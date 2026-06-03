/**
 * routes/build-agents.js
 * Public interfaces:
 * - GET /api/build-agents: detect available BYOK build-agent CLIs.
 * - POST /api/build-agents/run: create a handoff package and optionally launch a detected CLI.
 */

const fs = require('fs');
const path = require('path');
const { createHandoffPackage, getAgentScope } = require('../lib/handoff-package');
const { detectBuildAgents, launchBuildAgent } = require('../lib/build-agents');

function uniqueAgentIds(agentIds = [], fallbackAgentId = 'handoff') {
  const raw = Array.isArray(agentIds) ? agentIds : [fallbackAgentId];
  const seen = new Set();
  return raw
    .map(id => String(id || '').trim())
    .filter(Boolean)
    .filter(id => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, 5);
}

function scopedProjectName(projectName, agent) {
  return `${projectName} — ${agent.name || agent.id}`;
}

function buildRootManifest({ safeName, projectName, cauldronVersion, projectType, templateId, designReference, sessionId, agents, packages }) {
  return {
    schemaVersion: 1,
    projectName: safeName,
    displayName: projectName,
    createdAt: new Date().toISOString(),
    source: 'cauldron-os',
    cauldronVersion,
    projectType,
    templateId,
    designReference: designReference || 'none',
    sessionId: sessionId || null,
    orchestration: {
      mode: 'multi-agent',
      agents: agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        available: agent.available,
        scope: getAgentScope(agent.id),
      })),
      packages: packages.map(pkg => ({
        agentId: pkg.agentId,
        agentName: pkg.agentName,
        mode: pkg.mode,
        relativePath: pkg.relativePath,
        manifestPath: pkg.manifestPath,
        command: pkg.command || null,
        error: pkg.error || null,
      })),
    },
  };
}

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
      agentIds = [],
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
      const selectedAgentIds = uniqueAgentIds(agentIds, agentId);
      const isMultiAgent = selectedAgentIds.length > 1;

      if (isMultiAgent) {
        fs.mkdirSync(path.join(projectPath, 'agents'), { recursive: true });
        const detectedAgents = detectBuildAgents();
        const selectedAgents = selectedAgentIds.map(id => (
          detectedAgents.find(agent => agent.id === id)
          || { id, name: id, available: false, command: null, launch: 'run-prompt', notes: `${id} not detected` }
        ));
        const orchestration = { mode: 'multi-agent', agents: selectedAgents };
        const agentResults = [];

        for (const agent of selectedAgents) {
          const relativePath = path.join('agents', agent.id);
          const agentProjectPath = path.join(projectPath, relativePath);
          const handoff = await createHandoffPackage({
            projectPath: agentProjectPath,
            projectName: scopedProjectName(projectName, agent),
            safeName: `${safeName}-${agent.id}`,
            cauldronVersion: PACKAGE_VERSION,
            blueprint,
            prototypeHtml,
            designReference,
            designSystemContent,
            templateId,
            projectType,
            sessionId,
            workspace,
            agentId: agent.id,
            agentScope: getAgentScope(agent.id),
            orchestration,
            bootstrap: Boolean(bootstrap),
          });

          const launch = launchBuildAgent({ agentId: agent.id, projectPath: agentProjectPath, dryRun });
          handoff.manifest.agent = {
            ...handoff.manifest.agent,
            mode: launch.mode,
            requestedCli: launch.agent.id === 'handoff' ? null : launch.agent.id,
            command: launch.command,
            scope: getAgentScope(agent.id),
          };
          fs.writeFileSync(handoff.manifestPath, JSON.stringify(handoff.manifest, null, 2) + '\n', 'utf8');

          agentResults.push({
            success: true,
            mode: launch.mode,
            agentId: launch.agent.id,
            agentName: launch.agent.name,
            scope: getAgentScope(agent.id),
            fallback: Boolean(launch.fallback),
            dryRun: Boolean(launch.dryRun),
            error: launch.error || null,
            pid: launch.pid || null,
            projectPath: agentProjectPath,
            relativePath,
            manifestPath: handoff.manifestPath,
            command: launch.command,
            logPath: launch.logPath || null,
            files: handoff.files,
            filesCopied: handoff.filesCopied,
            bootstrap: handoff.bootstrap || null,
          });
        }

        const rootManifest = buildRootManifest({
          safeName,
          projectName,
          cauldronVersion: PACKAGE_VERSION,
          projectType,
          templateId,
          designReference,
          sessionId,
          agents: selectedAgents,
          packages: agentResults,
        });
        const manifestPath = path.join(projectPath, 'cauldron.project.json');
        fs.writeFileSync(manifestPath, JSON.stringify(rootManifest, null, 2) + '\n', 'utf8');

        try {
          db.setProjectStatusOverride(safeName, 'needs_review', `Multi-agent handoff created for ${selectedAgents.length} agents`);
        } catch (statusErr) {
          console.warn('[Cauldron] Status override warning:', statusErr.message);
        }

        let draftId = null;
        try {
          const draft = db.createDraft({
            projectName: safeName,
            brainDump: sessionId ? `Multi-agent build session: ${sessionId}` : `Multi-agent handoff: ${selectedAgents.map(agent => agent.name).join(', ')}`,
            blueprint: blueprint || '',
            designReference: designReference || 'handoff',
            generationMode: 'multi-agent-handoff',
            modelUsed: selectedAgents.map(agent => agent.name).join(', '),
          });
          draftId = draft.id;
        } catch (recordErr) {
          console.warn('[Cauldron] Multi-agent record warning:', recordErr.message);
        }

        return res.json({
          success: true,
          mode: 'multi-agent',
          agentId: 'multi',
          agentName: 'Multi-agent handoff',
          fallback: agentResults.some(result => result.fallback),
          dryRun: Boolean(dryRun),
          projectPath,
          manifestPath,
          draftId,
          agentResults,
          agents: selectedAgents.map(agent => ({ id: agent.id, name: agent.name, available: agent.available, scope: getAgentScope(agent.id) })),
        });
      }

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
