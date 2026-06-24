"use client";

import { useState, useRef, useEffect } from "react";
import { Download, FileSpreadsheet, FileText, FileDown, Loader2 } from "lucide-react";
import { exportCsv, exportWorkbook, exportPdf, buildDatasets } from "./exporter";

function MenuItem({ icon: Icon, label, onClick, color = "text-gray-600" }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 w-full px-3 py-2 text-xs font-bold hover:bg-gray-50 transition ${color}`}>
      <Icon size={14} /> {label}
    </button>
  );
}

export default function ExportMenu({ data, rangeLabel, disabled }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const csv = (key, label) => {
    const ds = buildDatasets(data)[key];
    exportCsv(`${label}-${Date.now()}.csv`, ds.columns, ds.rows);
    setOpen(false);
  };

  const excel = async () => {
    setBusy(true);
    try { await exportWorkbook(data, rangeLabel); } finally { setBusy(false); setOpen(false); }
  };

  const pdf = () => { exportPdf(data, rangeLabel); setOpen(false); };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || busy}
        className="flex items-center gap-1.5 bg-[#aa4725] hover:bg-[#8f3b1e] text-white text-xs font-bold px-3.5 py-2 rounded-xl transition disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        خروجی گزارش
      </button>
      {open && !disabled && (
        <div className="absolute left-0 mt-2 w-56 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden z-50 py-1">
          <MenuItem icon={FileSpreadsheet} label="اکسل — کل گزارش (چندبرگه)" onClick={excel} color="text-green-700" />
          <div className="my-1 border-t border-gray-100" />
          <p className="px-3 py-1 text-[10px] font-bold text-gray-400">CSV</p>
          <MenuItem icon={FileText} label="درآمد روزانه" onClick={() => csv("revenue", "درآمد")} />
          <MenuItem icon={FileText} label="مشتریان برتر" onClick={() => csv("customers", "مشتریان")} />
          <MenuItem icon={FileText} label="محصولات" onClick={() => csv("products", "محصولات")} />
          <MenuItem icon={FileText} label="مطالبات" onClick={() => csv("receivables", "مطالبات")} />
          <div className="my-1 border-t border-gray-100" />
          <MenuItem icon={FileDown} label="PDF — گزارش مدیریتی" onClick={pdf} color="text-red-600" />
        </div>
      )}
    </div>
  );
}
