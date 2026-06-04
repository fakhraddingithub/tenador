import OrderFlowForm from "@/components/admin/orderFlow/OrderFlowForm";
import connectToDB from "base/configs/db";
import OrderFlow from "base/models/OrderFlow";
import Category from "base/models/Category";

export const metadata = {
  title: "ویرایش فرایند سفارش | تنادور",
};

export default async function EditOrderFlowPage({ params }) {
  await connectToDB();
  const {flowId}= await params
  const flow = await OrderFlow.findById(flowId)
    .populate("rootCategory", "title name")
    .lean();

  if (!flow) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500 font-bold">فرایند یافت نشد</p>
      </div>
    );
  }

  // تبدیل ObjectId به string برای سریال‌شدن
  const plainFlow = JSON.parse(JSON.stringify(flow));

  return (
    <div style={{ height: "calc(100vh - 130px)" }}>
      <div className="mb-4">
        <h1 className="text-lg font-bold text-gray-800">
          ویرایش: {plainFlow.name}
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "#9c9189" }}>
          گراف فرایند سفارش را ویرایش کنید
        </p>
      </div>
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          border: "1px solid #e8e4df",
          height: "calc(100% - 56px)",
        }}
      >
        <OrderFlowForm initialFlow={plainFlow} />
      </div>
    </div>
  );
}
