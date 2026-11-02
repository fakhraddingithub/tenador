"use client";

import { useEffect, useState } from "react";

let request;
function loadModal() {
  return request ||= import("./QuickViewModal").catch(error => { request = undefined; throw error; });
}

export default function LazyQuickViewModal(props) {
  const [Modal, setModal] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!props.isOpen || Modal) return;
    let cancelled = false;
    loadModal().then(module => {
      if (!cancelled) setModal(() => module.default);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [props.isOpen, Modal, attempt]);

  if (!props.isOpen || !props.product) return null;
  if (Modal) return <Modal {...props} />;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" dir="rtl"
    onKeyDown={event => { if (event.key === "Escape") props.onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label="پیش‌نمایش محصول" className="rounded-lg bg-white p-6 text-center">
      <p role="status">{failed ? "دریافت پیش‌نمایش ممکن نشد." : "در حال دریافت پیش‌نمایش…"}</p>
      {failed && <button type="button" className="m-2 p-2" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>تلاش مجدد</button>}
      <button type="button" autoFocus className="m-2 p-2" onClick={props.onClose}>بستن</button>
    </div>
  </div>;
}
