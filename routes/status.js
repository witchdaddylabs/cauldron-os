/**
 * routes/status.js
 * Public interfaces:
 * - GET /api/health: service health response.
 */


const { normaliseLimitOffset, sendMarkdownDownload } = require("./_helpers");

function registerStatusRoutes(app, deps) {
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
  } = deps;

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Cauldron OS v0.30' });
  });
}

module.exports = registerStatusRoutes;
