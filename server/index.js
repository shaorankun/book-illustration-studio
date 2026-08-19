import { config } from './config.js';
import { createApp } from './app.js';
import { ensureDataDirs } from './store.js';

await ensureDataDirs();
const app = createApp();
app.listen(config.port, () => {
  console.log(`API on http://127.0.0.1:${config.port}`);
});
