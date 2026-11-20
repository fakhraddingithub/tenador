# Custom tab item texts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The AI writes a product-specific title and description for each custom-tab item it selects (create + regenerate); the category's manual text is the fallback.

**Architecture:** `customTabItems` stays the selection. Two new AI output maps (`customTabTitles`, `customTabDescriptions`, keyed by exact item title) are two new fixed prompt fields. One pure helper (`src/lib/customTabTexts.js`) turns maps ↔ the stored `Product.customTabTexts` and resolves what the product page shows; every write path (create, PUT, regeneration) and every read path (edit form, page) goes through it.

**Tech Stack:** Next 16, Mongoose 9, node:test.

**Spec:** `docs/superpowers/specs/2026-11-20-custom-tab-item-texts-design.md`

## Global Constraints
- Output keys: `customTabTitles`, `customTabDescriptions` — `{ "<exact catalog item title>": "<string>" }`.
- Stored: `Product.customTabTexts: [{ item: ObjectId, title: String, description: String }]`, `_id: false`, only selected items, only entries with a non-empty title or description.
- Category: `customTab.titlePrompt`, `customTab.descriptionPrompt` (String, trim, default ""). `customTab.items[].prompt` removed.
- Limits: title ≤ 200 chars, description ≤ 3000 chars (after trim); plain text, no HTML.
- `undefined ≠ {}` on every write path, per map.
- No prompt wording in code (`tests/productPromptConfig.test.mjs`); all wording in `productPromptSeed.json`.
- Every CLAUDE.md section that describes the custom tab is updated.

## Review Focus
1. Admin renames an item in the category → product text survives (keyed by `_id`). Test in Task 1.
2. Item deselected on edit/regeneration → its text is dropped, not resurrected on re-select. Test in Task 1 (prune) + Task 4.
3. Stored prompt config saved before this change → both new fields print with seed rules and the base page can save. Test in Task 2.
4. Request sends `customTabItems` only (old client / old JSON) → existing texts kept for still-selected items. Test in Task 1.
5. AI writes a key for an item it did not select or that does not exist → create skips it, regeneration planner rejects unknown titles, ignores unselected. Tests in Tasks 3, 4.

---

### Task 1: Pure helper `src/lib/customTabTexts.js`

**Files:** Create `src/lib/customTabTexts.js`, `tests/customTabTexts.test.mjs`; add `test:custom-tab-texts` to `package.json`.

**Produces:**
- `CUSTOM_TAB_TEXT_LIMITS = { title: 200, description: 3000 }`
- `checkTextMap(value, field) → { value: Record<string,string> } | { error: string }` — `undefined` → `{ value: undefined }`; `null`/`""` → `{}`; non-plain-object or non-string value → error; values trimmed; over-limit → error naming the key.
- `mergeCustomTabTexts({ items, selectedIds, existing = [], titles, descriptions }) → Array<{item, title, description}>` — per selected id in order; `titles === undefined` keeps `existing` title, else `titles[item.title] ?? ""`; same for descriptions; drops entries with both empty and ids not in `items`.
- `unknownTextKeys(items, map) → string[]` — keys that are no catalog title.
- `customTabTextMaps(items, texts) → { customTabTitles, customTabDescriptions }` keyed by current catalog title (only non-empty).
- `resolveCustomTabItems(customTab, selectedIds, texts) → items[]` — enabled tab only, catalog order, each `{ ...item, title: text.title || item.title, description: text.description || item.description }`.

- [ ] Tests: rename survives (`texts` by id, `resolveCustomTabItems` shows override, `customTabTextMaps` keys by new title); prune on deselect; `titles` undefined keeps existing; `{}` clears; per-field fallback; bad shapes/limits error.
- [ ] Implement; `npm run test:custom-tab-texts` passes; commit.

### Task 2: Category + prompt builder + prompt settings

**Files:** `models/Category.js`, `src/app/api/categories/create/route.js`, `src/app/api/categories/[categoryId]/route.js`, `src/lib/categoryFormCopy.mjs`, `src/components/admin/CustomTabPromptField.jsx`, both category admin pages, `src/lib/productPromptConfig.js`, `src/lib/productPromptSeed.json`, `src/lib/productPromptResolve.js`, `src/lib/buildProductTemplate.js`, `src/app/api/admin/product-prompts/category-rule/route.js`, prompt preview page, `src/lib/publicProductFields.js`, new `scripts/removeCustomTabItemPrompts.mjs` (+ `check:`/`migrate:remove-tab-item-prompts`). Tests: `productPromptConfig`, `aiProductDraft`, `categoryFormCopy`, `publicProductFields`.

- `PRODUCT_PROMPT_FIELDS` gains `customTabTitles` («عنوان آیتم‌های تب سفارشی») and `customTabDescriptions` («توضیحات آیتم‌های تب سفارشی») right after `customTabItems`; both offered to groups; both printed only when the tab has items.
- Category rule sources: `{ kind: "customTabTitle", tabName, value }` ← `customTab.titlePrompt`, `{ kind: "customTabDescription", tabName, value }` ← `customTab.descriptionPrompt`; editable via the category-rule route; `customTabItem` kind removed everywhere.
- Item line: per-item category prompt gone (legacy `tabItem:` group rules still print). New optional token `{{description}}` in `custom_tab_item` + template `custom_tab_item_description` (catalog description, context only).
- New template `custom_tab_text_output`, appended to `custom_tab_output` inside `{{custom_tab_output}}`.
- `upgradeFieldRules` appends seed entries for fixed fields absent from a stored document.
- `WITHOUT_AI_PROMPTS` adds `-customTab.titlePrompt -customTab.descriptionPrompt`.
- Category PUT: `undefined ≠ ""` for both new prompts.

- [ ] Update tests first (item hints gone, new sources, new field blocks, stored-doc fallback, route PATCH for both kinds, PUT keeps/sets prompts, public read hides them), run → fail; implement; run the four suites → pass; commit.

### Task 3: Product storage, create + edit

**Files:** `models/Product.js`, `src/lib/productCreationService.js`, `src/app/api/product/[productId]/route.js`, new `src/components/admin/CustomTabItemsField.jsx`, `src/components/admin/ProductCreateForm.js`, edit page. Test: `tests/productCreation.test.mjs`.

- Create: `checkTextMap` → 400 `fieldErrors.customTabTitles|customTabDescriptions`; `mergeCustomTabTexts` with `existing: []`; unknown keys skipped with `console.warn`.
- PUT: recompute when any of the three keys is sent, `existing = doc.customTabTexts`, selection = new ids or stored ids.
- `CustomTabItemsField({ tab, selected, titles, descriptions, onChange, errors })` — checkbox grid; under each ticked item a title input and description textarea, placeholders = catalog values. Both forms use it; edit page loads maps via `customTabTextMaps`.

- [ ] Tests: create stores texts by id, skips unknown/unselected; edit with only `customTabItems` keeps texts; deselect prunes; bad map → 400; run → pass; commit.

### Task 4: Regeneration

**Files:** `src/lib/productRegeneration.js`, `src/lib/mcp/products.js` (stub product gets `customTabTexts: []`). Test: `tests/productRegeneration.test.mjs`.

- `REGENERATED_FIELDS` += `customTabTitles`, `customTabDescriptions`. Check: plain object of strings. Form patch: known titles only, unknown → warning. Planner: unknown title → field error; when any of the three keys is present, `update.customTabTexts = mergeCustomTabTexts(...)` with `existing = product.customTabTexts`; diff label «متن آیتم‌های تب اختصاصی».

- [ ] Tests (check, patch, plan, apply round trip); run → pass; commit.

### Task 5: Product page

**Files:** `ProductTemplate.jsx`, `ProductTabs.jsx`. Test: `tests/productPageAudience.test.mjs`-style wiring assertion in `tests/customTabTexts.test.mjs`.

- `ProductTabs` takes `customTabTexts` and renders `resolveCustomTabItems(...)`.

- [ ] Test, implement, `npm run lint`, run every touched suite, update CLAUDE.md; commit.
