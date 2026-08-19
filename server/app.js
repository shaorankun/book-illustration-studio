import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { listPill, projectSubtitle, expectedStep, STEPS, statusIndex } from './constants.js';
import { clearSession, requireUser, setSession } from './session.js';
import { startStep, clearStuck, isStale } from './pipeline.js';
import {
  createProject,
  getUser,
  imageFilePath,
  listProjects,
  loadProject,
  readBookText,
  upsertUser,
} from './store.js';

function publicProject(project, bookText = undefined) {
  const next = expectedStep(project.status);
  return {
    id: project.id,
    title: project.title,
    createdAt: project.createdAt,
    status: project.status,
    stepState: project.stepState,
    stepStartedAt: project.stepStartedAt,
    lastError: project.lastError,
    stale: isStale(project),
    style: project.style,
    nextStep: next?.key || null,
    nextLabel: next?.label || null,
    subtitle: projectSubtitle(project.status),
    pill: listPill(project.status, project.stepState),
    progress: statusIndex(project.status),
    steps: STEPS.map((s) => s.key),
    characters: project.characters.map((c, i) => ({
      name: c.name,
      prompt: c.prompt,
      portraitUrl: c.portraitFile
        ? `/api/projects/${project.id}/images/${c.portraitFile}`
        : null,
      generatingIndex: i,
    })),
    chapters: project.chapters.map((c, i) => ({
      name: c.name,
      prompt: c.prompt,
      illustrationUrl: c.illustrationFile
        ? `/api/projects/${project.id}/images/${c.illustrationFile}`
        : null,
      generatingIndex: i,
    })),
    ...(bookText !== undefined ? { bookText } : {}),
  };
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  app.post(
    '/api/session',
    asyncHandler(async (req, res) => {
      const name = String(req.body?.name || '').trim();
      const email = String(req.body?.email || '').trim().toLowerCase();
      if (!name || !email || !email.includes('@')) {
        res.status(400).json({ error: 'Enter your name and a valid email to continue.' });
        return;
      }
      const user = await upsertUser(email, name);
      setSession(res, email);
      res.json({ name: user.name, email: user.email });
    }),
  );

  app.post('/api/session/logout', (req, res) => {
    clearSession(res);
    res.json({ ok: true });
  });

  app.get(
    '/api/me',
    requireUser,
    asyncHandler(async (req, res) => {
      const user = await getUser(req.userEmail);
      if (!user) {
        res.status(401).json({ error: 'Sign in required' });
        return;
      }
      res.json({ name: user.name, email: user.email });
    }),
  );

  app.get(
    '/api/projects',
    requireUser,
    asyncHandler(async (req, res) => {
      const projects = await listProjects(req.userEmail);
      res.json({ projects: projects.map((p) => publicProject(p)) });
    }),
  );

  app.post(
    '/api/projects',
    requireUser,
    asyncHandler(async (req, res) => {
      const title = String(req.body?.title || '').trim();
      const bookText = String(req.body?.bookText || '').trim();
      if (!title || !bookText) {
        res.status(400).json({
          error: 'Give the project a title and provide the book text (paste or upload).',
        });
        return;
      }
      const project = await createProject({
        email: req.userEmail,
        title,
        bookText,
      });
      const text = await readBookText(project.id);
      res.status(201).json(publicProject(project, text));
    }),
  );

  app.get(
    '/api/projects/:id',
    requireUser,
    asyncHandler(async (req, res) => {
      const project = await loadProject(req.params.id);
      if (!project || project.userEmail !== req.userEmail) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      const bookText = await readBookText(project.id);
      res.json(publicProject(project, bookText));
    }),
  );

  app.post(
    '/api/projects/:id/steps/:step',
    requireUser,
    asyncHandler(async (req, res) => {
      const project = await loadProject(req.params.id);
      if (!project || project.userEmail !== req.userEmail) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      const step = String(req.params.step || '').toUpperCase();
      const customStyle = String(req.body?.style || '');
      try {
        const updated = await startStep(project.id, step, { customStyle });
        const bookText = await readBookText(project.id);
        res.status(202).json(publicProject(updated, bookText));
      } catch (err) {
        if (err.status) {
          res.status(err.status).json({ error: err.message });
          return;
        }
        throw err;
      }
    }),
  );

  app.post(
    '/api/projects/:id/unstick',
    requireUser,
    asyncHandler(async (req, res) => {
      const project = await loadProject(req.params.id);
      if (!project || project.userEmail !== req.userEmail) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      try {
        const updated = await clearStuck(project.id);
        const bookText = await readBookText(project.id);
        res.json(publicProject(updated, bookText));
      } catch (err) {
        if (err.status) {
          res.status(err.status).json({ error: err.message });
          return;
        }
        throw err;
      }
    }),
  );

  app.get(
    '/api/projects/:id/images/:file',
    requireUser,
    asyncHandler(async (req, res) => {
      const project = await loadProject(req.params.id);
      if (!project || project.userEmail !== req.userEmail) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      const file = path.basename(req.params.file);
      const allowed =
        project.characters.some((c) => c.portraitFile === file) ||
        project.chapters.some((c) => c.illustrationFile === file);
      if (!allowed) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.sendFile(imageFilePath(project.id, file));
    }),
  );

  app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return next(err);
    res.status(err.status || 500).json({ error: err.message || 'Server error' });
  });

  return app;
}
