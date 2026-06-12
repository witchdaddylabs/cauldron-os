/**
 * routes/workspace-preview.js
 * Route handlers for workspace preview.
 */

const fs = require("fs");
const path = require("path");
const { normaliseLimitOffset, sendMarkdownDownload } = require("./_helpers");

function registerWorkspacePreviewRoutes(app, deps) {
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

  app.use('/workspace-preview', (req, res, next) => {
    const parts = req.path.split('/').filter(Boolean);
    const sessionId = parts[0] || '';
    const sanitized = sessionId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!sanitized || sanitized !== sessionId) {
      return res.status(400).send('Invalid session ID');
    }
    const wsDir = workspace.workspaceDir(sanitized);
    if (!fs.existsSync(wsDir)) {
      return res.status(404).send('Workspace not found');
    }
    const baseReal = fs.realpathSync(wsDir);
    const relPath = '/' + parts.slice(1).join('/');
    if (relPath === '/' || relPath === '') {
      const indexPath = path.join(wsDir, 'index.html');
      let indexReal;
      try { indexReal = fs.realpathSync(indexPath); } catch { return res.status(404).send('No index.html found in workspace'); }
      if (indexReal !== baseReal && !indexReal.startsWith(baseReal + path.sep)) {
        return res.status(403).send('Forbidden');
      }
      if (!fs.statSync(indexReal).isFile()) return res.status(404).send('No index.html found in workspace');
      return res.sendFile(path.relative(baseReal, indexReal), { root: baseReal });
    }
    const candidate = path.resolve(wsDir, '.' + relPath); // '.' keeps it relative to wsDir
    let real;
    try { real = fs.realpathSync(candidate); } catch { return res.status(404).send('File not found'); }
    if (real !== baseReal && !real.startsWith(baseReal + path.sep)) {
      return res.status(403).send('Forbidden');
    }
    if (!fs.statSync(real).isFile()) return res.status(404).send('File not found');
    res.sendFile(path.relative(baseReal, real), { root: baseReal });
  });
}

module.exports = registerWorkspacePreviewRoutes;
