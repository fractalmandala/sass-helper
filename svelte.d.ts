declare module '*.svelte' {
	const component: import('@fractaldesign/gpuix-fractalsvelte').AnyComponent;
	export default component;
}

// A `.css` import registers its rules and tokens with the renderer; it exports nothing.
declare module '*.css';
declare module '*.sass';

// Bun's file loader (`import x from './f.ttf' with { type: 'file' }`) binds the embedded file's
// virtual path string; tsc only needs to know the default export is that string.
declare module '*.ttf' {
	const path: string;
	export default path;
}
