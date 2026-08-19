import { config } from './config.js';
import {
  expectedStep,
  MAX_CHARACTERS,
  MAX_CHAPTERS,
} from './constants.js';
import { createGemini, ensureBookUploaded } from './gemini.js';
import {
  getBookFilePath,
  loadProject,
  saveProject,
  withProject,
  writeImage,
} from './store.js';
import { withLock } from './lock.js';

let geminiFactory = createGemini;

export function setGeminiFactory(factory) {
  geminiFactory = factory || createGemini;
}

export function isStale(project, now = Date.now()) {
  return (
    project.stepState === 'RUNNING' &&
    project.stepStartedAt &&
    now - project.stepStartedAt > config.staleRunningMs
  );
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function claimStep(projectId, stepKey, extra = {}) {
  return withProject(projectId, (project) => {
    const expected = expectedStep(project.status);
    if (!expected) throw new HttpError(409, 'This project is already complete');
    if (expected.key !== stepKey) {
      throw new HttpError(409, `Next step is ${expected.key}, not ${stepKey}`);
    }
    if (project.stepState === 'RUNNING' && !isStale(project)) {
      throw new HttpError(409, 'This step is already running');
    }
    project.stepState = 'RUNNING';
    project.stepStartedAt = Date.now();
    project.lastError = null;
    if (stepKey === 'STYLE') project.pendingStyle = extra.customStyle || '';
    return { ...project };
  });
}

export async function failStep(projectId, err) {
  await withProject(projectId, (project) => {
    project.stepState = 'IDLE';
    project.stepStartedAt = null;
    project.lastError = err.message || String(err);
  });
}

export async function clearStuck(projectId) {
  return withProject(projectId, (project) => {
    if (project.stepState !== 'RUNNING') {
      throw new HttpError(409, 'No step is running');
    }
    project.stepState = 'IDLE';
    project.stepStartedAt = null;
    project.lastError = 'Interrupted — retry this step';
    return { ...project };
  });
}

function extFor(mimeType) {
  if (mimeType?.includes('jpeg')) return 'jpg';
  if (mimeType?.includes('webp')) return 'webp';
  return 'png';
}

async function runStyle(gemini, project) {
  await ensureBookUploaded(gemini, project, getBookFilePath(project.id));
  await savePartial(project);
  const custom = project.pendingStyle || '';
  const result = await gemini.defineStyle(project.gemini.bookInteractionId, custom);
  project.gemini.styleInteractionId = result.id;
  project.style = result.style;
  project.pendingStyle = '';
  project.status = 'STYLE_SET';
}

async function runCharacters(gemini, project) {
  const prev = project.gemini.styleInteractionId || project.gemini.bookInteractionId;
  const result = await gemini.generateCharacters(prev);
  project.gemini.charactersInteractionId = result.id;
  project.characters = result.characters.slice(0, MAX_CHARACTERS).map((c) => ({
    name: c.name,
    prompt: c.prompt,
    portraitFile: null,
  }));
  project.status = 'CHARACTERS_GENERATED';
}

async function runPortraits(gemini, project) {
  if (!project.gemini.imageSeedInteractionId) {
    project.gemini.imageSeedInteractionId = await gemini.startImageChat(project.style);
    project.gemini.lastImageInteractionId = project.gemini.imageSeedInteractionId;
    await savePartial(project);
  }
  for (let i = 0; i < project.characters.length; i++) {
    const character = project.characters[i];
    if (character.portraitFile) continue;
    const image = await gemini.generatePortrait(
      project.gemini.lastImageInteractionId,
      character,
    );
    project.gemini.lastImageInteractionId = image.id;
    const filename = `portrait-${i}.${extFor(image.mimeType)}`;
    await writeImage(project.id, filename, image.buffer);
    character.portraitFile = filename;
    await savePartial(project);
  }
  project.status = 'PORTRAITS_GENERATED';
}

async function runChapters(gemini, project) {
  const prev = project.gemini.charactersInteractionId || project.gemini.styleInteractionId;
  const result = await gemini.generateChapters(prev);
  project.gemini.chaptersInteractionId = result.id;
  project.chapters = result.chapters.slice(0, MAX_CHAPTERS).map((c) => ({
    name: c.name,
    prompt: c.prompt,
    illustrationFile: null,
  }));
  project.status = 'CHAPTERS_GENERATED';
}

async function runIllustrations(gemini, project) {
  if (!project.gemini.lastImageInteractionId) {
    throw new HttpError(409, 'Portraits must exist before illustrations');
  }
  if (!project.gemini.chapterImageIntroId) {
    project.gemini.chapterImageIntroId = await gemini.startChapterImages(
      project.gemini.lastImageInteractionId,
    );
    project.gemini.lastImageInteractionId = project.gemini.chapterImageIntroId;
    await savePartial(project);
  }
  for (let i = 0; i < project.chapters.length; i++) {
    const chapter = project.chapters[i];
    if (chapter.illustrationFile) continue;
    const image = await gemini.generateIllustration(
      project.gemini.lastImageInteractionId,
      chapter,
    );
    project.gemini.lastImageInteractionId = image.id;
    const filename = `illustration-${i}.${extFor(image.mimeType)}`;
    await writeImage(project.id, filename, image.buffer);
    chapter.illustrationFile = filename;
    await savePartial(project);
  }
  project.status = 'DONE';
}

async function savePartial(project) {
  await withLock(project.id, () => saveProject(project));
}

const runners = {
  STYLE: runStyle,
  CHARACTERS: runCharacters,
  PORTRAITS: runPortraits,
  CHAPTERS: runChapters,
  ILLUSTRATIONS: runIllustrations,
};

export async function executeClaimedStep(projectId, stepKey) {
  const gemini = geminiFactory();
  const project = await loadProject(projectId);
  if (!project) throw new HttpError(404, 'Project not found');
  try {
    const runner = runners[stepKey];
    if (!runner) throw new HttpError(400, `Unknown step ${stepKey}`);
    await runner(gemini, project);
    project.stepState = 'IDLE';
    project.stepStartedAt = null;
    project.lastError = null;
    await savePartial(project);
  } catch (err) {
    project.stepState = 'IDLE';
    project.stepStartedAt = null;
    project.lastError = err.message || String(err);
    await savePartial(project).catch(() => failStep(projectId, err));
    throw err;
  }
}

const inFlight = new Set();

export async function startStep(projectId, stepKey, extra = {}) {
  const claimed = await claimStep(projectId, stepKey, extra);
  if (inFlight.has(projectId)) {
    return claimed;
  }
  inFlight.add(projectId);
  setImmediate(() => {
    executeClaimedStep(projectId, stepKey)
      .catch((err) => {
        console.error(`[pipeline] ${projectId} ${stepKey} failed:`, err.message);
      })
      .finally(() => {
        inFlight.delete(projectId);
      });
  });
  return claimed;
}
