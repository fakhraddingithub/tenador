/** Root plus every descendant, once each, including malformed cyclic trees. */
export function collectCategorySubtree(categories, rootId) {
  const byId = new Map(categories.map((category) => [String(category._id), category]));
  const children = new Map();
  for (const category of categories) {
    const parent = String(category.parent || "");
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(String(category._id));
  }
  const queue = [String(rootId)];
  const seen = new Set();
  const result = [];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (seen.has(id) || !byId.has(id)) continue;
    seen.add(id);
    result.push(byId.get(id));
    queue.push(...(children.get(id) || []));
  }
  return result;
}

/** Shared by the existing sidebar and server-side attribute matching. */
export function selectedCategoryIds(categories, selected = []) {
  if (!selected.length) return categories.map((c) => String(c._id));
  return [...new Set(categories
    .filter((c) => selected.includes(String(c._id)))
    .flatMap((c) => c.descendantIds || [String(c._id)]))];
}

export function filterCategoriesBySelection(categories, selected = []) {
  const ids = new Set(selectedCategoryIds(categories, selected));
  return categories.filter((c) => ids.has(String(c._id)));
}
