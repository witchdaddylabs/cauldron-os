/**
 * routes/generation.js
 * Public interfaces:
 * - POST /api/research-url: URL research persistence and prompt formatting.
 * - POST /api/clarify: Annoying PM Mode question generation.
 * - POST /api/generate: blueprint generation stream.
 * - POST /api/generate-prototype: prototype generation and critique-regeneration SSE stream.
 * - POST /api/refine: blueprint refinement.
 * - POST /api/handoff: project package export; currently writes files but does not launch a CLI.
 */

const fs = require("fs");
const path = require("path");
const { createHandoffPackage } = require("../lib/handoff-package");
const { normaliseLimitOffset, sendMarkdownDownload } = require("./_helpers");

function registerGenerationRoutes(app, deps) {
  const {
    db, TEMPLATES, DESIGN_SYSTEMS, workspace, designSystemCache,
    getSystemPrompt, getTemplate, formatTemplateForPrompt, ensureDesignSystem,
    CLARIFY_SYSTEM_PROMPT, PROTOTYPE_SYSTEM_PROMPT, CLARIFY_NUM_PREDICT, BLUEPRINT_NUM_PREDICT,
    OLLAMA_BASE_URL, OLLAMA_TAGS_URL, CLOUD_TIMEOUT_MS,
    activeBuildControllers, buildSessions,
    safeProjectName, getProjectPath, getProjectsDir, buildResumePrompt, buildOpencodeArgs,
    commandPreview, listImportableProjects, getBuildStatus,
    callOllamaModel, callCloudModel, getCloudModelName,
    extractJsonObject, normaliseClarifyResult,
    scrapeURLFast, scrapeRenderedURL, formatResearchForPrompt,
    inferProviderFromModel, rootDir, PACKAGE_VERSION,
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

  app.post('/api/generate-prototype', async (req, res) => {
    const { PROTOTYPE_SYSTEM_PROMPT } = deps;

    const STAGES = [
      { label: 'Analyzing blueprint...' },
      { label: 'Generating prototype...' },
    ];

    function emitProgress(step, total, label, status, duration) {
      res.write(JSON.stringify({ type: 'progress', step, total, label, status, duration }) + '\n');
    }

    const startTime = Date.now();

    try {
      const {
        blueprint,
        designReference = 'none',
        templateId = '',
        model,
        cloudModel = '',
        apiKey = '',
        projectType = 'site',
        critique = '',
        previousPrototypeHtml = '',
        iterationIndex = 0,
      } = req.body;

      if (!blueprint || !blueprint.trim()) {
        return res.status(400).json({ error: 'Blueprint required', details: 'Generate a blueprint first before creating a prototype.' });
      }

      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Stage 1: Research
      const t1 = Date.now();
      emitProgress(1, 2, STAGES[0].label, 'active');
      const designSystemContent = await ensureDesignSystem(designReference);
      let systemPrompt = PROTOTYPE_SYSTEM_PROMPT.replace('{blueprint text goes here}', blueprint);

      if (designSystemContent && designSystemContent.trim()) {
        const truncated = designSystemContent.length > 16000
          ? designSystemContent.slice(0, 16000) + '\n\n[Design system content truncated — showing first 16k chars]'
          : designSystemContent;
        systemPrompt += '\n\n## Target Design System Content\n' + truncated + '\n\nUse the above design system as the primary visual language. The user selected this reference — it takes priority over generic taste mandates.';
      }

      if (templateId) {
        const template = getTemplate(templateId);
        if (template) {
          systemPrompt += '\n\n' + formatTemplateForPrompt(template);
        }
      }

      const critiqueText = String(critique || '').trim();
      const previousHtml = String(previousPrototypeHtml || '').trim();
      if (critiqueText) {
        systemPrompt += '\n\n## Critique Review Mode\nYou are revising an existing prototype. Preserve working interactions and the selected design language, but directly address the requested critique. Return the full updated prototype, not a patch.';
      }

      emitProgress(1, 2, STAGES[0].label, 'complete', +(Date.now() - t1).toFixed(0) / 1000);

      // Stage 2: Generate
      const t2 = Date.now();
      emitProgress(2, 2, STAGES[1].label, 'active');
      let prototypeHtml = '';

      const prototypePrompt = [
        '## Blueprint',
        blueprint,
        previousHtml ? `## Previous Prototype HTML\n${previousHtml}` : '',
        critiqueText ? `## Requested Critique / Change\n${critiqueText}` : '',
        critiqueText
          ? 'Regenerate the complete prototype incorporating the requested change. Output ONLY the HTML inside a ```html fenced code block.'
          : 'Convert this blueprint into a complete, polished HTML prototype. Output ONLY the HTML inside a ```html fenced code block.',
      ].filter(Boolean).join('\n\n');

      if (['openai', 'gemini'].includes(model)) {
        if (!apiKey) {
          emitProgress(2, 2, STAGES[1].label, 'error');
          res.write(JSON.stringify({ type: 'error', step: 2, label: STAGES[1].label, message: 'No API key was provided for ' + model + '.' }) + '\n');
          return res.end();
        }

        const raw = await callCloudModel({
          provider: model,
          apiKey,
          prompt: prototypePrompt,
          systemPrompt,
          projectType,
          requestedModel: cloudModel,
        });

        const htmlMatch = raw.match(/```html\s*([\s\S]*?)```/i);
        prototypeHtml = htmlMatch ? htmlMatch[1].trim() : '';
      } else {
        const raw = await callOllamaModel({
          model,
          prompt: prototypePrompt,
          systemPrompt,
          numPredict: BLUEPRINT_NUM_PREDICT,
          temperature: 0.55,
        });

        const htmlMatch = raw.match(/```html\s*([\s\S]*?)```/i);
        prototypeHtml = htmlMatch ? htmlMatch[1].trim() : '';
      }

      if (!prototypeHtml) {
        emitProgress(2, 2, STAGES[1].label, 'error');
        res.write(JSON.stringify({ type: 'error', step: 2, label: STAGES[1].label, message: 'No HTML prototype was generated. Try again or adjust the blueprint.' }) + '\n');
        return res.end();
      }

      emitProgress(2, 2, STAGES[1].label, 'complete', +(Date.now() - t2).toFixed(0) / 1000);

      const totalDuration = +(Date.now() - startTime).toFixed(0) / 1000;

      res.write(JSON.stringify({
        type: 'prototype',
        data: {
          html: prototypeHtml,
          success: true,
          critique: critiqueText,
          iterationIndex: Number(iterationIndex) || 0,
        },
        duration: totalDuration,
      }) + '\n');
      res.end();
    } catch (err) {
      console.error('Generate prototype error:', err);

      if (err.name === 'AbortError') {
        const msg = ['openai', 'gemini'].includes(req.body.model)
          ? 'Cloud model did not respond within timeout.'
          : 'Ollama did not respond within timeout.';
        res.write(JSON.stringify({ type: 'error', step: 2, label: 'Generating Prototype...', message: msg }) + '\n');
        return res.end();
      }

      res.write(JSON.stringify({ type: 'error', step: 0, label: 'Prototype Generation', message: err.message }) + '\n');
      res.end();
    }
  });

  app.post('/api/handoff', async (req, res) => {
    const {
      projectName,
      blueprint,
      sessionId,
      designReference = 'none',
      prototypeHtml,
      templateId = '',
      projectType = 'app',
    } = req.body;

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
      const designSystemContent = await ensureDesignSystem(designReference);
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
        agentId: 'handoff',
      });

      // Set initial project status
      try {
        db.setProjectStatusOverride(safeName, 'needs_review', 'Handoff package created');
      } catch (statusErr) {
        console.warn('[Cauldron] Status override warning:', statusErr.message);
      }

      let draftId = null;
      try {
        const draft = db.createDraft({
          projectName: safeName,
          brainDump: sessionId ? `Build session: ${sessionId}` : '',
          blueprint: handoff.blueprint || '',
          designReference: sessionId ? 'build-handoff' : (designReference || 'handoff'),
          generationMode: sessionId ? 'build-handoff' : 'handoff',
          modelUsed: 'handoff-package',
        });
        draftId = draft.id;
      } catch (recordErr) {
        console.warn('[Cauldron] Handoff record warning:', recordErr.message);
      }

      res.json({
        success: true,
        message: handoff.filesCopied > 0
          ? `Handoff package created with ${handoff.filesCopied} copied workspace files`
          : 'Handoff package created',
        projectPath,
        manifestPath: handoff.manifestPath,
        draftId,
        files: handoff.files,
        filesCopied: handoff.filesCopied,
      });
    } catch (err) {
      console.error('[Cauldron] Handoff error:', err);
      res.status(500).json({ error: 'Handoff failed', details: err.message });
    }
  });
}

module.exports = registerGenerationRoutes;
