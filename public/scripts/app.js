function cauldronApp() {
  return {
    stages: [
      { id: 'dump', label: 'Brain Dump', icon: '01' },
      { id: 'interrogate', label: 'Interrogate', icon: '02' },
      { id: 'system', label: 'Design System', icon: '03' },
      { id: 'blueprint', label: 'Blueprint', icon: '04' },
      { id: 'prototype', label: 'Prototype', icon: '05' },
      { id: 'build', label: 'Build', icon: '06' },
      { id: 'export', label: 'Export', icon: '07' },
    ],
    activeStage: 'dump',
    busy: false,
    status: 'Ready. Feed the sewer cauldron.',
    previewMode: 'prototype',
    toasts: [],
    designSystems: [],
    templates: [],
    cloudModels: {},
    recentDrafts: [],
    apiKeyVisible: false,
    settingsOpen: false,
    settingsTab: 'general',
    pendingStageAfterKey: '',
    pendingActionAfterKey: '',
    savedKeyVersion: 0,
    keyStatus: 'No saved key loaded.',
    generatedAt: null,
    savedDraftId: null,
    handoffResult: null,
    researchResult: null,
    clarifyResult: null,
    // Refero search state
    referoQuery: '',
    referoResults: [],
    referoSearching: false,
    referoResultsOpen: false,
    selectedReferoStyle: null,
    blueprint: '',
    prototypeHtml: '',
    buildSession: null,
    buildFiles: [],
    workspacePreviewUrl: '',
    buildAgents: [],
    selectedBuildAgentId: 'handoff',
    buildAgentsLoaded: false,
    buildAgentDetecting: false,
    buildAgentRunResult: null,
    buildAgentStatus: 'Build agents not checked yet.',
    tasteInjectionEnabled: true,
    stageModels: {
      interrogate: { provider: 'gemini', cloudModel: '', label: 'Interrogate', stage: 'interrogate' },
      blueprint: { provider: 'openai', cloudModel: '', label: 'Blueprint', stage: 'blueprint' },
    },

    form: {
      projectName: '',
      projectType: 'site',
      brainDump: 'A high-end, Awwwards-adjacent interactive website. It should feel like Lovable, Replit, Volt and a sewer witch had a professional SaaS baby. Use acid green, purple, rogue pastel pink, charcoal, bone white, strong accessible typography, and real micro-interactions. The output must be polished enough to inspire a proper OpenCode build handoff.',
      referenceUrl: '',
      researchMode: 'deep',
      provider: 'gemini',
      cloudModel: '',
      apiKey: '',
      openAIBaseUrl: 'https://api.openai.com/v1',
      designReference: 'lovable',
      templateId: 'html-alpine',
      autoSaveDraft: true,
    },

    answers: {},

    // Pipeline Activity Log
    pipelineLog: [],
    pipelineView: 'preview',
    pipelineComplete: null,

    get activeIndex() {
      return this.stages.findIndex(stage => stage.id === this.activeStage);
    },

    get activeStageMeta() {
      return this.stages[this.activeIndex] || this.stages[0];
    },

    get selectedProviderModels() {
      return this.cloudModels?.[this.form.provider]?.models || [];
    },

    get selectedProviderDefault() {
      return this.cloudModels?.[this.form.provider]?.defaultModel || '';
    },

    get completedStages() {
      const complete = new Set();
      if (this.form.brainDump.trim()) complete.add('dump');
      if (this.clarifyResult) complete.add('interrogate');
      if (this.form.designReference || this.researchResult) complete.add('system');
      if (this.blueprint) complete.add('blueprint');
      if (this.prototypeHtml) complete.add('prototype');
      if (this.buildSession) complete.add('build');
      if (this.savedDraftId || this.handoffResult) complete.add('export');
      return complete;
    },

    get keyStorageKey() {
      return `cauldron:api-key:${this.form.provider}`;
    },

    get hasSavedProviderKey() {
      this.savedKeyVersion;
      try {
        return Boolean(localStorage.getItem(this.keyStorageKey));
      } catch (_) {
        return false;
      }
    },

    get hasUsableApiKey() {
      return Boolean(this.form.apiKey.trim() || this.hasSavedProviderKey);
    },

    get selectedBuildAgent() {
      return this.buildAgents.find(agent => agent.id === this.selectedBuildAgentId) || null;
    },

    get selectedBuildAgentAvailable() {
      return this.selectedBuildAgent?.available === true;
    },

    init() {
      this.loadStageConfig();
      this.loadConfig();
      this.loadRecords();
      this.loadSavedKey(false);
      this.$watch('form.provider', () => {
        this.ensureCloudModel();
        this.loadSavedKey(false);
      });
      this.$watch('stageModels', () => this.saveStageConfig(), { deep: true });
      this.$watch('tasteInjectionEnabled', () => this.saveStageConfig());
    },

    async loadConfig() {
      await Promise.allSettled([
        this.api('/api/design-systems').then(data => { this.designSystems = data.systems || []; }),
        this.api('/api/templates').then(data => { this.templates = data.templates || []; }),
        this.api('/api/cloud-models').then(data => { this.cloudModels = data || {}; this.ensureCloudModel(); }),
        this.loadBuildAgents(),
      ]);

      const desiredReference = this.designSystems.some(system => system.id === this.form.designReference)
        ? this.form.designReference
        : (this.designSystems[0]?.id || 'none');
      const desiredTemplate = this.templates.some(template => template.id === this.form.templateId)
        ? this.form.templateId
        : (this.templates.find(template => template.id === 'html-alpine')?.id || this.templates[0]?.id || 'html-alpine');

      this.$nextTick(() => {
        this.form.designReference = desiredReference;
        this.form.templateId = desiredTemplate;
        this.ensureCloudModel();
      });
    },

    async loadRecords() {
      try {
        const data = await this.api('/api/drafts?limit=6');
        this.recentDrafts = data.drafts || [];
      } catch (_) {}
    },

    ensureCloudModel() {
      const models = this.selectedProviderModels;
      if (!models.length) return;
      if (!models.includes(this.form.cloudModel)) {
        this.form.cloudModel = this.selectedProviderDefault || models[0];
      }
    },

    saveCurrentKey() {
      const key = this.form.apiKey.trim();
      if (!key) {
        this.toast('No key to save', 'Paste an API key first, then save it.', 'error');
        this.openApiKeySettings('Paste an API key first, then save it.');
        return;
      }
      try {
        localStorage.setItem(this.keyStorageKey, key);
        this.savedKeyVersion += 1;
        this.keyStatus = `Saved ${this.form.provider} key locally in this browser.`;
        this.toast('Key saved', `${this.form.provider} key saved locally. The flow can use it now.`);
        const pendingStage = this.pendingStageAfterKey;
        const pendingAction = this.pendingActionAfterKey;
        this.pendingStageAfterKey = '';
        this.pendingActionAfterKey = '';
        if (pendingStage) {
          this.closeSettings();
          this.setStage(pendingStage);
        }
        if (pendingAction === 'interrogate') {
          this.closeSettings();
          this.$nextTick(() => this.runInterrogate());
        }
      } catch (error) {
        this.keyStatus = 'Could not save key in this browser.';
        this.toast('Key save failed', error.message, 'error');
      }
    },

    loadSavedKey(showToast = true) {
      try {
        const saved = localStorage.getItem(this.keyStorageKey) || '';
        this.form.apiKey = saved;
        this.savedKeyVersion += 1;
        this.keyStatus = saved
          ? `Loaded saved ${this.form.provider} key from this browser.`
          : `No saved ${this.form.provider} key in this browser.`;
        if (showToast) {
          this.toast(saved ? 'Key loaded' : 'No saved key', this.keyStatus, saved ? 'info' : 'error');
        }
      } catch (error) {
        this.keyStatus = 'Could not read browser key storage.';
        if (showToast) this.toast('Key load failed', error.message, 'error');
      }
    },

    forgetSavedKey() {
      try {
        localStorage.removeItem(this.keyStorageKey);
        this.form.apiKey = '';
        this.savedKeyVersion += 1;
        this.pendingStageAfterKey = '';
        this.pendingActionAfterKey = '';
        this.keyStatus = `Forgot saved ${this.form.provider} key.`;
        this.toast('Key forgotten', `${this.form.provider} key removed from local browser storage.`);
      } catch (error) {
        this.toast('Could not forget key', error.message, 'error');
      }
    },

    loadStageConfig() {
      try {
        const saved = localStorage.getItem('cauldron:stage-models');
        if (saved) {
          const parsed = JSON.parse(saved);
          for (const key of Object.keys(this.stageModels)) {
            if (parsed[key]) {
              this.stageModels[key].provider = parsed[key].provider || this.stageModels[key].provider;
              this.stageModels[key].cloudModel = parsed[key].cloudModel || '';
            }
          }
        }
        const tasteSaved = localStorage.getItem('cauldron:taste-injection');
        if (tasteSaved !== null) {
          this.tasteInjectionEnabled = tasteSaved === 'true';
        }
      } catch (_) {}
    },

    saveStageConfig() {
      try {
        localStorage.setItem('cauldron:stage-models', JSON.stringify(this.stageModels));
        localStorage.setItem('cauldron:taste-injection', String(this.tasteInjectionEnabled));
      } catch (_) {}
    },

    openSettings(tab = 'general') {
      this.settingsTab = tab;
      this.settingsOpen = true;
      this.$nextTick(() => {
        const target = tab === 'api'
          ? document.getElementById('settingsApiKey')
          : document.querySelector('.settings-panel button');
        target?.focus?.();
      });
    },

    openApiKeySettings(message = '') {
      if (message) this.keyStatus = message;
      this.openSettings('api');
    },

    closeSettings() {
      this.settingsOpen = false;
    },

    async loadBuildAgents() {
      this.buildAgentDetecting = true;
      try {
        const data = await this.api('/api/build-agents');
        this.buildAgents = data.agents || [];
        this.buildAgentsLoaded = true;
        if (!this.buildAgents.some(agent => agent.id === this.selectedBuildAgentId)) {
          this.selectedBuildAgentId = this.buildAgents.find(agent => agent.id === 'handoff')?.id || this.buildAgents[0]?.id || 'handoff';
        }
        const available = this.buildAgents.filter(agent => agent.available && agent.id !== 'handoff').length;
        this.buildAgentStatus = available
          ? `${available} build agent${available === 1 ? '' : 's'} detected.`
          : 'No launchable build-agent CLIs detected. Handoff package mode is available.';
      } catch (error) {
        this.buildAgents = [{ id: 'handoff', name: 'Generate handoff package', available: true, command: null, notes: 'Always available' }];
        this.selectedBuildAgentId = 'handoff';
        this.buildAgentStatus = `Build-agent detection failed: ${error.message}`;
      } finally {
        this.buildAgentDetecting = false;
      }
    },

    ensureApiKey(actionLabel = 'This action', pendingStage = '', pendingAction = '') {
      if (!['openai', 'gemini'].includes(this.form.provider)) return true;
      if (this.form.apiKey.trim()) return true;
      this.loadSavedKey(false);
      if (this.form.apiKey.trim()) return true;
      this.pendingStageAfterKey = pendingStage;
      this.pendingActionAfterKey = pendingAction;
      this.openApiKeySettings(`${actionLabel} needs a ${this.form.provider} API key before it can run.`);
      this.toast('API key needed', `${actionLabel} needs a saved ${this.form.provider} key first.`, 'error');
      return false;
    },

    newWorkspace() {
      this.activeStage = 'dump';
      this.answers = {};
      this.savedDraftId = null;
      this.handoffResult = null;
      this.researchResult = null;
      this.clarifyResult = null;
      this.blueprint = '';
      this.prototypeHtml = '';
      this.buildSession = null;
      this.buildFiles = [];
      this.workspacePreviewUrl = '';
      this.previewMode = 'prototype';
      this.status = 'New workspace ready.';
      this.toast('New workspace', 'Cleared the brew without touching saved API keys.');
    },

    goToTasteEngine() {
      if (!this.ensureApiKey('Skipping interrogation still leads into cloud blueprinting', 'system')) return;
      this.setStage('system');
    },

    setStage(stageId) {
      this.activeStage = stageId;
      this.announce(`Stage changed to ${this.activeStageMeta.label}`);
    },

    nextStage() {
      const next = Math.min(this.activeIndex + 1, this.stages.length - 1);
      this.setStage(this.stages[next].id);
    },

    previousStage() {
      const previous = Math.max(this.activeIndex - 1, 0);
      this.setStage(this.stages[previous].id);
    },

    async api(url, options = {}) {
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) {
        throw new Error(data.details || data.error || `Request failed: ${response.status}`);
      }
      return data;
    },

    async withBusy(label, fn) {
      if (this.busy) return;
      this.busy = true;
      this.status = label;
      try {
        const result = await fn();
        return result;
      } catch (error) {
        console.error(error);
        this.status = `Failed: ${error.message}`;
        this.toast('Something went sideways', error.message, 'error');
      } finally {
        this.busy = false;
      }
    },

    async runResearch() {
      if (!this.form.referenceUrl.trim()) {
        this.toast('No URL', 'Give me a reference URL first.', 'error');
        return;
      }
      await this.withBusy('Researching visual DNA...', async () => {
        const data = await this.api('/api/research-url', {
          method: 'POST',
          body: JSON.stringify({
            url: this.form.referenceUrl.trim(),
            projectName: this.form.projectName,
            brainDump: this.form.brainDump,
            mode: this.form.researchMode,
          }),
        });
        this.researchResult = data;
        this.status = 'Reference research captured.';
        this.toast('Research captured', 'Design signals are now feeding the prompt. Delicious theft, legally styled.');
        this.setStage('system');
      });
    },

    async searchRefero() {
      const query = this.referoQuery.trim();
      if (!query) {
        this.referoResults = [];
        this.referoResultsOpen = false;
        return;
      }
      this.referoSearching = true;
      this.referoResultsOpen = true;
      try {
        const data = await this.api(`/api/refero-search?q=${encodeURIComponent(query)}`);
        this.referoResults = data.results || [];
      } catch (err) {
        console.error('Refero search failed:', err);
        this.referoResults = [];
      } finally {
        this.referoSearching = false;
      }
    },

    selectReferoStyle(style) {
      this.selectedReferoStyle = style;
      this.form.designReference = style.siteName;
      this.referoQuery = style.siteName;
      this.referoResultsOpen = false;
      this.toast('Refero style selected', `${style.siteName} set as design reference.`);
    },

    clearReferoSearch() {
      this.referoQuery = '';
      this.referoResults = [];
      this.referoResultsOpen = false;
      this.selectedReferoStyle = null;
    },

    async runResearch() {
      if (!this.form.referenceUrl.trim()) {
        this.toast('No URL', 'Give me a reference URL first.', 'error');
        return;
      }
      await this.withBusy('Researching visual DNA...', async () => {
        const data = await this.api('/api/research-url', {
          method: 'POST',
          body: JSON.stringify({
            url: this.form.referenceUrl.trim(),
            projectName: this.form.projectName,
            brainDump: this.form.brainDump,
            mode: this.form.researchMode,
          }),
        });
        this.researchResult = data;
        this.status = 'Reference research captured.';
        this.toast('Research captured', 'Design signals are now feeding the prompt. Delicious theft, legally styled.');
        this.setStage('system');
      });
    },

    async runInterrogate() {
      if (!this.form.brainDump.trim()) {
        this.toast('Empty cauldron', 'Write a brain dump first.', 'error');
        return;
      }
      if (!this.ensureApiKey('Interrogate brief', '', 'interrogate')) return;
      await this.withBusy('Interrogating the brief...', async () => {
        const data = await this.api('/api/clarify', {
          method: 'POST',
          body: JSON.stringify(this.modelPayload('interrogate', { prompt: this.form.brainDump })),
        });
        this.clarifyResult = data;
        for (const q of data.questions || []) {
          if (!(q.id in this.answers)) this.answers[q.id] = '';
        }
        this.status = 'Questions ready. Answer only what matters.';
        this.toast('Interrogation ready', `${(data.questions || []).length} questions, not a fucking investor deck.`);
        this.setStage('interrogate');
      });
    },

    modelPayload(stageId, extra = {}) {
      const config = stageId && this.stageModels[stageId] ? this.stageModels[stageId] : null;
      return {
        model: config?.provider || this.form.provider,
        apiKey: this.form.apiKey,
        cloudModel: config?.cloudModel || this.form.cloudModel,
        baseUrl: (config?.provider || this.form.provider) === 'openai' ? this.form.openAIBaseUrl : '',
        projectType: this.form.projectType,
        ...extra,
      };
    },

    getStageModelLabel(stageId) {
      const config = this.stageModels[stageId];
      if (!config) return 'Global default';
      return config.provider === 'gemini'
        ? `Gemini${config.cloudModel ? ' / ' + config.cloudModel : ''}`
        : `OpenAI${config.cloudModel ? ' / ' + config.cloudModel : ''}`;
    },

    buildGenerationPrompt() {
      const answerLines = (this.clarifyResult?.questions || [])
        .map(q => `- ${q.label}\n  Answer: ${this.answers[q.id] || '(not answered)'}`)
        .join('\n');

      const providerNotes = this.form.provider === 'openai'
        ? `OpenAI-compatible route. If a custom base URL is later wired, preserve model/base URL flexibility for OpenCode Go style providers.`
        : `Provider: ${this.form.provider}.`;

      const tasteBlock = this.tasteInjectionEnabled ? `
# Impeccable Taste Mandate — WITCH DADDY LABS STANDARD
This is a premium production, not a starter template. Follow these rules strictly:

## ANTI-PATTERNS (NEVER DO THESE)
- No Inter or Roboto fonts for body text — use system fonts or brand-specific typefaces
- No pure black (#000) — tint to deep charcoal like #0a0c12 or #0f0d13
- No generic blue gradients — they are the uniform of mediocre SaaS
- No nested cards — cards inside cards inside cards creates visual noise
- No heavy drop shadows — use subtle borders and opacity instead

## MANDATES (ALWAYS DO THESE)
- Typography: High-contrast hierarchy. Headings 32-48px+ with 600-800 weight. Body 16-18px at 400-500 weight. Never under 400 for body. Line height 1.6-1.8 body, 1.2-1.4 headings.
- Spacing: Consistent 8px scale (4, 8, 12, 16, 24, 32, 48, 64, 96). Section padding 48-96px vertical.
- Borders: rgba(255,255,255,0.1) on dark. Hover: rgba(255,255,255,0.2). Cards: rgba(255,255,255,0.03) background.
- States: EVERY interactive element must define default, hover (brightness shift), focus-visible (clear ring + offset), active (scale 0.98), disabled (40% opacity).
- Micro-interactions: 200ms transitions with ease-out curve. Hover lift of translateY(-1px). Buttons need active scale press.
- Layout: Max content width 1200px centered. Sidebar 280px. Header 56-64px. Forms 44px touch targets.

## ACCESSIBILITY
- 44px minimum touch targets on all controls
- Visible focus rings with 3px offset
- Semantic landmarks (nav, main, section, aside, footer)
- Keyboard navigation through all interactive elements
- prefers-reduced-motion: strip all animations
- Skip-to-content link as first focusable element

## COLOR ROLE MAP
${this.form.projectType === 'app' ? `
- Use neutral / brand-appropriate palette. Default to the brand colors the user described in their brain dump.
- Colour should serve information hierarchy: primary actions, surface backgrounds, text contrast, data viz accents.
- Avoid forcing any specific palette — match the project's own brand intent.` : `
- Acid green (#b8ff3b / #c1ff00): CTAs, active states, highlights
- Purple (#8b5cf6): Structural borders, headers, secondary elements
- Pink (#f3a6d6 / #f472b6): Delight, personality, completion states
- Charcoal (#0f0d13 / #15131a): Background canvas
- Bone (#f4efe4 / #f9f6ee): High-contrast text surfaces`}
` : '';

      return [
        '# Brain Dump',
        this.form.brainDump.trim(),
        '',
        '# Product Direction',
        this.form.projectType === 'app'
          ? 'Cauldron OS is generating an interactive web application prototype. Focus on data states, navigation patterns, user flows, and real interactivity. The result should feel like a functioning app, not a marketing page.'
          : 'Cauldron OS is focused on generating a high-end, Awwwards-adjacent website. The result should favour premium interactive websites over generic app scaffolding.',
        'It should feel like Lovable + Replit + Volt if the baby was aborted, survived in a witches cauldron in a sewer, then became a professional SaaS designer.',
        '',
        tasteBlock,
        '# Cauldron UI / Design Taste Mandate',
        '- High-end, Awwwards-adjacent, not generic startup blue gradient sludge.',
        '- Accessible from first principles: semantic HTML, 44px minimum controls, keyboard navigation, visible focus, contrast-safe text.',
        '- Typography must be legible on 4K. Strong heading personality; body text must breathe.',
        '- Use acid green for primary action, purple for structure, rogue pastel pink for delight, charcoal/deep backgrounds, bone-white contrast surfaces.',
        '- Build an interactive prototype, not a static screenshot. AlpineJS is preferred for preview state.',
        '',
        '# Clarifying Answers',
        answerLines || '- No formal answers yet. Infer cautiously and state assumptions.',
        '',
        '# Design System Reference',
        `Selected design reference: ${this.form.designReference || 'none'}`,
        this.researchResult?.formatted || 'No URL research captured yet.',
        '',
        '# Template Target',
        `Template: ${this.form.templateId}`,
        providerNotes,
      ].join('\n');
    },

    async generateBlueprint() {
      if (!this.ensureApiKey('Generate blueprint + prototype', 'blueprint')) return;

      // Reset pipeline log
      this.pipelineLog = [];
      this.pipelineComplete = null;
      this.pipelineView = 'log';
      this.busy = true;
      this.status = 'Generating blueprint + prototype...';

      try {
        const prompt = this.buildGenerationPrompt();
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...this.modelPayload('blueprint', { prompt }),
            designReference: this.form.designReference || 'none',
            researchData: this.researchResult || null,
            templateId: this.form.templateId,
            mode: 'blueprint',
          }),
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let blueprint = '';
        let modelUsed = '';
        let providerUsed = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);

              if (event.type === 'progress') {
                this.addPipelineEntry(event);
              } else if (event.type === 'error') {
                this.addPipelineEntry({
                  type: 'progress',
                  step: event.step || 0,
                  total: 4,
                  label: event.label || event.message || 'Error',
                  status: 'error',
                  message: event.message,
                });
              } else if (event.type === 'blueprint') {
                blueprint = event.data.blueprint || '';
                modelUsed = event.data.modelUsed || '';
                providerUsed = event.data.providerUsed || '';
                this.pipelineComplete = {
                  duration: event.duration,
                  steps: event.steps,
                };
              }
            } catch (e) {
              // Not JSON — skip
            }
          }
        }

        if (blueprint) {
          this.blueprint = blueprint;
          this.generatedAt = new Date().toISOString();
          this.status = `Blueprint generated with ${modelUsed || this.form.cloudModel || this.form.provider}.`;
          this.toast('Blueprint brewed', 'Blueprint ready. Review and edit, then generate the prototype.');
          this.setStage('blueprint');
          this.previewMode = 'blueprint';
          this.pipelineView = 'preview';

          if (this.form.autoSaveDraft) await this.saveDraft(false);
        }
      } catch (err) {
        console.error(err);
        this.status = `Failed: ${err.message}`;
        this.toast('Something went sideways', err.message, 'error');
      } finally {
        this.busy = false;
      }
    },

    async generatePrototype() {
      if (!this.blueprint.trim()) {
        this.toast('No blueprint', 'Generate a blueprint first.', 'error');
        return;
      }

      this.pipelineLog = [];
      this.pipelineComplete = null;
      this.pipelineView = 'log';
      this.busy = true;
      this.status = 'Generating prototype from blueprint...';

      try {
        const res = await fetch('/api/generate-prototype', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blueprint: this.blueprint,
            designReference: this.form.designReference || 'none',
            templateId: this.form.templateId,
            model: this.stageModels.blueprint?.provider || this.form.provider,
            cloudModel: this.stageModels.blueprint?.cloudModel || this.form.cloudModel,
            apiKey: this.form.apiKey,
            projectType: this.form.projectType,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.details || errData.error || 'Prototype generation failed');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);

              if (event.type === 'progress') {
                this.addPipelineEntry(event);
              } else if (event.type === 'error') {
                this.addPipelineEntry({
                  type: 'progress',
                  step: event.step || 0,
                  total: 2,
                  label: event.label || event.message || 'Error',
                  status: 'error',
                  message: event.message,
                });
              } else if (event.type === 'prototype') {
                this.prototypeHtml = event.data.html || '';
                this.pipelineComplete = {
                  duration: event.duration,
                  steps: 2,
                };
              }
            } catch (e) {
              // Not JSON — skip
            }
          }
        }

        if (this.prototypeHtml) {
          this.generatedAt = new Date().toISOString();
          this.status = 'Prototype generated from blueprint.';
          this.toast('Prototype ready', 'Prototype HTML generated from your blueprint.');
          this.setStage('prototype');
          this.previewMode = 'prototype';
          this.pipelineView = 'preview';

          if (this.form.autoSaveDraft) await this.saveDraft(false);
        }
      } catch (err) {
        console.error(err);
        this.status = `Failed: ${err.message}`;
        this.toast('Something went sideways', err.message, 'error');
      } finally {
        this.busy = false;
      }
    },

    addPipelineEntry(event) {
      const time = new Date().toLocaleTimeString('en-AU', { hour12: false });
      const icons = { active: '🔄', complete: '✅', error: '❌', warn: '⚠️' };
      const entry = {
        step: event.step,
        total: event.total,
        label: event.label,
        status: event.status,
        duration: event.duration,
        time,
        icon: icons[event.status] || '○',
        message: event.message || null,
      };
      // If active entry for step exists, update it (don't duplicate)
      const existing = this.pipelineLog.findIndex(e => e.step === event.step && e.status !== 'active');
      if (event.status === 'active') {
        // Remove previous same-step entry
        const prev = this.pipelineLog.findIndex(e => e.step === event.step);
        if (prev >= 0) this.pipelineLog.splice(prev, 1);
      }
      this.pipelineLog.push(entry);
    },

    switchPipelineView(view) {
      this.pipelineView = view;
    },

    extractHtml(markdown) {
      const matches = String(markdown || '').match(/```html\s*([\s\S]*?)```/i);
      if (matches?.[1]) return matches[1].trim();
      const docStart = String(markdown || '').indexOf('<!DOCTYPE html>');
      if (docStart >= 0) return String(markdown).slice(docStart).trim();
      return '';
    },

    async saveDraft(showToast = true) {
      if (!this.blueprint.trim()) return;
      const name = this.form.projectName || 'cauldron-untitled';
      const data = await this.api('/api/drafts', {
        method: 'POST',
        body: JSON.stringify({
          projectName: name,
          brainDump: this.form.brainDump,
          blueprint: this.blueprint,
          designReference: this.form.designReference || 'none',
          generationMode: 'cauldron-3-blueprint-prototype',
          modelUsed: `${this.form.provider}/${this.form.cloudModel || 'default'}`,
        }),
      });
      this.savedDraftId = data.draftId;
      await this.loadRecords();
      if (showToast) this.toast('Draft saved', `Draft #${data.draftId} is in the local record vault.`);
      this.status = `Draft saved: #${data.draftId}`;
    },

    async runBuildAgent({ fromBuild = false } = {}) {
      if (!this.blueprint.trim()) {
        this.toast('No blueprint', 'Generate a blueprint before creating a handoff package.', 'error');
        return;
      }
      if (!this.buildAgentsLoaded) await this.loadBuildAgents();

      await this.withBusy('Creating build-agent handoff package...', async () => {
        const data = await this.api('/api/build-agents/run', {
          method: 'POST',
          body: JSON.stringify({
            projectName: this.form.projectName || 'cauldron-project',
            agentId: this.selectedBuildAgentId || 'handoff',
            blueprint: this.blueprint,
            prototypeHtml: this.prototypeHtml,
            designReference: this.form.designReference || 'none',
            templateId: this.form.templateId,
            projectType: this.form.projectType,
            sessionId: fromBuild ? this.buildSession?.sessionId : '',
          }),
        });
        this.buildAgentRunResult = data;
        this.handoffResult = data;
        if (data.mode === 'launched') {
          this.status = `Handoff package created and ${data.agentName || data.agentId} launched.`;
          this.toast('Build agent launched', data.projectPath || 'Project folder created.');
        } else if (data.fallback) {
          this.status = 'Handoff package created. Launch it manually from the project folder.';
          this.toast('Package created', data.error || 'Selected agent was not launched.', 'info');
        } else {
          this.status = 'Handoff package created.';
          this.toast('Handoff package created', data.projectPath || 'Project folder created.');
        }
        this.setStage('export');
      });
    },

    async handoffToOpenCode() {
      return this.runBuildAgent({ fromBuild: false });
    },

    async startBuild() {
      if (!this.blueprint.trim()) {
        this.toast('No blueprint', 'Generate a blueprint first.', 'error');
        return;
      }
      await this.withBusy('Creating build workspace...', async () => {
        const data = await this.api('/api/build/start', {
          method: 'POST',
          body: JSON.stringify({
            prompt: this.blueprint,
            model: this.stageModels.blueprint?.provider || this.form.provider,
            sessionId: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
            designReference: this.form.designReference || 'none',
            templateId: this.form.templateId,
            projectType: this.form.projectType,
          }),
        });
        this.buildSession = data;
        this.workspacePreviewUrl = `/workspace-preview/${data.sessionId}/`;
        this.status = `Build workspace ready: ${data.sessionId.slice(0, 8)}...`;
        this.toast('Build started', `Workspace created at ${data.workspaceDir}`);
        await this.loadBuildFiles();
        this.setStage('build');
      });
    },

    async loadBuildFiles() {
      if (!this.buildSession?.sessionId) return;
      await this.withBusy('Loading workspace files...', async () => {
        const data = await this.api(`/api/build/files/${this.buildSession.sessionId}`);
        this.buildFiles = data.files || [];
        this.status = `${this.buildFiles.filter(f => f.type === 'file').length} files in workspace.`;
      });
    },

    async handoffFromBuild() {
      if (!this.buildSession?.sessionId) {
        this.toast('No build session', 'Start a build first.', 'error');
        return;
      }
      return this.runBuildAgent({ fromBuild: true });
    },

    previewWorkspaceFile(filePath) {
      if (!this.buildSession?.sessionId) return '';
      return `/workspace-preview/${this.buildSession.sessionId}/${filePath}`;
    },

    loadDraft(draft) {
      if (!draft) return;
      this.form.projectName = draft.project_name || this.form.projectName;
      this.form.brainDump = draft.brain_dump || this.form.brainDump;
      this.blueprint = draft.blueprint || '';
      this.prototypeHtml = this.extractHtml(this.blueprint);
      this.savedDraftId = draft.id;
      this.previewMode = this.prototypeHtml ? 'prototype' : 'blueprint';
      this.setStage(this.prototypeHtml ? 'prototype' : 'blueprint');
      this.toast('Draft loaded', `Loaded ${draft.project_name || 'untitled'}.`);
    },

    downloadBlueprint() {
      if (!this.blueprint) return;
      const blob = new Blob([this.blueprint], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.slug(this.form.projectName || 'cauldron-blueprint')}.md`;
      a.click();
      URL.revokeObjectURL(url);
    },

    slug(value) {
      return String(value || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';
    },

    toast(title, message, type = 'info') {
      const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
      this.toasts.push({ id, title, message, type });
      window.setTimeout(() => {
        this.toasts = this.toasts.filter(t => t.id !== id);
      }, 5200);
    },

    announce(message) {
      this.status = message;
    },
  };
}

window.cauldronApp = cauldronApp;
