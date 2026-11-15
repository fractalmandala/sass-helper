# Provenance

Every file here is either written for this app or copied from the user's own `fractaldesign/modules`, at their
request. No third-party source was copied, translated, or pasted, so nothing external ships with the app. The
only imported code that is not the user's is the npm dependencies — `tailwindcss`, `sass`, `postcss`,
`@fractaldesign/gpuix-fractalsvelte`, `@fractaldesign/fractalstyler` — which are used as libraries, not vendored.

## Vendored, unchanged

| Here | From |
|---|---|
| `src/lib/csssass/ast.ts`, `convert.ts`, `diff.ts`, `index.ts`, `selector.ts` | `modules/css-to-sass/lib/` — byte-for-byte |
| `src/lib/tw/engine.ts` | `modules/tw2sass/engine.ts` — byte-for-byte |

`csssass/diff.ts` is not called by the UI yet; it came along with the layer it belongs to and is kept so a
later "what changed" view is one import away.

## Vendored, changed

- `src/lib/csssass/parse.ts` — one constructor rewritten:

  ```ts
  // before: constructor(private src: string) {}
  //  after: constructor(src: string) { this.src = src; }
  ```

  A TypeScript parameter property is not erasable syntax, and this app's `.ts` files run through Node's type
  stripping. Behaviour is identical.

## Written for this app

- `src/lib/tw/resolve.ts` — the dictionary: reads `theme.css` and `utilities.css` out of the installed
  `tailwindcss` package, compiles a candidate list with the real `compile()`, caches by theme and class set,
  and strips the pasted theme's own token values out of the result so `var(--color-fg)` survives as a
  reference instead of being inlined.
- `src/lib/tw/untwail.ts` — classes → sections → CSS or Sass, with the aligned comment column, the `px`
  annotations, the `calc(1.75 / 1.125)` line-height rewrite, and the two marked guesses for unresolved
  colour utilities.
- `src/lib/sass/compile.ts` — dart-sass with brace-based syntax detection.
- `src/lib/index.ts` — the mode table and the single `convert()` entry.
- `src/lib/clipboard.ts` — the platform clip tools with a file fallback.
- `src/state/*`, `src/ui/*`, `App.svelte`, `app.ts`, `standalone.ts`, `build.ts`, `test.ts` — this app's UI.
  `src/state/persist.ts` follows the same data-directory convention as the other gpuix apps here, and
  `src/ui/Splitter.svelte` / `DragLayer.svelte` are the drag pattern from the `building-gpuix-fractalsvelte`
  skill's assets, adapted to one horizontal divider.

`styles/` is fractalstyler's own layer set, vendored (with its `LICENSE`) so an app token can be edited in
place rather than patched around.
