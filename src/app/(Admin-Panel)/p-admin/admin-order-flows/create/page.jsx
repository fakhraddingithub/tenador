import OrderFlowForm from "@/components/admin/orderFlow/OrderFlowForm";

export const metadata = {
  title: "فرایند جدید | تنادور",
};

export default function CreateOrderFlowPage() {
  return (
    <div dir="rtl">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-gray-800">ایجاد فرایند سفارش جدید</h1>
        <p className="text-xs mt-0.5" style={{ color: "#9c9189" }}>
          مراحل خرید را برای یک دسته‌بندی تعریف کنید و ترتیبشان را با کشیدن کارت‌ها بچینید
        </p>
      </div>
      <OrderFlowForm />
    </div>
  );
}
