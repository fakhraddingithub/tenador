// Show the optional prompt after engagement with the page, never on a timer.
// Scroll restoration alone is not an interaction; scrolling needs user input.
export function waitForPushEngagement(onEngage) {
  const startY = window.scrollY;
  let scrollIntent = false;
  let finished = false;
  const events = ["wheel", "touchmove", "scroll", "click", "keydown"];
  function cleanup() {
    finished = true;
    for (const name of events) window.removeEventListener(name, handle);
  }
  function engage() {
    cleanup();
    onEngage();
  }
  function handle(event) {
    if (finished || !event.isTrusted) return;
    const editable = event.target?.closest?.('input, textarea, select, [contenteditable="true"]');
    if (event.type === "wheel" || event.type === "touchmove") scrollIntent = true;
    if (event.type === "keydown" && !editable && ["ArrowDown", "PageDown", "End", " "].includes(event.key)) scrollIntent = true;
    if (event.type === "scroll" && scrollIntent && Math.abs(window.scrollY - startY) >= 160) engage();
    else if (!editable && event.target?.closest?.("main") &&
      (event.type === "click" || (event.type === "keydown" && event.key === "Enter"))) engage();
  }
  for (const name of events) window.addEventListener(name, handle, { passive: true });
  return cleanup;
}
