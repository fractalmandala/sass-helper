/**
 * Imported for its side effect, before anything that reads a session file: point the app's persistence at a
 * throwaway directory, so `npm test` cannot scribble on the session the window itself restores.
 *
 * ESM hoists imports, so this has to be the first import in `test.ts` — before `src/state/app.svelte.ts`,
 * which reads `session.json` while it is being loaded.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.SASS_HELPER_DATA_DIR = join(mkdtempSync(join(tmpdir(), 'sass-helper-test-')), 'session');
