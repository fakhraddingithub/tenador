import AdminForm from '@/components/admin/admins/AdminForm';

export default async function EditAdminPage({ params }) {
  const { adminId } = await params;

  return <AdminForm adminId={adminId} />;
}
