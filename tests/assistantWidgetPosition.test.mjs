import test from 'node:test';
import assert from 'node:assert/strict';
import { SIZE, bounds, anchorFromPoint, normalizeAnchor, widgetPosition } from '../src/lib/assistant/widgetPosition.mjs';

test('top launchers open below and bottom launchers open above', () => {
  const viewport = { width: 1440, height: 900 };
  for (const x of [0, 0.5, 1]) {
    const top = widgetPosition({ x, y: 0 }, viewport);
    const bottom = widgetPosition({ x, y: 1 }, viewport);
    assert.ok(top.panel.top >= top.button.top + SIZE);
    assert.ok(bottom.panel.top + bottom.panel.height <= bottom.button.top);
  }
});

test('middle desktop uses side space; narrow screens use a contained overlay', () => {
  const desktop = widgetPosition({ x: 0, y: 0.5 }, { width: 1200, height: 700 });
  assert.ok(desktop.panel.left > desktop.button.left + SIZE);
  assert.ok(!desktop.panel.overlay);
  const mobile = widgetPosition({ x: 0.5, y: 0.5 }, { width: 390, height: 700 });
  assert.equal(mobile.panel.overlay, true);
});

test('drag coordinates clamp at edges and stored positions reject invalid data', () => {
  const viewport = { width: 390, height: 844 };
  assert.deepEqual(anchorFromPoint({ x: -999, y: 9999 }, viewport), { x: 0, y: 1 });
  assert.deepEqual(normalizeAnchor({ x: 'bad', y: Infinity }), { x: 0, y: 1 });
  assert.deepEqual(normalizeAnchor(null), { x: 0, y: 1 });
});

test('chat stays inside visible safe bounds across positions, resize and keyboard offsets', () => {
  const viewports = [
    { width: 1440, height: 900 }, { width: 768, height: 1024 },
    { width: 390, height: 844 }, { width: 320, height: 568 },
    { width: 844, height: 390 }, { width: 390, height: 290, top: 180 },
    { width: 320, height: 240, top: 130, left: 90 },
    { width: 390, height: 844, insets: { top: 47, bottom: 34, left: 8, right: 8 } },
  ];
  const epsilon = 0.000001;
  for (const viewport of viewports) for (let x = 0; x <= 10; x++) for (let y = 0; y <= 10; y++) {
    const { button, panel } = widgetPosition({ x: x / 10, y: y / 10 }, viewport);
    const b = bounds(viewport);
    for (const rect of [panel, { ...button, width: SIZE, height: SIZE }]) {
      assert.ok(rect.left >= b.left - epsilon && rect.top >= b.top - epsilon);
      assert.ok(rect.left + rect.width <= b.left + b.width + epsilon);
      assert.ok(rect.top + rect.height <= b.top + b.height + epsilon);
    }
    if (!panel.overlay) assert.ok(
      panel.left + panel.width <= button.left + epsilon || panel.left >= button.left + SIZE - epsilon ||
      panel.top + panel.height <= button.top + epsilon || panel.top >= button.top + SIZE - epsilon,
      'A non-overlay panel must not cover its launcher',
    );
    const restored = anchorFromPoint({ x: button.left, y: button.top }, viewport);
    assert.ok(Math.abs(restored.x - x / 10) < epsilon && Math.abs(restored.y - y / 10) < epsilon);
  }
});
