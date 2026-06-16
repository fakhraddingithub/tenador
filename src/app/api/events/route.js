import { NextResponse } from "next/server";
import { getActiveEvents } from "base/services/event.service";

// GET /api/events — public active events list
export async function GET() {
  const events = await getActiveEvents();
  return NextResponse.json({ events });
}
