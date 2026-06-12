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
    flush();
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
  ensureColumn('drafts', 'prototype_html', 'TEXT DEFAULT \'\'');
  ensureColumn('drafts', 'prototype_iterations_json', 'TEXT DEFAULT \'[]\'');
  ensureColumn('drafts', 'blueprint_versions_json', 'TEXT DEFAULT \'[]\'');

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

  db.run(`
    CREATE TABLE IF NOT EXISTS research_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      source TEXT DEFAULT 'url-sweep',
      project_name TEXT DEFAULT '',
      brain_dump TEXT DEFAULT '',
      findings_json TEXT NOT NULL,
      formatted TEXT DEFAULT '',
      favorite INTEGER DEFAULT 0,
      reuse_count INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_used_at TEXT DEFAULT CURRENT_TIMESTAMP,
      draft_id INTEGER,
      FOREIGN KEY (draft_id) REFERENCES drafts(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS project_status_overrides (
      project_name TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      note TEXT DEFAULT '',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function hasColumn(tableName, columnName) {
  const db = requireDb();
  const rows = db.exec(`PRAGMA table_info(${tableName})`);
  if (!rows[0]) return false;
  const nameIndex = rows[0].columns.indexOf('name');
  return rows[0].values.some(row => row[nameIndex] === columnName);
}

function ensureColumn(tableName, columnName, definition) {
  const db = requireDb();
  if (hasColumn(tableName, columnName)) return;
  db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

let saveTimer = null;
let pendingDirty = false;

function flush() {
  if (!database) return;
  fs.writeFileSync(DB_PATH, Buffer.from(database.export()));
  pendingDirty = false;
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
}

function save() {
  pendingDirty = true;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (pendingDirty) flush();
  }, 250);
  if (typeof saveTimer.unref === 'function') saveTimer.unref();
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

function safeJsonParse(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeUrl(url) {
  const parsed = new URL(String(url || '').trim());
  parsed.hash = '';
  return parsed.toString();
}

function hydrateResearchRow(row) {
  if (!row) return row;
  return {
    ...row,
    findings: safeJsonParse(row.findings_json, {}),
  };
}

function upsertResearchRecord({ url, source = 'url-sweep', projectName = '', brainDump = '', findings = {}, formatted = '', draftId = null }) {
  if (!url) throw new Error('url is required');
  const db = requireDb();
  const normalisedUrl = normalizeUrl(url);
  const findingsJson = JSON.stringify(findings || {});

  const existing = getResearchByUrl(normalisedUrl);
  if (existing) {
    db.run(`
      UPDATE research_history
      SET source = ?, project_name = ?, brain_dump = ?, findings_json = ?, formatted = ?,
          reuse_count = reuse_count + 1,
          updated_at = CURRENT_TIMESTAMP,
          last_used_at = CURRENT_TIMESTAMP,
          draft_id = COALESCE(?, draft_id)
      WHERE id = ?
    `, [source, projectName, brainDump, findingsJson, formatted, draftId, existing.id]);
    save();
    return getResearchById(existing.id);
  }

  db.run(`
    INSERT INTO research_history (url, source, project_name, brain_dump, findings_json, formatted, draft_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [normalisedUrl, source, projectName, brainDump, findingsJson, formatted, draftId]);
  const id = db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
  save();
  return getResearchById(id);
}

function normalisePrototypeIterations(iterations = []) {
  if (!Array.isArray(iterations)) return [];
  return iterations.slice(-12).map((iteration, index) => ({
    id: String(iteration.id || `iteration-${index + 1}`),
    version: Number(iteration.version) || index + 1,
    critique: String(iteration.critique || ''),
    summary: String(iteration.summary || ''),
    html: String(iteration.html || ''),
    previousHtml: String(iteration.previousHtml || ''),
    createdAt: iteration.createdAt || new Date().toISOString(),
  }));
}

function normaliseBlueprintVersions(versions = [], currentBlueprint = '') {
  const seen = new Set();
  const normalised = Array.isArray(versions) ? versions : [];
  const mapped = normalised
    .filter(version => version && typeof version === 'object')
    .map((version, index) => {
      const blueprint = String(version.blueprint || version.content || '');
      const id = String(version.id || `blueprint-version-${index + 1}`);
      return {
        id,
        version: Number(version.version) || index + 1,
        blueprint,
        summary: String(version.summary || (index === 0 ? 'Baseline blueprint' : 'Blueprint update')),
        modelUsed: version.modelUsed ? String(version.modelUsed) : '',
        providerUsed: version.providerUsed ? String(version.providerUsed) : '',
        createdAt: version.createdAt || new Date().toISOString(),
      };
    })
    .filter(version => {
      const key = `${version.version}:${version.blueprint}`;
      if (!version.blueprint || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(-20)
    .map((version, index) => ({ ...version, version: index + 1 }));

  if (!mapped.length && currentBlueprint) {
    mapped.push({
      id: 'blueprint-version-1',
      version: 1,
      blueprint: String(currentBlueprint || ''),
      summary: 'Baseline blueprint',
      modelUsed: '',
      providerUsed: '',
      createdAt: new Date().toISOString(),
    });
  }

  return mapped;
}

function createDraft({
  projectName,
  brainDump = '',
  blueprint,
  designReference = 'none',
  generationMode = 'local',
  modelUsed = null,
  prototypeHtml = '',
  prototypeIterations = [],
  blueprintVersions = [],
}) {
  if (!projectName || !blueprint) throw new Error('projectName and blueprint are required');
  const db = requireDb();
  const filename = generateFilename(projectName);
  const markdownPath = path.join(DRAFTS_DIR, `${filename}.md`);
  const metaPath = path.join(META_DIR, `${filename}.json`);
  const normalisedIterations = normalisePrototypeIterations(prototypeIterations);
  const normalisedBlueprintVersions = normaliseBlueprintVersions(blueprintVersions, blueprint);

  fs.writeFileSync(markdownPath, blueprint, 'utf8');
  fs.writeFileSync(metaPath, JSON.stringify({
    projectName,
    brainDump,
    designReference,
    generationMode,
    modelUsed,
    prototypeHtml,
    prototypeIterations: normalisedIterations,
    blueprintVersions: normalisedBlueprintVersions,
    createdAt: new Date().toISOString(),
  }, null, 2), 'utf8');

  db.run(`
    INSERT INTO drafts (
      project_name, brain_dump, blueprint, design_reference, generation_mode, model_used,
      prototype_html, prototype_iterations_json, blueprint_versions_json, file_path, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, [
    projectName,
    brainDump,
    blueprint,
    designReference,
    generationMode,
    modelUsed,
    prototypeHtml || '',
    JSON.stringify(normalisedIterations),
    JSON.stringify(normalisedBlueprintVersions),
    markdownPath,
  ]);

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

function hydrateDraftRow(row) {
  if (row?.file_path && fs.existsSync(row.file_path)) {
    row.blueprint = fs.readFileSync(row.file_path, 'utf8');
  }
  if (row) {
    row.prototype_iterations = safeJsonParse(row.prototype_iterations_json, []);
    row.blueprint_versions = safeJsonParse(row.blueprint_versions_json, []);
    delete row.prototype_iterations_json;
    delete row.blueprint_versions_json;
  }
  return row;
}

function getDraftById(id) {
  const db = requireDb();
  const stmt = db.prepare('SELECT * FROM drafts WHERE id = ?');
  stmt.bind([Number(id)]);

  try {
    if (!stmt.step()) return null;
    return hydrateDraftRow(stmt.getAsObject());
  } finally {
    stmt.free();
  }
}

function getDraftByProjectName(projectName) {
  const db = requireDb();
  const stmt = db.prepare('SELECT * FROM drafts WHERE project_name = ? ORDER BY updated_at DESC LIMIT 1');
  stmt.bind([String(projectName || '')]);

  try {
    if (!stmt.step()) return null;
    return hydrateDraftRow(stmt.getAsObject());
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

function getResearchById(id) {
  const db = requireDb();
  const stmt = db.prepare('SELECT * FROM research_history WHERE id = ?');
  stmt.bind([Number(id)]);
  try {
    if (!stmt.step()) return null;
    return hydrateResearchRow(stmt.getAsObject());
  } finally {
    stmt.free();
  }
}

function getResearchByUrl(url) {
  const db = requireDb();
  let normalisedUrl;
  try {
    normalisedUrl = normalizeUrl(url);
  } catch {
    return null;
  }
  const stmt = db.prepare('SELECT * FROM research_history WHERE url = ?');
  stmt.bind([normalisedUrl]);
  try {
    if (!stmt.step()) return null;
    return hydrateResearchRow(stmt.getAsObject());
  } finally {
    stmt.free();
  }
}

function getResearchHistory({ limit = 50, offset = 0, q = '', favoriteOnly = false } = {}) {
  const db = requireDb();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const clauses = [];
  const params = [];

  if (favoriteOnly) clauses.push('favorite = 1');
  if (q) {
    clauses.push('(LOWER(url) LIKE LOWER(?) OR LOWER(project_name) LIKE LOWER(?) OR LOWER(brain_dump) LIKE LOWER(?) OR LOWER(formatted) LIKE LOWER(?))');
    const pattern = `%${q}%`;
    params.push(pattern, pattern, pattern, pattern);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const stmt = db.prepare(`
    SELECT *
    FROM research_history
    ${where}
    ORDER BY favorite DESC, last_used_at DESC, updated_at DESC
    LIMIT ? OFFSET ?
  `);
  stmt.bind([...params, safeLimit, safeOffset]);
  return rowsFromStatement(stmt).map(hydrateResearchRow);
}

function setResearchFavorite(id, favorite = true) {
  const db = requireDb();
  db.run('UPDATE research_history SET favorite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [favorite ? 1 : 0, Number(id)]);
  const changed = db.getRowsModified();
  save();
  return changed > 0;
}

const VALID_PROJECT_STATUSES = new Set(['running', 'stalled', 'failed', 'needs_review', 'completed', 'unknown']);

function normaliseProjectStatus(status) {
  const value = String(status || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (value === 'done') return 'completed';
  return VALID_PROJECT_STATUSES.has(value) ? value : 'unknown';
}

function setProjectStatusOverride(projectName, status, note = 'manual') {
  const name = sanitizeName(projectName);
  const normalised = normaliseProjectStatus(status);
  const db = requireDb();
  db.run(`
    INSERT INTO project_status_overrides (project_name, status, note, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(project_name) DO UPDATE SET
      status = excluded.status,
      note = excluded.note,
      updated_at = CURRENT_TIMESTAMP
  `, [name, normalised, note]);
  save();
  return getProjectStatusOverride(name);
}

function clearProjectStatusOverride(projectName) {
  const db = requireDb();
  db.run('DELETE FROM project_status_overrides WHERE project_name = ?', [sanitizeName(projectName)]);
  const changed = db.getRowsModified();
  save();
  return changed > 0;
}

function getProjectStatusOverride(projectName) {
  const db = requireDb();
  const stmt = db.prepare('SELECT * FROM project_status_overrides WHERE project_name = ?');
  stmt.bind([sanitizeName(projectName)]);
  try {
    if (!stmt.step()) return null;
    return stmt.getAsObject();
  } finally {
    stmt.free();
  }
}

function getProjectStatusOverrides() {
  const db = requireDb();
  const stmt = db.prepare('SELECT * FROM project_status_overrides');
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

function countResearchHistory() {
  return scalar('SELECT COUNT(*) AS count FROM research_history');
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
  flush,
  createDraft,
  getAllDrafts,
  getDraftById,
  getDraftByProjectName,
  deleteDraft,
  createSession,
  getSessions,
  upsertResearchRecord,
  getResearchById,
  getResearchByUrl,
  getResearchHistory,
  setResearchFavorite,
  setProjectStatusOverride,
  clearProjectStatusOverride,
  getProjectStatusOverride,
  getProjectStatusOverrides,
  purgeOldDays,
  countDrafts,
  countSessions,
  countResearchHistory,
  generateSessionId,
  paths: { DATA_DIR, DB_PATH, DRAFTS_DIR },
};
