/**
 * The Tailwind dictionary — the real compiler, offline, in this process.
 *
 * No utility table is hand-authored and nothing is downloaded at runtime: `tailwindcss` v4 ships the
 * compiler plus its two source stylesheets (`theme.css` = the default `@theme` tokens, `utilities.css` =
 * `@tailwind utilities`), and `compile()` resolves an explicit candidate list against them. So `mb-4`,
 * `text-lg`, `tracking-tight`, `md:p-6` and `hover:bg-red-500/50` come back as exactly what Tailwind
 * would emit — including the `--tw-*` runtime plumbing that the engine inlines and drops.
 *
 * `themeCss` is the user's own `@theme { … }` block, appended to the source so custom tokens
 * (`text-fg` against `--color-fg`) resolve for real instead of being guessed. The names it declares are
 * returned so the emitter can keep them as `var(--x)` rather than baking a colour into the output.
 */
import { readFileSync } from 'node:fs';
import { compile } from 'tailwindcss';
import { extractUtilities, type Extracted } from './engine.ts';

export type { Extracted };

const themeUrl = new URL('../../../node_modules/tailwindcss/theme.css', import.meta.url);
const utilitiesUrl = new URL('../../../node_modules/tailwindcss/utilities.css', import.meta.url);

let files: Record<string, string> | null = null;
const compiled = new Map<string, Extracted>();

const read = (url: URL): string => readFileSync(url, 'utf8');

function load(): Record<string, string> {
	if (!files) {
		files = {
			'tailwindcss/theme.css': read(themeUrl),
			'tailwindcss/utilities.css': read(utilitiesUrl)
		};
	}
	return files;
}

/** The `@theme` custom properties a pasted theme block declares. */
export function themeTokenNames(themeCss: string): string[] {
	const out = new Set<string>();
	const blocks = [...themeCss.matchAll(/@theme[^{]*\{([\s\S]*?)\}/g)].map((m) => m[1]);
	// A bare `:root { --x: … }` block is just as good as an @theme one.
	blocks.push(...[...themeCss.matchAll(/:root\s*\{([\s\S]*?)\}/g)].map((m) => m[1]));
	for (const body of blocks) {
		for (const m of body.matchAll(/(--[A-Za-z0-9-]+)\s*:/g)) out.add(m[1]);
	}
	return [...out];
}

/** Token names that Tailwind's own default theme declares — these may be inlined into raw values. */
function defaultTokenNames(): Set<string> {
	const names = new Set<string>();
	for (const m of load()['tailwindcss/theme.css'].matchAll(/(--[A-Za-z0-9-]+)\s*:/g)) names.add(m[1]);
	return names;
}

const defaults = /* @__PURE__ */ defaultTokenNames();
export const isDefaultToken = (name: string): boolean => defaults.has(name);

/**
 * Compile `classes` and extract each one's rules. Cached per (classes, theme) pair, because the compiler
 * is not cheap and typing in the input box re-asks for almost the same list every time.
 */
export async function resolveClasses(classes: string[], themeCss = ''): Promise<Extracted> {
	const clean = [...new Set(classes.filter(Boolean))];
	const key = `${themeCss}\u0000${clean.sort().join(' ')}`;
	const hit = compiled.get(key);
	if (hit) return hit;

	const userTokens = themeTokenNames(themeCss);
	const source = `@import "tailwindcss/theme.css";@import "tailwindcss/utilities.css";${
		themeCss.trim() ? `\n@theme {\n${themeCss.replace(/@theme[^{]*\{([\s\S]*?)\}/g, '$1')}\n}` : ''
	}`;

	const compiler = await compile(source, {
		base: '/',
		loadStylesheet: async (id: string) => {
			const content = load()[id];
			if (content != null) return { path: id, base: '/', content };
			throw new Error(`sass-helper: cannot resolve stylesheet "${id}"`);
		},
		loadModule: async () => {
			throw new Error('sass-helper: @plugin / @config JS modules are not supported');
		}
	});

	let css: string;
	try {
		css = await compiler.build(clean);
	} catch (err) {
		// A candidate Tailwind rejects (an arbitrary value it cannot parse) should cost one class, not the run.
		css = '';
		for (const c of clean) {
			try {
				css += (await compiler.build([c])) + '\n';
			} catch {
				/* reported as unknown below */
			}
		}
	}

	// Drop the user's own token values from the :root tables so the engine leaves `var(--color-fg)` intact
	// while still inlining Tailwind's defaults (`--spacing`, `--text-lg`, …) into concrete values.
	for (const name of userTokens) css = css.replace(new RegExp(`\\s*${escapeRe(name)}:[^;]+;`, 'g'), '');

	const extracted = extractUtilities(css, new Set(clean));
	if (compiled.size > 40) compiled.clear();
	compiled.set(key, extracted);
	return extracted;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
