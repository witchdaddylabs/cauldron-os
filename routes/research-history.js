/**
 * routes/research-history.js
 * Route handlers for research history.
 */

const { normaliseLimitOffset } = require('./_helpers');

function registerResearchHistoryRoutes(app, deps) {
  const { db } = deps;

  app.get('/api/research-history', (req, res) => {
    try {
      const { limit, offset } = normaliseLimitOffset(req.query);
      const research = db.getResearchHistory({
        limit,
        offset,
        q: req.query.q || '',
        favoriteOnly: req.query.favorite === '1' || req.query.favorite === 'true',
      });
      res.json({ success: true, research, total: db.countResearchHistory() });
    } catch (err) {
      console.error('[Cauldron] Research history error:', err);
      res
        .status(500)
        .json({ success: false, error: 'Failed to fetch research history', details: err.message });
    }
  });

  app.post('/api/research-history/:id/favorite', (req, res) => {
    try {
      const ok = db.setResearchFavorite(req.params.id, req.body.favorite !== false);
      if (!ok) return res.status(404).json({ success: false, error: 'Research record not found' });
      res.json({ success: true });
    } catch (err) {
      console.error('[Cauldron] Research favorite error:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to update research favorite',
        details: err.message,
      });
    }
  });
}

module.exports = registerResearchHistoryRoutes;
