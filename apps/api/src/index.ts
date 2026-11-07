import * as path from 'path';
import * as os from 'os';
import { startServer, buildServer } from './server';

export { startServer, buildServer };

const PORT = parseInt(process.env.FML_PORT ?? '3847');
const DATA_DIR = process.env.FML_DATA_DIR ?? path.join(os.homedir(), '.five-map-locator');

if (process.env.NODE_ENV !== 'test' && !process.env.ELECTRON_RUN_AS_NODE) {
  startServer(PORT, DATA_DIR).then(() => {
    console.log(`[Five Map Locator API] Running at http://127.0.0.1:${PORT}`);
  }).catch((err) => {
    console.error('[Five Map Locator API] Failed to start:', err);
  });
}
