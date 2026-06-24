import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";
import { FaMoneyBillWave } from "react-icons/fa";
import InstallmentsManager from "@/components/admin/financial/InstallmentsManager";

export const metadata = {
  title: "مدیریت اقساط | پنل ادمین تنادور",
};

export default function AdminInstallmentsPage() {
  return (
    <div dir="rtl">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[var(--radius)] flex items-center justify-center" style={{ background: "rgba(170,71,37,0.1)" }}>
            <FaMoneyBillWave size={18} style={{ color: "var(--color-primary)" }} />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">مدیریت اقساط</h1>
            <p className="text-xs font-bold text-gray-400">پیگیری چک‌ها، تأیید پرداخت و تأیید سفارش‌های اقساطی</p>
          </div>
        </div>
        <Link href="/p-admin/financial"
          className="flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-[var(--color-primary)] transition">
          مدیریت مالی <FiArrowRight size={15} />
        </Link>
      </div>

      <InstallmentsManager />
    </div>
  );
}
