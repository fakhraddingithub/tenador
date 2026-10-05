'use client';

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Bot, X } from 'lucide-react';
import { useAdminPermissions } from '../AdminPermissionProvider';
import { anchorFromPoint, normalizeAnchor, widgetPosition } from '@/lib/assistant/widgetPosition.mjs';

const POSITION_KEY = 'admin-assistant-position-v1';
const AssistantChat = lazy(() => import('./AssistantChat'));
function savePosition(anchor) {
  try { sessionStorage.setItem(POSITION_KEY, JSON.stringify(anchor)); } catch { /* Storage may be disabled. */ }
}
export default function AssistantWidget() {
  const { can } = useAdminPermissions();
  const allowed = can('assistant.use');
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 1 });
  const [viewport, setViewport] = useState(null);
  const [dragging, setDragging] = useState(false);
  const launcher = useRef(null), panel = useRef(null), safeArea = useRef(null);
  const drag = useRef(null), suppressClick = useRef(false), wasOpen = useRef(false);
  const position = viewport ? widgetPosition(anchor, viewport) : null;

  useEffect(() => {
    if (!allowed) return;
    let frame;
    const measure = () => {
      const visual = window.visualViewport;
      const padding = safeArea.current ? getComputedStyle(safeArea.current) : null;
      setViewport({
        left: visual?.offsetLeft || 0, top: visual?.offsetTop || 0,
        width: visual?.width || window.innerWidth, height: visual?.height || window.innerHeight,
        insets: {
          left: parseFloat(padding?.paddingLeft) || 0, right: parseFloat(padding?.paddingRight) || 0,
          top: parseFloat(padding?.paddingTop) || 0, bottom: parseFloat(padding?.paddingBottom) || 0,
        },
      });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    frame = requestAnimationFrame(() => {
      try { setAnchor(normalizeAnchor(JSON.parse(sessionStorage.getItem(POSITION_KEY)))); } catch { /* Keep the default corner. */ }
      measure();
    });
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
    };
  }, [allowed]);

  useEffect(() => {
    if (open) panel.current?.focus();
    else if (wasOpen.current) launcher.current?.focus();
    wasOpen.current = open;
  }, [open]);

  function finishDrag(event, cancelled = false) {
    const current = drag.current;
    if (!current || (event.pointerId != null && current.id !== event.pointerId)) return;
    drag.current = null;
    suppressClick.current = current.moved;
    setDragging(false);
    if (cancelled) setAnchor(current.anchor);
    else if (current.moved) savePosition(current.latest);
    if (launcher.current?.hasPointerCapture(current.id)) launcher.current.releasePointerCapture(current.id);
  }
  function moveDrag(event) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId || !viewport) return;
    const dx = event.clientX - current.x, dy = event.clientY - current.y;
    if (!current.moved && Math.hypot(dx, dy) < 6) return;
    current.moved = true;
    suppressClick.current = true;
    setDragging(true);
    current.latest = anchorFromPoint({ x: current.left + dx, y: current.top + dy }, viewport);
    setAnchor(current.latest);
  }

  if (!allowed) return null;
  const { overlay, ...panelStyle } = position?.panel || {};
  return <div dir="rtl" className="pointer-events-none fixed inset-0 z-40">
    <span ref={safeArea} aria-hidden="true" className="invisible absolute" style={{ padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)' }} />
    <span id="assistant-drag-help" className="sr-only">برای جابه‌جایی دکمه آن را بکشید یا از کلیدهای جهت‌نما استفاده کنید. کلید Home دکمه را به گوشهٔ پایین چپ برمی‌گرداند.</span>
    <section id="admin-assistant-chat" ref={panel} tabIndex={-1} role="dialog" aria-label="دستیار هوشمند"
      hidden={!open} style={position ? panelStyle : undefined}
      onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); } }}
      className={`pointer-events-auto absolute ${position ? '' : 'bottom-24 left-4 h-[min(640px,calc(100dvh-8rem))] w-[min(420px,calc(100vw-2rem))]'} overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-card)] text-[var(--admin-text)] shadow-2xl focus:outline-none`}>
      {loaded ? <Suspense fallback={<div className="flex items-center justify-between gap-3 p-4">
        <p role="status" className="text-sm">در حال آماده‌سازی دستیار…</p>
        <button type="button" aria-label="بستن دستیار" onClick={() => setOpen(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg focus-visible:outline-2"><X size={22} /></button>
      </div>}><AssistantChat onClose={() => setOpen(false)} /></Suspense> : null}
    </section>
    <button ref={launcher} type="button" aria-label={open ? 'بستن دستیار هوشمند' : 'باز کردن دستیار هوشمند'}
      aria-describedby="assistant-drag-help" title="دستیار هوشمند — برای جابه‌جایی بکشید"
      aria-expanded={open} aria-controls="admin-assistant-chat" aria-haspopup="dialog"
      style={{ ...(position?.button || { left: 16, bottom: 'max(1rem, env(safe-area-inset-bottom))' }), touchAction: 'none', visibility: open && overlay && !dragging ? 'hidden' : undefined }}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0 || !position) return;
        suppressClick.current = false;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, ...position.button, anchor, latest: anchor, moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={moveDrag} onPointerUp={(event) => finishDrag(event)}
      onPointerCancel={(event) => finishDrag(event, true)} onLostPointerCapture={(event) => finishDrag(event, true)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          if (drag.current) finishDrag(event, true);
          else setOpen(false);
          return;
        }
        if (!position || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
        event.preventDefault();
        const step = event.shiftKey ? 48 : 16;
        const next = event.key === 'Home' ? { x: 0, y: 1 } : anchorFromPoint({
          x: position.button.left + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
          y: position.button.top + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0),
        }, viewport);
        setAnchor(next);
        savePosition(next);
      }}
      onClick={(event) => {
        if (suppressClick.current && event.detail !== 0) { suppressClick.current = false; return; }
        if (open) setOpen(false);
        else { setLoaded(true); setOpen(true); }
      }}
      className={`pointer-events-auto absolute flex h-14 w-14 select-none items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-lg transition-colors hover:bg-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-primary)] ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}>
      {open ? <X size={25} /> : <Bot size={27} />}
    </button>
  </div>;
}
