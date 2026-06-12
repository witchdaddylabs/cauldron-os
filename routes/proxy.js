/**
 * routes/proxy.js
 * Route handlers for proxy.
 */


function registerProxyRoutes(app, deps) {
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
    inferProviderFromModel,
    GEMINI_BASE_URL, normaliseOpenAICompatibleChatUrl, buildChatPayload,
  } = deps;

  app.post('/api/chat/completions', async (req, res) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS);
    try {
      const { model, messages = [], temperature = 0.55, stream = false, base_url: baseUrl = '', provider: explicitProvider = '' } = req.body || {};
      if (!model) return res.status(400).json({ error: { message: 'model is required' } });
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: { message: 'messages array is required' } });
      }

      const authHeader = req.headers.authorization || '';
      const apiKey = authHeader.replace(/^Bearer\s+/i, '') || req.body.apiKey || '';
      if (!apiKey) return res.status(401).json({ error: { message: 'Bearer API key required' } });

      const provider = explicitProvider || inferProviderFromModel(model);
      if (!['gemini', 'openai'].includes(provider)) {
        return res.status(501).json({ error: { message: `${provider} routing is not implemented yet` } });
      }

      const targetUrl = provider === 'gemini' ? GEMINI_BASE_URL : normaliseOpenAICompatibleChatUrl(baseUrl);
      const upstream = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify(buildChatPayload({ model, messages, temperature, stream })),
      });

      const text = await upstream.text();
      res.status(upstream.status);
      res.type(upstream.headers.get('content-type') || 'application/json');
      res.send(text);
    } catch (err) {
      const status = err.name === 'AbortError' ? 504 : 500;
      res.status(status).json({ error: { message: 'Chat completion proxy failed', details: err.message } });
    } finally {
      clearTimeout(timeout);
    }
  });
}

module.exports = registerProxyRoutes;
