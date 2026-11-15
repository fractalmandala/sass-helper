/**
 * Sass → CSS, with dart-sass.
 *
 * The real compiler rather than an in-house expander, because "convert Sass to CSS" is a promise about
 * `@use`, `@mixin`, functions, math and `@if` — everything an in-house pass would get subtly wrong.
 * Syntax is detected from the source (`@import "x";` and braces mean SCSS, a brace-less indented body
 * means the Sass idiom this app emits), and can be overridden from the toolbar.
 */
import * as sass from 'sass';

export type SassSyntax = 'indented' | 'scss';

export type SassResult = { css: string; error: string | null; syntax: SassSyntax };

/** Indented Sass has no braces; SCSS has them. `@media` alone does not settle it. */
export function detectSyntax(source: string): SassSyntax {
	const body = source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
	if (/[{]/.test(body)) return 'scss';
	return /(^|\n)\s*[.#&%\w:][^\n]*\n\s+[-\w]+\s*:/.test(body) ? 'indented' : 'scss';
}

export async function sassToCss(source: string, syntax?: SassSyntax): Promise<SassResult> {
	const use = syntax ?? detectSyntax(source);
	try {
		const result = await sass.compileStringAsync(source, {
			syntax: use,
			style: 'expanded',
			quietDeps: true,
			logger: { warn() {}, debug() {} }
		});
		return { css: result.css.trim(), error: null, syntax: use };
	} catch (err) {
		const e = err as { message?: string };
		return { css: '', error: (e.message ?? String(err)).replace(/\s*╷[\s\S]*$/, '').trim(), syntax: use };
	}
}
