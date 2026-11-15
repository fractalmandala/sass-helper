/**
 * The app's state: the mode, both panes, the knobs, the divider, and the result of the last conversion.
 *
 * It is a class in a `.svelte.ts` module because runes only bind to declarations — `$state` written in an
 * object literal's property is a compile error, and a `$derived` copied into one freezes at its first
 * value. Living in a module is also what makes it survive a hot reload: `render_hot` remounts the
 * components on every `.svelte` save, and this state, and the Tailwind compiler cache behind it, do not
 * reset.
 *
 * The window's width is polled rather than signalled, so the point where the two panes stop fitting side
 * by side is derived here, not in a `@media` block — GPUI has none and drops the ones in a stylesheet.
 */
import { readFileSync } from 'node:fs';
import { register_font, window_size } from '@fractaldesign/gpuix-fractalsvelte';
import { font_family } from '../lib/font.ts';
import { MODES, convert, type Mode } from '../lib/index.ts';
import { copyText } from '../lib/clipboard.ts';
import { read_json, write_json } from './persist.ts';
import { SAMPLE_CSS, SAMPLE_SASS, SAMPLE_THEME, SAMPLE_TW } from './samples.ts';

export const LIMITS = { left: { min: 300, max: 1200, default: 620 } } as const;
export const LIMITSH = { top: {min: 240, max: 2400, default: 600 } } as const;

/** Below this the panes stack, because two code columns under ~400px each are unreadable. */
export const BREAKPOINT = { stack: 860 } as const;

const MODE_IDS = MODES.map((m) => m.id);

/** What each tab opens with, so a stylesheet tab never inherits the markup from a Tailwind one. */
const SEED: Record<Mode, string> = { 'tw-css': SAMPLE_TW, 'tw-sass': SAMPLE_TW, 'css-sass': SAMPLE_CSS, 'sass-css': SAMPLE_SASS };

/** The session file before per-tab buffers existed: one text, for whichever tab was open. */
type LegacyShape = Partial<Shape> & { input?: string };

/** The saved buffers, or the seeds — and a pre-per-tab session file has its one text put where it was typed. */
function restore(stored: LegacyShape): Record<Mode, string> {
	const buffers: Record<Mode, string> = { ...SEED };
	if (stored.inputs && typeof stored.inputs === 'object') {
		for (const id of MODE_IDS) {
			const v = stored.inputs[id];
			if (typeof v === 'string') buffers[id] = v;
		}
	} else if (typeof stored.input === 'string') {
		buffers[MODES.find((m) => m.id === stored.mode)?.id ?? 'tw-css'] = stored.input;
	}
	return buffers;
}

type Shape = {
	mode: Mode;
	inputs: Record<Mode, string>;
	selector: string;
	themeCss: string;
	comments: boolean;
	nest: boolean;
	showTheme: boolean;
	splitW: number;
	splitH: number;
};

const stored: LegacyShape = read_json<LegacyShape>('session.json') ?? {};

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

class Helper {
	// Looked up rather than cast: whatever is on disk has to name a mode this build actually has.
	mode = $state<Mode>(MODES.find((m) => m.id === stored.mode)?.id ?? 'tw-css');
	inputs = $state<Record<Mode, string>>(restore(stored));
	selector = $state(typeof stored.selector === 'string' ? stored.selector : '');
	themeCss = $state(typeof stored.themeCss === 'string' ? stored.themeCss : SAMPLE_THEME);
	comments = $state(stored.comments !== false);
	/** Whether the Tailwind modes show the token box under the input. Its label is the `theme` toggle. */
	showTheme = $state(stored.showTheme !== false);
	nest = $state(stored.nest !== false);
	splitW = $state(clamp(typeof stored.splitW === 'number' ? stored.splitW : LIMITS.left.default, LIMITS.left.min, LIMITS.left.max));
	splitH = $state(clamp(typeof stored.splitH === 'number' ? stored.splitH : LIMITSH.top.default, LIMITSH.top.min, LIMITSH.top.max));

	output = $state('');
	error = $state<string | null>(null);
	notices = $state<string[]>([]);
	unknown = $state<string[]>([]);
	/** Set when the input is not what this mode reads, and what to switch to instead. */
	suggest = $state<{ mode: Mode; label: string } | null>(null);
	stats = $state('');
	busy = $state(false);
	/** Which button currently reads "Copied", plus the honest note about how the copy happened. */
	copied = $state(false);
	copyNote = $state('');

	dragging = $state<false | 'x' | 'y'>(false);

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

	width = $derived(window_size.width);
	height = $derived(window_size.height);
	stacked = $derived(this.width < BREAKPOINT.stack);
	leftWidth = $derived(clamp(this.splitW, LIMITS.left.min, Math.max(LIMITS.left.min, this.width - 420)));
	// The absolute ceiling only; the honest cap — header, token box, splitter and padding — is measured where
	// those things are laid out (App.svelte), because this class cannot know how tall the header is.
	topHeight = $derived(clamp(this.splitH, LIMITSH.top.min, LIMITSH.top.max));
	def = $derived(MODES.find((m) => m.id === this.mode) ?? MODES[0]);

	/**
	 * The tab's own text. Reading and writing it through `mode` is what keeps the four conversions apart:
	 * pasting a component in Tailwind → CSS and then clicking CSS → Sass used to leave the markup on screen
	 * in a mode that reads stylesheets, which is a design fault, not a user mistake.
	 */
	get input(): string {
		return this.inputs[this.mode];
	}

	set input(value: string) {
		this.inputs[this.mode] = value;
	}
	isTw = $derived(this.mode === 'tw-css' || this.mode === 'tw-sass');
	/** Swap only makes sense between the two directions of the same stylesheet language. */
	canSwap = $derived(this.mode === 'css-sass' || this.mode === 'sass-css');

	run = async (): Promise<void> => {
		const source = this.input.trim();
		if (!source) {
			this.clearResult();
			return;
		}
		this.busy = true;
		try {
			const r = await convert(this.mode, source, {
				selector: this.selector.trim() || undefined,
				themeCss: this.themeCss.trim() || undefined,
				comments: this.comments,
				nest: this.nest
			});
			this.output = r.text;
			this.error = r.error ?? (r.text ? null : 'nothing to convert');
			this.notices = r.notices;
			this.unknown = r.unknown;
			this.stats = r.stats;
			this.suggest = r.suggest;
		} catch (err) {
			const e = err as Error;
			this.output = '';
			this.error = `${e.name ?? 'Error'}: ${e.message}`;
		} finally {
			this.busy = false;
		}
		this.save();
	};

	setMode = (next: Mode): void => {
		if (next === this.mode) return;
		this.mode = next;
		this.clearResult();
		if (this.input.trim()) void this.run();
	};

	/** Feed the output back in and convert the other way — the round trip is the point of both buttons. */
	swap = (): void => {
		if (!this.output.trim()) return;
		const next: Mode = this.mode === 'css-sass' ? 'sass-css' : 'css-sass';
		this.inputs[next] = this.output;
		this.selector = '';
		this.setMode(next);
	};

	copy = (): void => {
		if (!this.output) return;
		const r = copyText(this.output, this.isTw || this.mode === 'sass-css' ? 'sass-helper-output.css' : 'sass-helper-output.sass');
		this.copyNote = r.via;
		this.copied = r.ok;
		setTimeout(() => (this.copied = false), 1800);
	};

	/** One keystroke away: the mode that reads this input, offered by the error line. */
	applySuggest = (): void => {
		const s = this.suggest;
		if (s) this.setMode(s.mode);
	};

	sample = (): void => {
		this.input = SEED[this.mode];
		if (this.isTw && !this.themeCss.trim()) this.themeCss = SAMPLE_THEME;
		void this.run();
	};

	clear = (): void => {
		this.input = '';
		this.clearResult();
		this.save();
	};

	clearResult = (): void => {
		this.output = '';
		this.error = null;
		this.notices = [];
		this.unknown = [];
		this.stats = '';
		this.suggest = null;
		this.copied = false;
		this.copyNote = '';
	};

	// Not `$state`: the drag's origin is read only while a drag is alive, and re-rendering on it would
	// re-render on every mouse move for no reason.
	dragStartX = 0;
	dragStartW: number = LIMITS.left.default;

	dragStartY = 0;
	dragStartH: number = LIMITSH.top.default;

	/*
	  The drag session is the axis, not just a flag. The layer that hears the moves is axis-blind — it only
	  forwards window coordinates — so *something* has to remember whether those coordinates are a width or a
	  height, and it has to be one field: `dragging` decides what a move means, which splitter lights up, and
	  that the layer is mounted at all.
	*/
	beginDrag = (x: number): void => {
		this.dragging = 'x';
		this.dragStartX = x;
		this.dragStartW = this.splitW;
	};

	beginDragH = (y: number): void => {
		this.dragging = 'y';
		this.dragStartY = y;
		this.dragStartH = this.splitH;
	};

	/** The one handler the layer calls, with both coordinates; the axis picks which pair to use. */
	moveDrag = (x: number, y: number): void => {
		if (this.dragging === 'x') this.setSplit(this.dragStartW + (x - this.dragStartX));
		else if (this.dragging === 'y') this.setSplitH(this.dragStartH + (y - this.dragStartY));
	};

	/** The one place each divider's range is enforced, so the keyboard path and the mouse path agree. */
	setSplit = (px: number): void => {
		this.splitW = clamp(px, LIMITS.left.min, LIMITS.left.max);
		// A drag saves when it ends; an arrow-key nudge has no end, so it saves as it goes.
		if (!this.dragging) this.save();
	};

	setSplitH = (px: number): void => {
		this.splitH = clamp(px, LIMITSH.top.min, LIMITSH.top.max);
		if (!this.dragging) this.save();
	};

	endDrag = (): void => {
		if (!this.dragging) return;
		this.dragging = false;
		this.save();
	};

	resetSplit = (): void => {
		this.splitW = LIMITS.left.default;
		this.save();
	};

	resetSplitH = (): void => {
		this.splitH = LIMITSH.top.default;
		this.save();
	}

	save = (): void => {
		write_json('session.json', {
			mode: this.mode,
			inputs: this.inputs,
			selector: this.selector,
			themeCss: this.themeCss,
			comments: this.comments,
			nest: this.nest,
			showTheme: this.showTheme,
			splitW: this.splitW,
			splitH: this.splitH
		} satisfies Shape);
	};
}

export const app = new Helper();
