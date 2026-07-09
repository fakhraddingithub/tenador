import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";
import { FaMoneyBillWave } from "react-icons/fa";
import InstallmentsManager from "@/components/admin/financial/InstallmentsManager";
import PageHeader from "@/components/admin/PageHeader";

export const metadata = {
  title: "مدیریت اقساط | پنل ادمین تنادور",
};

export default function AdminInstallmentsPage() {
  return (
    <div dir="rtl" className="space-y-5">
      <PageHeader
        icon={<FaMoneyBillWave size={16} />}
        title="مدیریت اقساط"
        subtitle="پیگیری چک‌ها، تأیید پرداخت و تأیید سفارش‌های اقساطی"
        actions={
          <Link
            href="/p-admin/financial"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition-colors border"
            style={{
              color: "var(--admin-text-muted)",
              background: "var(--admin-card)",
              borderColor: "var(--admin-border)",
              borderRadius: "var(--admin-radius)",
            }}
          >
            <FiArrowRight size={13} />
            بازگشت به مدیریت مالی
          </Link>
        }
      />

      <InstallmentsManager />
    </div>
  );
}
