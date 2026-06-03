const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const BUILD_AGENT_DEFINITIONS = [
  { id: 'handoff', name: 'Generate handoff package', command: null, launch: 'handoff' },
  { id: 'cursor', name: 'Cursor', command: 'cursor', launch: 'open-project' },
  { id: 'claude', name: 'Claude Code', command: 'claude', launch: 'manual-prompt' },
  { id: 'codex', name: 'Codex', command: 'codex', launch: 'manual-prompt' },
  { id: 'hermes', name: 'Hermes', command: 'hermes', launch: 'manual-prompt' },
  { id: 'opencode', name: 'OpenCode', command: 'opencode', launch: 'run-prompt' },
];

function findCommand(command) {
  if (!command) return null;
  const lookup = process.platform === 'win32' ? 'where' : 'which';
  try {
    return execFileSync(lookup, [command], { encoding: 'utf8' }).split(/\r?\n/).find(Boolean) || null;
  } catch {
    return null;
  }
}

function detectBuildAgents() {
  return BUILD_AGENT_DEFINITIONS.map(def => {
    if (def.id === 'handoff') {
      return {
        id: def.id,
        name: def.name,
        available: true,
        command: null,
        launch: def.launch,
        notes: 'Always available',
      };
    }

    const commandPath = findCommand(def.command);
    return {
      id: def.id,
      name: def.name,
      available: Boolean(commandPath),
      command: commandPath,
      launch: def.launch,
      notes: commandPath ? 'Detected on PATH' : `${def.command} not found on PATH`,
    };
  });
}

function commandPreview(command, args) {
  return [command, ...args.map(arg => /\s/.test(arg) ? JSON.stringify(arg) : arg)].join(' ');
}

function launchBuildAgent({ agentId, projectPath, dryRun = false }) {
  const agents = detectBuildAgents();
  const agent = agents.find(item => item.id === agentId) || agents[0];

  if (agent.id === 'handoff') {
    return { launched: false, fallback: false, agent, mode: 'handoff-only', command: null };
  }

  if (!agent.available || !agent.command) {
    return { launched: false, fallback: true, agent, mode: 'handoff-only', command: null, error: agent.notes };
  }

  if (agent.launch === 'manual-prompt') {
    return {
      launched: false,
      fallback: true,
      agent,
      mode: 'handoff-only',
      command: null,
      error: `${agent.name} launch is not automated yet; handoff package created.`,
    };
  }

  let args = [];
  let logPath = path.join(projectPath, 'build.log');

  if (agent.launch === 'open-project') {
    args = [projectPath];
  } else if (agent.launch === 'run-prompt') {
    const prompt = fs.readFileSync(path.join(projectPath, 'agent-prompt.md'), 'utf8');
    args = ['run', prompt, '--dir', projectPath];
  }

  const command = commandPreview(agent.command, args);
  if (dryRun) {
    return { launched: false, fallback: false, dryRun: true, agent, mode: 'dry-run', command, logPath };
  }

  let outFd = null;
  try {
    outFd = fs.openSync(logPath, 'a');
    fs.appendFileSync(logPath, `\n\n=== Build agent launched ${new Date().toISOString()} ===\n${command}\n\n`);
    const child = spawn(agent.command, args, {
      cwd: projectPath,
      detached: true,
      stdio: ['ignore', outFd, outFd],
    });
    child.on('error', err => {
      fs.appendFileSync(logPath, `\nBuild agent failed to start: ${err.message}\n`);
    });
    child.unref();

    return { launched: true, fallback: false, agent, mode: 'launched', command, logPath, pid: child.pid };
  } catch (err) {
    return {
      launched: false,
      fallback: true,
      agent,
      mode: 'handoff-only',
      command,
      logPath,
      error: `${agent.name} launch failed: ${err.message}`,
    };
  } finally {
    if (outFd !== null) fs.closeSync(outFd);
  }
}

module.exports = {
  BUILD_AGENT_DEFINITIONS,
  detectBuildAgents,
  launchBuildAgent,
};
