/**
 * routes/history.js
 * Route handlers for history.
 */

const { normaliseLimitOffset } = require('./_helpers');

function registerHistoryRoutes(app, deps) {
  const { db } = deps;

  app.get('/api/history', (req, res) => {
    try {
      const { limit, offset } = normaliseLimitOffset(req.query);
      res.json({
        success: true,
        sessions: db.getSessions(limit, offset),
        total: db.countSessions(),
      });
    } catch (err) {
      console.error('[Cauldron] History error:', err);
      res
        .status(500)
        .json({ success: false, error: 'Failed to fetch history', details: err.message });
    }
  });

  app.post('/api/history/cleanup', (req, res) => {
    try {
      const days = Number(req.body.days || 90);
      res.json({ success: true, purged: db.purgeOldDays(days) });
    } catch (err) {
      console.error('[Cauldron] History cleanup error:', err);
      res.status(500).json({ success: false, error: 'Cleanup failed', details: err.message });
    }
  });

  app.get('/api/stats', (req, res) => {
    try {
      res.json({
        success: true,
        stats: {
          totalDrafts: db.countDrafts(),
          totalSessions: db.countSessions(),
          totalResearchHistory:
            typeof db.countResearchHistory === 'function' ? db.countResearchHistory() : 0,
          recentActivity: db.getSessions(10, 0).length,
        },
      });
    } catch (err) {
      console.error('[Cauldron] Stats error:', err);
      res
        .status(500)
        .json({ success: false, error: 'Failed to fetch stats', details: err.message });
    }
  });
}

module.exports = registerHistoryRoutes;
