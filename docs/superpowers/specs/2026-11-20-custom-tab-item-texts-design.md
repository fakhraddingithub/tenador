# Custom tab: per-product item titles and descriptions

## Intent
Each custom-tab item a product selects gets a title and a description written for *that* product by the AI,
at creation and regeneration. The category keeps its items as they are (title, description, image, link);
the admin's manual description is the fallback when the AI wrote nothing.

## Decisions (approved)
- **Shape A.** `customTabItems` (exact item titles) stays the selection. Two new output keys:
  `customTabTitles` and `customTabDescriptions`, each `{ "<exact item title>": "<text>" }`, only for selected items.
  Each is its own product prompt field: base rules (seed) → group rules → the category's own rule.
- **Category prompts.** `customTab.prompt` = selection rule (unchanged), new `customTab.titlePrompt` and
  `customTab.descriptionPrompt` under it. The per-item «راهنمای انتخاب» (`customTab.items[].prompt`) is removed
  from schema, UI, prompt builder, preview and the category-rule route. Stored values are deleted by a migration
  (`migrate:remove-tab-item-prompts`, the user chose delete, not merge).
- **Product storage.** `Product.customTabTexts: [{ item: ObjectId, title, description }]`, pruned to selected items
  on every write. Keyed by item `_id`, so renaming an item in the category keeps the text.
- **Product page.** Per selected item: `title = text.title || item.title`, `description = text.description || item.description`,
  each independently.
- **Forms.** Under each ticked item in create/edit: a title input and a description textarea, placeholders = the
  catalog values. Empty = fallback.
- **Regeneration.** Both modes accept the two maps; `undefined ≠ {}` like every other field.
- The catalog description is given to the AI as context on the item's data line (my call; optional token).

## Compatibility (no migration needed for prompts)
- A stored prompt document predating the two fields gets them from the seed: the panel never removes a field,
  so a fixed field absent from stored `fieldRules` was never stored.
- The two output lines come from a new template (`custom_tab_text_output`) appended to `{{custom_tab_output}}`,
  so stored `output_structure`/`custom_tab_output` keep working.
- Old JSON without the maps → no texts → fallback. Legacy group rules `tabItem:<title>` keep applying.
- `WITHOUT_AI_PROMPTS` keeps excluding `customTab.items.prompt` (until the migration runs) and adds the two new prompts.
