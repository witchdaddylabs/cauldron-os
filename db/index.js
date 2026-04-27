/**
 * Cauldron OS local storage
 *
 * Public-safe, local-first persistence using sql.js. Runtime data is written to
 * ./data by default and should never be committed.
 */
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DATA_DIR = process.env.CAULDRON_DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'cauldron.db');
const DRAFTS_DIR = path.join(DATA_DIR, 'drafts');
const META_DIR = path.join(DRAFTS_DIR, '.meta');

let SQL = null;
let database = null;
let readyPromise = null;

function ensureDirs() {
  for (const dir of [DATA_DIR, DRAFTS_DIR, META_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function init() {
  if (readyPromise) return readyPromise;

  readyPromise = (async () => {
    ensureDirs();
    SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
      database = new SQL.Database(fs.readFileSync(DB_PATH));
    } else {
      database = new SQL.Database();
    }

    runMigrations();
    save();
    return database;
  })();

  return readyPromise;
}

function requireDb() {
  if (!database) throw new Error('Database is not initialised');
  return database;
}

function runMigrations() {
  const db = requireDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT NOT NULL,
      brain_dump TEXT DEFAULT '',
      blueprint TEXT NOT NULL,
      design_reference TEXT DEFAULT 'none',
      generation_mode TEXT DEFAULT 'local',
      model_used TEXT,
      file_path TEXT UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE,
      brain_dump TEXT DEFAULT '',
      url_research TEXT,
      design_reference TEXT DEFAULT 'none',
      generation_mode TEXT DEFAULT 'local',
      model_used TEXT,
      draft_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (draft_id) REFERENCES drafts(id)
    )
  `);
}

function save() {
  const db = requireDb();
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function sanitizeName(name) {
  return String(name || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-') || 'untitled';
}

function generateFilename(projectName) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${sanitizeName(projectName)}-${stamp}`;
}

function createDraft({ projectName, brainDump = '', blueprint, designReference = 'none', generationMode = 'local', modelUsed = null }) {
  if (!projectName || !blueprint) throw new Error('projectName and blueprint are required');
  const db = requireDb();
  const filename = generateFilename(projectName);
  const markdownPath = path.join(DRAFTS_DIR, `${filename}.md`);
  const metaPath = path.join(META_DIR, `${filename}.json`);

  fs.writeFileSync(markdownPath, blueprint, 'utf8');
  fs.writeFileSync(metaPath, JSON.stringify({
    projectName,
    brainDump,
    designReference,
    generationMode,
    modelUsed,
    createdAt: new Date().toISOString(),
  }, null, 2), 'utf8');

  db.run(`
    INSERT INTO drafts (project_name, brain_dump, blueprint, design_reference, generation_mode, model_used, file_path, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, [projectName, brainDump, blueprint, designReference, generationMode, modelUsed, markdownPath]);

  const id = db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
  save();
  return { id, filename, filePath: markdownPath };
}

function rowsFromStatement(stmt) {
  const rows = [];
  try {
    while (stmt.step()) rows.push(stmt.getAsObject());
  } finally {
    stmt.free();
  }
  return rows;
}

function getAllDrafts(limit = 50, offset = 0, searchQuery = '') {
  const db = requireDb();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  let stmt;

  if (searchQuery) {
    const pattern = `%${searchQuery}%`;
    stmt = db.prepare(`
      SELECT id, project_name, design_reference, generation_mode, model_used, created_at, updated_at, brain_dump
      FROM drafts
      WHERE LOWER(project_name) LIKE LOWER(?) OR LOWER(brain_dump) LIKE LOWER(?) OR LOWER(blueprint) LIKE LOWER(?)
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `);
    stmt.bind([pattern, pattern, pattern, safeLimit, safeOffset]);
  } else {
    stmt = db.prepare(`
      SELECT id, project_name, design_reference, generation_mode, model_used, created_at, updated_at, brain_dump
      FROM drafts
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `);
    stmt.bind([safeLimit, safeOffset]);
  }

  return rowsFromStatement(stmt).map(row => ({
    ...row,
    preview: row.brain_dump ? `${row.brain_dump.slice(0, 140)}${row.brain_dump.length > 140 ? '…' : ''}` : '',
  }));
}

function getDraftById(id) {
  const db = requireDb();
  const stmt = db.prepare('SELECT * FROM drafts WHERE id = ?');
  stmt.bind([Number(id)]);

  try {
    if (!stmt.step()) return null;
    const row = stmt.getAsObject();
    if (row.file_path && fs.existsSync(row.file_path)) {
      row.blueprint = fs.readFileSync(row.file_path, 'utf8');
    }
    return row;
  } finally {
    stmt.free();
  }
}

function deleteDraft(id) {
  const db = requireDb();
  const draft = getDraftById(id);
  if (!draft) return false;

  if (draft.file_path && fs.existsSync(draft.file_path)) fs.unlinkSync(draft.file_path);
  const metaPath = draft.file_path
    ? path.join(META_DIR, `${path.basename(draft.file_path, '.md')}.json`)
    : null;
  if (metaPath && fs.existsSync(metaPath)) fs.unlinkSync(metaPath);

  db.run('DELETE FROM drafts WHERE id = ?', [Number(id)]);
  save();
  return true;
}

function createSession({ sessionId, brainDump = '', urlResearch = null, designReference = 'none', generationMode = 'local', modelUsed = null, draftId = null }) {
  const db = requireDb();
  db.run(`
    INSERT OR REPLACE INTO sessions (session_id, brain_dump, url_research, design_reference, generation_mode, model_used, draft_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, [
    sessionId || generateSessionId(),
    brainDump,
    urlResearch ? JSON.stringify(urlResearch) : null,
    designReference,
    generationMode,
    modelUsed,
    draftId,
  ]);
  save();
}

function getSessions(limit = 50, offset = 0) {
  const db = requireDb();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const stmt = db.prepare(`
    SELECT sessions.*, drafts.project_name
    FROM sessions
    LEFT JOIN drafts ON drafts.id = sessions.draft_id
    ORDER BY sessions.created_at DESC
    LIMIT ? OFFSET ?
  `);
  stmt.bind([safeLimit, safeOffset]);
  return rowsFromStatement(stmt);
}

function scalar(sql, params = []) {
  const db = requireDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  try {
    if (!stmt.step()) return 0;
    return Object.values(stmt.getAsObject())[0] || 0;
  } finally {
    stmt.free();
  }
}

function countDrafts() {
  return scalar('SELECT COUNT(*) AS count FROM drafts');
}

function countSessions() {
  return scalar('SELECT COUNT(*) AS count FROM sessions');
}

function purgeOldDays(daysOld = 90) {
  const db = requireDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Math.max(Number(daysOld) || 90, 1));
  const cutoffIso = cutoff.toISOString();

  const stmt = db.prepare('SELECT id FROM drafts WHERE updated_at < ?');
  stmt.bind([cutoffIso]);
  const oldDrafts = rowsFromStatement(stmt).map(row => row.id);
  oldDrafts.forEach(deleteDraft);

  db.run('DELETE FROM sessions WHERE created_at < ?', [cutoffIso]);
  const sessionsDeleted = db.getRowsModified();
  save();

  return { drafts: oldDrafts.length, sessions: sessionsDeleted };
}

function generateSessionId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

module.exports = {
  init,
  createDraft,
  getAllDrafts,
  getDraftById,
  deleteDraft,
  createSession,
  getSessions,
  purgeOldDays,
  countDrafts,
  countSessions,
  generateSessionId,
  paths: { DATA_DIR, DB_PATH, DRAFTS_DIR },
};
