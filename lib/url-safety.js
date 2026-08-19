const dns = require('dns').promises;
const net = require('net');

const METADATA_HOSTS = new Set([
  'metadata.google.internal',
  'metadata.goog',
  'kubernetes.default.svc',
]);

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, octet) => ((acc << 8) + Number(octet)) >>> 0, 0);
}

function unwrapMappedIpv4(ip) {
  const value = String(ip || '').toLowerCase();
  if (value.startsWith('::ffff:')) return value.slice(7);
  return value;
}

function isLoopbackIp(ip) {
  const value = unwrapMappedIpv4(ip);
  const version = net.isIP(value);
  if (version === 4) {
    const n = ipv4ToInt(value);
    return n >= 0x7f000000 && n <= 0x7fffffff;
  }
  if (version === 6) return value === '::1';
  return false;
}

function isLinkLocalOrMetadataIp(ip) {
  const value = unwrapMappedIpv4(ip);
  const version = net.isIP(value);
  if (version === 4) {
    const n = ipv4ToInt(value);
    return n >= 0xa9fe0000 && n <= 0xa9feffff;
  }
  if (version === 6) return value === '::' || value.startsWith('fe80:');
  return false;
}

function isPrivateOrReservedIp(ip) {
  const value = unwrapMappedIpv4(ip);
  if (isLoopbackIp(value) || isLinkLocalOrMetadataIp(value)) return true;
  const version = net.isIP(value);
  if (version === 4) {
    const n = ipv4ToInt(value);
    if (n <= 0x00ffffff) return true; // 0.0.0.0/8
    if (n >= 0x0a000000 && n <= 0x0affffff) return true; // 10.0.0.0/8
    if (n >= 0x64400000 && n <= 0x647fffff) return true; // 100.64.0.0/10
    if (n >= 0xac100000 && n <= 0xac1fffff) return true; // 172.16.0.0/12
    if (n >= 0xc0000000 && n <= 0xc00000ff) return true; // 192.0.0.0/24
    if (n >= 0xc0a80000 && n <= 0xc0a8ffff) return true; // 192.168.0.0/16
    if (n >= 0xe0000000) return true; // multicast / reserved
    return false;
  }
  if (version === 6) {
    if (value.startsWith('fc') || value.startsWith('fd')) return true;
    if (value.startsWith('ff')) return true;
    return false;
  }
  return true;
}

function normalizeHostname(hostname) {
  const host = String(hostname || '')
    .toLowerCase()
    .replace(/\.$/, '');
  if (host.startsWith('[') && host.endsWith(']')) return host.slice(1, -1);
  return host;
}

function isLoopbackHostname(hostname) {
  const host = normalizeHostname(hostname);
  return host === 'localhost' || host.endsWith('.localhost') || isLoopbackIp(host);
}

function isMetadataHostname(hostname) {
  const host = normalizeHostname(hostname);
  return METADATA_HOSTS.has(host) || host.endsWith('.internal');
}

function createPinnedLookup(address, family) {
  const ipFamily = Number(family) === 6 ? 6 : 4;
  const record = { address, family: ipFamily };
  return (hostname, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    if (options && options.all) {
      callback(null, [record]);
      return;
    }
    callback(null, record.address, record.family);
  };
}

function validateHttpUrl(targetUrl) {
  let parsed;
  try {
    parsed = new URL(String(targetUrl || ''));
  } catch {
    throw new Error('Invalid URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http/https URLs are supported');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Research URLs must not include credentials');
  }
  return parsed;
}

function resolveRedirectUrl(currentUrl, location) {
  if (!location) throw new Error('Invalid redirect');
  return new URL(location, currentUrl).toString();
}

async function assertSafeResearchUrl(targetUrl, options = {}) {
  const parsed = validateHttpUrl(targetUrl);
  const hostname = normalizeHostname(parsed.hostname);
  const allowPrivate = Boolean(
    options.allowPrivate || process.env.CAULDRON_ALLOW_PRIVATE_RESEARCH === '1'
  );

  if (isMetadataHostname(hostname)) {
    throw new Error('Research URL host is not allowed');
  }

  const resolved = net.isIP(hostname)
    ? [{ address: hostname, family: net.isIP(hostname) }]
    : await dns.lookup(hostname, { all: true });

  if (!resolved.length) {
    throw new Error('Research URL host could not be resolved');
  }

  const hostnameIsLoopback = Boolean(net.isIP(hostname))
    ? isLoopbackIp(hostname)
    : isLoopbackHostname(hostname);

  for (const entry of resolved) {
    const address = entry.address;
    if (isLinkLocalOrMetadataIp(address)) {
      throw new Error('Research URL host is not allowed');
    }
    if (isLoopbackIp(address)) {
      if (hostnameIsLoopback) continue;
      throw new Error('Research URL host resolved to a loopback address');
    }
    if (isPrivateOrReservedIp(address) && !allowPrivate) {
      throw new Error('Research URL must not target private or reserved networks');
    }
  }

  const pinned = resolved.find((entry) => entry.family === 4) || resolved[0];
  return {
    parsed,
    hostname,
    address: pinned.address,
    family: pinned.family,
  };
}

function assertHttpOrHttpsUrl(rawUrl, label = 'URL') {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || ''));
  } catch {
    throw new Error(`Invalid ${label}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${label} must be http or https`);
  }
  return parsed;
}

module.exports = {
  validateHttpUrl,
  resolveRedirectUrl,
  assertSafeResearchUrl,
  assertHttpOrHttpsUrl,
  createPinnedLookup,
  normalizeHostname,
  isLoopbackIp,
  isPrivateOrReservedIp,
  isLinkLocalOrMetadataIp,
  isMetadataHostname,
};
