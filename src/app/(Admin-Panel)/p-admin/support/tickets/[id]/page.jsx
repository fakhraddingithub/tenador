import AdminTicketChat from "@/components/admin/support/AdminTicketChat";

export const metadata = {
  title: "گفتگوی تیکت | پنل ادمین تنادور",
};

export default async function AdminTicketDetailPage({ params }) {
  const { id } = await params;

  return <AdminTicketChat ticketId={id} />;
}
