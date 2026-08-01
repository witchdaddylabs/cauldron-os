/**
 * routes/projects.js
 * Public interfaces:
 * - POST/DELETE /api/projects/:name/status: manual project status overrides.
 * - POST /api/projects/:name/resume: detached OpenCode resume run.
 * - POST /api/projects/:name/open-visible: visible terminal OpenCode launch.
 * - POST /api/projects/import: import local project folders into records.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function registerProjectsRoutes(app, deps) {
  const {
    db,
    getProjectPath,
    buildResumePrompt,
    buildOpencodeArgs,
    commandPreview,
    listImportableProjects,
  } = deps;

  app.post('/api/projects/:name/status', (req, res) => {
    try {
      const { safe } = getProjectPath(req.params.name);
      const { status, note = 'manual' } = req.body || {};
      if (!status) return res.status(400).json({ success: false, error: 'status is required' });
      const override = db.setProjectStatusOverride(safe, status, note);
      res.json({ success: true, project: safe, override });
    } catch (err) {
      console.error('[Cauldron] Project status update error:', err);
      res
        .status(500)
        .json({ success: false, error: 'Project status update failed', details: err.message });
    }
  });

  app.delete('/api/projects/:name/status', (req, res) => {
    try {
      const { safe } = getProjectPath(req.params.name);
      db.clearProjectStatusOverride(safe);
      res.json({ success: true, project: safe });
    } catch (err) {
      console.error('[Cauldron] Project status reset error:', err);
      res
        .status(500)
        .json({ success: false, error: 'Project status reset failed', details: err.message });
    }
  });

  app.post('/api/projects/:name/resume', (req, res) => {
    try {
      const dryRun =
        req.query.dryRun === '1' || req.query.dryRun === 'true' || req.body?.dryRun === true;
      const { safe, projectPath } = getProjectPath(req.params.name);
      const prompt = req.body?.prompt || buildResumePrompt(safe);
      const opencodeArgs = buildOpencodeArgs(prompt, projectPath);
      const command = commandPreview('opencode', opencodeArgs);
      const logPath = path.join(projectPath, 'opencode-resume.log');

      if (dryRun) return res.json({ success: true, dryRun: true, project: safe, command, logPath });

      const outFd = fs.openSync(logPath, 'a');
      fs.appendFileSync(
        logPath,
        `\n\n=== Resume launched ${new Date().toISOString()} ===\n${command}\n\n`
      );
      const child = spawn('opencode', opencodeArgs, {
        cwd: projectPath,
        detached: true,
        stdio: ['ignore', outFd, outFd],
      });
      child.unref();
      res.json({ success: true, dryRun: false, project: safe, pid: child.pid, command, logPath });
    } catch (err) {
      console.error('[Cauldron] Resume build error:', err);
      res.status(500).json({ success: false, error: 'Resume build failed', details: err.message });
    }
  });

  app.post('/api/projects/:name/open-visible', (req, res) => {
    try {
      const dryRun =
        req.query.dryRun === '1' || req.query.dryRun === 'true' || req.body?.dryRun === true;
      const { safe, projectPath } = getProjectPath(req.params.name);
      const shellCommand = `cd ${JSON.stringify(projectPath)} && opencode`;

      if (dryRun)
        return res.json({ success: true, dryRun: true, project: safe, command: shellCommand });

      let child;
      if (process.platform === 'darwin') {
        const osa = [
          'tell application "Terminal"',
          'activate',
          `do script ${JSON.stringify(shellCommand)}`,
          'end tell',
        ].join('\n');
        child = spawn('osascript', ['-e', osa], { detached: true, stdio: 'ignore' });
      } else {
        child = spawn('opencode', [], { cwd: projectPath, detached: true, stdio: 'ignore' });
      }
      child.unref();
      res.json({
        success: true,
        dryRun: false,
        project: safe,
        pid: child.pid,
        command: shellCommand,
      });
    } catch (err) {
      console.error('[Cauldron] Visible OpenCode error:', err);
      res
        .status(500)
        .json({ success: false, error: 'Visible OpenCode launch failed', details: err.message });
    }
  });

  app.post('/api/projects/import', (req, res) => {
    try {
      const dryRun =
        req.query.dryRun === '1' || req.query.dryRun === 'true' || req.body?.dryRun === true;
      const projects = listImportableProjects();
      const imported = [];
      const skipped = [];

      if (!dryRun) {
        for (const project of projects) {
          if (project.alreadyImported) {
            skipped.push({
              name: project.name,
              reason: 'already imported',
              draftId: project.existingDraftId,
            });
            continue;
          }

          const draft = db.createDraft({
            projectName: project.name,
            brainDump: `Imported from existing private project folder: ${project.path}`,
            blueprint: project.blueprint,
            designReference: 'private-project-folder',
            generationMode: 'opencode-import',
            modelUsed: 'opencode-go/deepseek-v4-flash',
          });
          db.createSession({
            sessionId: `import-${project.name}`,
            brainDump: `Imported from existing private project folder: ${project.path}`,
            designReference: 'private-project-folder',
            generationMode: 'opencode-import',
            modelUsed: 'opencode-go/deepseek-v4-flash',
            draftId: draft.id,
          });
          imported.push({ name: project.name, draftId: draft.id, source: project.source });
        }
      }

      res.json({
        success: true,
        dryRun,
        imported: imported.length,
        skipped: skipped.length,
        projects: projects.map(({ blueprint, ...project }) => ({
          ...project,
          blueprintChars: blueprint.length,
        })),
        importedProjects: imported,
        skippedProjects: skipped,
      });
    } catch (err) {
      console.error('[Cauldron] Project import error:', err);
      res
        .status(500)
        .json({ success: false, error: 'Project import failed', details: err.message });
    }
  });
}

module.exports = registerProjectsRoutes;
