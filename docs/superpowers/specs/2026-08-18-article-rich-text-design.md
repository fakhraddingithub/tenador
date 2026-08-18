# Article Block Editor — Rich Text & Editor Ergonomics

Date: 2026-08-18
Status: approved

## Goal

Three scoped improvements to the article block editor:

1. A compact inline rich-text toolbar for `heading`, `paragraph` and `quote`
   blocks, applying formatting to the current text selection.
2. Block appearance/layout controls moved from the bottom of each block to the
   top.
3. A second, fixed Preview/Save control at the bottom-left of the viewport,
   alongside the existing top controls.

Priority order, unchanged from the previous round of work:
**Correctness > Backward compatibility > Minimal changes > New functionality.**

## Current architecture (as analysed)

| Concern | Location |
| --- | --- |
| Block definitions, field kinds | `src/components/admin/articles/blockRegistry.js` |
| Editor UI, per-block panel | `src/components/admin/articles/BlockEditor.jsx` |
| Page-level editor, save/autosave | `src/components/admin/articles/ArticleEditor.jsx` |
| Write-path sanitiser (all 5 paths) | `src/lib/articleBlockValidation.js` |
| Block array sanitiser | `src/lib/articleValidation.js` |
| Renderer (public + preview + brand) | `src/components/features/articles/ArticleBlockRenderer.jsx` |
| Existing HTML sanitiser (`customHtml`) | `src/lib/sanitizeArticleHtml.js` |
| Block schema | `models/articleSchemas.js` |

Text blocks today:

| Block | Field | Renders as |
| --- | --- | --- |
| `heading` | `data.text` (max 500) | `<h2/h3/h4>{data.text}</h2>`, JSX-escaped |
| `paragraph` | `data.text` (max 50000) | `<p class="whitespace-pre-line">{data.text}</p>` |
| `quote` | `data.text` (max 5000), `data.author` | `<blockquote><p>{data.text}</p>…` |

Two consumers constrain the design:

- `countArticleWords` (`src/lib/articleContent.js`) already strips `<[^>]*>`
  from every string, so word count and reading time tolerate HTML.
- `articleHeadings()` reads `block.data.text` **raw** for the table of
  contents. If `text` ever became HTML, tags would appear in the TOC.

The article `$text` index covers only `title` and `excerpt`, so block text is
not search-indexed.

`sanitize-html@2.17` is already a dependency and already wired up for the
`customHtml` block. No new dependency is required, and no editor framework
(Tiptap/ProseMirror/Slate) is introduced.

## Task 1 — rich text

### Data model

`data.text` remains the plain-text source of truth. An optional sibling
`data.html` carries the formatted version and is written **only when the
author actually formats something**.

```js
// unformatted block — unchanged from today, no `html` key
{ type: "paragraph", data: { text: "This is an important sentence." } }

// formatted block
{ type: "paragraph", data: {
    text: "This is an important sentence.",
    html: "This is an <b>important</b> sentence.",
} }
```

`data` is `mongoose.Schema.Types.Mixed`, so **no schema change is needed** for
`html`. No migration is required: an existing block has no `html` key and takes
the current renderer branch untouched.

The editor keeps the two in sync by emitting both on every edit — `text` from
`element.innerText`, `html` from the sanitised markup. TOC, word count, reading
time and excerpt therefore keep reading plain text exactly as they do now.

Rejected alternative: converting `data.text` itself to HTML. It needs a
migration over every article (escaping `<` and `&`, converting newlines to
`<br>`) and permanently forces tag-stripping on the TOC, word count and
excerpt. More risk for fewer keys.

### Sanitisation (R7 — no arbitrary CSS reaches the DOM)

A **new** `src/lib/sanitizeRichText.js`, deliberately separate from
`sanitizeArticleHtml` so the `customHtml` block's existing security boundary is
not widened:

```
allowedTags:       b strong i em u s a span br
allowedAttributes: a[href,target,rel]; span,b,strong,i,em,u,s[style]
allowedStyles:     color     -> #rrggbb | rgb(n,n,n)
                   font-size -> one of 0.8em 1em 1.25em 1.5em 2em
transformTags:     div,p -> br   (contentEditable line breaks survive)
                   a with target=_blank gains rel=noopener noreferrer
allowedSchemes:    http https mailto tel
allowProtocolRelative: false
```

Anything outside that vocabulary is dropped. Verified against a hostile
battery: `<script>`, `<img onerror>`, `javascript:` hrefs, `background:url()`,
out-of-range font sizes, `<font>` legacy tags.

A leading `<br />` produced by `transformTags` on `<p>`-wrapped input is
trimmed after sanitising.

Applied **server-side at the write choke point**
(`validators.heading/paragraph/quote` in `articleBlockValidation.js`), covering
all five write paths, and again at render — the same belt-and-braces pattern
`customHtml` already uses.

`html` is added to the returned data object only when non-empty, so existing
stored blocks remain byte-identical after a save.

### Editor component

New `src/components/admin/articles/RichTextField.jsx`: a `contentEditable`
element plus a compact toolbar row styled to match the existing editor.

- **bold, italic, underline, link, text colour** — `document.execCommand` with
  `styleWithCSS`. execCommand is used deliberately: it correctly re-colours
  text that already carries a colour span, which a naive `Range` wrap does not.
- **font size** — a short manual `Range.extractContents()` wrap, because
  `execCommand("fontSize")` only emits `<font size="1-7">`. Conflicting
  `font-size` on descendants of the new span is cleared so re-sizing works.
- **alignment** — writes `block.style.align`, not inline markup (see below).
- Button active state comes from `document.queryCommandState`.

Registry change: the `text` field of `heading`, `paragraph` and `quote` changes
`kind` from `text`/`textarea` to `rich`. `BlockField` gains a `rich` branch that
receives the whole `data` object and emits a `{ text, html }` patch — the same
convention `image` and `table` already use. No other block type is touched.

### Alignment

Alignment is a whole-line property, so it joins the existing validated
block-style vocabulary rather than the inline markup:

- `models/articleSchemas.js`: `align: { type: String, enum: ["left","center","right"] }`
  on `ArticleBlockStyleSchema`, optional, no default — absent stays absent.
- `articleBlockValidation.js`: `align` added to the strict style sanitiser.
- Renderer: one more entry in the merged inline style, `{ textAlign: v.align }`.

Rejected alternative: `execCommand("justifyCenter")`, which injects
`<div style="text-align">` into stored HTML. That would require allowing `div`
and `text-align` in the allowlist, and block-level `div`s nested inside `<p>`
are invalid HTML that browsers un-nest, breaking paragraph styling.

### Renderer

Three ternaries, one per text block:

```jsx
data.html
  ? <p … dangerouslySetInnerHTML={{ __html: sanitizeRichText(data.html) }} />
  : <p … className="… whitespace-pre-line">{data.text}</p>
```

`whitespace-pre-line` is dropped on the HTML branch, since `<br>` carries the
line breaks there and stray newlines in the markup must not double up.

`articleHeadings()` needs no change — it reads `data.text`, which stays plain.

## Task 2 — layout controls at the top

`<BlockStylePanel>` moves from after the field list to before it inside the
open block body. One JSX element relocated; no change to its props, state or
behaviour. Applies to every block type uniformly.

## Task 3 — fixed Preview/Save

A `fixed bottom-4 left-4 z-40` bar in `ArticleEditor`, reusing the same
handlers as the existing header buttons, which are left untouched.

- `z-40` sits below the block library (`z-[100]`) and revision history
  (`z-[110]`), so it can never cover a modal.
- The admin sidebar is on the right in RTL, so bottom-left is clear; the admin
  header is `sticky top-[75px] z-40`, not bottom-anchored.
- Precedent for the pattern already exists at
  `src/app/(Admin-Panel)/p-admin/admin-home/slider/page.jsx:242`.
- Respects `env(safe-area-inset-bottom)` for mobile.

## Backward compatibility

| Guarantee | Mechanism |
| --- | --- |
| Existing articles render identically | No `html` key → existing renderer branch, unchanged |
| No migration | `data` is `Mixed`; `html` is additive and optional |
| `style.align` absent stays absent | Optional enum, no default, dropped by the sanitiser when unset |
| `customHtml` security unchanged | New sanitiser is a separate function; `sanitizeArticleHtml` untouched |
| TOC / word count / excerpt unchanged | They read `data.text`, which stays plain text |
| Save / autosave / preview unchanged | No change to payload shape beyond additive keys |

To be **proved, not asserted**: the rendered body of an article using no
formatting must be byte-identical to the pre-change baseline.

## Testing

| File | Covers |
| --- | --- |
| `tests/richText.test.mjs` (new) | Sanitiser allowlist, hostile-input battery, `div→br`, leading-`<br>` trim |
| `tests/articleBlockStyle.test.mjs` (extend) | `align` accepted for valid values, dropped otherwise |
| `tests/articleBlockPersistence.test.mjs` (extend) | `data.html` and `style.align` survive a real save/reload; unformatted block gains neither key |

Plus, after each task: `node --test tests/*.mjs`, eslint on touched files,
production build, and browser verification of the actual editor.

The jest suite (`npm test`) is broken at baseline — `tests/setup.js` referenced
by the jest config does not exist. Pre-existing and out of scope; the real
suite is `node --test tests/*.mjs`.

## Execution order

Task 1 → review → tests → browser verify → Task 2 → … → Task 3 → … → final
end-to-end review. A regression at any stage is fixed before moving on.
