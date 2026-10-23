"use client";

import { useRef, useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { toast } from "react-toastify";

export default function DownloadInvoiceButton({ order, admin = false }) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function download() {
    if (pending.current || !order) return;
    pending.current = true;
    setBusy(true);
    try {
      // Reuse authenticated endpoints so downloads reflect the latest order/payment data.
      const url = admin ? `/api/admin/orders/${encodeURIComponent(order._id)}`
        : `/api/orders/${encodeURIComponent(order.trackingCode)}`;
      const response = await fetch(url, { credentials: "include", cache: "no-store", signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error("دریافت اطلاعات فاکتور ناموفق بود؛ دوباره تلاش کنید.");
      const data = await response.json();
      if (!data.order) throw new Error("اطلاعات سفارش در دسترس نیست.");
      let installment = data.installment || null;
      if (!admin && data.order.paymentMethod === "INSTALLMENT") {
        const response = await fetch("/api/installments", { credentials: "include", cache: "no-store", signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error("دریافت جزئیات اقساط ناموفق بود؛ دوباره تلاش کنید.");
        const result = await response.json();
        installment = result.installments?.find((i) => String(i.order?._id) === String(data.order._id)) || null;
      }
      const { downloadOrderInvoice } = await import("@/lib/downloadOrderInvoice");
      const { missingImages } = await downloadOrderInvoice(data.order, installment, { customerRole: data.invoiceCustomerRole });
      if (missingImages) toast.warn("فاکتور دانلود شد؛ بعضی تصاویر در دسترس نبودند و با جایگزین نمایش داده شدند.");
    } catch (error) {
      toast.error(error.name === "TimeoutError" ? "دریافت فاکتور طول کشید؛ دوباره تلاش کنید." : error.message || "ساخت فاکتور ناموفق بود.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <button type="button" onClick={download} disabled={busy || !order} aria-busy={busy}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#aa4725]/25 bg-white px-4 py-2 text-xs font-bold text-[#aa4725] transition hover:bg-[#aa4725]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#aa4725] disabled:cursor-wait disabled:opacity-60">
      {busy ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
      <span role="status">{busy ? "در حال ساخت فاکتور…" : "دانلود فاکتور PDF"}</span>
    </button>
  );
}
