/**
 * Putting text on the system clipboard.

 * GPUI has no clipboard binding — the a11y page says so plainly — but this app is an ordinary Node or
 * Bun process, so it pipes the text through the platform's own clip utility. Every route is tried in
 * order and the result is reported honestly: a copy that fell back to a file is labelled as one, so the
 * UI never claims the text is "on your clipboard" when it is on disk.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { platform, tmpdir } from 'node:os';
import { join } from 'node:path';

export type CopyResult = { ok: boolean; via: string };

const run = (cmd: string, args: string[], text: string): boolean => {
	try {
		return spawnSync(cmd, args, { input: text, encoding: 'utf8', timeout: 2000 }).status === 0;
	} catch {
		return false;
	}
};

/** Copy `text`, and say which route worked. The last resort is a file the user can open. */
export function copyText(text: string, filename = 'sass-helper-output.txt'): CopyResult {
	if (!text) return { ok: false, via: 'nothing to copy' };

	const p = platform();
	if (p === 'darwin' && run('pbcopy', [], text)) return { ok: true, via: 'pbcopy' };
	// `clip` wants UTF-16LE for non-ASCII; for the CSS and Sass this app copies, ASCII plus UTF-8 is fine.
	if (p === 'win32' && run('clip', [], text)) return { ok: true, via: 'clip' };
	// Linux is whichever of the three clipboard helpers is installed, and writing the file is the norm there.
	for (const [cmd, args] of [
		['wl-copy', []],
		['xclip', ['-selection', 'clipboard']],
		['xsel', ['--clipboard', '--input']]
	] as const) {
		if (run(cmd, [...args], text)) return { ok: true, via: cmd };
	}

	try {
		const path = join(tmpdir(), filename);
		writeFileSync(path, text, 'utf8');
		return { ok: false, via: `no clipboard tool — wrote ${path}` };
	} catch (err) {
		return { ok: false, via: `copy failed: ${(err as Error).message}` };
	}
}
