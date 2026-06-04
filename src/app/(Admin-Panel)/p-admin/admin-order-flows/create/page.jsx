import OrderFlowForm from "@/components/admin/orderFlow/OrderFlowForm";

export const metadata = {
  title: "فرایند جدید | تنادور",
};

export default function CreateOrderFlowPage() {
  return (
    <div style={{ height: "calc(100vh - 130px)" }}>
      <div className="mb-4">
        <h1 className="text-lg font-bold text-gray-800">ایجاد فرایند سفارش جدید</h1>
        <p className="text-xs mt-0.5" style={{ color: "#9c9189" }}>
          گراف فرایند خرید را برای یک دسته‌بندی تعریف کنید
        </p>
      </div>
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          border: "1px solid #e8e4df",
          height: "calc(100% - 56px)",
        }}
      >
        <OrderFlowForm />
      </div>
    </div>
  );
}
