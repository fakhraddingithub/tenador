import { isSharedCategory } from "./categorySportVisibility.js";

/** Display-only label: never persist this in the category title or slug. */
export function getCategoryLabel(category) {
  const title = (category?.title || category?.name || "").trim();
  if (!title || isSharedCategory(category)) return title;

  const sportTitle = (category?.sport?.title || category?.sport?.name || "").trim();
  return sportTitle ? `${title} ${sportTitle}` : title;
}
