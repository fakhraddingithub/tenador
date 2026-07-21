import AdminOrderDetailClient from "@/components/admin/orders/AdminOrderDetailClient";
import MarkNotificationsRead from "@/components/admin/MarkNotificationsRead";

export const metadata = {
  title: "جزئیات سفارش | پنل ادمین تنادور",
};

export default async function AdminOrderDetailPage({ params }) {
  const {orderId} = await params

  return (
    <>
      {/* مشاهده‌ی سفارش → اعلان‌های مرتبط (سفارش/پرداخت/کردیت مربی) خوانده می‌شوند */}
      <MarkNotificationsRead filter={{ order: orderId }} />
      <AdminOrderDetailClient orderId={orderId} />
    </>
  );
}
