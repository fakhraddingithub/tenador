import TicketChat from '@/components/modules/tickets/TicketChat'

export default async function TicketDetailPage({ params }) {
  const { id } = await params
  return <TicketChat ticketId={id} />
}
