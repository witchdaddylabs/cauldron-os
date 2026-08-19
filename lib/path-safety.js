const path = require('path');

const SESSION_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

function isInsideRoot(rootDir, candidatePath) {
  const root = path.resolve(rootDir);
  const candidate = path.resolve(candidatePath);
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function parseSessionId(value) {
  const sessionId = String(value || '');
  if (!SESSION_ID_RE.test(sessionId)) return null;
  return sessionId;
}

function requireSessionId(value) {
  const sessionId = parseSessionId(value);
  if (!sessionId) {
    const err = new Error('Invalid sessionId');
    err.code = 'EINVAL_SESSION';
    throw err;
  }
  return sessionId;
}

module.exports = {
  SESSION_ID_RE,
  isInsideRoot,
  parseSessionId,
  requireSessionId,
};
