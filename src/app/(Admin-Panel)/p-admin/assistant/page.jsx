import { redirect } from 'next/navigation';
import { getAdminContext } from '@/lib/adminContext';
import { hasPermission } from '@/lib/permissions';

export default async function AssistantPage() {
  const ctx = await getAdminContext();
  if (!ctx || !hasPermission(ctx.permissions, 'assistant.use')) redirect('/p-admin/403');
  redirect('/p-admin');
}
