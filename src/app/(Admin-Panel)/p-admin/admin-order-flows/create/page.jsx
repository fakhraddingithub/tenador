import OrderFlowForm from "@/components/admin/orderFlow/OrderFlowForm";

export const metadata = {
  title: "فرایند جدید | تنادور",
};

export default function CreateOrderFlowPage() {
  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 120px)" }}>
      <div className="mb-4">
        <h1 className="text-lg font-bold text-gray-800">ایجاد فرایند سفارش جدید</h1>
        <p className="text-xs mt-0.5" style={{ color: "#9c9189" }}>
          گراف فرایند خرید را برای یک دسته‌بندی تعریف کنید
        </p>
      </div>
      <div
        className="rounded-2xl overflow-hidden flex-1 min-h-0"
        style={{ border: "1px solid #e8e4df" }}
      >
        <OrderFlowForm />
      </div>
    </div>
  );
}
