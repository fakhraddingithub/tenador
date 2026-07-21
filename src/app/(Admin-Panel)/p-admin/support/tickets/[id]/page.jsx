import AdminTicketChat from "@/components/admin/support/AdminTicketChat";
import MarkNotificationsRead from "@/components/admin/MarkNotificationsRead";

export const metadata = {
  title: "گفتگوی تیکت | پنل ادمین تنادور",
};

export default async function AdminTicketDetailPage({ params }) {
  const { id } = await params;

  return (
    <>
      {/* مشاهده‌ی تیکت → اعلان‌های همان تیکت خوانده می‌شوند */}
      <MarkNotificationsRead filter={{ ticket: id }} />
      <AdminTicketChat ticketId={id} />
    </>
  );
}
