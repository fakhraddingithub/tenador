"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";

let request;
function loadModal() {
  return request ||= import("./QuickViewModal").catch(error => { request = undefined; throw error; });
}

export function preloadQuickView() {
  // A failed speculative request must not prevent a later click from retrying.
  void loadModal().catch(() => {});
}

export default function LazyQuickViewModal(props) {
  const [Modal, setModal] = useState(null);
  const { onClose } = props;
  useEffect(() => {
    if (!props.isOpen || Modal) return;
    let cancelled = false;
    loadModal().then(module => {
      if (!cancelled) setModal(() => module.default);
    }).catch(() => {
      if (!cancelled) {
        onClose();
        toast.error("دریافت پیش‌نمایش ممکن نشد. لطفاً دوباره تلاش کنید.");
      }
    });
    return () => { cancelled = true; };
  }, [props.isOpen, Modal, onClose]);

  if (!props.isOpen || !props.product) return null;
  if (Modal) return <Modal {...props} />;
  return null;
}
