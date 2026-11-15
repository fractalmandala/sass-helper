/**
 * Engine tests: `npm run test:lib`.
 *
 * These run the real Tailwind v4 compiler and the real dart-sass, not fixtures — the value of the app is
 * that a utility resolves to what Tailwind actually emits, so a stubbed dictionary would prove nothing.
 * Node's own test runner is enough (no vitest dependency), and every case is one the UI can reach.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { convert, kindOf } from './index.ts';
import { SAMPLE_CSS, SAMPLE_SASS, SAMPLE_TW } from '../state/samples.ts';
import { classesFrom } from './tw/untwail.ts';
import { detectSyntax } from './sass/compile.ts';

const H2 = `<h2 class="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight text-fg">
  <a href={\`#\${id}\`}>#</a>
  {title}
</h2>`;

const theme = '@theme { --color-fg: oklch(0.2 0 0); }';

test('untailwind produces the house format for a real heading', async () => {
	const r = await convert('tw-css', H2, { themeCss: theme });
	assert.equal(r.error, null);
	const lines = r.text.split('\n');

	assert.ok(lines[0]?.startsWith('.element-h2 {'), lines[0]);
	const decl = (prop: string): string => lines.find((l) => l.trim().startsWith(`${prop}:`)) ?? '';

	assert.match(decl('margin-bottom'), /^ {2}margin-bottom: 1rem;\s+\/\* mb-4 \(16px\) \*\/$/);
	assert.match(decl('display'), /display: flex;\s+\/\* flex \*\//);
	assert.match(decl('align-items'), /align-items: center;\s+\/\* items-center \*\//);
	assert.match(decl('gap'), /gap: 0\.5rem;\s+\/\* gap-2 \(8px\) \*\//);
	assert.match(decl('font-size'), /font-size: 1\.125rem;\s+\/\* text-lg \(18px\) \*\//);
	assert.match(decl('line-height'), /line-height: 1\.75rem;\s+\/\* text-lg \(28px\) \*\//);
	assert.match(decl('font-weight'), /font-weight: 600;\s+\/\* font-semibold \*\//);
	assert.match(decl('letter-spacing'), /letter-spacing: -0\.025em;\s+\/\* tracking-tight \*\//);
	// A project token stays a var() reference and says so, instead of baking in an oklch value.
	assert.match(decl('color'), /color: var\(--color-fg\);\s+\/\* text-fg \(custom theme variable\) \*\//);
});

test('the comment column is aligned', async () => {
	const r = await convert('tw-css', H2, { themeCss: theme });
	const at = r.text.split('\n').filter((l) => l.includes('/*')).map((l) => l.indexOf('/*'));
	assert.equal(new Set(at).size, 1, `expected one column, got ${at.join(',')}`);
});

test('variants nest, breakpoints become media blocks', async () => {
	const r = await convert('tw-css', 'hover:bg-red-500/50 md:p-6 px-2');
	assert.match(r.text, /\.element:hover \{/);
	assert.match(r.text, /@media \(width >= 48rem\) \{/);
	assert.match(r.text, /padding: 1\.5rem;\s+\/\* md:p-6 \(24px\) \*\//);
});

test('an unknown colour token is guessed and says so', async () => {
	const r = await convert('tw-css', 'text-brand bg-brand');
	assert.match(r.text, /color: var\(--color-brand\);\s+\/\* text-brand \(guessed\) \*\//);
	assert.ok(r.notices.some((n) => n.startsWith('text-brand:')), r.notices.join(' | '));
});

test('Tailwind → Sass keeps the dictionary and the comment column', async () => {
	const r = await convert('tw-sass', H2, { themeCss: theme });
	assert.equal(r.error, null);
	assert.match(r.text, /^\.element-h2\n\tmargin-bottom: 1rem\s+\/\* mb-4 \(16px\) \*\//);
	assert.match(r.text, /\tline-height: 1\.75rem\s+\/\* text-lg \(28px\) \*\//);
	assert.match(r.text, /\tcolor: var\(--color-fg\)\s+\/\* text-fg \(custom theme variable\) \*\//);
	assert.ok(!r.text.includes('{'), 'indented sass has no braces');
	assert.ok(!r.text.includes(';'), 'indented sass has no semicolons');

	// The same column rule as the CSS output: one comment column per block, comments on their own line
	// would stop being a column.
	const at = r.text.split('\n').filter((l) => l.includes('/*')).map((l) => l.replace(/\t/g, '    ').indexOf('/*'));
	assert.equal(new Set(at).size, 1, `expected one column, got ${at.join(',')}`);

	const v = await convert('tw-sass', 'px-2 hover:bg-red-500 md:p-6', { selector: '.cta' });
	assert.match(v.text, /^\.cta\n\tpadding-inline: 0\.5rem/);
	assert.match(v.text, /\t&:hover\n\t\tbackground-color: oklch/);
	assert.match(v.text, /\t@media \(width >= 48rem\)\n\t\t\.cta\n\t\t\tpadding: 1\.5rem\s+\/\* md:p-6 \(24px\) \*\//);
});

test('CSS → Sass nests shared prefixes and keeps order', async () => {
	const r = await convert(
		'css-sass',
		`.a { color: red; }
.a:hover { color: blue; }
.b { color: green; }`
	);
	assert.match(r.text, /^\.a\s*\n\tcolor: red/);
	assert.match(r.text, /&:hover/);
	assert.ok(r.text.indexOf('.b') > r.text.indexOf('blue'), 'source order preserved');
});

test('Sass → CSS compiles indented and scss, and reports errors', async () => {
	const indented = await convert('sass-css', '.a\n  color: red\n  .b\n    color: blue');
	assert.equal(indented.error, null);
	assert.match(indented.text, /\.a \.b \{/);

	const scss = await convert('sass-css', '$c: red; .a { color: $c; }');
	assert.match(scss.text, /color: red/);

	const broken = await convert('sass-css', '.a { color: ');
	assert.notEqual(broken.error, null);
});

test('round trip: CSS → Sass → CSS keeps the declarations', async () => {
	const css = `.x {\n  margin-bottom: 1rem;\n  display: flex;\n}`;
	const sass = await convert('css-sass', css);
	const back = await convert('sass-css', sass.text);
	assert.match(back.text, /margin-bottom: 1rem/);
	assert.match(back.text, /\.x \{/);
});

test('markup without classes invents nothing', async () => {
	const r = await convert('tw-css', '<div>{title}</div>');
	assert.equal(r.text, '');
	assert.deepEqual(r.unknown, []);
});

test('class vocabulary', () => {
	assert.deepEqual(classesFrom('mb-4 text-[13px] hover:p-2 w-1/2 # 123'), ['mb-4', 'text-[13px]', 'hover:p-2', 'w-1/2']);
	assert.equal(detectSyntax('.a\n  color: red'), 'indented');
	assert.equal(detectSyntax('.a { color: red }'), 'scss');
});

test('the input kind is read before any engine sees it', () => {
	assert.equal(kindOf(SAMPLE_TW), 'markup');
	assert.equal(kindOf(SAMPLE_CSS), 'css');
	assert.equal(kindOf(SAMPLE_SASS), 'sass');
	// A variant's colon has no space after it, which is what keeps a class list out of the Sass branch.
	assert.equal(kindOf('mb-4 flex hover:bg-red-500'), 'classes');
});

test('the wrong mode says so, and names the right one', async () => {
	const r = await convert('sass-css', SAMPLE_TW);
	assert.match(r.error ?? '', /Tailwind markup/, r.error ?? 'no error');
	assert.equal(r.suggest?.mode, 'tw-css');
	assert.equal(r.text, '');

	const c = await convert('css-sass', SAMPLE_SASS);
	assert.equal(c.suggest?.mode, 'sass-css');

	const t = await convert('tw-css', SAMPLE_CSS, { themeCss: theme });
	assert.equal(t.suggest?.mode, 'css-sass');

	// A mode that fits its input offers nothing and converts normally.
	assert.equal((await convert('tw-css', SAMPLE_TW, { themeCss: theme })).suggest, null);
	assert.equal((await convert('sass-css', SAMPLE_SASS)).suggest, null);
});

test('CSS → Sass keeps an annotation column that was inline in the CSS', async () => {
	const css = await convert('tw-css', H2, { themeCss: theme });
	const sass = await convert('css-sass', css.text);
	assert.match(sass.text, /\tmargin-bottom: 1rem\s+\/\* mb-4 \(16px\) \*\//);
	assert.match(sass.text, /\tline-height: 1\.75rem\s+\/\* text-lg \(28px\) \*\//);
	// Re-padded, because a Sass declaration has no semicolon: the column would drift one character.
	const at = sass.text.split('\n').filter((l) => l.includes('/*')).map((l) => l.replace(/\t/g, '    ').indexOf('/*'));
	assert.equal(new Set(at).size, 1, `columns: ${at.join(',')}`);
	// And with the toggle off the annotations go, as they do for any comment in this mode.
	const bare = await convert('css-sass', css.text, { comments: false });
	assert.ok(!bare.text.includes('//') && !bare.text.includes('/*'), bare.text);
});

test('the annotation column survives three hops and not the fourth', async () => {
	const css = await convert('tw-css', H2, { themeCss: theme });
	const sass = await convert('css-sass', css.text);
	assert.ok(sass.text.includes('/* mb-4 (16px) */'), 'kept loud, so it reads like the Tailwind modes');
	const back = await convert('sass-css', sass.text);
	// Documented dart-sass behaviour, not a bug: in indented syntax a comment after a declaration is
	// dropped, so this direction is where the column ends. The UI says so in the mode's own explainer.
	assert.ok(!back.text.includes('mb-4'), back.text);
	assert.ok(back.text.includes('margin-bottom: 1rem;'), back.text);
	// Loud comments on their own line do survive, which is how the user gets them back into CSS.
	const own_line = await convert('sass-css', '.a\n  color: red\n  /* note */\n');
	assert.ok(own_line.text.includes('/* note */'), own_line.text);
});

test('a prose comment in CSS still becomes the Sass idiom', async () => {
	const r = await convert('css-sass', '.a {\n  /* why the colour */\n  color: red;\n}');
	assert.match(r.text, /\/\/ why the colour/);
});
