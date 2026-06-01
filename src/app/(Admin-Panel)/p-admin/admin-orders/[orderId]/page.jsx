import AdminOrderDetailClient from "@/components/admin/orders/AdminOrderDetailClient";

export const metadata = {
  title: "جزئیات سفارش | پنل ادمین تنادور",
};

export default async function AdminOrderDetailPage({ params }) {
  const {orderId} = await params
  
  return <AdminOrderDetailClient orderId={orderId} />;
}
