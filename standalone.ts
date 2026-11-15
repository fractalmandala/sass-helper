// The entry `npm run build` compiles: a binary carries no source to hot-reload, so it imports the
// component statically and mounts it with `render`.
//
// Fonts ride inside the binary: `with { type: 'file' }` is Bun's file loader, and in a compiled build
// the bytes are embedded and the binding resolves to a virtual `/$bunfs/root/…` path that `readFileSync`
// can read. These imports must stay out of everything Node runs (`app.ts`, `test.ts`) — Node rejects the
// unknown attribute at link time. Registration happens in App.svelte's mount effect, because it needs a
// window — an entry's module top has none — so here the embedded paths are only handed to the state.
import { render } from '@fractaldesign/gpuix-fractalsvelte';
import App from './App.svelte';
import { app } from './src/state/app.svelte.ts';
import googleSans from './public/fonts/GoogleSans.ttf' with { type: 'file' };
import googleSansItalic from './public/fonts/GoogleSans-Italic.ttf' with { type: 'file' };
import ahmVariable from './public/fonts/ahm-variable.ttf' with { type: 'file' };

app.font_files = [googleSans, googleSansItalic, ahmVariable];

render(App, {
	// Keep these in step with `app.ts`: the window a built app opens is the window you developed in.
	title: 'sass-helper',
	appName: 'sass-helper',
	width: 1440,
	height: 1024,
	minWidth: 720,
	minHeight: 480,
	app: {
		name: 'sass-helper',
		identifier: 'design.fractala.sass-helper',
		// The Dock's source art; `build.ts` rebuilds the packaged icns so the small sizes come from
		// icon1024.png. The build reads this file, and only the build — a dev run has no bundle to carry it.
		icon: './public/icon.png'
	}
});
