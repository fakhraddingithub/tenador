# Article Editor Improvements — Design

Date: 2026-08-17
Status: approved, ready for implementation

## Scope

Four independent, incremental improvements to the article block editor and renderer:

1. Simple per-block visual styling
2. Fix cropped/zoomed article content images
3. Side-by-side blocks on desktop, stacked on mobile
4. Clickable public URL for published articles in the admin editor

Priority order, absolute: **Correctness > Backward compatibility > Minimal changes > New functionality.**

## Existing architecture (verified by reading the code)

| Concern | Location | Notes |
|---|---|---|
| Block schema | `models/articleSchemas.js` → `ArticleBlockSchema` | `{ id, type, data, version }`, `_id:false`, `minimize:false` |
| Used by | `Article.blocks`, `Brand.articleBlocks` | One schema, two collections |
| Write choke point | `sanitizeArticleBlocks` in `src/lib/articleValidation.js:57` | Whitelist-rebuilds each block; drops unknown fields |
| Reached from | article `POST`/`PATCH`, `article-cms/[id]/autosave`, `brands/create`, `brands/[brandId]` | All go through `validateArticleInput` / `sanitizeArticleBlocks` |
| Per-type data validators | `src/lib/articleBlockValidation.js` | `validators[type]` map |
| Renderer (single) | `src/components/features/articles/ArticleBlockRenderer.jsx` | Returns a flat array from `.map()` |
| Render surfaces | `PublicArticlePage.jsx`, admin `ArticlePreview.jsx`, `BrandMiniArticleSection.jsx` | All three use the one renderer |
| Editor | `blockRegistry.js` (declarative fields) + `BlockEditor.jsx` (dnd-kit) | Reused verbatim by `BrandMiniArticleEditor` |
| Revisions | `models/ArticleRevision.js` | `snapshot` is `Mixed` — no schema coupling |
| Public visibility | `publicArticleFilter()` in `utils/articleRoutes.js:30` | published (null or past `publishedAt`) OR scheduled with past `publishedAt` |
| Canonical path | `buildArticlePath()` in `utils/articleSlug.js` | `/articles/{category}/{slug}`, returns `null` if either part missing |

## Binding requirements (from the requester)

R1. Gallery and cover image behavior stay **unchanged**; `object-cover` there is intentional. Only the regular `image` content block is fixed.
R2. Blocks with no `layout` behave exactly as full-width, as today.
R3. Mixed layout combinations must be explicitly tested: `1/3+1/3+1/3`, `1/2+1/2`, `1/3+2/3`, `2/3+1/3`, `2/3+2/3`, `1/2+1/3+1/3`, full + sized + full, and sized runs separated by a full-width block. Grouping, wrapping, spacing and ordering must all be correct.
R4. Mobile behavior verified in a real browser: sized blocks stack below `md`, with no broken margins, unexpected spacing, overflow, or layout shift.
R5. No unnecessary wrappers or refactors. Apply styles to existing elements where possible. Keep the change isolated.
R6. URL/routing/SEO logic unchanged. The clickable URL uses the existing canonical path. Drafts stay plain text and never receive a fake or placeholder `href`.
R7. All style inputs strictly validated. No arbitrary CSS value may reach the DOM.
R8. Strict process: one task → review → tests → browser verification → next. Any regression is fixed before continuing.

## Data model

`ArticleBlockSchema` gains two optional sub-schemas, both `default: undefined`, so absent stays absent on every existing document and no migration is required.

```js
BlockStyleSchema  = { spacing, textColor, background, accent, tableVariant }  // _id:false
BlockLayoutSchema = { width }                                                 // _id:false
```

Allowed values (anything else is dropped):

- `spacing`: `"none" | "sm" | "lg"` — `"md"` is the default and is **dropped**
- `textColor`, `background`, `accent`: `/^#[0-9a-fA-F]{6}$/` only (R7)
- `tableVariant`: `"striped" | "bordered" | "plain"` — `"default"` is **dropped**
- `width`: `"1/2" | "1/3" | "2/3"` — `"full"` is **dropped**

### Normalization invariant

The sanitizer drops every default-valued key, and returns `undefined` when no key survives. Therefore *"no styling configured"* can never be persisted as a truthy object, which is what guarantees byte-identical rendering for existing content.

Adding these in `sanitizeArticleBlocks` covers all five write paths at once, including both brand routes, with zero per-route edits.

## Task 1 — Block styling

`blockRegistry.js` gains a per-type `styleKeys` array so the editor only offers controls meaningful for that block type (no "button color" on a paragraph).

Renderer applies values **inline, per branch, on the element that already carries the relevant text/background** — no wrapper elements (R5).

Two deliberate decisions:

- **Spacing is inline `marginBlock`, never a Tailwind class.** Appending `my-16` alongside the existing `my-9` would not reliably win: equal specificity means generated-stylesheet order decides, not class-attribute order. Inline style always wins. Absent spacing → no inline style → the existing `my-9`/`my-5`/`my-10` classes apply untouched.
- **`accent` is semantic per type**: button background/border, table header background, quote right border, callout border + icon, divider color.

`background` on a block that has no padding of its own also receives `p-5` + rounding so it does not look cramped. Blocks that already have padding (callout, quote, newsletterCta) only swap the color.

## Task 2 — Image fix

Root cause, `ArticleBlockRenderer.jsx:73`: a hard-coded `16/9` container plus `object-cover`. `data.width`/`height` are supported by the validator but never set by the editor, so in practice **every** image block is force-cropped to 16/9.

Fix: drop `fill` and the fixed-ratio wrapper; use intrinsic responsive sizing (`width`/`height` attributes + `h-auto w-full`). Per the HTML spec the attributes yield `aspect-ratio: auto w / h`, where `auto` means the natural ratio takes over once the image loads — so the attributes prevent layout shift without locking the ratio.

The positioned wrapper existed *only* to satisfy `fill`; removing it is required by the fix, not a refactor.

Then, to remove pre-load shift, the article image field captures natural dimensions into `data.width`/`height` on selection. This is contained to the article block editor — the shared `ImageUpload` component is not modified. No validator change is needed; `width`/`height` are already accepted.

**Explicitly unchanged (R1):** the gallery grid (`:76`) and the cover hero (`PublicArticlePage.jsx:37`) keep `object-cover`.

## Task 3 — Side-by-side blocks

Grouping is **recomputed at render time** from per-block widths. There are no row IDs, so drag-reorder, duplicate, and delete cannot corrupt a row.

Algorithm (extracted as a pure, exported, unit-testable helper):

1. Render blocks to nodes; **drop nulls first**, so a block that renders nothing can neither occupy nor break a row.
2. Walk the survivors. A block with no width (or `full`) becomes its own full row. A sized block joins the current sized run, or starts one.
3. Full rows emit **the node directly, with no wrapper** → existing articles are byte-identical (R2).
4. A sized run is wrapped in `md:grid md:grid-cols-6 md:gap-x-6`, with spans `1/2→3`, `1/3→2`, `2/3→4`. A 6-column basis makes halves, thirds and two-thirds all exact, and grid auto-wraps when spans exceed 6.
5. Below `md` the wrapper declares no grid at all, so children are ordinary block elements that stack with their existing margins → mobile is unchanged by construction (R4).

RTL is free: CSS grid follows `dir="rtl"`, so the first block sits on the right.

Editor: a width selector per block.

## Task 4 — Clickable published URL

`ArticleEditor.jsx:68` currently collapses a missing category/slug into the placeholder string `"/articles/category/article"`. That string must never become an `href` (R6).

```js
const realPath = buildArticlePath(category?.slug, article.slug);  // null when incomplete
const livePath = realPath || "/articles/category/article";        // display only
const isLive   = Boolean(realPath) && isArticlePubliclyVisible(article);
```

`isArticlePubliclyVisible()` is added as a **pure sibling** of `publicArticleFilter` in `utils/articleRoutes.js`, so the two predicates stay visibly in sync. It mirrors the filter exactly: published with null or past `publishedAt`, or scheduled with past `publishedAt` — status alone is not sufficient.

In the "آدرس و آمار" panel: `isLive` renders `<a target="_blank" rel="noopener noreferrer">` with an external-link icon; otherwise the current `<p>` is unchanged. No routing, canonical, or SEO code is touched.

## Execution order

Smallest and safest first, so any regression is unambiguous:

**Task 2 → Task 4 → Task 1 → Task 3.**

Tasks 2 and 4 touch no schema at all. After each task: targeted review, `npm run lint`, `npm test`, and a real browser check of the editor and the public page, before the next task starts (R8).

## Testing

New `tests/articleBlockStyling.test.mjs`:

- Sanitizer round-trip: defaults dropped, invalid colors rejected, unknown keys stripped, legacy blocks emerge unchanged
- Row grouping: every combination listed in R3, plus null-rendering blocks and empty input

Browser verification: admin editor, admin preview, public article page, and the brand mini-article surface, at desktop and mobile widths.

## Backward compatibility summary

- No migration required; `default: undefined` means existing documents are untouched
- Absent `style`/`layout` → no inline styles, no wrappers → identical DOM
- Revision snapshots are `Mixed`; old snapshots restore fine, new ones round-trip the new fields
- Brand mini-articles inherit all four features through the shared editor and renderer
