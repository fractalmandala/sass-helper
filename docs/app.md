# App

A text area sizes itself to its content between `minRows` and `maxRows`, so both ends are pinned to one number — that is what makes the boxes fill the window. The column height comes from the header's measured `onlayout` height. The per-line figures are measured against this renderer, not guessed: a 13px code line is 24px tall and a code box carries 16px of padding and border, so `rows_in` turns a pixel budget into the rows that actually fill it.

Setting in `App.svelte`- 

```ts
	let header_h = $state(0);
	const LINE = 24;
	const BOX = 16;
	const rows_in = (h: number): number => Math.max(4, Math.floor((h - BOX) / LINE));
	const theme_rows = $derived(app.isTw && app.showTheme ? 4 : 0);
	const body_h = $derived(Math.max(160, app.height - (header_h || 160)));
	const pane_split = $derived(app.stacked ? 2 : 1);
	const output_rows = $derived(rows_in(body_h / pane_split));
```

The input's height *is* the horizontal divider's position: `topHeight` is what the drag negotiated, and the token box lives on whatever is left below it. The min() is the promise the column adds on top — in the stacked layout the left pane is only half the body, and a token box pushed off-window is a drag that lost the thing it was dividing. Rows are the one height GPUI's text area obeys, so the drag moves the rows and never an inline `height`, which would be a second source of truth for the same pixel.

```ts
	const input_px = $derived(
		app.isTw && app.showTheme
			? Math.min(app.topHeight, body_h / pane_split - (theme_rows * LINE + BOX + 46))
			: body_h / pane_split
	);
	const input_rows = $derived(rows_in(input_px));
```