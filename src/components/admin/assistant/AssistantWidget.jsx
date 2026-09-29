'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Bot, X } from 'lucide-react';
import { useAdminPermissions } from '../AdminPermissionProvider';

const AssistantChat = dynamic(() => import('./AssistantChat'), {
  loading: () => <p role="status" className="p-6 text-sm">در حال آماده‌سازی دستیار…</p>,
});

export default function AssistantWidget() {
  const { can } = useAdminPermissions();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const launcher = useRef(null);
  const panel = useRef(null);

  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    launcher.current?.focus();
  }

  if (!can('assistant.use')) return null;

  return <div dir="rtl" className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-40 sm:left-6">
    <section id="admin-assistant-chat" ref={panel} tabIndex={-1} role="dialog" aria-label="دستیار هوشمند"
      hidden={!open} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}
      className="absolute bottom-20 left-0 h-[min(640px,calc(100dvh-8rem))] w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-card)] text-[var(--admin-text)] shadow-2xl focus:outline-none">
      {loaded ? <AssistantChat onClose={close} /> : null}
    </section>
    <button ref={launcher} type="button" aria-label={open ? 'بستن دستیار هوشمند' : 'باز کردن دستیار هوشمند'}
      title="دستیار هوشمند" aria-expanded={open} aria-controls="admin-assistant-chat" aria-haspopup="dialog"
      onClick={() => { if (open) close(); else { setLoaded(true); setOpen(true); } }}
      className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-lg transition-colors hover:bg-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-primary)]">
      {open ? <X size={25} /> : <Bot size={27} />}
    </button>
  </div>;
}
