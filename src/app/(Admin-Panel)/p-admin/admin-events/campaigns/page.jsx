import Link from 'next/link';
import { FaArrowRight } from 'react-icons/fa';
import EventList from '@/components/admin/events/EventList';

export const metadata = {
  title: 'مدیریت Collections | پنل مدیریت تنادور',
};

export default function CampaignsPage() {
  return (
    <div dir="rtl">
      <EventList />
    </div>
  );
}
