"use client";

import { useState, useEffect } from "react";
import { FaTelegramPlane, FaWhatsapp, FaTwitter, FaInstagram } from "react-icons/fa";
import { FiLink, FiCheck } from "react-icons/fi";

export default function ProductShare({ title = "مشاهده این محصول", text = "پیشنهاد می‌کنم این محصول را ببینید:" }) {
  const [currentUrl, setCurrentUrl] = useState("");
  const [copied, setCopied] = useState(false);

  // دریافت آدرس صفحه در سمت کلاینت
  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentUrl(window.location.href);
    }
  }, []);

  const encodedUrl = encodeURIComponent(currentUrl);
  const encodedText = encodeURIComponent(text);
  const encodedTitle = encodeURIComponent(title);

  // لینک‌های اشتراک‌گذاری
  const shareLinks = {
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
    whatsapp: `https://api.whatsapp.com/send?text=${encodedTitle} ${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
    // اینستاگرام API مستقیم برای اشتراک لینک ندارد، بنابراین کاربر را به سایت/اپلیکیشن هدایت می‌کنیم
    instagram: `https://instagram.com`, 
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  // کپی کردن لینک قبل از باز کردن اینستاگرام (اختیاری برای راحتی کاربر)
  const handleInstagramClick = async (e) => {
    try {
      await navigator.clipboard.writeText(currentUrl);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  return (
    <div className="bg-[#fcfcfc] border border-gray-100 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
      <div className="text-right w-full sm:w-auto">
        <h4 className="text-sm font-bold text-gray-800 mb-1">اشتراک‌گذاری محصول</h4>
        <p className="text-xs text-gray-500 font-medium">این محصول را با دوستان خود به اشتراک بگذارید.</p>
      </div>

      <div className="flex items-center gap-2 rtl:space-x-reverse w-full sm:w-auto justify-start sm:justify-end">
        {/* تلگرام */}
        <a
          href={shareLinks.telegram}
          target="_blank"
          rel="noopener noreferrer"
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-[#0088cc] hover:border-[#0088cc] hover:shadow-sm transition-all duration-300 group"
          aria-label="اشتراک در تلگرام"
        >
          <FaTelegramPlane className="text-lg group-hover:scale-110 transition-transform" />
        </a>

        {/* واتس‌اپ */}
        <a
          href={shareLinks.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-[#25D366] hover:border-[#25D366] hover:shadow-sm transition-all duration-300 group"
          aria-label="اشتراک در واتس‌اپ"
        >
          <FaWhatsapp className="text-lg group-hover:scale-110 transition-transform" />
        </a>

        {/* ایکس (توییتر) */}
        <a
          href={shareLinks.twitter}
          target="_blank"
          rel="noopener noreferrer"
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-black hover:border-black hover:shadow-sm transition-all duration-300 group"
          aria-label="اشتراک در ایکس"
        >
          <FaTwitter className="text-lg group-hover:scale-110 transition-transform" />
        </a>

        {/* اینستاگرام */}
        <a
          href={shareLinks.instagram}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleInstagramClick}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-[#E1306C] hover:border-[#E1306C] hover:shadow-sm transition-all duration-300 group"
          aria-label="باز کردن اینستاگرام"
          title="کپی لینک و باز کردن اینستاگرام"
        >
          <FaInstagram className="text-lg group-hover:scale-110 transition-transform" />
        </a>

        {/* خط جداکننده */}
        <div className="w-[1px] h-6 bg-gray-200 mx-1"></div>

        {/* کپی لینک */}
        <button
          onClick={handleCopyLink}
          className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all duration-300 ${
            copied
              ? "bg-green-50 border-green-200 text-green-600"
              : "bg-white border-gray-200 text-gray-500 hover:text-[#aa4725] hover:border-[#aa4725] hover:shadow-sm"
          }`}
          aria-label="کپی لینک"
          title="کپی لینک"
        >
          {copied ? (
            <FiCheck className="text-lg scale-110 transition-transform" />
          ) : (
            <FiLink className="text-lg hover:scale-110 transition-transform" />
          )}
        </button>
      </div>
    </div>
  );
}
