"use client";

import { useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { FiX } from "react-icons/fi";

const WHATSAPP_NUMBER = "989123456789";
const DEFAULT_MESSAGE = "سلام، می‌خواستم در مورد محصولات سوال بپرسم.";

export default function WhatsAppSupport() {
  const [showTooltip, setShowTooltip] = useState(false);

  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`;

  return (
    <div
      className="fixed bottom-6 left-6 z-50 flex flex-col items-start" // تغییر به items-start
      dir="rtl"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* تولتیپ */}
      {showTooltip && (
        <div 
          className="absolute bottom-full left-0 mb-4 flex items-center gap-3 bg-white border border-gray-100 shadow-2xl rounded-2xl px-4 py-3 animate-[fadeInUp_0.2s_ease] whitespace-nowrap"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
          <div className="flex flex-col">
            <p className="text-xs font-black text-gray-800 leading-tight">پشتیبانی آنلاین</p>
            <p className="text-[10px] text-gray-400 mt-0.5">معمولاً در چند دقیقه پاسخ می‌دهیم</p>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              setShowTooltip(false);
            }}
            className="mr-2 p-1 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <FiX size={14} />
          </button>
          
          {/* فلش کوچک - دقیقاً بالای مرکز دکمه تنظیم شده */}
          <div className="absolute -bottom-1 left-6 w-2.5 h-2.5 bg-white border-b border-l border-gray-100 rotate-[-45deg]"></div>
        </div>
      )}

      {/* دکمه اصلی */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="
          relative flex items-center justify-center
          w-14 h-14 rounded-full
          bg-[#25D366] hover:bg-[#20c15a]
          shadow-[0_8px_24px_rgba(37,211,102,0.4)]
          hover:scale-110 active:scale-95
          transition-all duration-300
        "
      >
        <FaWhatsapp size={32} className="text-white" />
        <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-green-400 border-2 border-white rounded-full" />
      </a>
    </div>
  );
}