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
      />

      <InstallmentsManager />
    </div>
  );
}
