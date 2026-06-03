/**
 * routes/models-design.js
 * Public interfaces:
 * - GET /api/cloud-models: supported cloud model catalog.
 * - GET /api/ollama-models: local Ollama model detection.
 * - GET /api/design-systems: selectable design-system list.
 * - POST /api/design-reference: fetch/cache design reference markdown.
 * - GET /api/refero-search: cached Refero style proxy.
 */

const { normaliseLimitOffset, sendMarkdownDownload } = require("./_helpers");

// ─── Refero Deep Search cache ────────────────────────────────────────────────
const REFERO_API_URL = 'https://styles.refero.design/api/styles';
const REFERO_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let referoCache = { timestamp: 0, data: [] };

function registerModelsDesignRoutes(app, deps) {
  const {
    db, TEMPLATES, DESIGN_SYSTEMS, workspace, designSystemCache,
    getSystemPrompt, getTemplate, formatTemplateForPrompt, ensureDesignSystem,
    CLARIFY_SYSTEM_PROMPT, CLARIFY_NUM_PREDICT, BLUEPRINT_NUM_PREDICT,
    OLLAMA_BASE_URL, OLLAMA_TAGS_URL, CLOUD_TIMEOUT_MS,
    activeBuildControllers, buildSessions,
    safeProjectName, getProjectPath, buildResumePrompt, buildOpencodeArgs,
    commandPreview, listImportableProjects, getBuildStatus,
    callOllamaModel, callCloudModel, getCloudModelName,
    extractJsonObject, normaliseClarifyResult,
    scrapeURLFast, scrapeRenderedURL, formatResearchForPrompt,
    inferProviderFromModel, CLOUD_MODELS,
  } = deps;

  app.get('/api/cloud-models', (req, res) => {
    res.json({ success: true, providers: CLOUD_MODELS });
  });

  app.get('/api/ollama-models', async (req, res) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(OLLAMA_TAGS_URL, { signal: controller.signal });
      if (!response.ok) throw new Error(`Ollama ${response.status}`);
      const data = await response.json();
      const models = Array.isArray(data.models)
        ? data.models.map(model => ({
            name: model.name,
            label: model.name,
            size: model.size || null,
            modifiedAt: model.modified_at || null,
          })).filter(model => model.name)
        : [];
      res.json({ success: true, baseUrl: OLLAMA_BASE_URL, models });
    } catch (err) {
      res.status(503).json({ success: false, baseUrl: OLLAMA_BASE_URL, models: [], error: 'Unable to detect Ollama models', details: err.message });
    } finally {
      clearTimeout(timeout);
    }
  });

  app.get('/api/design-systems', (req, res) => {
    const list = Object.entries(DESIGN_SYSTEMS)
      .filter(([key]) => key !== 'none')
      .map(([key, val]) => ({ id: key, name: val.name, source: val.source || (val.__refero ? 'refero' : 'remote') }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json({ systems: list });
  });

  app.post('/api/design-reference', async (req, res) => {
    const { system } = req.body;
  
    if (!system || !DESIGN_SYSTEMS[system]) {
      return res.status(400).json({ error: 'Invalid design system' });
    }
  
    if (designSystemCache.has(system)) {
      return res.json({ cached: true, system });
    }
  
    const content = await ensureDesignSystem(system);
    res.json({ cached: false, system, content });
  });

  /**
   * GET /api/refero-search?q=<query>
   * Proxies to the Refero API, caches results for 5 minutes, and returns
   * matching styles by siteName (case-insensitive substring match).
   */
  app.get('/api/refero-search', async (req, res) => {
    const query = (req.query.q || '').trim();
    const now = Date.now();

    try {
      // Fetch from Refero API if cache is stale or empty
      if (now - referoCache.timestamp > REFERO_CACHE_TTL_MS || referoCache.data.length === 0) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
          const response = await fetch(REFERO_API_URL, { signal: controller.signal });
          if (!response.ok) throw new Error(`Refero API returned ${response.status}`);
          const json = await response.json();
          const styles = Array.isArray(json.styles) ? json.styles : [];
          // Only cache non-empty results — prevents a transient failure from
          // poisoning the cache for the next 5 minutes
          if (styles.length > 0) {
            referoCache = { timestamp: now, data: styles };
          }
        } finally {
          clearTimeout(timeout);
        }
      }

      const allStyles = referoCache.data;

      // If no query, return empty results (the hardcoded list is the fallback)
      if (!query) {
        return res.json({ results: [] });
      }

      const lowerQuery = query.toLowerCase();
      const results = allStyles
        .filter(s => s.siteName && s.siteName.toLowerCase().includes(lowerQuery))
        .map(s => ({
          id: s.id,
          siteName: s.siteName,
          screenshotUrl: s.screenshotUrl || null,
          thumbnailUrl: s.thumbnailUrl || null,
          colors: Array.isArray(s.colors) ? s.colors.map(c => c.hex || c) : [],
          colorScheme: s.colorScheme || 'unknown',
          url: s.url || null,
        }));

      res.json({ results });
    } catch (err) {
      console.error('[Refero Search] Error:', err.message);
      res.status(502).json({ error: 'Failed to search Refero styles', details: err.message });
    }
  });
}

module.exports = registerModelsDesignRoutes;
