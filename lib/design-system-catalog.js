const fs = require('fs');
const https = require('https');
const path = require('path');

function titleFromSlug(slug) {
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map(part => {
      const lower = part.toLowerCase();
      if (['ai', 'ui', 'ux', 'bmw', 'ibm', 'nasa', 'x'].includes(lower)) return lower.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function normaliseSystemId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractDesignSystemName(content, fallbackSlug) {
  const text = String(content || '');
  const frontmatter = text.match(/^---\s*([\s\S]*?)\s*---/);
  if (frontmatter) {
    const name = frontmatter[1].match(/^name:\s*(.+)$/im);
    if (name?.[1]) return name[1].trim().replace(/^["']|["']$/g, '');
  }

  const heading = text.match(/^#\s+(.+)$/m);
  if (heading?.[1]) {
    return heading[1].trim().replace(/\s+design\s+system$/i, '');
  }

  return titleFromSlug(fallbackSlug);
}

function discoverLocalDesignSystems({ rootDir, catalogPath = 'design-systems/catalog.json' }) {
  const fullCatalogPath = path.join(rootDir, catalogPath);
  if (fs.existsSync(fullCatalogPath)) {
    const parsed = JSON.parse(fs.readFileSync(fullCatalogPath, 'utf8'));
    if (Array.isArray(parsed.systems)) {
      return parsed.systems
        .map(system => ({
          id: normaliseSystemId(system.id),
          name: system.name || titleFromSlug(system.id),
          repo: null,
          path: system.path || `design-systems/${system.id}/DESIGN.md`,
          source: system.source || 'local',
          origin: system.origin || parsed.source || 'local-catalog',
        }))
        .filter(system => system.id && system.path);
    }
  }

  const designSystemsDir = path.join(rootDir, 'design-systems');
  if (!fs.existsSync(designSystemsDir)) return [];

  return fs.readdirSync(designSystemsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))
    .map(entry => {
      const designPath = path.join(designSystemsDir, entry.name, 'DESIGN.md');
      if (!fs.existsSync(designPath)) return null;
      const content = fs.readFileSync(designPath, 'utf8');
      const id = normaliseSystemId(entry.name);
      return {
        id,
        name: extractDesignSystemName(content, id),
        repo: null,
        path: `design-systems/${entry.name}/DESIGN.md`,
        source: 'local',
        origin: 'local-discovery',
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function createDesignSystems({ rootDir, legacySystems = {}, referoStyles = {} }) {
  const systems = {};
  systems.none = legacySystems.none || { name: 'None', repo: null, path: null };

  for (const local of discoverLocalDesignSystems({ rootDir })) {
    systems[local.id] = {
      name: local.name,
      repo: null,
      path: local.path,
      source: local.source,
      origin: local.origin,
    };
  }

  for (const [id, legacy] of Object.entries(legacySystems)) {
    if (id === 'none') continue;
    if (systems[id]) {
      systems[id] = {
        ...systems[id],
        name: legacy.name || systems[id].name,
        promptGuidance: legacy.promptGuidance || systems[id].promptGuidance,
        legacyRepo: legacy.repo || null,
      };
    } else {
      systems[id] = legacy;
    }
  }

  for (const [id, val] of Object.entries(referoStyles)) {
    systems[id] = {
      name: val.name,
      __refero: true,
      uuid: val.uuid,
      promptGuidance: val.promptGuidance,
      colors: val.colors,
      fonts: val.fonts,
      scheme: val.scheme,
    };
  }

  return systems;
}

function fetchRemoteDesignSystem(remoteBaseUrl, repo, callback) {
  const url = `${remoteBaseUrl}/${repo}/DESIGN.md`;

  https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      if (res.statusCode === 200) {
        callback(null, data);
      } else {
        callback(new Error(`HTTP ${res.statusCode}`), null);
      }
    });
  }).on('error', callback);
}

function createDesignSystemService({ rootDir, systems, remoteBaseUrl }) {
  const cache = new Map();

  function fetchDesignSystem(systemOrRepo, callback) {
    const system = systems[systemOrRepo];

    if (system?.path) {
      const filePath = path.join(rootDir, system.path);
      fs.readFile(filePath, 'utf8', (err, content) => {
        if (err && system.legacyRepo) {
          return fetchRemoteDesignSystem(remoteBaseUrl, system.legacyRepo, callback);
        }
        callback(err, content);
      });
      return;
    }

    const repo = system?.repo || systemOrRepo;
    if (!repo) return callback(new Error('No design system repo or local path'), null);
    fetchRemoteDesignSystem(remoteBaseUrl, repo, callback);
  }

  function ensureDesignSystem(systemId) {
    if (!systemId || systemId === 'none' || !systems[systemId]) return Promise.resolve('');
    if (cache.has(systemId)) return Promise.resolve(cache.get(systemId));

    const system = systems[systemId];
    if (system.__refero && system.promptGuidance) {
      const content = [
        `# ${system.name}`,
        '',
        system.promptGuidance,
        '',
        Array.isArray(system.colors) && system.colors.length ? `Colors: ${system.colors.join(', ')}` : '',
        Array.isArray(system.fonts) && system.fonts.length ? `Fonts: ${system.fonts.join(', ')}` : '',
      ].filter(Boolean).join('\n');
      cache.set(systemId, content);
      return Promise.resolve(content);
    }

    return new Promise((resolve) => {
      fetchDesignSystem(systemId, (err, content) => {
        if (err) {
          console.warn(`[Cauldron] Design reference ${systemId} unavailable:`, err.message);
          return resolve('');
        }
        cache.set(systemId, content);
        resolve(content);
      });
    });
  }

  return { cache, fetchDesignSystem, ensureDesignSystem };
}

module.exports = {
  createDesignSystems,
  createDesignSystemService,
  discoverLocalDesignSystems,
  extractDesignSystemName,
  normaliseSystemId,
  titleFromSlug,
};
