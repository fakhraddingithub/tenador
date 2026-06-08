import { MdVerified } from "react-icons/md";

/**
 * نشان تأیید سبک اینستاگرام (تیک آبی) برای محصولات تست‌شده.
 *
 * - size: اندازه‌ی آیکن
 * - className: کلاس اضافه روی wrapper (برای موقعیت‌دهی absolute و غیره)
 */
export default function VerifiedBadge({ size = 22, className = "", title = "تست‌شده" }) {
  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      title={title}
      aria-label={title}
    >
      {/* پس‌زمینه‌ی سفید زیر تیک تا روی هر تصویری واضح دیده شود */}
      <span className="relative inline-flex">
        <span className="absolute inset-[18%] rounded-full bg-white" />
        <MdVerified
          size={size}
          className="relative text-[#1d9bf0] drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
        />
      </span>
    </span>
  );
}
