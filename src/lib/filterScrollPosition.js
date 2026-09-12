/** Choose a stable viewport after replacing a product result set. */
export function getFilterScrollTarget(previous, current, offset = 90) {
  if (!previous) return null;
  // A filter response must not pull readers away from the hero or footer.
  if (previous.y + offset < previous.top || previous.y >= previous.bottom) return null;

  const preserved = Math.max(0, previous.y + current.top - previous.top);
  const maxScroll = Math.max(0, current.documentHeight - current.viewportHeight);
  const resultsGone = preserved + offset + 48 >= current.resultsBottom;
  if (preserved > maxScroll || resultsGone) {
    return Math.min(maxScroll, Math.max(0, current.resultsTop - offset));
  }
  return Math.min(preserved, maxScroll);
}
