import Link from 'next/link';
import { FaArrowRight } from 'react-icons/fa';
import EventForm from '@/components/admin/events/EventForm';

export const metadata = {
  title: 'ویرایش Collection | پنل مدیریت تنادور',
};

export default async function EditCampaignPage({ params }) {
  const { id } = await params;
  return (
    <div dir="rtl">
      <EventForm eventId={id} />
    </div>
  );
}
