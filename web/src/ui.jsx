export function Wordmark() {
  return (
    <div className="wordmark">
      GRAD<span>ION</span>
    </div>
  );
}

export function initials(name) {
  return (name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function snippet(text, n) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export const STEP_LABELS = ['Style', 'Characters', 'Portraits', 'Chapters', 'Illustrations'];
export const STEP_KEYS = ['STYLE', 'CHARACTERS', 'PORTRAITS', 'CHAPTERS', 'ILLUSTRATIONS'];

export const CAPTIONS = {
  STYLE: 'Reading your book text and defining an art style',
  CHARACTERS: 'Generating the character list from your book’s text',
  PORTRAITS: 'Generating character portraits',
  CHAPTERS: 'Generating a chapter illustration prompt',
  ILLUSTRATIONS: 'Generating the chapter illustration',
};
