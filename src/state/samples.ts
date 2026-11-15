/**
 * The sample text behind the Sample button.

 * A plain `.ts` module rather than state, so the headless tests and the engine's own test file can assert
 * on exactly what the window shows. These strings are documentation of the four modes: the Tailwind one
 * is the heading the tool was written for, and the CSS one is deliberately full of the nesting a human
 * would rather not type again.
 */
export const SAMPLE_TW = `<h2 class="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight text-fg">
  Now playing
</h2>
<button className="rounded-lg border border-brand px-4 py-2 text-sm font-medium text-fg hover:bg-brand/10 md:px-6">
  {label}
</button>
<div class="grid gap-4 p-6 shadow-sm dark:bg-panel">…</div>`;

export const SAMPLE_THEME = `@theme {
  --color-fg: oklch(0.18 0.01 265);
  --color-brand: oklch(0.72 0.15 200);
  --color-panel: oklch(0.24 0.02 265);
}`;

export const SAMPLE_CSS = `.card {
  display: flex;
  flex-direction: column;
  padding: 1rem;
}
.card:hover {
  border-color: #888;
}
.card .title {
  font-weight: 600;
}
.card.is-open .title {
  color: teal;
}
.card, .panel {
  gap: 0.5rem;
}
@media (min-width: 48rem) {
  .card {
    padding: 1.5rem;
  }
}`;

export const SAMPLE_SASS = `.card
  display: flex
  padding: 1rem
  border: 1px solid #ddd

  &:hover
    border-color: #888

  .title
    font-weight: 600

  @media (min-width: 48rem)
    padding: 1.5rem

$accent: teal

.badge
  color: $accent
  background: rgba($accent, 0.1)`;
