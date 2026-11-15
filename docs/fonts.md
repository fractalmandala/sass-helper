# Fonts

1. Place font files in `public/fonts`. In gpuix-svelte/fractalsvelte you can use `.ttf` files, not `.woff` or `.woff2`

2. In `app.svelte.ts`:

```ts
import { readFileSync } from 'node:fs';
import { register_font, window_size } from '@fractaldesign/gpuix-fractalsvelte';
import { font_family } from '../lib/font.ts';
```

3. Then, in same file, inside `class Helper`

```ts
font_files: string[] | null = null;
fonts_registered = false;
sans_family = $state<string | null>(null);
code_family = $state<string | null>(null);
register_fonts = (): void => {
	if (this.fonts_registered) return;
	const files =
		this.font_files ??
		['GoogleSans.ttf', 'GoogleSans-Italic.ttf', 'ahm-variable.ttf'].map(
			(f) => new URL(`../../public/fonts/${f}`, import.meta.url)
		);
	const families: string[] = [];
	for (const f of files) {
		const bytes = readFileSync(f);
		register_font(bytes);
		const family = font_family(bytes);
		if (family && !families.includes(family)) families.push(family);
	}
	this.fonts_registered = true;
	this.sans_family = families[0] ?? null;
	this.code_family = families.find((family) => family !== families[0]) ?? families[0] ?? null;
};
```

`register_font` hands the bytes to the native window, and it only works once a window exists — at an entry's module top there is none, so every call lands on null and silently no-ops. So the entry only names the files and this method runs from App.svelte's mount effect: the built binary hands over its embedded copies (`/$bunfs/…` virtual paths) through `font_files`; dev reads the three files off disk. The guard keeps a hot-reload remount from registering the same bytes twice — this module loads once per process, so the flag outlives remounts.

The families are read back out of each file's name table and kept in state: GPUI matches text to a registered font by that declared family, not the filename, and components bind it with `style:font-family` — the mechanism the renderer's own demo uses.

4. Load in App

In App.svelte script tag:

```ts
	import { app } from './src/state/app.svelte.ts';
	$effect(() => app.register_fonts());
```