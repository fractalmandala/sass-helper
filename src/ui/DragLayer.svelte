<!--
  The layer that hears a divider drag.

  `Splitter.svelte` only starts the gesture; the moves and the release have to be caught by a surface
  above everything the pointer can travel over while the button is still down. This is that surface —
  it exists solely while `app.dragging` is set, and it ends the drag on the payload's button state
  rather than on `mouseup` alone, because a release that lands on a pane without our listener never
  arrives at all.
-->
<script lang="ts">
	import type { GpuixEvent } from '@fractaldesign/gpuix-fractalsvelte';
	import { app } from '../state/app.svelte.ts';

	function move(e: GpuixEvent): void {
		if (!app.dragging) return;
		// The payload's button state is the truth: a buttonless move means the pointer is no longer held.
		if (e.pressedButton == null) {
			app.endDrag();
			return;
		}
		// The layer is axis-blind: it forwards window coordinates and the state's drag session — which is the
		// axis itself (`'x'` or `'y'`) — decides whether those coordinates mean a width or a height.
		app.moveDrag(e.x ?? 0, e.y ?? 0);
	}
</script>

{#if app.dragging}
	<div class="drag-layer" testid="drag-layer" onmousemove={move} onmouseup={app.endDrag} onmousedownoutside={app.endDrag}></div>
{/if}

<style>
	/*
	  `position: absolute` plus a background is what makes this the surface the pointer lands on: a mouse
	  event fires down to the first element that paints or is absolutely positioned, so this wash keeps
	  the two text areas from taking hover and caret states mid-drag. `inset: 0` expands to the four
	  sides because GPUI has no `inset` field of its own.
	*/
	.drag-layer {
		position: absolute;
		inset: 0;
		/* GPUI hit-tests painted backgrounds more reliably than `transparent`, so it is nearly invisible
		   rather than absent. */
		background: #00000001;
		cursor: col-resize;
	}
</style>
