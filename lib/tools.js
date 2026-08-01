/**
 * tools.js — Tool Definitions and Execution Engine
 *
 * Defines all available tools for the XML tool agent system.
 * Each tool has { name, description, params, run(ctx, args) }.
 * Execution is delegated to workspace.js functions with the
 * session context.
 *
 * Private Cauldron — XML Tool Agent System
 * Witch Daddy Labs
 */

const workspace = require('./workspace');

// ─── Tool Definitions ───────────────────────────────────────────────────

const toolDefinitions = [
  {
    name: 'write_file',
    description:
      'Write content to a file within the project workspace. Creates parent directories automatically. Use this for creating new files or completely overwriting existing ones.',
    params: [
      {
        name: 'path',
        type: 'string',
        required: true,
        description: 'Relative file path (e.g., "src/index.html")',
      },
      { name: 'content', type: 'string', required: true, description: 'File content to write' },
    ],
    run: async (ctx, args) => {
      _validateCtx(ctx);
      const { path: filePath, content } = args;
      if (!filePath) return 'Error: "path" parameter is required for write_file';
      if (content === undefined || content === null)
        return 'Error: "content" parameter is required for write_file';
      try {
        await workspace.wsWriteFile(ctx.sessionId, filePath, String(content));
        return `✅ Wrote file: ${filePath}`;
      } catch (err) {
        return `Error writing file "${filePath}": ${err.message}`;
      }
    },
  },

  {
    name: 'read_file',
    description:
      'Read the contents of a file from the workspace. Use this before editing files to see their current state.',
    params: [{ name: 'path', type: 'string', required: true, description: 'Relative file path' }],
    run: async (ctx, args) => {
      _validateCtx(ctx);
      const { path: filePath } = args;
      if (!filePath) return 'Error: "path" parameter is required for read_file';
      try {
        const content = await workspace.wsReadFile(ctx.sessionId, filePath);
        return content;
      } catch (err) {
        if (err.code === 'ENOENT') {
          return `Error: File "${filePath}" not found in workspace`;
        }
        return `Error reading file "${filePath}": ${err.message}`;
      }
    },
  },

  {
    name: 'edit_file',
    description:
      'Patch a file by finding and replacing text. For making targeted modifications without rewriting the entire file. Always read the file first before editing it.',
    params: [
      { name: 'path', type: 'string', required: true, description: 'Relative file path' },
      {
        name: 'old_string',
        type: 'string',
        required: true,
        description: 'Text to find and replace (should be unique)',
      },
      { name: 'new_string', type: 'string', required: true, description: 'Replacement text' },
      {
        name: 'replace_all',
        type: 'boolean',
        required: false,
        description: 'Replace all occurrences instead of the first',
      },
    ],
    run: async (ctx, args) => {
      _validateCtx(ctx);
      const { path: filePath, old_string, new_string, replace_all } = args;
      if (!filePath) return 'Error: "path" parameter is required for edit_file';
      if (!old_string) return 'Error: "old_string" parameter is required for edit_file';
      if (new_string === undefined || new_string === null)
        return 'Error: "new_string" parameter is required for edit_file';

      try {
        const result = await workspace.wsEditFile(
          ctx.sessionId,
          filePath,
          old_string,
          new_string,
          Boolean(replace_all)
        );
        return result.success ? `✅ ${result.message}` : `Error: ${result.message}`;
      } catch (err) {
        return `Error editing file "${filePath}": ${err.message}`;
      }
    },
  },

  {
    name: 'delete_file',
    description: 'Delete a file from the workspace.',
    params: [
      { name: 'path', type: 'string', required: true, description: 'Relative file path to delete' },
    ],
    run: async (ctx, args) => {
      _validateCtx(ctx);
      const { path: filePath } = args;
      if (!filePath) return 'Error: "path" parameter is required for delete_file';
      try {
        const result = await workspace.wsDeleteFile(ctx.sessionId, filePath);
        return result.success ? `✅ Deleted file: ${filePath}` : `Error: ${result.message}`;
      } catch (err) {
        return `Error deleting file "${filePath}": ${err.message}`;
      }
    },
  },

  {
    name: 'list_files',
    description:
      'List all files and directories in the workspace, recursively. Shows relative paths, file sizes, and types.',
    params: [],
    run: async (ctx) => {
      _validateCtx(ctx);
      try {
        const files = await workspace.wsListFiles(ctx.sessionId);
        if (files.length === 0) {
          return '📂 Workspace is empty — no files found.';
        }

        // Build a formatted tree
        const lines = ['📂 **Workspace Files:**', ''];
        let totalSize = 0;

        for (const entry of files) {
          if (entry.type === 'directory') {
            lines.push(`  📁 ${entry.path}`);
          } else {
            totalSize += entry.size;
            const sizeStr = _formatSize(entry.size);
            lines.push(`  📄 ${entry.path} (${sizeStr})`);
          }
        }

        lines.push('');
        lines.push(
          `**Total: ${files.filter((f) => f.type === 'file').length} files, ${_formatSize(totalSize)}**`
        );
        return lines.join('\n');
      } catch (err) {
        return `Error listing files: ${err.message}`;
      }
    },
  },

  {
    name: 'run_bash',
    description:
      'Execute a shell command in the project workspace directory. Use for running build tools, installers, dev servers, or any CLI commands. Returns stdout and stderr.',
    params: [
      { name: 'command', type: 'string', required: true, description: 'Shell command to execute' },
      {
        name: 'timeout',
        type: 'number',
        required: false,
        description: 'Timeout in milliseconds (default: 60000)',
      },
    ],
    run: async (ctx, args) => {
      _validateCtx(ctx);
      const { command } = args;
      if (!command) return 'Error: "command" parameter is required for run_bash';

      try {
        const result = await workspace.wsRunBash(ctx.sessionId, command);

        let output = '';
        if (result.stdout) {
          output += `📤 **stdout:**\n\`\`\`\n${result.stdout.slice(0, 10000)}\`\`\`\n`;
        }
        if (result.stderr) {
          output += `📤 **stderr:**\n\`\`\`\n${result.stderr.slice(0, 5000)}\`\`\`\n`;
        }
        if (!result.stdout && !result.stderr) {
          output = '✅ Command completed (no output)';
        }

        output += `\n**Exit code:** ${result.exitCode}`;
        return output;
      } catch (err) {
        return `Error running command: ${err.message}`;
      }
    },
  },

  {
    name: 'read_result',
    description:
      'Read a result file from the workspace. Useful for checking outputs of build processes or generated files.',
    params: [{ name: 'path', type: 'string', required: true, description: 'Relative file path' }],
    run: async (ctx, args) => {
      _validateCtx(ctx);
      const { path: filePath } = args;
      if (!filePath) return 'Error: "path" parameter is required for read_result';
      try {
        const content = await workspace.wsReadFile(ctx.sessionId, filePath);
        return content;
      } catch (err) {
        if (err.code === 'ENOENT') {
          return `Error: File "${filePath}" not found in workspace`;
        }
        return `Error reading file "${filePath}": ${err.message}`;
      }
    },
  },
];

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Build a formatted system prompt string with all tool schemas and usage
 * instructions for injection into the model's system prompt.
 *
 * @returns {string} - Formatted tool description string
 */
function toolsSystemPrompt() {
  const lines = [
    '## Available Tools',
    '',
    'You have access to the following tools to build and modify the project.',
    'To use a tool, emit an XML action block in your response.',
    'Use the EXACT parameter names listed below \u2014 not "param_name" or "param_value".',
    '',
    '**Examples:**',
    '',
    '```',
    '<action name="write_file">',
    '  <path>src/index.html</path>',
    '  <content><!DOCTYPE html><html>...</content>',
    '</action>',
    '```',
    '',
    '```',
    '<action name="run_bash">',
    '  <command>npm install lodash</command>',
    '</action>',
    '```',
    '',
    '```',
    '<action name="edit_file">',
    '  <path>src/App.js</path>',
    '  <old_string>import old from</old_string>',
    '  <new_string>import new from</new_string>',
    '</action>',
    '```',
    '',
    '**Important Rules:**',
    '- Always read a file with `read_file` before editing it with `edit_file`',
    '- Use `write_file` for creating new files or completely overwriting existing ones',
    '- Content inside `<content>` and `<command>` tags can contain HTML/XML markup',
    '- For web projects, output COMPLETE files \u2014 not partial snippets',
    '- You can chain multiple actions in a single response',
    '',
    '### Tool Reference:',
    '',
  ];

  for (const tool of toolDefinitions) {
    lines.push(`#### ${tool.name}`);
    lines.push(tool.description);
    lines.push('');

    if (tool.params.length > 0) {
      lines.push('Parameters:');
      for (const param of tool.params) {
        const required = param.required ? '**(required)**' : '*(optional)*';
        lines.push(`  - \`${param.name}\` (${param.type}) ${required}: ${param.description}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Execute a tool by name with the given arguments and context.
 * Also normalizes args to handle models that use different parameter naming
 * (e.g., Gemma's param_name/param_value pairs, scattered content fields).
 *
 * @param {string} name - Tool name (e.g., "write_file", "run_bash")
 * @param {object} args - Tool arguments (parameter key-value pairs)
 * @param {object} ctx - Execution context with { sessionId, workspace }
 * @returns {Promise<string>} - Human-readable result string
 */
async function runTool(name, args, ctx) {
  if (!name || typeof name !== 'string') {
    return `Error: Tool name must be a string, got ${typeof name}`;
  }

  // Normalize args for models that use alternative XML formats
  args = normalizeToolArgs(name, args || {});

  const tool = toolDefinitions.find((t) => t.name === name);
  if (!tool) {
    return `Error: Unknown tool "${name}". Available tools: ${toolDefinitions.map((t) => t.name).join(', ')}`;
  }

  try {
    return await tool.run(ctx, args || {});
  } catch (err) {
    return `Error executing tool "${name}": ${err.message}`;
  }
}

/**
 * Normalize tool arguments from model-specific XML formats into the
 * standard parameter structure expected by toolDefinitions.
 *
 * Handles:
 * 1. <param_name>/<param_value> pairs (Gemma format)
 * 2. Scattered content fields for write_file (Gemma format)
 * 3. Aliases for common parameter name variations
 *
 * @param {string} toolName - Name of the tool being called
 * @param {object} args - Raw arguments extracted from XML
 * @returns {object} - Normalized arguments
 */
function normalizeToolArgs(toolName, args) {
  const normalized = { ...args };

  // ── 1. Handle <param_name>/<param_value> pairs ────────────────────
  // Gemma uses: <param_name>path</param_name><param_value>src/index.html</param_value>
  // Instead of: <path>src/index.html</path>
  if (normalized.param_name && normalized.param_value !== undefined) {
    const key = String(normalized.param_name).trim();
    const val = normalized.param_value;
    // Only apply if the real parameter isn't already set
    if (normalized[key] === undefined) {
      normalized[key] = val;
    }
  }

  // ── 2. Aliases: map common alternate names to expected ones ────────
  const ALIASES = {
    file: 'path',
    file_path: 'path',
    filepath: 'path',
    filename: 'path',
    destination: 'path',
    cmd: 'command',
    shell: 'command',
    bash: 'command',
    exec: 'command',
    text: 'content',
    body: 'content',
    data: 'content',
    markup: 'content',
    html: 'content',
    source: 'content',
    code: 'content',
    find: 'old_string',
    search: 'old_string',
    from: 'old_string',
    replace: 'new_string',
    replacement: 'new_string',
    to: 'new_string',
  };

  for (const [alias, target] of Object.entries(ALIASES)) {
    if (normalized[alias] !== undefined && normalized[target] === undefined) {
      normalized[target] = normalized[alias];
    }
  }

  // For run_bash: if command is missing and path is present, path IS the command
  // (Gemini sometimes uses <path> instead of <command> for shell commands)
  if (
    toolName === 'run_bash' &&
    normalized.command === undefined &&
    normalized.path !== undefined
  ) {
    normalized.command = normalized.path;
  }

  // ── 3. For write_file: stitch scattered content fields ────────────
  if (
    toolName === 'write_file' &&
    (normalized.content === undefined || normalized.content === null || normalized.content === '')
  ) {
    // Gemma scatters HTML content across: head, title, body, header, h1, h2, etc.
    const contentParts = [];
    // Order matters for document structure
    const structuralFields = [
      'head',
      'title',
      'meta',
      'link',
      'style',
      'script',
      'body',
      'header',
      'nav',
      'main',
      'section',
      'article',
      'aside',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'span',
      'div',
      'ul',
      'ol',
      'li',
      'table',
      'form',
      'footer',
      'template',
    ];
    for (const field of structuralFields) {
      if (normalized[field] !== undefined && normalized[field] !== null) {
        contentParts.push(normalized[field]);
        delete normalized[field];
      }
    }
    // Also grab content from remaining string-ish values that look like
    // HTML/XML content fields (not random param names that happen to be long)
    const contentKeywords = new Set([
      'head',
      'title',
      'meta',
      'link',
      'style',
      'script',
      'body',
      'header',
      'nav',
      'main',
      'section',
      'article',
      'aside',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'span',
      'div',
      'ul',
      'ol',
      'li',
      'table',
      'form',
      'footer',
      'template',
      'html',
      'doctype',
    ]);
    for (const [key, val] of Object.entries(normalized)) {
      if (typeof val === 'string' && val.length > 20 && contentKeywords.has(key)) {
        contentParts.push(val);
      }
    }
    if (contentParts.length > 0) {
      normalized.content = contentParts.join('\n\n');
    }
  }

  // ── 4. Sanitize path parameters to prevent content bleed ──────────────
  // If a model produces malformed XML where content bleeds into the path
  // (e.g. missing </path> closing tag), truncate at characters that can't
  // appear in a valid relative file path.
  for (const pathKey of ['path', 'file', 'file_path', 'filepath', 'filename', 'destination']) {
    if (normalized[pathKey] && typeof normalized[pathKey] === 'string') {
      const val = normalized[pathKey];
      // Find the first character that can't be in a file path
      // Valid path chars: alphanumeric, _ - . / ~ and whitespace between parts
      const invalidMatch = val.match(/[^\w\-.\/~\s]/);
      if (invalidMatch) {
        normalized[pathKey] = val.slice(0, invalidMatch.index).trim();
        if (normalized[pathKey] !== val) {
          console.warn(
            `[tools] Path sanitized for "${pathKey}": "${val.slice(0, 60)}..." → "${normalized[pathKey]}"`
          );
        }
      }
      // Also truncate at newlines and angle brackets (safety net)
      const nl = normalized[pathKey].indexOf('\n');
      if (nl !== -1) normalized[pathKey] = normalized[pathKey].slice(0, nl).trim();
      const ang = normalized[pathKey].indexOf('<');
      if (ang !== -1) normalized[pathKey] = normalized[pathKey].slice(0, ang).trim();
    }
  }

  // ── 5. Clean up intermediary fields ────────────────────────────────
  delete normalized.param_name;
  delete normalized.param_value;

  return normalized;
}

// ─── Internal ────────────────────────────────────────────────────────────

/**
 * Validate that the execution context has the required fields.
 *
 * @param {object} ctx - Execution context
 * @throws {Error} - If required fields are missing
 */
function _validateCtx(ctx) {
  if (!ctx) throw new Error('Execution context (ctx) is required');
  if (!ctx.sessionId && !(ctx.workspace && ctx.workspace.sessionId)) {
    throw new Error('ctx.sessionId is required');
  }
}

/**
 * Format a byte size into a human-readable string.
 *
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size (e.g., "1.5 KB", "3.2 MB")
 */
function _formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(1);
  return `${size} ${units[i]}`;
}

module.exports = {
  toolDefinitions,
  runTool,
  toolsSystemPrompt,
};
