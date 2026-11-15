# sass-helper

A native desktop window for reading stylesheets back to yourself. Four conversions, all offline:

| Mode | Input | Output |
|---|---|---|
| **Tailwind → CSS** | markup or a class list | one rule per element, one comment per utility |
| **Tailwind → Sass** | the same | the same dictionary in indented Sass, comments kept on the declaration line |
| **CSS → Sass** | plain CSS | nested Sass, only where the cascade cannot change |
| **Sass → CSS** | Sass or SCSS | dart-sass, expanded |

The Tailwind directions resolve every candidate through the **real Tailwind v4 compiler** that ships in
`node_modules/tailwindcss` — its own `theme.css` and `utilities.css` are the dictionary, so there is nothing
to download and nothing hand-authored to go stale. A class that resolves to nothing is reported, not invented.

```css
.element-h2 {
  margin-bottom: 1rem;       /* mb-4 (16px) */
  display: flex;             /* flex */
  align-items: center;       /* items-center */
  gap: 0.5rem;               /* gap-2 (8px) */
  font-size: 1.125rem;       /* text-lg (18px) */
  line-height: 1.75rem;      /* text-lg (28px) */
  font-weight: 600;          /* font-semibold */
  letter-spacing: -0.025em;  /* tracking-tight */
  color: var(--color-fg);    /* text-fg (custom theme variable) */
}
```

The comment column is the deliverable: the pixels, and whether a value came from Tailwind's defaults or from
the `@theme` block you paste into the left pane. Custom tokens stay as `var()` references on purpose — that
is the line you are supposed to recognise.

Built on [`@fractaldesign/gpuix-fractalsvelte`](https://www.npmjs.com/package/@fractaldesign/gpuix-fractalsvelte):
Svelte 5 compiled into GPUI, one Metal-backed window, no DOM and no CSS engine.

## Run it

```bash
npm install          # gpuix-fractalsvelte brings its own patched Svelte; keep `svelte` out of package.json
npm start            # opens the window (1440×1024) and hot-reloads on save
npm test             # 70 headless checks through GPUI's real hit testing
npm run test:lib     # 15 engine checks: the real compiler, the real dart-sass, no UI
npm run typecheck    # tsc, then svelte-check against GPUI's element types (warnings fail it)
npm run shot         # the same as start, but writes /tmp/sass-helper.png after every mount
npm run build        # dist/sass-helper.app on macOS; needs Bun >= 1.4
npm run dmg          # the same build, then dist/sass-helper.dmg (macOS only)
```

Needs Node >= 24 or Bun >= 1.4. `npm test` and `npm run shot` require macOS or Windows, where the headless
renderer is built. With Bun: `bun run start`, `bun run test`.

### Installable .dmg

```bash
npm run dmg          # or: bun build.ts --dmg (also accepts --archive / --aot / --trim)
```

This runs the regular build first — including the mixed iconset rebuild, where the Dock sizes come from
`public/icon.png` and everything 64 px and under from `public/icon1024.png` — then packs the `.app` into
`dist/sass-helper.dmg`. The image contains the app beside a link to `/Applications`, so installing is
opening the image and dragging one onto the other, and the volume itself carries the app icon.

The build is unsigned, so Gatekeeper blocks a copy that came from a download rather than this machine:
right-click → **Open** the first time, or clear it with `xattr -cr sass-helper.app`. To ship a signed
build, set `CODESIGN_IDENTITY` in the environment and add `--archive` — the icon swap runs through
`beforeArchive`, before signing, so the signature covers the final icns.

## Using the window

One line of header, then nothing but code. The four modes and the buttons sit on its left, the knobs this
mode can honour on its right, and the body is the input, the theme box, the dividers and the output — the
boxes fill the window at any height.

The header's buttons: the four modes, then Sample / Swap / Clear / Copy / Convert. Swap shows only for the
two directions of the same language, because that is the pair where feeding the output back in is the round
trip. When the input is not what this tab reads, the header grows a **Switch to …** button for the mode
that does. Counts, notices and the copy note are computed but not drawn yet — where they land is still an
open decision.

| Knob | Where | What it does |
|---|---|---|
| `selector` | Tailwind modes | Names the rule when the input is one bare class list (`mb-4 flex` → `.hero { … }`). With markup in the input it is ignored, because each element gets its own `.element-<tag>`. A bare name gets its dot. |
| `theme` | Tailwind modes | Opens and closes the `@theme` box under the input, with its own divider — the project's own tokens, so `text-fg` resolves instead of being guessed. |
| `comments` | Tailwind modes | The `/* mb-4 (16px) */` column itself — off gives you the bare stylesheet. |
| `comments` | CSS → Sass | Keeps the comments already in your CSS — as `//` lines, or as `/* … */` when they are an annotation column, so the next hop can still see them; off drops them. |
| `nest` | CSS → Sass, Tailwind → Sass | Whether shared prefixes fold into nested rules. Off means a flat list of full selectors, which is what you want if anything else will re-parse the output. |
| — | Sass → CSS | No knobs: dart-sass just compiles. |

Every code box's height is carried by its `minRows`/`maxRows`, derived from the header's measured height
(`onlayout`) and the two dividers' state — GPUI's flex can squeeze a textarea but never stretch one above
its rows. Dragging a divider gives one box exactly what it takes from the other; with the theme box closed
the input is the whole column, exactly as the output pane is.

**Each tab keeps its own input.** The markup you pasted into Tailwind → CSS is not what CSS → Sass shows,
because a stylesheet tab reading a component is a confusing error, not a workflow. All four buffers are saved,
so a restart brings back what you had in each.

Shortcuts: `Cmd+Enter` converts, `Cmd+1…4` picks the mode, `Cmd+S` copies the output. Typing in a field never
triggers a shortcut, because the window handler checks `e.editing` first.

Both dividers drag, and both are tab stops: `left`/`right` for the pane divider, `up`/`down` for the theme
divider (`shift` for 48 px, `0` or alt-click to reset either). Under 860 px wide the panes stack, derived
from the polled window size because GPUI has no `@media`.

### Chaining the modes

The tabs compose, which is how you get a component into Sass: **Tailwind → CSS**, then **CSS → Sass** with that
output in its own buffer (or press Swap). The annotation column survives that hop — the converter would
otherwise print every comment on its own line, so a comment that shared a line with its declaration goes back
onto it and each block's column is re-padded, because a Sass declaration has no semicolon.

It does not survive **Sass → CSS**, and that is dart-sass, not this app: in indented syntax a comment trailing a
declaration is dropped when it compiles. The mode's own header line says so. The column is for reading, not for
shipping, so the Tailwind modes keep it and the compile directions drop it.

### Two honest limits

GPUI's text area has no `nowrap` — `white-space: pre` does not exist here — so a line longer than the pane
folds. The column reads best with the divider dragged wide, and `Copy` always hands over the exact text rather
than what is on screen.

Copy goes through the platform's clip tool: `pbcopy` on macOS, `clip` on Windows, then `wl-copy`/`xclip`/`xsel`
on Linux. GPUI has no clipboard binding, so if none of those exist the status line says where the file was
written instead of claiming a copy that did not happen.

## Hot reload

`npm start` runs `app.ts`, which calls `render_hot`; that is the whole setup.

- save a **`.svelte` or `.css`** file → the app remounts in the same process. Component state resets;
  `src/state/app.svelte.ts` does not, so both panes keep their text — and the compiled Tailwind dictionary
  in `src/lib/tw/resolve.ts` stays cached, which is why the second conversion is far quicker than the first.
- save a **`.ts` or `.svelte.ts`** file → the console prints the load-once reminder. Ctrl-C and `npm start`
  again; there is no way around it, and it is exactly what lets state survive a reload.

The session — mode, both panes, the knobs, both dividers — is written to `session.json` in
`~/Library/Application Support/sass-helper` on macOS, `%APPDATA%\sass-helper` on Windows,
`$XDG_CONFIG_HOME/sass-helper` elsewhere (`src/state/persist.ts`). Delete that file for the shipped defaults.

`GPUIX_FPS=1 npm start` draws GPUI's frame-time overlay; `npm run shot` writes a PNG per mount for reviewing paint.

## Files

- `App.svelte` — the shell: `.sass-header` with every control, `.sass-body` with the input pane, the theme
  box and the output pane.
- `src/ui/` — `Splitter.svelte` (the pane divider), `SplitterH.svelte` (the theme divider), `DragLayer.svelte`
  (the full-window overlay that hears the drag, because GPUI captures no pointer).
- `src/state/` — `app.svelte.ts` (the state class: modes, panes, knobs, both drags, font registration,
  persistence), `samples.ts` (the text behind the Sample button, shared with the tests), `persist.ts` (the
  JSON read/write).
- `src/lib/index.ts` — the one entry, `convert(mode, input, options)`, and the mode table.
- `src/lib/font.ts` — reads a font file's family name out of its bytes; `src/state` registers the fonts and
  picks the sans and mono families from what is registered.
- `src/lib/tw/` — `resolve.ts` (the Tailwind v4 dictionary and its cache), `untwail.ts` (class list → sections →
  CSS or Sass with the comment column), `engine.ts` (postcss extraction of what the compiler emitted).
- `src/lib/sass/compile.ts` — dart-sass with syntax detection. `src/lib/csssass/` — CSS → nested Sass.
- `src/lib/clipboard.ts` — the platform clip tools and their file fallback.
- `styles/` — fractalstyler's layers, vendored so a token can be edited in place. Most of that file is web CSS
  GPUI cannot match: it is imported for the `:root` tokens and the palette, and the renderer says which selectors
  it skips.
- `standalone.ts`, `build.ts` — the entry and the build/`--dmg` script behind `npm run build`; `build.ts`
  also rebuilds the packaged icns so the Dock sizes come from `public/icon.png` and everything 64 px and
  under from `public/icon1024.png`.
- `test.ts` — the window's behaviour (it imports `test-session-dir.ts` first, so the suite's session file
  is a throwaway, not yours); `src/lib/sass-helper.test.ts` — the engines'.
- `docs/` — `PROVENANCE.md` (where the vendored code came from and what was changed), plus `app.md` and
  `fonts.md`.

`AGENTS.md` is the scaffold's own note on GPUI rules; the `building-gpuix-fractalsvelte` skill is the longer
version, and `node ~/.fdesign/skills/building-gpuix-fractalsvelte/scripts/gpui-css-lint.mjs .` is the static
check for CSS the renderer would drop.
