import { NextResponse } from 'next/server';
import connectToDB from 'base/configs/db';
import { deliverPendingWalletNotifications } from 'base/services/walletNotificationDelivery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await connectToDB();
  const processed = await deliverPendingWalletNotifications();
  return NextResponse.json({ ok: true, processed }, { headers: { 'Cache-Control': 'private, no-store' } });
}
