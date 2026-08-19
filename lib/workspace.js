/**
 * workspace.js — Per-Conversation Sandboxed File System
 *
 * Provides isolated workspaces under data/workspaces/<sessionId>/
 * for each conversation or session. All file operations are confined
 * to the sandbox directory with path traversal protection.
 *
 * Private Cauldron — XML Tool Agent System
 * Witch Daddy Labs
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const { isInsideRoot, requireSessionId } = require('./path-safety');

const execAsync = promisify(exec);

const BASE_WORKSPACE = path.resolve(__dirname, '..', 'data', 'workspaces');

// ─── Helpers ────────────────────────────────────────────────────────────

/** Ensure BASE_WORKSPACE directory exists */
function _ensureBaseDir() {
  if (!fs.existsSync(BASE_WORKSPACE)) {
    fs.mkdirSync(BASE_WORKSPACE, { recursive: true });
  }
}

/**
 * Return the sandbox root for a validated session id.
 */
function _workspaceRoot(sessionId) {
  const sid = requireSessionId(sessionId);
  return path.resolve(BASE_WORKSPACE, sid);
}

function _securityError(message) {
  const err = new Error(message);
  err.code = 'ESECURITY';
  return err;
}

/**
 * Resolve a path within the session workspace, rejecting traversal and
 * absolute paths.
 */
function _resolvePath(sessionId, filePath) {
  const sid = requireSessionId(sessionId);
  if (!filePath || typeof filePath !== 'string' || filePath.includes('\0')) {
    throw new Error('Invalid path: must be a non-empty string');
  }

  const normalised = filePath.replace(/\\/g, '/');
  if (
    path.isAbsolute(filePath) ||
    path.isAbsolute(normalised) ||
    normalised.startsWith('/') ||
    /^[a-zA-Z]:/.test(filePath)
  ) {
    throw _securityError(`Security: Absolute paths are not allowed: "${filePath}"`);
  }

  const root = path.resolve(BASE_WORKSPACE, sid);
  const resolved = path.resolve(root, filePath);
  if (!isInsideRoot(root, resolved)) {
    throw _securityError(`Security: Path traversal detected in "${filePath}"`);
  }

  return resolved;
}

async function _realpathInside(sessionId, resolved) {
  const root = _workspaceRoot(sessionId);
  const realRoot = await fs.promises.realpath(root);
  const realPath = await fs.promises.realpath(resolved);
  if (!isInsideRoot(realRoot, realPath)) {
    throw _securityError('Security: Path escaped workspace');
  }
  return realPath;
}

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Ensure a sandbox directory exists for the given session.
 *
 * @param {string} sessionId - The session identifier
 * @returns {Promise<string>} - Absolute path to the workspace directory
 */
async function ensureWorkspace(sessionId) {
  _ensureBaseDir();
  const dir = _workspaceRoot(sessionId);
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Get the absolute path to the workspace directory for a session.
 *
 * @param {string} sessionId - The session identifier
 * @returns {string} - Absolute path to the workspace directory
 */
function workspaceDir(sessionId) {
  return _workspaceRoot(sessionId);
}

/**
 * Write content to a file within the session workspace.
 * Creates parent directories automatically.
 *
 * @param {string} sessionId - The session identifier
 * @param {string} filePath - Relative path within the workspace (e.g., "src/index.html")
 * @param {string} content - File content to write
 * @returns {Promise<string>} - Absolute path of the written file
 */
async function wsWriteFile(sessionId, filePath, content) {
  await ensureWorkspace(sessionId);
  const resolved = _resolvePath(sessionId, filePath);
  const parentDir = path.dirname(resolved);

  await fs.promises.mkdir(parentDir, { recursive: true });
  const confinedParent = await _realpathInside(sessionId, parentDir);
  const target = path.join(confinedParent, path.basename(resolved));
  const realRoot = await fs.promises.realpath(_workspaceRoot(sessionId));
  if (!isInsideRoot(realRoot, target)) {
    throw _securityError('Security: Path escaped workspace');
  }

  await fs.promises.writeFile(target, content, 'utf-8');
  return target;
}

/**
 * Read file content from within the session workspace.
 *
 * @param {string} sessionId - The session identifier
 * @param {string} filePath - Relative path within the workspace
 * @returns {Promise<string>} - File content as a string
 */
async function wsReadFile(sessionId, filePath) {
  await ensureWorkspace(sessionId);
  const resolved = _resolvePath(sessionId, filePath);
  const confined = await _realpathInside(sessionId, resolved);
  return await fs.promises.readFile(confined, 'utf-8');
}

/**
 * Edit (patch) a file by replacing a string with a new string.
 * Uses fuzzy matching: tries exact match first, then whitespace-normalized match.
 *
 * @param {string} sessionId - The session identifier
 * @param {string} filePath - Relative path within the workspace
 * @param {string} oldStr - The string to find and replace
 * @param {string} newStr - The replacement string
 * @param {boolean} [replaceAll=false] - Replace all occurrences (default: false)
 * @returns {Promise<object>} - { success: boolean, message: string }
 */
async function wsEditFile(sessionId, filePath, oldStr, replaceAll = false, newStr) {
  // Support both call signatures:
  // wsEditFile(sessionId, path, oldStr, newStr, replaceAll)
  // wsEditFile(sessionId, path, oldStr, replaceAll, newStr) — legacy
  // We parse based on types:
  if (typeof replaceAll === 'string') {
    // Signature: (sessionId, path, oldStr, newStr, replaceAll)
    const actualNewStr = replaceAll;
    const actualReplaceAll = typeof newStr === 'boolean' ? newStr : false;
    return await _doEdit(sessionId, filePath, oldStr, actualNewStr, actualReplaceAll);
  }
  return await _doEdit(sessionId, filePath, oldStr, newStr, replaceAll);
}

/**
 * Internal edit implementation.
 */
async function _doEdit(sessionId, filePath, oldStr, newStr, replaceAll) {
  await ensureWorkspace(sessionId);
  const resolved = await _realpathInside(sessionId, _resolvePath(sessionId, filePath));

  let content;
  try {
    content = await fs.promises.readFile(resolved, 'utf-8');
  } catch (err) {
    return {
      success: false,
      message: `Error reading file "${filePath}": ${err.message}`,
    };
  }

  // Try exact match first
  if (!replaceAll) {
    const idx = content.indexOf(oldStr);
    if (idx !== -1) {
      content = content.replace(oldStr, newStr);
      await fs.promises.writeFile(resolved, content, 'utf-8');
      return {
        success: true,
        message: `✅ Patched file: ${filePath} (1 occurrence replaced)`,
      };
    }

    // Fuzzy match: normalize whitespace and try again
    const normalizedContent = content.replace(/\s+/g, ' ').trim();
    const normalizedOld = oldStr.replace(/\s+/g, ' ').trim();
    const fuzzyIdx = normalizedContent.indexOf(normalizedOld);

    if (fuzzyIdx !== -1) {
      // Find the actual substring in the original content by mapping positions
      // Since normalized content is continuous whitespace, we need to find
      // the original range. We use a simpler approach: find the first and last word.
      const words = oldStr.trim().split(/\s+/);
      if (words.length > 0) {
        const firstWordIdx = content.indexOf(words[0]);
        const lastWordIdx = content.lastIndexOf(words[words.length - 1]);
        if (firstWordIdx !== -1 && lastWordIdx !== -1 && lastWordIdx >= firstWordIdx) {
          const actualOldStr = content.slice(
            firstWordIdx,
            lastWordIdx + words[words.length - 1].length
          );
          content = content.replace(actualOldStr, newStr);
          await fs.promises.writeFile(resolved, content, 'utf-8');
          return {
            success: true,
            message: `✅ Patched file: ${filePath} (1 occurrence replaced, fuzzy match)`,
          };
        }
      }
    }

    return {
      success: false,
      message: `Could not find exact match for old_string in "${filePath}"`,
    };
  }

  // replaceAll mode
  if (content.includes(oldStr)) {
    const count = (content.match(new RegExp(escapeRegex(oldStr), 'g')) || []).length;
    content = content.split(oldStr).join(newStr);
    await fs.promises.writeFile(resolved, content, 'utf-8');
    return {
      success: true,
      message: `✅ Patched file: ${filePath} (${count} occurrences replaced)`,
    };
  }

  return {
    success: false,
    message: `Could not find any occurrences of old_string in "${filePath}"`,
  };
}

/**
 * Delete a file within the session workspace.
 *
 * @param {string} sessionId - The session identifier
 * @param {string} filePath - Relative path within the workspace
 * @returns {Promise<object>} - { success: boolean, message: string }
 */
async function wsDeleteFile(sessionId, filePath) {
  await ensureWorkspace(sessionId);
  const resolved = await _realpathInside(sessionId, _resolvePath(sessionId, filePath));

  try {
    await fs.promises.unlink(resolved);
    return {
      success: true,
      message: `✅ Deleted file: ${filePath}`,
    };
  } catch (err) {
    return {
      success: false,
      message: `Error deleting file "${filePath}": ${err.message}`,
    };
  }
}

/**
 * Recursively list all files in the session workspace.
 *
 * @param {string} sessionId - The session identifier
 * @returns {Promise<Array<{path: string, size: number, type: string}>>}
 *   - path: relative path from workspace root
 *   - size: file size in bytes
 *   - type: 'file' or 'directory'
 */
async function wsListFiles(sessionId) {
  const dir = _workspaceRoot(sessionId);
  const entries = [];

  if (!fs.existsSync(dir)) {
    return entries;
  }

  async function walk(currentDir, relativePath) {
    const items = await fs.promises.readdir(currentDir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(currentDir, item.name);
      const relPath = relativePath ? path.join(relativePath, item.name) : item.name;

      if (item.isDirectory()) {
        entries.push({
          path: relPath + '/',
          size: 0,
          type: 'directory',
        });
        await walk(fullPath, relPath);
      } else if (item.isFile()) {
        const stat = await fs.promises.stat(fullPath);
        entries.push({
          path: relPath,
          size: stat.size,
          type: 'file',
        });
      }
    }
  }

  await walk(dir, '');
  return entries;
}

/**
 * Run a shell command within the session workspace directory.
 *
 * @param {string} sessionId - The session identifier
 * @param {string} command - The shell command to execute
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number|null }>}
 */
async function wsRunBash(sessionId, command) {
  await ensureWorkspace(sessionId);
  const cwd = await fs.promises.realpath(_workspaceRoot(sessionId));

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: 60000, // 60 second default timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB max output
    });

    return {
      stdout: stdout || '',
      stderr: stderr || '',
      exitCode: 0,
    };
  } catch (err) {
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || err.message || '',
      exitCode: err.code || 1,
    };
  }
}

/**
 * Remove an entire workspace directory for a session.
 *
 * @param {string} sessionId - The session identifier
 * @returns {Promise<void>}
 */
async function cleanupWorkspace(sessionId) {
  const dir = _workspaceRoot(sessionId);

  if (fs.existsSync(dir)) {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────

/**
 * Escape special regex characters in a string.
 *
 * @param {string} str - Input string
 * @returns {string} - Escaped string safe for RegExp
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  ensureWorkspace,
  workspaceDir,
  wsWriteFile,
  wsReadFile,
  wsEditFile,
  wsDeleteFile,
  wsListFiles,
  wsRunBash,
  cleanupWorkspace,
};
