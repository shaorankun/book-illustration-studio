import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  root,
  get port() {
    return Number(process.env.PORT || 3001);
  },
  get dataDir() {
    return path.resolve(root, process.env.DATA_DIR || './data');
  },
  get sessionSecret() {
    return process.env.SESSION_SECRET || 'dev-only-secret';
  },
  get geminiApiKey() {
    return process.env.GEMINI_API_KEY || '';
  },
  get textModel() {
    return process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';
  },
  get imageModel() {
    return process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
  },
  get staleRunningMs() {
    return Number(process.env.STALE_RUNNING_MS || 180000);
  },
};
