import Link from 'next/link';
import { FaArrowRight } from 'react-icons/fa';
import EventList from '@/components/admin/events/EventList';

export const metadata = {
  title: 'مدیریت Collections | پنل مدیریت تنادور',
};

export default function CampaignsPage() {
  return (
    <div dir="rtl">
      <div className="mb-6">
        <Link
          href="/p-admin/admin-events"
          className="inline-flex items-center gap-1.5 text-xs font-bold mb-2 hover:gap-2.5 transition-all"
          style={{ color: 'var(--color-primary)' }}
        >
          <FaArrowRight size={11} /> بازگشت به Collection
        </Link>
      </div>
      <EventList />
    </div>
  );
}
