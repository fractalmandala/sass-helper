<!--
  The draggable divider between the input and the token box — the vertical twin of `Splitter.svelte`.

  GPUI captures no pointer, so this element only starts the gesture; `DragLayer.svelte` hears the moves
  above it. The strip is also a real tab stop, because a divider you can only move with a mouse you
  cannot move at all with a keyboard: up and down nudge it, shift for a bigger step, alt-click or `0`
  returns it to the shipped height.
-->
<script lang="ts">
	import type { GpuixEvent } from '@fractaldesign/gpuix-fractalsvelte';
	import { app, LIMITSH } from '../state/app.svelte.ts';

	let { testid = 'splitterH' }: { testid?: string } = $props();

	const active = $derived(app.dragging === 'y');

	function press(e: GpuixEvent): void {
		if (e.modifiers?.alt) {
			app.resetSplitH();
			return;
		}
		// A height is being negotiated, so the gesture's origin is the pointer's Y. (`e.x` here would make
		// every delta a sideways one, and the divider would chase the mouse down a different axis.)
		app.beginDragH(e.y ?? 0);
	}

	/** GPUI reports keys in its own lowercase syntax (`"up"`), not the DOM's (`"ArrowUp"`). */
	function key(e: GpuixEvent): void {
		const step = e.modifiers?.shift ? 48 : 12;
		if (e.key === 'up' || e.key === 'down') {
			e.preventDefault();
			app.setSplitH(app.splitH + (e.key === 'down' ? step : -step));
			return;
		}
		if (e.key === '0') {
			e.preventDefault();
			app.resetSplitH();
		}
	}
</script>

<div
	class="splitterH"
	class:active
	role="separator"
	aria-valuetext={`${app.splitH} pixels`}
	tabindex={0}
	{testid}
	onmousedown={press}
	onkeydown={key}
>
	<div class="grip"></div>
</div>

<style>
	.splitterH {
		width: 100%;
		height: 6px;
		display: flex;
		align-items: center;
		cursor: row-resize;
		/*
		  A background is not decoration here: GPUI delivers a mouse event only down to the first element
		  that paints one, so an invisible divider never hears its own `onmousedown`.
		*/
		background: var(--bg);
	}

	.grip {
		width: 100%;
		height: 2px;
		background: var(--border);
		/* The hairline sits under the pointer at the strip's centre. If it took part in the hit test the
		   press would land on it and stop there, and it has no handler. */
		pointer-events: none;
	}

	.splitterH:hover {
		background: var(--state-hover);
	}

	.splitterH.active {
		background: var(--state-hover);
	}

	.splitterH:focus-visible {
		background: var(--state-hover);
		outline-width: 2px;
		outline-color: var(--ring);
	}
</style>
