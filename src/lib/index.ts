/**
 * The one entry the UI calls.
 *
 * Four modes, two engines: Tailwind resolution is `tailwindcss` v4 itself (via `untwail`), and Sass is
 * dart-sass for compiling and `modules/css-to-sass` for the CSS → indented-Sass direction. The
 * Tailwind → Sass mode is composed rather than duplicated: untwail produces commented CSS, and
 * `css_to_sass` nests it — which is also the round trip worth showing, because the comment column is
 * what tells the reader which utility produced which line.
 */
import { css_to_sass } from './csssass/index.ts';
import { sassToCss } from './sass/compile.ts';
import { untwail } from './tw/untwail.ts';

export type Mode = 'tw-css' | 'tw-sass' | 'css-sass' | 'sass-css';

export const MODES: Array<{ id: Mode; label: string; from: string; to: string; hint: string; explain: string }> = [
	{
		id: 'tw-css',
		label: 'Tailwind → CSS',
		from: 'markup or class list',
		to: 'CSS',
		hint: 'One rule per element, one comment per utility.',
		explain:
			'selector names the rule when the input is one bare class list — blank gives every element its own .element-<tag>. comments writes /* mb-4 (16px) */ after each declaration.'
	},
	{
		id: 'tw-sass',
		label: 'Tailwind → SASS',
		from: 'markup or class list',
		to: 'indented SASS',
		hint: 'Same dictionary, indented output.',
		explain:
			'same dictionary as Tailwind → CSS, in tabs instead of braces. selector and comments mean the same thing here; nest is not used, because the structure comes from the markup.'
	},
	{
		id: 'css-sass',
		label: 'CSS → SASS',
		from: 'CSS',
		to: 'indented SASS',
		hint: 'Nests only where the cascade cannot change.',
		explain:
			'comments keeps the comments already in the CSS as Sass comments (off drops them). nest turns the shared-prefix folding on or off. No selector: this mode changes notation, not meaning.'
	},
	{
		id: 'sass-css',
		label: 'SASS → CSS',
		from: 'SASS',
		to: 'CSS',
		hint: 'dart-sass, expanded output.',
		explain: 'dart-sass compiles variables, nesting and functions into plain CSS. Nothing to annotate, so no knobs.'
	}
];

export type ConvertOptions = {
	selector?: string;
	themeCss?: string;
	comments?: boolean;
	nest?: boolean;
};

export type ConvertResult = {
	text: string;
	error: string | null;
	notices: string[];
	unknown: string[];
	stats: string;
	/** Set when the input is not what this mode reads: the mode that does, offered as a button. */
	suggest: { mode: Mode; label: string } | null;
};

const empty: ConvertResult = { text: '', error: null, notices: [], unknown: [], stats: '', suggest: null };

export type InputKind = 'markup' | 'css' | 'sass' | 'classes';

const KIND_NAME: Record<InputKind, string> = {
	markup: 'Tailwind markup',
	css: 'a CSS stylesheet',
	sass: 'indented Sass',
	classes: 'a bare class list'
};

/**
 * What the input actually is, so pasting markup into the Sass mode gets an explanation instead of
 * dart-sass's `expected "{"`. Deliberately rough: markup has a tag with a class attribute, CSS has braces,
 * indented Sass has `prop: value` lines without them, and a Tailwind class list has neither — a variant's
 * colon (`hover:bg-x`) has no space after it, which is what keeps it out of the Sass branch.
 */
export function kindOf(input: string): InputKind {
	const s = input.trim();
	if (/<[A-Za-z][^>]*\bclass(?:Name)?\s*=/i.test(s) || /\bclassName\s*=/.test(s)) return 'markup';
	if (s.includes('{')) return 'css';
	if (/(^|\n)[ \t]*[-a-z]+:[ \t]+\S/.test(s) || /^[ \t]*[$@+]/m.test(s)) return 'sass';
	return 'classes';
}

/** When the input is not what this mode reads, name the mode that is. */
export function mismatch(mode: Mode, kind: InputKind): { mode: Mode; label: string } | null {
	const tailwind = mode === 'tw-css' || mode === 'tw-sass';
	if (kind === 'markup' || kind === 'classes') {
		if (tailwind) return null;
		const to = mode === 'css-sass' ? 'tw-sass' : 'tw-css';
		return { mode: to, label: MODES.find((m) => m.id === to)!.label };
	}
	if (tailwind) {
		const to = kind === 'css' ? 'css-sass' : 'sass-css';
		return { mode: to, label: MODES.find((m) => m.id === to)!.label };
	}
	// Indented Sass pasted into CSS → Sass would be read as one long selector; the other three pairings
	// are either what the mode wants or harmless (dart-sass takes CSS as SCSS).
	if (mode === 'css-sass' && kind === 'sass') return { mode: 'sass-css', label: 'Sass → CSS' };
	return null;
}

// `css_to_sass` prints every comment on its own line, which is right for prose and wrong for a table:
// an annotation like `mb-4 (16px)` is one row of the comment column, and pasting the Tailwind output into
// CSS to Sass is the obvious thing to do with it. So a comment that shared a line with its declaration in
// the input goes back onto that line, and each block's column is re-padded — a Sass declaration loses its
// semicolon, so the column would otherwise drift by one character per block.
//
// (Written as line comments on purpose: this file's own docstring rule is that a block comment cannot
// contain an example of a CSS comment, because the closing pair ends the doc comment early.)
export function keepInlineComments(sass: string, css: string): string {
	const inline = new Set<string>();
	for (const line of css.split('\n')) {
		for (const m of line.matchAll(/\/\*\s*([\s\S]*?)\s*\*\//g)) {
			if (line.slice(0, m.index).includes(':')) inline.add(m[1]!);
		}
	}
	if (!inline.size) return sass;

	const merged: string[] = [];
	for (const line of sass.split('\n')) {
		const note = /^(\t*)(\/\/|\/\*)\s*(.*?)\s*(?:\*\/)?$/.exec(line);
		if (!note || !inline.has(note[3]!)) {
			merged.push(line);
			continue;
		}
		const prev = merged[merged.length - 1] ?? '';
		// Same indent, a property, and nothing after it: a declaration the note can be attached to.
		const decl = prev.startsWith(note[1]!) && /^[-a-z]+: [^/]+$/.test(prev.slice(note[1]!.length));
		if (!decl) {
			merged.push(line);
			continue;
		}
		merged[merged.length - 1] = `${merged[merged.length - 1]}  ${note[2] === '//' ? `// ${note[3]}` : `/* ${note[3]} */`}`;
	}

	// One column per run of annotated declarations at the same indent.
	const split = (l: string): [string, string] => {
		const i = l.search(/\s\s+(\/\/|\/\*)/);
		return i === -1 ? [l, ''] : [l.slice(0, i), l.slice(i + 2)];
	};
	const out: string[] = [];
	let run: number[] = [];
	const flush = (): void => {
		if (run.length > 1) {
			const width = Math.max(...run.map((i) => out[i]!.split('  //')[0]!.split('  /*')[0]!.length));
			for (const i of run) {
				const [decl, note] = split(out[i]!);
				out[i] = `${decl.padEnd(width + 2)}${note}`.trimEnd();
			}
		}
		run = [];
	};
	for (let i = 0; i < merged.length; i++) {
		const [, note] = split(merged[i]!);
		if (note) {
			out.push(merged[i]!);
			run.push(out.length - 1);
			continue;
		}
		flush();
		out.push(merged[i]!);
	}
	flush();
	return out.join('\n');
}

export async function convert(mode: Mode, input: string, options: ConvertOptions = {}): Promise<ConvertResult> {
	const source = input.trim();
	if (!source) return empty;

	const kind = kindOf(source);
	const suggest = mismatch(mode, kind);
	if (suggest) {
		return {
			...empty,
			error: `this looks like ${KIND_NAME[kind]}, not ${MODES.find((m) => m.id === mode)!.from}`,
			suggest
		};
	}

	try {
		if (mode === 'tw-css' || mode === 'tw-sass') {
			const result = await untwail(source, {
				selector: options.selector,
				themeCss: options.themeCss,
				comments: options.comments,
				format: mode === 'tw-sass' ? 'sass' : 'css'
			});
			return {
				text: result.text,
				error: result.text ? null : 'no classes found',
				notices: result.notices,
				unknown: result.unknown,
				stats: `${result.elements.length} ${mode === 'tw-sass' ? 'block' : 'element'}(s) · ${result.tokens} token(s)`,
				suggest: null
			};
		}

		if (mode === 'css-sass') {
			// An annotation column is data, not prose: keep it loud so the next hop (Sass → CSS) still sees it,
			// instead of the Sass idiom of a silent `//`, which dart-sass would drop on the floor.
			const annotated = /;[ \t]*\/\*[^]*?\*\/[ \t]*$/m.test(source);
			const nested = css_to_sass(source, {
				nest: options.nest !== false,
				comments: options.comments === false ? 'drop' : annotated ? 'loud' : 'silent',
				indent: '\t'
			});
			return {
				text: keepInlineComments(nested.sass, source),
				error: null,
				notices: nested.warnings,
				unknown: [],
				stats: `${nested.stats.rules} rule(s) · ${nested.stats.nested} nested · ${nested.stats.declarations} declaration(s)`,
				suggest: null
			};
		}

		const compiled = await sassToCss(source);
		return {
			text: compiled.css,
			error: compiled.error,
			notices: compiled.error ? [] : [`sass syntax detected: ${compiled.syntax}`],
			unknown: [],
			stats: `${compiled.css.split('\n').filter((l) => l.includes(':')).length} declaration(s)`,
			suggest: null
		};
	} catch (err) {
		const e = err as Error;
		return { ...empty, error: `${e.name ?? 'Error'}: ${e.message}` };
	}
}
