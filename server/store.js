import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';
import { withLock } from './lock.js';

const USERS_KEY = '__users__';

function usersPath() {
  return path.join(config.dataDir, 'users.json');
}

function projectPath(id) {
  return path.join(config.dataDir, 'projects', `${id}.json`);
}

function bookPath(id) {
  return path.join(config.dataDir, 'books', `${id}.txt`);
}

function imageDir(id) {
  return path.join(config.dataDir, 'images', id);
}

async function readJson(file, fallback) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  try {
    await fs.rename(tmp, file);
  } catch {
    await fs.copyFile(tmp, file);
    await fs.unlink(tmp).catch(() => {});
  }
}

export async function ensureDataDirs() {
  await fs.mkdir(path.join(config.dataDir, 'projects'), { recursive: true });
  await fs.mkdir(path.join(config.dataDir, 'books'), { recursive: true });
  await fs.mkdir(path.join(config.dataDir, 'images'), { recursive: true });
  const users = await readJson(usersPath(), { users: {} });
  if (!users.users) users.users = {};
  await writeJson(usersPath(), users);
}

export function newId() {
  return crypto.randomBytes(6).toString('hex');
}

export async function upsertUser(email, name) {
  return withLock(USERS_KEY, async () => {
    const db = await readJson(usersPath(), { users: {} });
    const existing = db.users[email];
    if (existing) {
      existing.name = name;
    } else {
      db.users[email] = { email, name, projectIds: [] };
    }
    await writeJson(usersPath(), db);
    return db.users[email];
  });
}

export async function getUser(email) {
  const db = await readJson(usersPath(), { users: {} });
  return db.users[email] || null;
}

async function attachProjectId(email, projectId) {
  await withLock(USERS_KEY, async () => {
    const db = await readJson(usersPath(), { users: {} });
    const user = db.users[email];
    if (!user) throw Object.assign(new Error('User not found'), { status: 401 });
    if (!user.projectIds.includes(projectId)) user.projectIds.unshift(projectId);
    await writeJson(usersPath(), db);
  });
}

export async function createProject({ email, title, bookText }) {
  const id = newId();
  const project = {
    id,
    userEmail: email,
    title,
    createdAt: Date.now(),
    status: 'CREATED',
    stepState: 'IDLE',
    stepStartedAt: null,
    lastError: null,
    style: null,
    characters: [],
    chapters: [],
    gemini: {
      fileUri: null,
      fileName: null,
      bookInteractionId: null,
      styleInteractionId: null,
      charactersInteractionId: null,
      chaptersInteractionId: null,
      imageSeedInteractionId: null,
      chapterImageIntroId: null,
      lastImageInteractionId: null,
    },
  };
  await withLock(id, async () => {
    await writeJson(projectPath(id), project);
    await fs.mkdir(path.dirname(bookPath(id)), { recursive: true });
    await fs.writeFile(bookPath(id), bookText, 'utf8');
  });
  await attachProjectId(email, id);
  return project;
}

export async function readBookText(id) {
  return fs.readFile(bookPath(id), 'utf8');
}

export function getBookFilePath(id) {
  return bookPath(id);
}

export async function loadProject(id) {
  const project = await readJson(projectPath(id), null);
  return project;
}

export async function saveProject(project) {
  await writeJson(projectPath(project.id), project);
}

export async function withProject(id, fn) {
  return withLock(id, async () => {
    const project = await loadProject(id);
    if (!project) {
      const err = new Error('Project not found');
      err.status = 404;
      throw err;
    }
    const result = await fn(project);
    await saveProject(project);
    return result === undefined ? project : result;
  });
}

export async function listProjects(email) {
  const user = await getUser(email);
  if (!user) return [];
  const projects = [];
  for (const id of user.projectIds) {
    const p = await loadProject(id);
    if (p && p.userEmail === email) projects.push(p);
  }
  return projects;
}

export async function writeImage(projectId, filename, buffer) {
  const dir = imageDir(projectId);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, filename);
  await fs.writeFile(file, buffer);
  return file;
}

export function imageFilePath(projectId, filename) {
  return path.join(imageDir(projectId), filename);
}
