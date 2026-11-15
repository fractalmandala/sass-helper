<script lang="ts">

	import { on_window_key, use_palette, type GpuixEvent } from '@fractaldesign/gpuix-fractalsvelte';
	import './styles/index.css';

	import { app } from './src/state/app.svelte.ts';
	import { MODES } from './src/lib/index.ts';
	import Splitter from './src/ui/Splitter.svelte';
	import SplitterH from './src/ui/SplitterH.svelte';
	import DragLayer from './src/ui/DragLayer.svelte';

	$effect(() => use_palette('dark'));
	// The window exists by mount time, which is what font registration needs (see app.svelte.ts).
	$effect(() => app.register_fonts());

	let header_h = $state(0);
	// What the renderer actually draws: one row is 26px and the box adds 32px around them — measured with
	// bounds(), not guessed. Every budget below is rows math, and a wrong line height poisons all of it.
	const LINE = 26;
	const BOX = 32;
	// The column's own chrome, measured the same way: 50px around the code boxes (pad-lg and borders), and
	// — while the theme box is open — 78px between the input's bottom and the theme's top (gap, splitter, label).
	const PAD = 50;
	const GAP = 78;
	const rows_in = (h: number): number => Math.max(4, Math.floor((h - BOX) / LINE));
	const body_h = $derived(Math.max(120, app.height - (header_h || 120)));
	const pane_split = $derived(app.stacked ? 2 : 1);
	const content_h = $derived(body_h / pane_split - PAD);
	const output_rows = $derived(rows_in(content_h));

	// The vertical twin of the width split: the input takes `topHeight` — the divider's own number, capped
	// so the theme box keeps its four-row floor — and the theme box takes what the column has left after
	// it and the splitter + label. One grows by exactly what the other gives; with the theme off the input
	// is the whole column, exactly as the output pane is. The rows carry the sizes because GPUI's flex can
	// squeeze a textarea but never stretch one above its rows (a `flex-basis: 0` textarea paints 32px).
	const input_px = $derived(
		app.isTw && app.showTheme
			? Math.min(app.topHeight, content_h - (GAP + 4 * LINE + BOX))
			: content_h
	);
	const input_rows = $derived(rows_in(input_px));
	const theme_px = $derived(
		app.isTw && app.showTheme ? Math.max(4 * LINE + BOX, content_h - input_px - GAP) : 0
	);
	const theme_rows = $derived(rows_in(theme_px));

	$effect(() =>
		on_window_key('keydown', (e: GpuixEvent) => {
			if (!e.modifiers?.cmd) return;
			// Cmd+Enter converts from anywhere, including inside a text area — that is where the cursor is.
			if (e.key === 'enter') {
				e.preventDefault();
				void app.run();
				return;
			}
			if (e.editing) return;
			if (e.key === 's') {
				e.preventDefault();
				app.copy();
				return;
			}
			const n = Number(e.key);
			if (n >= 1 && n <= MODES.length) {
				e.preventDefault();
				app.setMode(MODES[n - 1].id);
			}
		})
	);
</script>

<div class="app-shell" testid="sass-shell" style:font-family={app.sans_family ?? undefined}>
	<div class="app-header xbetween row ycenter gap-md px-bs py-xs bb" testid="header" onlayout={(e: GpuixEvent) => (header_h = e.height ?? header_h)}>
		<div class="row ycenter gap-sm" testid="row-actions">
			<div class="modes" role="tablist" testid="modes">
				{#each MODES as m}
					<button
						class="outline text-sm h-bs modern"
						class:selected={app.mode === m.id}
						role="tab"
						aria-selected={app.mode === m.id}
						testid={`mode-${m.id}`}
						onclick={() => app.setMode(m.id)}
					>
						{m.label}
					</button>
				{/each}
			</div>
			<button class="secondary modern text-sm h-bs" testid="sample" onclick={app.sample}>Sample</button>
			{#if app.canSwap}
				<button class="secondary modern text-sm h-bs" class:off={!app.output.trim()} testid="swap" disabled={!app.output.trim()} onclick={app.swap}>Swap</button>
			{/if}
			<button class="secondary modern text-sm h-bs" testid="clear" onclick={app.clear}>Clear</button>
			<button class="secondary modern text-sm h-bs" class:off={!app.output} testid="copy" disabled={!app.output} onclick={app.copy}>
				{app.copied ? 'Copied' : 'Copy'}
			</button>
			<button class="secondary modern text-sm h-bs go" class:off={app.busy} testid="convert" disabled={app.busy} onclick={() => void app.run()}>
				{app.busy ? 'Working…' : 'Convert'}
			</button>
		</div>
		<div class="row ycenter xright gap-sm" testid="row-knobs">
			{#if app.isTw}
				<input
					class="input outline h-bs text-sm modern px-sm w-bs"
					testid="selector"
					placeholder=".element-h2"
					value={app.selector}
					onchange={(e: GpuixEvent) => (app.selector = e.value ?? '')}
				/>
				<button class="ghost text-sm h-bs modern" class:selected={app.showTheme} testid="toggle-theme" onclick={() => (app.showTheme = !app.showTheme)}>
					theme
				</button>
			{/if}
			{#if app.isTw || app.mode === 'css-sass'}
				<button class="ghost text-sm h-bs modern" class:selected={app.comments} testid="toggle-comments" onclick={() => (app.comments = !app.comments)}>
					comments
				</button>
			{/if}
			{#if app.mode === 'tw-sass' || app.mode === 'css-sass'}
				<button class="ghost text-sm h-bs modern" class:selected={app.nest} testid="toggle-nest" onclick={() => (app.nest = !app.nest)}>nest</button>
			{/if}
			{#if app.suggest}
				<button class="btn" testid="suggest" onclick={app.applySuggest}>Switch to {app.suggest.label}</button>
			{/if}
		</div>
	</div>
	<div class="sass-body" class:stacked={app.stacked} testid="body">
		<div class="sass-left pad-lg box gap-lg" class:stacked={app.stacked} testid="left" style={app.stacked ? '' : `width: ${app.leftWidth}px; min-width: ${app.leftWidth}px`}>
			<textarea
				class="code input-code"
				style:font-family={app.code_family ?? undefined}
				testid="input"
				placeholder={app.isTw ? 'Paste markup or a class list' : `Paste ${app.def.from}`}
				value={app.input}
				minRows={input_rows}
				maxRows={input_rows}
				onchange={(e: GpuixEvent) => (app.input = e.value ?? '')}
			></textarea>
			{#if app.isTw && app.showTheme}
				<SplitterH testid="splitterH"/>
				<!-- A brace in a plain attribute value opens an expression to the Svelte parser, so the example theme block is handed over as a JS string. -->
				<div class="box gap-sm">
					<div class="field-label">Theme</div>
					<textarea
						class="code theme"
						style:font-family={app.code_family ?? undefined}
						testid="theme"
						placeholder={'@theme { --color-brand: oklch(0.7 0.15 200); }'}
						value={app.themeCss}
						minRows={theme_rows}
						maxRows={theme_rows}
						onchange={(e: GpuixEvent) => (app.themeCss = e.value ?? '')}
					></textarea>
				</div>
			{/if}
		</div>
		{#if !app.stacked}
			<Splitter testid="splitter" />
		{/if}
		<div class="sass-right pad-lg" testid="right">
			<textarea
				class="code out"
				style:font-family={app.code_family ?? undefined}
				testid="output"
				readOnly
				placeholder="Convert →"
				value={app.output}
				minRows={output_rows}
				maxRows={output_rows}
			></textarea>
		</div>
	</div>

	<DragLayer />
</div>

<style>
	.app-shell {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		background: var(--bg);
	}

	/* GPUI has no descendant selector, so every part of a row is a class of its own. */
	.modes {
		display: flex;
		flex-direction: row;
		gap: 4px;
	}

	.btn {
		background: var(--bg-button);
		border: 1px solid var(--border);
		border-radius: 6px;
		color: var(--text-secondary);
		cursor: pointer;
		padding: 4px 10px;
		font-size: 11px;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.btn:hover {
		background: var(--bg-button-hover);
		color: var(--text-primary);
	}

	.btn:focus-visible {
		outline-width: 2px;
		outline-color: var(--ring);
	}

	.field-label {
		color: var(--text-muted);
		font-size: 11px;
		flex-shrink: 0;
	}

	/*
	  `calc()` is dropped by GPUI — and it is not needed: as the shell's flex child this row already takes the
	  height the header leaves (`flex-basis: 0` + `flex-grow: 1` + `min-height: 0` is the whole mechanism).
	*/
	.sass-body {
		display: flex;
		flex-direction: row;
		flex-grow: 1;
		flex-basis: 0;
		min-height: 0;
		height: 100%;
		width: 100%;
	}

	.sass-body.stacked {
		flex-direction: column;
	}

	.sass-left {
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
		min-height: 0;
		overflow: auto
	}

	.sass-left.stacked {
		width: 100%;
		min-width: 0;
	}

	.sass-right {
		display: flex;
		flex-direction: column;
		flex-grow: 1;
		flex-basis: 0;
		min-height: 0;
		min-width: 0;
		overflow: auto;
	}

	.code {
		background: var(--bg-input);
		border: 1px solid var(--border);
		border-radius: 6px;
		color: var(--text-primary);
		padding: 16px;
		font-family: var(--font-mono);
	}

	.code.theme {
		color: var(--text-secondary);
		border-color: var(--border-subtle);
		/* No flex sizing here: GPUI can squeeze a textarea but never stretch one above its rows, and a
		   `flex-basis: 0` textarea collapses to its padding. The rows binding carries the box's height. */
	}

	.code.out {
		color: var(--text-secondary);
		border-color: var(--border-subtle);
	}

	.code:focus-visible {
		outline-width: 2px;
		outline-color: var(--ring);
	}
</style>
