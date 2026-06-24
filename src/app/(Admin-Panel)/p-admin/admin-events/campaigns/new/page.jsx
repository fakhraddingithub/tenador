import Link from 'next/link';
import { FaArrowRight } from 'react-icons/fa';
import EventForm from '@/components/admin/events/EventForm';

export const metadata = {
  title: 'Collection جدید | پنل مدیریت تنادور',
};

export default function NewCampaignPage() {
  return (
    <div dir="rtl">
      <div className="mb-4">
        <Link
          href="/p-admin/admin-events/campaigns"
          className="inline-flex items-center gap-1.5 text-xs font-bold hover:gap-2.5 transition-all"
          style={{ color: 'var(--color-primary)' }}
        >
          <FaArrowRight size={11} /> بازگشت به Collections
        </Link>
      </div>
      <EventForm />
    </div>
  );
}
