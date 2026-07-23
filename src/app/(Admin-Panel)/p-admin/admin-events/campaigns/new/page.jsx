import Link from 'next/link';
import { FaArrowRight } from 'react-icons/fa';
import EventForm from '@/components/admin/events/EventForm';

export const metadata = {
  title: 'Collection جدید | پنل مدیریت تنادور',
};

export default function NewCampaignPage() {
  return (
    <div dir="rtl">
      <EventForm />
    </div>
  );
}
