<!--
  The draggable divider between the input and output panes.

  GPUI captures no pointer, so this element only starts the gesture; `DragLayer.svelte` hears the moves
  above it. The strip is also a real tab stop, because a divider you can only move with a mouse you
  cannot move at all with a keyboard: left and right nudge it, shift for a bigger step, alt-click or `0`
  returns it to the shipped width.
-->
<script lang="ts">
	import type { GpuixEvent } from '@fractaldesign/gpuix-fractalsvelte';
	import { app } from '../state/app.svelte.ts';

	let { testid = 'splitter' }: { testid?: string } = $props();

	const active = $derived(app.dragging === 'x');

	function press(e: GpuixEvent): void {
		if (e.modifiers?.alt) {
			app.resetSplit();
			return;
		}
		app.beginDrag(e.x ?? 0);
	}

	/** GPUI reports keys in its own lowercase syntax (`"left"`), not the DOM's (`"ArrowLeft"`). */
	function key(e: GpuixEvent): void {
		const step = e.modifiers?.shift ? 48 : 12;
		if (e.key === 'left' || e.key === 'right') {
			e.preventDefault();
			app.setSplit(app.splitW + (e.key === 'right' ? step : -step));
			return;
		}
		if (e.key === '0') {
			e.preventDefault();
			app.resetSplit();
		}
	}
</script>

<div
	class="splitter"
	class:active
	role="separator"
	aria-valuetext={`${app.splitW} pixels`}
	tabindex={0}
	{testid}
	onmousedown={press}
	onkeydown={key}
>
	<div class="grip"></div>
</div>

<style>
	.splitter {
		width: 7px;
		height: 100%;
		display: flex;
		justify-content: center;
		cursor: col-resize;
		/*
		  A background is not decoration here: GPUI delivers a mouse event only down to the first element
		  that paints one, so an invisible divider never hears its own `onmousedown`.
		*/
		background: var(--bg);
	}

	.grip {
		width: 1px;
		height: 100%;
		background: var(--border);
		/* The hairline sits under the pointer at the strip's centre. If it took part in the hit test the
		   press would land on it and stop there, and it has no handler. */
		pointer-events: none;
	}

	.splitter:hover {
		background: var(--state-hover);
	}

	.splitter.active {
		background: var(--state-hover);
	}

	.splitter:focus-visible {
		background: var(--state-hover);
		outline-width: 2px;
		outline-color: var(--ring);
	}
</style>
