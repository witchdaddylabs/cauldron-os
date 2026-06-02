/**
 * routes/generation.js
 * Route handlers for generation.
 */

const fs = require("fs");
const path = require("path");
const { normaliseLimitOffset, sendMarkdownDownload } = require("./_helpers");

function registerGenerationRoutes(app, deps) {
  const {
    db, TEMPLATES, DESIGN_SYSTEMS, workspace, designSystemCache,
    getSystemPrompt, getTemplate, formatTemplateForPrompt, ensureDesignSystem,
    CLARIFY_SYSTEM_PROMPT, CLARIFY_NUM_PREDICT, BLUEPRINT_NUM_PREDICT,
    OLLAMA_BASE_URL, OLLAMA_TAGS_URL, CLOUD_TIMEOUT_MS,
    activeBuildControllers, buildSessions,
    safeProjectName, getProjectPath, getProjectsDir, buildResumePrompt, buildOpencodeArgs,
    commandPreview, listImportableProjects, getBuildStatus,
    callOllamaModel, callCloudModel, getCloudModelName,
    extractJsonObject, normaliseClarifyResult,
    scrapeURLFast, scrapeRenderedURL, formatResearchForPrompt,
    inferProviderFromModel, rootDir,
  } = deps;

  app.post('/api/research-url', async (req, res) => {
    const { url, projectName = '', brainDump = '', mode = 'fast' } = req.body;
  
    if (!url) {
      return res.status(400).json({ error: 'URL required' });
    }

    const persistAndRespond = (findings) => {
      const formatted = formatResearchForPrompt(findings);
      let researchRecord = null;
      try {
        researchRecord = db.upsertResearchRecord({
          url: findings.url || url,
          source: findings.mode === 'deep' ? 'playwright-deep' : 'url-sweep',
          projectName,
          brainDump,
          findings,
          formatted,
        });
      } catch (recordErr) {
        console.warn('[Cauldron] Research history warning:', recordErr.message);
      }
      res.json({ success: true, findings, formatted, researchId: researchRecord?.id || null, reuseCount: researchRecord?.reuse_count || null });
    };

    if (mode === 'deep') {
      try {
        const findings = await scrapeRenderedURL(url);
        return persistAndRespond(findings);
      } catch (err) {
        console.error('Deep research failed:', err);
        return res.status(500).json({ error: `Deep research failed: ${err.message}` });
      }
    }
  
    try {
        const findings = await scrapeURLFast(url);
        return persistAndRespond(findings);
      } catch (err) {
        console.error('Research failed:', err);
        return res.status(500).json({ error: `Research failed: ${err.message}` });
      }
  });

  app.post('/api/clarify', async (req, res) => {
    try {
      const { prompt, model, projectType = 'app', apiKey = '', cloudModel = '' } = req.body;
      if (!prompt || !prompt.trim()) {
        return res.status(400).json({ error: 'Prompt required' });
      }

      const clarifyPrompt = `Project type: ${projectType}\n\nBrain dump:\n${prompt}\n\nAsk the project-manager questions needed before generating a build blueprint.`;
      let rawText = '';

      if (['openai', 'gemini'].includes(model)) {
        if (!apiKey) {
          return res.status(400).json({ error: 'Missing API key', details: `No API key was provided for ${model}.` });
        }
        rawText = await callCloudModel({
          provider: model,
          apiKey,
          prompt: clarifyPrompt,
          systemPrompt: CLARIFY_SYSTEM_PROMPT,
          projectType,
          requestedModel: cloudModel,
        });
      } else {
        rawText = await callOllamaModel({
          model,
          prompt: clarifyPrompt,
          systemPrompt: CLARIFY_SYSTEM_PROMPT,
          numPredict: CLARIFY_NUM_PREDICT,
          temperature: 0.35,
        });
      }

      const questions = normaliseClarifyResult(extractJsonObject(rawText));
      res.json({ success: true, ...questions });
    } catch (err) {
      console.error('Clarify error:', err);
      res.status(500).json({ error: 'Clarification failed', details: err.message });
    }
  });

  app.post('/api/generate', async (req, res) => {
    const STAGES = [
      { label: 'Researching design references...' },
      { label: 'Generating Blueprint...' },
      { label: 'Assembling output...' },
      { label: 'Rendering preview...' },
    ];

    function emitProgress(step, total, label, status, duration) {
      res.write(JSON.stringify({ type: 'progress', step, total, label, status, duration }) + '\n');
    }

    const startTime = Date.now();
    let modelUsed = '';
    let providerUsed = '';

    try {
      const { prompt, model, projectType = 'app', apiKey = '', designReference = 'none', researchData = null, cloudModel = '', researchUrl = '', templateId = '' } = req.body;

      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // ── Stage 1: Research ──
      const t1 = Date.now();
      emitProgress(1, 4, STAGES[0].label, 'active');
      const designSystemContent = await ensureDesignSystem(designReference);
      let systemPrompt = getSystemPrompt(projectType, designReference);

      // Inject actual design system content if fetched
      if (designSystemContent && designSystemContent.trim()) {
        const truncated = designSystemContent.length > 16000
          ? designSystemContent.slice(0, 16000) + '\n\n[Design system content truncated — showing first 16k chars]'
          : designSystemContent;
        systemPrompt += `\n\n## Target Design System Content\n${truncated}\n\nUse the above design system as the primary visual language. The user selected this reference — it takes priority over generic taste mandates.`;
      }

      // Inject template guidance if specified
      if (templateId) {
        const template = getTemplate(templateId);
        if (template) {
          systemPrompt += `\n\n${formatTemplateForPrompt(template)}`;
        }
      }

      // Inject dedicated research URL
      if (researchUrl) {
        systemPrompt += `\n\n## User-provided research URL\n${researchUrl}\nUse this as a visual/reference target when relevant.`;
      }

      // Inject research findings if provided
      if (researchData && researchData.formatted) {
        systemPrompt += `\n\n${researchData.formatted}\n\nUse these design signals to match the visual language and structure.`;
      }

      emitProgress(1, 4, STAGES[0].label, 'complete', +(Date.now() - t1).toFixed(0) / 1000);

      if (!prompt) {
        emitProgress(2, 4, 'Validation', 'error');
        res.write(JSON.stringify({ type: 'error', step: 2, label: 'Validation', message: 'Prompt required' }) + '\n');
        return res.end();
      }

      // ── Stage 2: Generation ──
      emitProgress(2, 4, STAGES[1].label, 'active');
      const t2 = Date.now();
      let blueprint = '';

      // Cloud models
      if (['openai', 'gemini'].includes(model)) {
        if (!apiKey) {
          emitProgress(2, 4, STAGES[1].label, 'error');
          res.write(JSON.stringify({ type: 'error', step: 2, label: STAGES[1].label, message: `No API key was provided for ${model}. Add it in Cloud Cauldron and try again.` }) + '\n');
          return res.end();
        }

        modelUsed = getCloudModelName(model, projectType, cloudModel);
        providerUsed = model;
        blueprint = await callCloudModel({
          provider: model,
          apiKey,
          prompt,
          systemPrompt,
          projectType,
          requestedModel: cloudModel,
        });

        db.createSession({
          sessionId: req.headers['x-session-id'] || db.generateSessionId(),
          brainDump: prompt,
          urlResearch: researchData || null,
          designReference,
          generationMode: 'cloud',
          modelUsed,
          draftId: null,
        });
      } else {
        // Local models → Ollama
        const ollamaModel = model;
        modelUsed = ollamaModel;
        providerUsed = 'ollama';
        blueprint = await callOllamaModel({
          model: ollamaModel,
          prompt,
          systemPrompt,
          numPredict: BLUEPRINT_NUM_PREDICT,
          temperature: 0.55,
        });

        db.createSession({
          sessionId: req.headers['x-session-id'] || db.generateSessionId(),
          brainDump: prompt,
          urlResearch: researchData || null,
          designReference,
          generationMode: 'local',
          modelUsed: ollamaModel,
          draftId: null,
        });
      }

      emitProgress(2, 4, STAGES[1].label, 'complete', +(Date.now() - t2).toFixed(0) / 1000);

      // ── Stage 3: Assembly ──
      const t3 = Date.now();
      emitProgress(3, 4, STAGES[2].label, 'active');
      // Assembly is synchronous post-processing; blueprint already assembled above
      emitProgress(3, 4, STAGES[2].label, 'complete', +(Date.now() - t3).toFixed(0) / 1000);

      // ── Stage 4: Rendering ──
      const t4 = Date.now();
      emitProgress(4, 4, STAGES[3].label, 'active');
      const totalDuration = +(Date.now() - startTime).toFixed(0) / 1000;
      emitProgress(4, 4, STAGES[3].label, 'complete', +(Date.now() - t4).toFixed(0) / 1000);

      // ── Final blueprint event ──
      res.write(JSON.stringify({
        type: 'blueprint',
        data: { success: true, blueprint, canHandoff: true, modelUsed, providerUsed },
        duration: totalDuration,
        steps: 4,
      }) + '\n');
      res.end();

    } catch (err) {
      console.error('Generate error:', err);

      if (err.name === 'AbortError') {
        const msg = ['openai', 'gemini'].includes(req.body.model)
          ? `Cloud model did not respond within ${CLOUD_TIMEOUT_MS / 1000}s.`
          : `Ollama did not respond within ${OLLAMA_TIMEOUT_MS / 1000}s. Try a shorter prompt or a smaller model output.`;
        res.write(JSON.stringify({ type: 'error', step: 2, label: 'Generating Blueprint...', message: msg }) + '\n');
        return res.end();
      }

      res.write(JSON.stringify({ type: 'error', step: 0, label: 'Generation', message: err.message }) + '\n');
      res.end();
    }
  });

  app.post('/api/refine', async (req, res) => {
    try {
      const { currentBlueprint, refinementPrompt, model, projectType = 'app', apiKey = '', designReference = 'none', cloudModel = '' } = req.body;
    
      const designSystemContent = await ensureDesignSystem(designReference);
      let systemPrompt = getSystemPrompt(projectType, designReference);

      if (designSystemContent && designSystemContent.trim()) {
        const truncated = designSystemContent.length > 16000
          ? designSystemContent.slice(0, 16000) + '\n\n[Design system content truncated — showing first 16k chars]'
          : designSystemContent;
        systemPrompt += `\n\n## Target Design System Content\n${truncated}\n\nUse the above design system as the primary visual language. The user selected this reference — it takes priority over generic taste mandates.`;
      }
    
      const prompt = `Here is the current blueprint:

  ${currentBlueprint}

  Here is the requested refinement:
  ${refinementPrompt}

  Please rewrite the blueprint entirely to incorporate the requested refinements while keeping the rest of the structure and intent intact. Ensure the output is a complete blueprint.`;
    
      if (!currentBlueprint || !refinementPrompt) {
        return res.status(400).json({ error: 'currentBlueprint and refinementPrompt required' });
      }
    
      if (['openai', 'gemini'].includes(model)) {
        if (!apiKey) return res.status(400).json({ error: 'Missing API key' });
        const modelUsed = getCloudModelName(model, projectType, cloudModel);
        const blueprint = await callCloudModel({
          provider: model, apiKey, prompt, systemPrompt, projectType, requestedModel: cloudModel,
        });
        return res.json({ success: true, blueprint, canHandoff: true, modelUsed, providerUsed: model });
      }
    
      const ollamaModel = model;
      const blueprint = await callOllamaModel({
        model: ollamaModel, prompt, systemPrompt, numPredict: BLUEPRINT_NUM_PREDICT, temperature: 0.55,
      });
      res.json({ success: true, blueprint, canHandoff: true, modelUsed: ollamaModel, providerUsed: 'ollama' });
    } catch (err) {
      console.error('Refine error:', err);
      res.status(500).json({ error: 'Refinement failed', details: err.message });
    }
  });

  app.post('/api/handoff', (req, res) => {
    const { projectName, blueprint, sessionId, designReference } = req.body;

    if (!projectName || (!blueprint && !sessionId)) {
      return res.status(400).json({ error: 'projectName and either blueprint or sessionId required' });
    }

    const safeName = safeProjectName(projectName);
    const projectsDir = getProjectsDir();
    const projectPath = path.join(projectsDir, safeName);

    if (fs.existsSync(projectPath)) {
      return res.status(409).json({ error: `Project "${safeName}" already exists` });
    }

    try {
      fs.mkdirSync(projectPath, { recursive: true });
      let buildFilesList = [];
      let useBlueprint = blueprint;

      if (sessionId) {
        const wsDir = workspace.workspaceDir(sessionId);
        if (fs.existsSync(wsDir)) {
          const copyRecursive = (src, dest) => {
            fs.mkdirSync(dest, { recursive: true });
            const entries = fs.readdirSync(src, { withFileTypes: true });
            for (const entry of entries) {
              const srcPath = path.join(src, entry.name);
              const destPath = path.join(dest, entry.name);
              if (entry.isDirectory()) {
                copyRecursive(srcPath, destPath);
              } else {
                fs.copyFileSync(srcPath, destPath);
                buildFilesList.push(entry.name);
              }
            }
          };
          copyRecursive(wsDir, projectPath);
          if (!useBlueprint) {
            try {
              const files = workspace.wsListFiles(sessionId);
              useBlueprint = `# Build Session: ${safeName}\n\nCopied ${buildFilesList.length} files from build session ${sessionId}.\n\n## Files\n${files.map(f => `- ${f}`).join('\n')}`;
            } catch {
              useBlueprint = `# Build Session: ${safeName}\n\nBuild handoff from session ${sessionId}.`;
            }
          }
        }
      }

      if (useBlueprint) {
        const blueprintPath = path.join(projectPath, 'blueprint.md');
        fs.writeFileSync(blueprintPath, useBlueprint, 'utf-8');
      }

      // Extract HTML prototype from fenced block
      const htmlBlockMatch = (useBlueprint || '').match(/```html\s*([\s\S]*?)\s*```/i);
      if (htmlBlockMatch && htmlBlockMatch[1]) {
        let prototypeHtml = htmlBlockMatch[1].trim();
        const hasAlpine = /alpinejs|x-data|x-show|x-for|@click|x-on:/i.test(prototypeHtml);
        const hasAlpineCdn = /cdn\.jsdelivr\.net\/npm\/alpinejs|unpkg\.com\/alpinejs/i.test(prototypeHtml);
        const alpineScript = hasAlpine && !hasAlpineCdn
          ? '\n        <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>'
          : '';
        const fullPrototype = `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <style>\n    * { box-sizing: border-box; }\n    body { margin: 0; min-height: 100vh; }\n  </style>${alpineScript}\n</head>\n<body>\n${prototypeHtml}\n</body>\n</html>`;
        fs.writeFileSync(path.join(projectPath, 'prototype.html'), fullPrototype, 'utf-8');
      }

      // Save OpenCode task stub
      const opencodeConfigPath = path.join(projectPath, '.opencode', 'config.md');
      const opencodeConfig = `# ${projectName}\n\nGenerated by [Cauldron OS](https://github.com/witchdaddylabs/cauldron-os).\n\n## What's included\n\n- \`blueprint.md\` — full product specification\n- \`prototype.html\` — live HTML/AlpineJS prototype (open in browser)\n- \`.opencode/config.md\` — this file\n\n## Build this project\n\n1. Open this folder in your terminal\n2. Run: \`opencode\`\n3. Paste the content of \`blueprint.md\` when prompted\n4. Choose your preferred model — whatever you select is what gets used to build\n\n---\n*Model: your choice in OpenCode. Cauldron saves the blueprint; you own the model decision.*\n`;
      fs.mkdirSync(path.join(projectPath, '.opencode'), { recursive: true });
      fs.writeFileSync(opencodeConfigPath, opencodeConfig, 'utf-8');

      // Set initial project status
      try {
        db.setProjectStatusOverride(safeName, 'needs_review', 'Handoff dispatched');
      } catch (statusErr) {
        console.warn('[Cauldron] Status override warning:', statusErr.message);
      }

      let draftId = null;
      try {
        const draft = db.createDraft({
          projectName: safeName,
          brainDump: sessionId ? `Build session: ${sessionId}` : '',
          blueprint: useBlueprint || '',
          designReference: sessionId ? 'build-handoff' : (designReference || 'handoff'),
          generationMode: sessionId ? 'build-execute' : 'handoff',
          modelUsed: 'opencode-go/deepseek-v4-flash',
        });
        draftId = draft.id;
      } catch (recordErr) {
        console.warn('[Cauldron] Handoff record warning:', recordErr.message);
      }

      res.json({
        success: true,
        message: buildFilesList.length > 0
          ? `Project created with ${buildFilesList.length} built files and prototype exported`
          : 'Project created',
        projectPath,
        draftId,
        filesCopied: buildFilesList.length,
      });
    } catch (err) {
      console.error('[Cauldron] Handoff error:', err);
      res.status(500).json({ error: 'Handoff failed', details: err.message });
    }
  });
}

module.exports = registerGenerationRoutes;
