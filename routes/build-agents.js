/**
 * routes/build-agents.js
 * Public interfaces:
 * - GET /api/build-agents: detect available BYOK build-agent CLIs.
 * - POST /api/build-agents/run: create a handoff package and optionally launch a detected CLI.
 */

const fs = require('fs');
const path = require('path');
const { createHandoffPackage } = require('../lib/handoff-package');
const { detectBuildAgents, launchBuildAgent } = require('../lib/build-agents');

function registerBuildAgentRoutes(app, deps) {
  const {
    db, workspace, ensureDesignSystem, safeProjectName, getProjectsDir,
    PACKAGE_VERSION,
  } = deps;

  app.get('/api/build-agents', (req, res) => {
    res.json({ success: true, agents: detectBuildAgents() });
  });

  app.post('/api/build-agents/run', async (req, res) => {
    const {
      projectName,
      agentId = 'handoff',
      blueprint = '',
      prototypeHtml = '',
      designReference = 'none',
      templateId = '',
      projectType = 'app',
      sessionId = '',
      dryRun = false,
      bootstrap = false,
    } = req.body || {};

    if (!projectName || (!blueprint && !sessionId)) {
      return res.status(400).json({ success: false, error: 'projectName and either blueprint or sessionId required' });
    }

    const safeName = safeProjectName(projectName);
    const projectPath = path.join(getProjectsDir(), safeName);

    if (fs.existsSync(projectPath)) {
      return res.status(409).json({ success: false, error: `Project "${safeName}" already exists` });
    }

    try {
      const designSystemContent = await ensureDesignSystem(designReference);
      const shouldBootstrap = Boolean(req.body.bootstrap);
      const handoff = await createHandoffPackage({
        projectPath,
        projectName,
        safeName,
        cauldronVersion: PACKAGE_VERSION,
        blueprint,
        prototypeHtml,
        designReference,
        designSystemContent,
        templateId,
        projectType,
        sessionId,
        workspace,
        agentId,
        bootstrap: shouldBootstrap,
      });

      const launch = launchBuildAgent({ agentId, projectPath, dryRun });
      if (launch.command) {
        handoff.manifest.agent = {
          mode: launch.mode,
          requestedCli: launch.agent.id,
          command: launch.command,
        };
        fs.writeFileSync(handoff.manifestPath, JSON.stringify(handoff.manifest, null, 2) + '\n', 'utf8');
      }

      try {
        db.setProjectStatusOverride(safeName, launch.launched ? 'building' : 'needs_review', launch.launched ? `Launched ${launch.agent.name}` : 'Handoff package created');
      } catch (statusErr) {
        console.warn('[Cauldron] Status override warning:', statusErr.message);
      }

      let draftId = null;
      try {
        const draft = db.createDraft({
          projectName: safeName,
          brainDump: sessionId ? `Build session: ${sessionId}` : '',
          blueprint: handoff.blueprint || '',
          designReference: designReference || 'handoff',
          generationMode: launch.launched ? `agent-${launch.agent.id}` : 'handoff',
          modelUsed: launch.agent?.name || 'handoff',
        });
        draftId = draft.id;
      } catch (recordErr) {
        console.warn('[Cauldron] Build agent record warning:', recordErr.message);
      }

      res.json({
        success: true,
        mode: launch.mode,
        agentId: launch.agent.id,
        agentName: launch.agent.name,
        fallback: Boolean(launch.fallback),
        dryRun: Boolean(launch.dryRun),
        error: launch.error || null,
        pid: launch.pid || null,
        projectPath,
        manifestPath: handoff.manifestPath,
        command: launch.command,
        logPath: launch.logPath || null,
        draftId,
        files: handoff.files,
        filesCopied: handoff.filesCopied,
        bootstrap: handoff.bootstrap || null,
      });
    } catch (err) {
      console.error('[Cauldron] Build agent run error:', err);
      res.status(500).json({ success: false, error: 'Build agent handoff failed', details: err.message });
    }
  });
}

module.exports = registerBuildAgentRoutes;
