/**
 * routes/build.js
 * Public interfaces:
 * - POST /api/build/start: create an isolated build workspace.
 * - POST /api/build/generate: SSE XML-tool build execution.
 * - POST /api/build/refine: SSE continuation for an existing workspace.
 * - POST /api/build/stop: abort active build execution.
 * - GET /api/build/files/:sessionId: list workspace files.
 * - GET /api/build/file/:sessionId: read a workspace file by query path.
 * - GET /api/build/status/:sessionId: inspect build session state.
 */


function registerBuildRoutes(app, deps) {
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
    buildSystemPrompt, _runCloudAgentBuild, generateWithTools,
  } = deps;

  app.post('/api/build/start', async (req, res) => {
    try {
      const { prompt, model, sessionId, designReference, templateId, projectType } = req.body;
      const sid = sessionId || db.generateSessionId();
      const wsDir = await workspace.ensureWorkspace(sid);

      buildSessions.set(sid, {
        sessionId: sid,
        prompt: prompt || '',
        model: model || 'llama3.2',
        designReference: designReference || 'none',
        templateId: templateId || '',
        projectType: projectType || 'app',
        workspaceDir: wsDir,
        startedAt: new Date().toISOString(),
        actions: [],
        files: [],
        status: 'initialized',
      });

      res.json({ success: true, sessionId: sid, workspaceDir: wsDir });
    } catch (err) {
      console.error('[Build] Start error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/build/generate', async (req, res) => {
    const { prompt, model, sessionId, systemPrompt, apiKey, cloudModel } = req.body;
    const sid = sessionId;

    if (!sid) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const startTime = Date.now();
    const isCloud = ['openai', 'gemini'].includes(model);
    const controller = new AbortController();
    activeBuildControllers.set(sid, controller);

    try {
      await workspace.ensureWorkspace(sid);
      const sysPrompt = systemPrompt || await buildSystemPrompt({ sessionId: sid });

      const sendEvent = (event, data) => {
        if (!controller.signal.aborted) {
          try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch (e) {}
        }
      };

      let finalFiles = [];
      let finalActions = [];
      let finalMessages = [];

      if (isCloud) {
        if (!apiKey) {
          sendEvent('error', { message: `API key required for ${model}` });
          return res.end();
        }
        const result = await _runCloudAgentBuild({
          prompt, model, apiKey, systemPrompt: sysPrompt, sessionId: sid,
          onToken: (text) => sendEvent('token', { text }),
          signal: controller.signal, cloudModel,
        });
        finalFiles = result.files || [];
        finalActions = result.actions || [];
        finalMessages = result.messages || [];
        for (const action of finalActions) {
          sendEvent('action', { tool: action.name, path: action.args?.path, status: 'start' });
          sendEvent('result', { tool: action.name, path: action.args?.path, status: 'complete', output: action.result });
          if (action.args && action.args.path && ['write_file', 'edit_file', 'delete_file'].includes(action.name)) {
            sendEvent('filechange', { path: action.args.path });
          }
        }
      } else {
        const agentGen = generateWithTools({
          prompt, model, systemPrompt: sysPrompt, sessionId: sid,
          onStream: (chunk) => { if (chunk && chunk.token) sendEvent('token', { text: chunk.token }); },
          onAction: ({ action, args, result }) => {
            sendEvent('action', { tool: action, path: args?.path, status: 'start' });
            sendEvent('result', { tool: action, path: args?.path, status: 'complete', output: result });
          },
          onFileChange: ({ action, path }) => { sendEvent('filechange', { path }); },
        });
        for await (const chunk of agentGen) {
          if (controller.signal.aborted) break;
          if (chunk.done) {
            finalFiles = chunk.files || [];
            finalActions = chunk.actions || [];
            finalMessages = chunk.messages || [];
          }
        }
      }

      if (!controller.signal.aborted) {
        const duration = Date.now() - startTime;
        buildSessions.set(sid, {
          ...(buildSessions.get(sid) || {}),
          sessionId: sid, status: 'completed', completedAt: new Date().toISOString(),
          files: finalFiles, actions: finalActions, duration,
        });

        let draftId = null;
        try {
          const draftRecord = db.createDraft({
            projectName: `build-${sid.slice(0, 8)}`,
            brainDump: prompt,
            blueprint: JSON.stringify({ files: finalFiles, actions: finalActions }),
            designReference: 'build', generationMode: 'build', modelUsed: model,
          });
          draftId = draftRecord.id;
        } catch (e) { console.warn('[Build] Draft save warning:', e.message); }

        sendEvent('done', { files: finalFiles, actions: finalActions, duration, draftId });
      }
      res.end();
    } catch (err) {
      console.error('[Build] Generate error:', err);
      try {
        res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
        res.end();
      } catch (e) {}
    } finally {
      activeBuildControllers.delete(sid);
    }
  });

  app.post('/api/build/refine', async (req, res) => {
    const { prompt, sessionId, systemPrompt, model, apiKey, cloudModel } = req.body;
    const sid = sessionId;

    if (!sid) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const startTime = Date.now();
    const isCloud = ['openai', 'gemini'].includes(model);
    const controller = new AbortController();
    activeBuildControllers.set(sid, controller);

    try {
      await workspace.ensureWorkspace(sid);
      const sysPrompt = systemPrompt || await buildSystemPrompt({ sessionId: sid });

      const sendEvent = (event, data) => {
        if (!controller.signal.aborted) {
          try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch (e) {}
        }
      };

      let finalFiles = [];
      let finalActions = [];
      let finalMessages = [];

      if (isCloud) {
        if (!apiKey) {
          sendEvent('error', { message: `API key required for ${model}` });
          return res.end();
        }
        const result = await _runCloudAgentBuild({
          prompt, model, apiKey, systemPrompt: sysPrompt, sessionId: sid,
          onToken: (text) => sendEvent('token', { text }),
          signal: controller.signal, cloudModel,
        });
        finalFiles = result.files || [];
        finalActions = result.actions || [];
        finalMessages = result.messages || [];
        for (const action of finalActions) {
          sendEvent('action', { tool: action.name, path: action.args?.path, status: 'start' });
          sendEvent('result', { tool: action.name, path: action.args?.path, status: 'complete', output: action.result });
          if (action.args && action.args.path && ['write_file', 'edit_file', 'delete_file'].includes(action.name)) {
            sendEvent('filechange', { path: action.args.path });
          }
        }
      } else {
        const agentGen = generateWithTools({
          prompt, model: model || 'llama3.2', systemPrompt: sysPrompt, sessionId: sid,
          onStream: (chunk) => { if (chunk && chunk.token) sendEvent('token', { text: chunk.token }); },
          onAction: ({ action, args, result }) => {
            sendEvent('action', { tool: action, path: args?.path, status: 'start' });
            sendEvent('result', { tool: action, path: args?.path, status: 'complete', output: result });
          },
          onFileChange: ({ action, path }) => { sendEvent('filechange', { path }); },
        });
        for await (const chunk of agentGen) {
          if (controller.signal.aborted) break;
          if (chunk.done) {
            finalFiles = chunk.files || [];
            finalActions = chunk.actions || [];
            finalMessages = chunk.messages || [];
          }
        }
      }

      if (!controller.signal.aborted) {
        const duration = Date.now() - startTime;
        const existingSession = buildSessions.get(sid) || {};
        const mergedFiles = [...new Set([...(existingSession.files || []), ...finalFiles])];
        const mergedActions = [...(existingSession.actions || []), ...finalActions];
        buildSessions.set(sid, {
          ...existingSession, status: 'refined', completedAt: new Date().toISOString(),
          files: mergedFiles, actions: mergedActions, duration: (existingSession.duration || 0) + duration,
        });
        sendEvent('done', { files: mergedFiles, actions: mergedActions, duration });
      }
      res.end();
    } catch (err) {
      console.error('[Build] Refine error:', err);
      try {
        res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
        res.end();
      } catch (e) {}
    } finally {
      activeBuildControllers.delete(sid);
    }
  });

  app.post('/api/build/stop', (req, res) => {
    try {
      const { sessionId } = req.body;
      if (!sessionId) {
        return res.status(400).json({ success: false, error: 'sessionId required' });
      }
      const controller = activeBuildControllers.get(sessionId);
      if (controller) {
        controller.abort();
        activeBuildControllers.delete(sessionId);
      }
      const session = buildSessions.get(sessionId);
      if (session) session.status = 'stopped';
      res.json({ success: true });
    } catch (err) {
      console.error('[Build] Stop error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/build/files/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const sanitized = sessionId.replace(/[^a-zA-Z0-9_-]/g, '');
      if (!sanitized) return res.status(400).json({ success: false, error: 'Invalid sessionId' });
      const files = await workspace.wsListFiles(sanitized);
      res.json({ success: true, files });
    } catch (err) {
      console.error('[Build] List files error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/build/file/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const filePath = req.query.path;
      if (!filePath) return res.status(400).json({ success: false, error: 'path query parameter required' });
      const sanitized = sessionId.replace(/[^a-zA-Z0-9_-]/g, '');
      if (!sanitized) return res.status(400).json({ success: false, error: 'Invalid sessionId' });
      const content = await workspace.wsReadFile(sanitized, filePath);
      res.json({ success: true, content });
    } catch (err) {
      if (err.code === 'ENOENT') return res.status(404).json({ success: false, error: 'File not found' });
      console.error('[Build] Read file error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/build/status/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const sanitized = sessionId.replace(/[^a-zA-Z0-9_-]/g, '');
      if (!sanitized) return res.status(400).json({ success: false, error: 'Invalid sessionId' });
      const files = await workspace.wsListFiles(sanitized);
      const fileCount = files.filter(f => f.type === 'file').length;
      const totalSize = files.filter(f => f.type === 'file').reduce((sum, f) => sum + f.size, 0);
      const sessionData = buildSessions.get(sanitized) || {};
      res.json({
        success: true,
        status: {
          sessionId: sanitized, fileCount, totalSize,
          lastAction: sessionData.actions ? sessionData.actions[sessionData.actions.length - 1] || null : null,
          duration: sessionData.duration || null, status: sessionData.status || 'unknown',
          startedAt: sessionData.startedAt || null, completedAt: sessionData.completedAt || null,
          files,
        },
      });
    } catch (err) {
      console.error('[Build] Status error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
}

module.exports = registerBuildRoutes;
