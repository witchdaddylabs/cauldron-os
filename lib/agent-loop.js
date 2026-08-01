/**
 * agent-loop.js — Multi-Turn Agent Controller
 *
 * Orchestrates the model <-> tool loop:
 * 1. Build system prompt with workspace state + tool descriptions
 * 2. Send user prompt to the model via Ollama API
 * 3. Stream tokens, detect <action> blocks via xml-parser
 * 4. When action is found, execute the tool and feed result back to model
 * 5. Loop up to MAX_ROUNDS per user message
 *
 * Private Cauldron — XML Tool Agent System
 * Witch Daddy Labs
 */

const { findNextAction } = require('./xml-parser');
const { runTool, toolsSystemPrompt } = require('./tools');
const workspace = require('./workspace');

const MAX_ROUNDS = 40;
const DEFAULT_BASE_URL = 'http://localhost:11434';

// ─── Agent Loop ──────────────────────────────────────────────────────────

/**
 * Multi-turn agent loop that yields iterable chunks.
 *
 * @param {object} options
 * @param {string} options.prompt - The user's prompt / message
 * @param {string} [options.model] - Model name to use (e.g., "llama3.2")
 * @param {string} [options.systemPrompt] - Optional additional system instructions
 * @param {string} options.sessionId - Session identifier for workspace isolation
 * @param {object} [options.workspaceData] - Optional initial workspace files data
 * @param {function} [options.onFileChange] - Called when files are created/modified
 * @param {function} [options.onAction] - Called when an action is executed
 * @param {function} [options.onStream] - Called with each streamed token
 * @param {string} [options.baseUrl] - Ollama API base URL (default: http://localhost:11434)
 * @yields {object} - Tokens { token: string } or final { done: true, files: [], actions: [] }
 */
async function* generateWithTools({
  prompt,
  model,
  systemPrompt,
  sessionId,
  workspaceData,
  onFileChange,
  onAction,
  onStream,
  baseUrl,
}) {
  // Ensure workspace exists
  await workspace.ensureWorkspace(sessionId);

  const finalActions = [];
  const finalFiles = [];
  const baseUrlFinal = (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');

  // Build the system prompt
  const fullSystemPrompt = await buildSystemPrompt({
    systemPrompt,
    sessionId,
    workspaceData,
  });

  // Messages array for context
  const messages = [
    { role: 'system', content: fullSystemPrompt },
    { role: 'user', content: prompt },
  ];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { content, actions } = await _streamAndParse({
      messages,
      model,
      baseUrl: baseUrlFinal,
      sessionId,
      onStream,
      onAction,
      onFileChange,
      finalActions,
      finalFiles,
    });

    // Push assistant response to context
    messages.push({ role: 'assistant', content });

    // If no actions were taken this round, we're done
    if (actions.length === 0) {
      // Yield final result
      yield {
        done: true,
        files: [...new Set(finalFiles)],
        actions: finalActions,
        messages,
      };
      return;
    }

    // Process each action and feed results back
    let hasToolResult = false;

    for (const action of actions) {
      const result = await runTool(action.name, action.args, { sessionId });

      if (onAction) {
        onAction({ action: action.name, args: action.args, result });
      }

      // Track file operations
      if (['write_file', 'edit_file', 'delete_file'].includes(action.name)) {
        if (action.args && action.args.path) {
          finalFiles.push(action.args.path);
        }
        if (onFileChange) {
          onFileChange({ action: action.name, path: action.args?.path, result });
        }
      }

      // Add tool result as a message
      messages.push({
        role: 'user',
        content: `[Tool Result: ${action.name}]\n\n${result}\n\n${_continuePrompt()}`,
      });

      hasToolResult = true;
    }

    if (!hasToolResult) {
      // No tool results to process — we're done
      yield {
        done: true,
        files: [...new Set(finalFiles)],
        actions: finalActions,
        messages,
      };
      return;
    }

    // Yield a round-marker for progress tracking
    yield {
      round: round + 1,
      actions: actions.map((a) => ({ name: a.name, args: a.args })),
    };
  }

  // Max rounds reached
  yield {
    done: true,
    maxRoundsReached: true,
    files: [...new Set(finalFiles)],
    actions: finalActions,
    messages,
  };
}

// ─── System Prompt Builder ──────────────────────────────────────────────

/**
 * Build the full system prompt including tool descriptions, workspace state,
 * and behavioral instructions.
 *
 * @param {object} options
 * @param {string} [options.systemPrompt] - Custom system instructions
 * @param {string} options.sessionId - Session identifier
 * @returns {Promise<string>} - The complete system prompt
 */
async function buildSystemPrompt({ systemPrompt, sessionId } = {}) {
  const lines = [
    'You are Cauldron OS — a project-building AI assistant.',
    'You create, read, edit, and manage files in a sandboxed workspace.',
    '',
    '## Your Capabilities',
    '',
    'You can build complete web projects, write code, run commands, and',
    'manage files. You work inside an isolated workspace directory.',
    '',
  ];

  // Inject tool system prompt
  lines.push(toolsSystemPrompt());
  lines.push('');

  // Add workspace state if available
  try {
    const files = await workspace.wsListFiles(sessionId);
    if (files && files.length > 0) {
      lines.push('## Current Workspace State');
      lines.push('');
      for (const entry of files) {
        if (entry.type === 'directory') {
          lines.push(`  📁 ${entry.path}`);
        } else {
          const sizeStr =
            entry.size < 1024 ? `${entry.size} B` : `${(entry.size / 1024).toFixed(1)} KB`;
          lines.push(`  📄 ${entry.path} (${sizeStr})`);
        }
      }
      lines.push('');
    }
  } catch {
    // Workspace might not exist yet — fine
  }

  // Append custom system prompt if provided
  if (systemPrompt) {
    lines.push('');
    lines.push('## Additional Instructions');
    lines.push('');
    lines.push(systemPrompt);
    lines.push('');
  }

  // Behavioral guidelines
  lines.push('');
  lines.push('## Behavioral Guidelines');
  lines.push('');
  lines.push('- Always read a file BEFORE editing it with edit_file');
  lines.push('- For web projects, output COMPLETE files, not partial snippets');
  lines.push('- You can chain multiple actions in a single response');
  lines.push('- When you encounter errors, fix them and retry');
  lines.push('- Run `npm install` or similar commands with run_bash after creating package.json');
  lines.push('- Use the XML action format: <action name="tool_name"><param>value</param></action>');
  lines.push('- Content inside <content> and <command> tags is treated as raw text');
  lines.push('- After completing all tasks, output a summary of what was built');

  return lines.join('\n');
}

// ─── Internal Streaming & Parsing ────────────────────────────────────────

/**
 * Stream a model response and detect action blocks in real-time.
 *
 * @param {object} options
 * @param {Array} options.messages - Message history
 * @param {string} options.model - Model name
 * @param {string} options.baseUrl - Ollama base URL
 * @param {function} options.onStream - Token callback
 * @param {Array} options.finalActions - Accumulator for all actions
 * @returns {Promise<{ content: string, actions: Array }>}
 */
async function _streamAndParse({ messages, model, baseUrl, onStream, finalActions }) {
  const url = `${baseUrl}/api/chat`;
  const responseText = await _streamTokens({
    url,
    messages,
    model,
    onToken: (token) => {
      if (onStream) onStream({ token });
    },
  });

  // Parse all actions from the response
  const actions = _extractAllActions(responseText);

  // Report actions
  for (const action of actions) {
    finalActions.push({ name: action.name, args: action.args, round: finalActions.length + 1 });
  }

  return { content: responseText, actions };
}

/**
 * Stream tokens from the Ollama chat API.
 *
 * @param {object} options
 * @returns {Promise<string>} - The full response text
 */
async function _streamTokens({ url, messages, model, onToken }) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || 'llama3.2',
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Ollama API error (${response.status}): ${errBody || response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n').filter((l) => l.trim());

    for (const line of lines) {
      try {
        const json = JSON.parse(line);
        const token = json.message?.content || json.response || '';
        if (token) {
          fullText += token;
          if (onToken) onToken(token);
        }
        if (json.done) break;
      } catch {
        // Skip malformed JSON lines
      }
    }
  }

  return fullText;
}

/**
 * Extract all complete <action> blocks from a response text.
 *
 * @param {string} text - The model's response text
 * @returns {Array<{ name: string, args: object }>}
 */
function _extractAllActions(text) {
  const actions = [];
  let fromIndex = 0;

  while (fromIndex < text.length) {
    const result = findNextAction(text, fromIndex);

    if (result === null) {
      break;
    }

    if (result === 'incomplete') {
      // Incomplete action at the end — ignore it
      break;
    }

    actions.push({ name: result.name, args: result.args });
    fromIndex = result.end;
  }

  return actions;
}

/**
 * Generate the "continue" prompt sent after tool results to encourage
 * the model to proceed with the next action.
 *
 * @returns {string}
 */
function _continuePrompt() {
  return 'Continue working. If you are done, respond with a summary of what was completed.';
}

module.exports = {
  generateWithTools,
  buildSystemPrompt,
};
