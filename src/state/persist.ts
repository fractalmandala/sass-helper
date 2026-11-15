/**
 * Where sass-helper keeps its own files.

 * The app is a Node or Bun process, so it reads and writes directly — no storage service, no browser
 * API. One file holds the whole session (the mode, both panes, the theme, the divider), which is what
 * lets a restart pick up exactly where the last one stopped.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

/**
 * `<appSupport>/sass-helper` on macOS, `%APPDATA%/sass-helper` on Windows, `~/.config/sass-helper` elsewhere.
 *
 * `SASS_HELPER_DATA_DIR` overrides it, which is how `test.ts` keeps its own session: the suite converts,
 * swaps and drags the divider for real, and doing that in the user's file would leave the next window open
 * at a width some test happened to leave behind.
 */
export function data_dir(): string {
	const override = process.env.SASS_HELPER_DATA_DIR;
	if (override) return override;
	const p = platform();
	if (p === 'darwin') return join(homedir(), 'Library', 'Application Support', 'sass-helper');
	if (p === 'win32') return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'sass-helper');
	return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'sass-helper');
}

const file = (name: string): string => join(data_dir(), name);

/** Read a JSON file, or `null` when it is missing or corrupt — a broken session never blocks launch. */
export function read_json<T>(name: string): T | null {
	try {
		const path = file(name);
		if (!existsSync(path)) return null;
		return JSON.parse(readFileSync(path, 'utf8')) as T;
	} catch {
		return null;
	}
}

/** Create the directory and write the file; a failure is swallowed, since losing a session is not fatal. */
export function write_json(name: string, value: unknown): boolean {
	try {
		mkdirSync(data_dir(), { recursive: true, mode: 0o700 });
		writeFileSync(file(name), JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 });
		return true;
	} catch {
		return false;
	}
}
