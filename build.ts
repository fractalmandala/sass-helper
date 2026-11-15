// `bun build.ts` (npm run build): one executable for the platform it runs on — a .app on macOS, a
// console-less .exe on Windows, a bare binary on Linux. `--archive` also writes the distribution archive
// and the update-manifest fragment; `--aot` and `--trim` turn on Bun's experimental compile options.
//
// The icon mapping: the Dock and Finder read one .icns, and the renderer's `write_icns` derives every
// size of it from a single PNG. The two renders want different jobs — `public/icon.png` carries the
// macOS margin and is the Dock's tile (128 px up), `public/icon1024.png` is the tight full-bleed crop
// that still reads at 64 px and under, where a padded tile would shrink the art to nothing. So the
// packaged icns is rebuilt here from a mixed iconset. With `--archive` that happens through
// `beforeArchive`, before signing, so the signature and the archive cover the final icns; a plain build
// is unsigned (no CODESIGN_IDENTITY), so swapping afterwards is safe too.
import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { build, type BuildResult } from '@fractaldesign/gpuix-fractalsvelte/build';

// Pixel sizes at or under this come from the tight crop; the rest from the padded Dock art.
const SMALL_MAX = 64;
const SMALL_PNG = './public/icon1024.png';
const BIG_PNG = './public/icon.png';
const POINTS = [16, 32, 128, 256, 512]; // the ten standard iconset sizes are these and their @2x

const mix_icns = async ({ output }: Pick<BuildResult, 'output'>): Promise<void> => {
	if (process.platform !== 'darwin') return;
	const icns = join(output, 'Contents', 'Resources', 'AppIcon.icns');
	const scratch = mkdtempSync(join(tmpdir(), 'sass-helper-icon-'));
	try {
		const iconset = join(scratch, 'AppIcon.iconset');
		mkdirSync(iconset);
		const resize = (png: string, size: number, out: string): void => {
			execFileSync('sips', ['-s', 'format', 'png', '-z', `${size}`, `${size}`, png, '--out', out], { stdio: 'pipe' });
		};
		const source = (pixels: number): string => (pixels <= SMALL_MAX ? SMALL_PNG : BIG_PNG);
		for (const points of POINTS) {
			resize(source(points), points, join(iconset, `icon_${points}x${points}.png`));
			resize(source(points * 2), points * 2, join(iconset, `icon_${points}x${points}@2x.png`));
		}
		const mixed = join(scratch, 'AppIcon.icns');
		execFileSync('iconutil', ['-c', 'icns', iconset, '-o', mixed], { stdio: 'pipe' });
		rmSync(icns);
		renameSync(mixed, icns);
	} finally {
		rmSync(scratch, { recursive: true, force: true });
	}
};

// `--dmg` packs the built .app into an installable image: the app beside a link to /Applications, so the
// user drags one onto the other to install. The volume carries the app's own icon (`.volume-icon.icns` at
// the image root is the macOS convention Finder honours), and the image is compressed read-only (`UDZO`) —
// what `open` mounts and what a Mac download expects to be.
const make_dmg = async ({ output, app }: Pick<BuildResult, 'output' | 'app'>): Promise<void> => {
	if (process.platform !== 'darwin') return;
	const stage = mkdtempSync(join(tmpdir(), 'sass-helper-dmg-'));
	try {
		cpSync(output, join(stage, `${app.slug}.app`), { recursive: true });
		symlinkSync('/Applications', join(stage, 'Applications'), 'dir');
		copyFileSync(join(output, 'Contents', 'Resources', 'AppIcon.icns'), join(stage, '.volume-icon.icns'));
		const out = join(dirname(output), `${app.slug}.dmg`);
		rmSync(out, { force: true });
		execFileSync('hdiutil', ['create', '-volname', app.name, '-srcfolder', stage, '-format', 'UDZO', '-ov', out], { stdio: 'pipe' });
		console.log(`[sass-helper] ${out}`);
	} finally {
		rmSync(stage, { recursive: true, force: true });
	}
};

const archiving = process.argv.includes('--archive');
const result = await build({
	entry: './standalone.ts',
	archive: archiving,
	aot: process.argv.includes('--aot'),
	trim: process.argv.includes('--trim'),
	beforeArchive: archiving ? mix_icns : undefined
});
if (!archiving) await mix_icns(result);
if (process.argv.includes('--dmg')) await make_dmg(result);
