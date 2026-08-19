import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parsePromptList } from './gemini.js';
import {
  claimStep,
  clearStuck,
  executeClaimedStep,
  HttpError,
  setGeminiFactory,
} from './pipeline.js';
import { createProject, ensureDataDirs, loadProject, upsertUser } from './store.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function mockGemini(overrides = {}) {
  return {
    uploadBook: async () => ({ uri: 'files/book', name: 'files/book' }),
    startBookChat: async () => 'book-int',
    defineStyle: async (_id, custom) => ({ id: 'style-int', style: custom || 'watercolour' }),
    generateCharacters: async () => ({
      id: 'char-int',
      characters: [
        { name: 'Mole', prompt: 'A mole in a velvet jacket.' },
        { name: 'Rat', prompt: 'A water rat with a boat.' },
        { name: 'Toad', prompt: 'Should be dropped by the cap.' },
      ],
    }),
    generateChapters: async () => ({
      id: 'chap-int',
      chapters: [
        { name: 'The River Bank', prompt: 'Mole and Rat on the river.' },
        { name: 'Toad Hall', prompt: 'Should be dropped by the cap.' },
      ],
    }),
    startImageChat: async () => 'img-seed',
    generatePortrait: async (_id, ch) => ({
      id: `port-${ch.name}`,
      buffer: PNG,
      mimeType: 'image/png',
    }),
    startChapterImages: async () => 'img-chap',
    generateIllustration: async () => ({ id: 'ill-1', buffer: PNG, mimeType: 'image/png' }),
    ...overrides,
  };
}

async function seedProject() {
  await upsertUser('mira@example.com', 'Mira Hassan');
  return createProject({
    email: 'mira@example.com',
    title: 'Willows',
    bookText: 'The Mole had been working very hard all the morning.',
  });
}

describe('parsePromptList', () => {
  it('reads a JSON array and strips fences', () => {
    const raw = '```json\n[{"name":"Mole","prompt":"A mole"}]\n```';
    expect(parsePromptList(raw)).toEqual([{ name: 'Mole', prompt: 'A mole' }]);
  });
});

describe('pipeline', () => {
  beforeEach(async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bi-'));
    process.env.DATA_DIR = dir;
    process.env.STALE_RUNNING_MS = '40';
    await ensureDataDirs();
    setGeminiFactory(() => mockGemini());
  });

  afterEach(() => {
    setGeminiFactory(undefined);
  });

  it('rejects a step that is not next', async () => {
    const project = await seedProject();
    await expect(claimStep(project.id, 'CHARACTERS')).rejects.toMatchObject({ status: 409 });
  });

  it('rejects a second claim while RUNNING', async () => {
    const project = await seedProject();
    await claimStep(project.id, 'STYLE');
    await expect(claimStep(project.id, 'STYLE')).rejects.toBeInstanceOf(HttpError);
  });

  it('keeps status when a step fails', async () => {
    const project = await seedProject();
    setGeminiFactory(() =>
      mockGemini({
        defineStyle: async () => {
          throw new Error('quota');
        },
      }),
    );
    await claimStep(project.id, 'STYLE');
    await expect(executeClaimedStep(project.id, 'STYLE')).rejects.toThrow('quota');
    const live = await loadProject(project.id);
    expect(live.status).toBe('CREATED');
    expect(live.stepState).toBe('IDLE');
    expect(live.lastError).toBe('quota');
  });

  it('clears a stuck RUNNING step so it can be retried', async () => {
    const project = await seedProject();
    await claimStep(project.id, 'STYLE');
    const stuck = await loadProject(project.id);
    stuck.stepStartedAt = Date.now() - 1000;
    const { saveProject } = await import('./store.js');
    await saveProject(stuck);
    await clearStuck(project.id);
    const live = await loadProject(project.id);
    expect(live.stepState).toBe('IDLE');
    await claimStep(project.id, 'STYLE');
    await executeClaimedStep(project.id, 'STYLE');
    expect((await loadProject(project.id)).status).toBe('STYLE_SET');
  });

  it('runs all five steps and enforces 2 character / 1 chapter caps', async () => {
    const project = await seedProject();
    for (const step of ['STYLE', 'CHARACTERS', 'PORTRAITS', 'CHAPTERS', 'ILLUSTRATIONS']) {
      await claimStep(project.id, step);
      await executeClaimedStep(project.id, step);
    }
    const live = await loadProject(project.id);
    expect(live.status).toBe('DONE');
    expect(live.characters).toHaveLength(2);
    expect(live.characters.map((c) => c.name)).toEqual(['Mole', 'Rat']);
    expect(live.chapters).toHaveLength(1);
    expect(live.chapters[0].name).toBe('The River Bank');
    expect(live.characters.every((c) => c.portraitFile)).toBe(true);
    expect(live.chapters[0].illustrationFile).toBeTruthy();
  });

  it('does not regenerate portraits that already exist', async () => {
    const project = await seedProject();
    await claimStep(project.id, 'STYLE');
    await executeClaimedStep(project.id, 'STYLE');
    await claimStep(project.id, 'CHARACTERS');
    await executeClaimedStep(project.id, 'CHARACTERS');
    let calls = 0;
    setGeminiFactory(() =>
      mockGemini({
        generatePortrait: async (_id, ch) => {
          calls += 1;
          return { id: `port-${ch.name}`, buffer: PNG, mimeType: 'image/png' };
        },
      }),
    );
    await claimStep(project.id, 'PORTRAITS');
    await executeClaimedStep(project.id, 'PORTRAITS');
    expect(calls).toBe(2);
    await claimStep(project.id, 'PORTRAITS').catch(() => {});
    const live = await loadProject(project.id);
    expect(live.status).toBe('PORTRAITS_GENERATED');
    expect(calls).toBe(2);
  });
});
