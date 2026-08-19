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

function isLoopbackHostname(hostname) {
  const host = String(hostname || '')
    .toLowerCase()
    .replace(/\.$/, '');
  return host === 'localhost' || host.endsWith('.localhost') || host === '::1';
}

function isMetadataHostname(hostname) {
  const host = String(hostname || '')
    .toLowerCase()
    .replace(/\.$/, '');
  return METADATA_HOSTS.has(host) || host.endsWith('.internal');
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
  const hostname = parsed.hostname;
  const allowPrivate = Boolean(
    options.allowPrivate || process.env.CAULDRON_ALLOW_PRIVATE_RESEARCH === '1'
  );

  if (isMetadataHostname(hostname)) {
    throw new Error('Research URL host is not allowed');
  }

  const addresses = net.isIP(hostname)
    ? [hostname]
    : (await dns.lookup(hostname, { all: true })).map((entry) => entry.address);

  if (!addresses.length) {
    throw new Error('Research URL host could not be resolved');
  }

  const hostnameIsLoopback = Boolean(net.isIP(hostname))
    ? isLoopbackIp(hostname)
    : isLoopbackHostname(hostname);

  for (const address of addresses) {
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

  return parsed;
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
  isLoopbackIp,
  isPrivateOrReservedIp,
  isLinkLocalOrMetadataIp,
  isMetadataHostname,
};
