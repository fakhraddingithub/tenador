export const SIZE = 56;
const GAP = 12;
const clamp = (n, min, max) => Math.min(Math.max(n, min), Math.max(min, max));
export function normalizeAnchor(a) {
  return { x: Number.isFinite(a?.x) ? clamp(a.x, 0, 1) : 0, y: Number.isFinite(a?.y) ? clamp(a.y, 0, 1) : 1 };
}
export function bounds(v) {
  const i = v.insets || {};
  return { left: (v.left || 0) + 16 + (i.left || 0), top: (v.top || 0) + 16 + (i.top || 0), width: Math.max(0, v.width - 32 - (i.left || 0) - (i.right || 0)), height: Math.max(0, v.height - 32 - (i.top || 0) - (i.bottom || 0)) };
}
export function anchorFromPoint(p, v) {
  const b = bounds(v);
  return normalizeAnchor({ x: (p.x - b.left) / Math.max(1, b.width - SIZE), y: (p.y - b.top) / Math.max(1, b.height - SIZE) });
}
export function widgetPosition(anchor, viewport) {
  const b = bounds(viewport), a = normalizeAnchor(anchor);
  const button = { left: b.left + a.x * Math.max(0, b.width - SIZE), top: b.top + a.y * Math.max(0, b.height - SIZE) };
  const width = Math.min(420, b.width), height = Math.min(640, b.height);
  const above = button.top - b.top - GAP, below = b.top + b.height - button.top - SIZE - GAP;
  const left = clamp(button.left, b.left, b.left + b.width - width);
  const top = clamp(button.top, b.top, b.top + b.height - height);
  let panel;
  if (Math.max(above, below) >= Math.min(380, height)) {
    const up = above >= below, h = Math.min(height, up ? above : below);
    panel = { left, top: up ? button.top - GAP - h : button.top + SIZE + GAP, width, height: h };
  } else if (b.left + b.width - button.left - SIZE - GAP >= width) {
    panel = { left: button.left + SIZE + GAP, top, width, height };
  } else if (button.left - b.left - GAP >= width) {
    panel = { left: button.left - GAP - width, top, width, height };
  } else {
    // With a small viewport or virtual keyboard, the chat uses its own close button.
    panel = { left, top, width, height, overlay: true };
  }
  return { button, panel };
}
