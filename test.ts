/**
 * The app's behaviour, proved headlessly through GPUI's real hit testing (`npm test`).
 *
 * Two things are being checked. The conversions have to actually appear in the output pane — that is the
 * engine's job, and `npm run test:lib` covers it exhaustively, so here one assertion per mode is enough to
 * prove the wiring from button to text. What only a UI test can prove is the rest: that the header controls
 * hit, that the divider moves the pane by a dragged amount, that the keyboard path reaches the same state as
 * the mouse path, and that the copy button really gets the text out of the window.
 */
// First, so the state module below reads and writes the throwaway session instead of the window's own.
import './test-session-dir.ts';
import {
	mount_headless,
	click_test_id,
	find_test_id,
	bounds,
	center,
	drag,
	focus,
	press,
	type,
	check,
	finish,
	settle,
	wait,
	painted
} from '@fractaldesign/gpuix-fractalsvelte/test';
import { app, LIMITS, LIMITSH } from './src/state/app.svelte.ts';
import { SAMPLE_CSS, SAMPLE_SASS, SAMPLE_THEME, SAMPLE_TW } from './src/state/samples.ts';
import { read_json } from './src/state/persist.ts';
import App from './App.svelte';

/**
 * The session is restored from disk on purpose — that is the feature — but a test that measures whatever
 * the last run left behind is not a test. Start from the shipped shape.
 */
app.input = '';
app.output = '';
app.selector = '';
app.themeCss = SAMPLE_THEME;
app.comments = true;
app.nest = true;
app.splitW = LIMITS.left.default;
// Last, and through the app's own door: switching modes converts whatever the input holds, so the panes have
// to be empty first — and assigning the mode directly would narrow its type to one literal for the rest of
// this file, which is what the mode-switch assertions below then refuse to compile.
app.setMode('tw-css');

mount_headless(App, { width: 1400, height: 860 });

// `window_size` is polled, not signalled, and reports 800×600 until the first poll lands — which would
// read as a narrow window and stack the panes the test then measures as side by side.
await wait(250);
settle();

const widthOf = (id: string): number => bounds(find_test_id(id)!)?.width ?? -1;
const box = (id: string) => bounds(find_test_id(id)!)!;

// — the shell: header, two panes, a divider between them
check('the shell mounts', find_test_id('sass-shell') !== null);
check('every mode has a tab', ['tw-css', 'tw-sass', 'css-sass', 'sass-css'].every((m) => find_test_id(`mode-${m}`) !== null));
check('a wide window keeps the panes side by side', !app.stacked && app.width >= 1200);
check('the divider is in the tree', find_test_id('splitter') !== null);
check('the copy button is in the header', find_test_id('copy') !== null);
check('an empty input converts to nothing', app.output === '' && find_test_id('convert') !== null);

// — Sample, then Convert, through the real buttons
click_test_id('sample');
// The first Tailwind compile in a process is the dictionary being built; after that it is cached.
await wait(1200);
settle();
check('Sample filled the input', app.input.includes('mb-4') && app.input === SAMPLE_TW);
check('Convert ran on its own and produced text', app.output.includes('.element-h2 {'));
check('nothing was left unresolved', app.unknown.length === 0);
check('the house format survived the round trip', app.output.includes('margin-bottom: 1rem'));
check('a type step carries its leading in pixels', app.output.includes('line-height: 1.75rem'));
check('a project token stays a var() reference', app.output.includes('color: var(--color-fg)'));
check('and says so', app.output.includes('(custom theme variable)'));
const col = app.output
	.split('\n\n')[0]!
	.split('\n')
	.filter((l) => l.includes('/*'))
	.map((l) => l.indexOf('/*'));
check('one comment column per block', new Set(col).size === 1);

// — Copy takes the output out of the window
click_test_id('copy');
settle();
check('copy reports the route it used', app.copyNote !== '');
check('copy put the text on the clipboard', app.copied === true);

// — the tabs switch modes and re-run what is in the input
click_test_id('mode-tw-sass');
await wait(600);
settle();
check('Tailwind → Sass is the active mode', app.mode === 'tw-sass');
check('the same dictionary, indented', app.output.includes('\tmargin-bottom: 1rem') && !app.output.includes('{'));
check('and the comment stays on its declaration line', app.output.includes('/* mb-4 (16px) */'));

// — the knobs are live, not decoration
click_test_id('toggle-comments');
click_test_id('convert');
await wait(400);
settle();
check('comments off drops the annotation column', !app.comments && !app.output.includes('/*'));
click_test_id('toggle-comments');

// — the selector field writes to state, and the override reaches the output
focus(find_test_id('selector')!);
type('hero');
settle();
check('the selector field typed into state', app.selector === 'hero');
app.input = '<p class="mb-2">one element</p>';
await app.run();
settle();
// Still in the Sass mode from the tab click above, so the override lands as a Sass block header.
check('one selector for one element', app.output.startsWith('.hero\n'));

// — CSS → Sass, then the Swap button turns it straight back around
click_test_id('mode-css-sass');
settle();
app.input = SAMPLE_CSS;
await app.run();
settle();
check('CSS → Sass nests the shared prefix', app.output.includes('.card\n\tdisplay: flex'));
check('and the state rule', app.output.includes('&:hover'));
const swapped = app.output;
click_test_id('swap');
await wait(600);
settle();
check('Swap turned the mode around', app.mode === 'sass-css');
check('and fed that output straight back into the input', app.input === swapped);
check('Sass → CSS compiled it back to braces', app.output.includes('.card {') && app.output.includes('display: flex;'));

// — the Sass source, and the error path when it does not compile
app.input = SAMPLE_SASS;
await app.run();
settle();
check('dart-sass resolves variables and functions', app.output.includes('color: teal') && app.output.includes('rgba(0, 128, 128, 0.1)'));
app.input = '.a\n  color: ;';
await app.run();
settle();
check('a broken stylesheet reports instead of blanking', app.error !== null);

// — the wrong mode says so, and hands over the right one
// Still in Sass → CSS from the Swap step, so this is the paste-a-component-into-the-wrong-mode case.
app.input = SAMPLE_TW;
await app.run();
settle();
check('markup in the Sass mode names what it found', (app.error ?? '').includes('Tailwind markup'));
check('instead of dart-sass\'s brace complaint', !(app.error ?? '').includes('expected "{\"'));
check('and offers the mode that reads it', app.suggest?.mode === 'tw-css');
click_test_id('suggest');
await wait(700);
settle();
check('taking the offer switches mode', app.mode === 'tw-css');
check('and converts in the same click', app.output.includes('.element-h2 {'));

// — each tab keeps its own text, which is the whole point of having four tabs
click_test_id('mode-css-sass');
await wait(600);
settle();
check('a stylesheet tab does not inherit the markup buffer', !app.input.includes('<h2'));
check('and opens on its own example', app.input.includes('.card {'));
check('so it converts without a complaint', app.error === null && app.output.includes('.card\n\tdisplay: flex'));
click_test_id('mode-tw-css');
await wait(500);
settle();
check('the Tailwind tab still holds the markup', app.input.includes('<h2 class="mb-4'));

// — the Tailwind output, fed through CSS → Sass, keeps its column
const annotated = app.output;
click_test_id('mode-css-sass');
await wait(500);
settle();
app.input = annotated;
await app.run();
settle();
check('the chained CSS keeps the annotation column', app.output.includes('/* mb-4 (16px) */'));
// One column per block, not one column for the whole file — each block pads to its own widest line.
const chained = (app.output.split('\n\n')[0] ?? '')
	.split('\n')
	.filter((l) => l.includes('/*'))
	.map((l) => l.replace(/\t/g, '    ').indexOf('/*'));
check('and the chained column is still one column per block', chained.length > 1 && new Set(chained).size === 1);

// — Swap hands the text to the other tab's buffer rather than overwriting this one
const beforeSwap = app.output;
click_test_id('swap');
await wait(700);
settle();
check('Swap put the Sass into the Sass → CSS tab', app.mode === 'sass-css' && app.input === beforeSwap);

// — the divider: a drag moves the pane by exactly the dragged amount
const split0 = app.splitW;
const sx = center(find_test_id('splitter')!).x;
drag({ x: sx, y: 300 }, { x: sx + 60, y: 300 }, { steps: 6 });
settle();
check('dragging the divider widens the input pane', app.splitW === split0 + 60);
check('the drag released itself', app.dragging === false);
check('the pane took the new width', Math.abs(widthOf('left') - (split0 + 60)) <= 8);

// — keyboard parity on the same control, and the clamp both paths share
focus(find_test_id('splitter')!);
press('right');
settle();
check('the right arrow nudges the divider', app.splitW === split0 + 72);
press('shift-left');
settle();
check('shift steps further', app.splitW === split0 + 24);
app.setSplit(9999);
settle();
check('and it clamps at the maximum', app.splitW === LIMITS.left.max);
click_test_id('mode-tw-css');
await wait(500);
settle();
check('switching tabs converts that tab\'s own text', app.output.includes('.element-h2 {'));

// — the panes are nothing but code: every label, note and status line is in the header
check('no pane titles are drawn anywhere', !painted().includes('Input ·') && !painted().includes('Output ·'));
check('no per-tab note is drawn', !painted().includes('This tab keeps its own input'));
click_test_id('toggle-theme');
settle();
check('theme off closes the token box', find_test_id('theme') === null);
check('with the theme off the input takes the whole column', Math.abs(box('input').height - box('output').height) <= 8);
click_test_id('toggle-theme');
await wait(400);
settle();
check('theme opens it again', find_test_id('theme') !== null);

// — the layout the user settled on: the header is one line, and the body is code plus the token box
// Back to the shipped split before measuring: the checks below care about how the header shares its line, and
// a divider the drag test pinned at the maximum would leave the status nothing to be drawn in.
app.setSplit(LIMITS.left.default);
await wait(300);
settle();
check('the header is one line tall', box('header').height < 84);
check('the knobs share the header line with the modes', Math.abs(box('row-knobs').y - box('modes').y) < 2 && box('row-knobs').x > box('modes').x);
check(
	'the token box sits inside the left column',
	box('theme').x >= box('left').x && box('theme').x + box('theme').width <= box('left').x + box('left').width + 1
);
check('the token box sits below the input in the column', box('theme').y >= box('input').y + box('input').height);
check('the output fills its column', box('output').width >= box('right').width - 60);
check('nothing overflows the body', box('left').height <= box('body').height + 1 && box('right').height <= box('body').height + 1);

// — the horizontal divider: the same drag protocol on the other axis
// Start low: from the shipped height the input is already against the column's cap, and a drag against
// the cap moves the state without moving a pixel.
app.setSplitH(240);
await wait(300);
settle();
const hy = center(find_test_id('splitterH')!).y;
const h0 = app.splitH;
const w0 = app.splitW;
const ih0 = box('input').height;
const th0 = box('theme').height;
drag({ x: 300, y: hy }, { x: 300, y: hy + 40 }, { steps: 6 });
settle();
check('dragging the horizontal divider grows the input pane', app.splitH === h0 + 40);
check('and leaves the width divider alone', app.splitW === w0);
check('the input pane took the height', box('input').height > ih0);
check('the theme box gave that height back', box('theme').height < th0);
check('the token box still sits under the input', box('theme').y >= box('input').y + box('input').height);
focus(find_test_id('splitterH')!);
press('down');
settle();
check('the down arrow nudges it too', app.splitH === h0 + 52);
app.resetSplitH();
settle();
check('the reset returns the shipped height', app.splitH === LIMITSH.top.default);

// — the session is written down, which is what makes a restart pick up where this one stopped
app.save();
const session = read_json<{ mode?: string; splitW?: number; inputs?: Record<string, string> }>('session.json');
check('the session persisted the mode', session?.mode === 'tw-css');
check('the session persisted the divider', session?.splitW === LIMITS.left.default);
check('the session persisted the Tailwind tab', session?.inputs?.['tw-css'] === SAMPLE_TW);
check('and the CSS tab, column and all', (session?.inputs?.['css-sass'] ?? '').includes('/* mb-4 (16px) */'));

finish('sass-helper', 70);
