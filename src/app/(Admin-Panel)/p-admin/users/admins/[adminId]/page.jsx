import AdminDetail from "@/components/admin/admins/AdminDetail";

export const metadata = { title: "جزئیات ادمین | پنل مدیریت" };

export default async function AdminDetailPage({ params }) {
  const { adminId } = await params;
  return <AdminDetail adminId={adminId} />;
}
