import { render_hot } from '@fractaldesign/gpuix-fractalsvelte';

// The dev window. `render_hot` watches this directory: saving a `.svelte` or `.css` file remounts the app
// in the same process, so `src/state/app.svelte.ts` keeps the panes' contents across a reload; saving a
// `.ts` file prints a reminder, because modules load once per process.
render_hot(new URL('./App.svelte', import.meta.url), {
	title: 'sass-helper',
	appName: 'sass-helper',
	width: 1440,
	height: 1024,
	minWidth: 720,
	minHeight: 480
});
