/**
 * routes/index.js
 * Barrel file that registers all route groups.
 */

const registerStatusRoutes = require('./status');
const registerDraftsRoutes = require('./drafts');
const registerHistoryRoutes = require('./history');
const registerResearchHistoryRoutes = require('./research-history');
const registerTemplatesRoutes = require('./templates');
const registerProjectsRoutes = require('./projects');
const registerModelsDesignRoutes = require('./models-design');
const registerGenerationRoutes = require('./generation');
const registerBuildRoutes = require('./build');
const registerBuildAgentRoutes = require('./build-agents');
const registerProxyRoutes = require('./proxy');
const registerWorkspacePreviewRoutes = require('./workspace-preview');
const registerSpaCatchallRoutes = require('./spa-catchall');

function registerAllRoutes(app, deps) {
  registerStatusRoutes(app, deps);
  registerDraftsRoutes(app, deps);
  registerHistoryRoutes(app, deps);
  registerResearchHistoryRoutes(app, deps);
  registerTemplatesRoutes(app, deps);
  registerProjectsRoutes(app, deps);
  registerModelsDesignRoutes(app, deps);
  registerGenerationRoutes(app, deps);
  registerBuildRoutes(app, deps);
  registerBuildAgentRoutes(app, deps);
  registerProxyRoutes(app, deps);
  registerWorkspacePreviewRoutes(app, deps);
  registerSpaCatchallRoutes(app, deps);
}

module.exports = registerAllRoutes;
