import InstallmentDetail from "@/components/admin/financial/InstallmentDetail";

export const metadata = {
  title: "جزئیات اقساط | پنل ادمین تنادور",
};

export default async function AdminInstallmentDetailPage({ params }) {
  const { id } = await params;
  return <InstallmentDetail id={id} />;
}
