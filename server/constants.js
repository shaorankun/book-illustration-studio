export const STEPS = [
  { key: 'STYLE', label: 'Style', status: 'STYLE_SET' },
  { key: 'CHARACTERS', label: 'Characters', status: 'CHARACTERS_GENERATED' },
  { key: 'PORTRAITS', label: 'Portraits', status: 'PORTRAITS_GENERATED' },
  { key: 'CHAPTERS', label: 'Chapters', status: 'CHAPTERS_GENERATED' },
  { key: 'ILLUSTRATIONS', label: 'Illustrations', status: 'DONE' },
];

export const STATUS_ORDER = ['CREATED', ...STEPS.map((s) => s.status)];

export const MAX_CHARACTERS = 2;
export const MAX_CHAPTERS = 1;

export const SYSTEM_INSTRUCTIONS = `There must be no text on the image, it should not look like a cover page.
It should be a full illustration with no borders, titles, nor description.
Unless asked otherwise, stay family-friendly with uplifting colors.
Each produced should be a simple image, no panels.`;

export function statusIndex(status) {
  return STATUS_ORDER.indexOf(status);
}

export function expectedStep(status) {
  const idx = statusIndex(status);
  if (idx < 0 || idx >= STEPS.length) return null;
  return STEPS[idx];
}

export function projectSubtitle(status) {
  if (status === 'CREATED') return 'Book text saved · style not yet generated';
  if (status === 'DONE') return 'All 5 steps complete';
  const idx = statusIndex(status);
  return STEPS.slice(0, idx).map((s) => s.label).join(' + ') + ' done';
}

export function listPill(status, stepState) {
  if (status === 'DONE') return 'Done';
  if (stepState === 'RUNNING') return 'In progress';
  if (status === 'CREATED') return 'Draft';
  return 'In progress';
}
