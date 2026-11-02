import { NextResponse } from "next/server";
import { readAuthProfile } from "@/lib/authProfile";

export async function GET(req) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    // An absent/expired session is normal on public pages. Protected profile
    // and mutation endpoints retain their existing authorization responses.
    const { user } = await readAuthProfile(req.nextUrl.origin);
    return NextResponse.json({ user }, { headers });
  } catch (error) {
    console.error("Session lookup failed:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500, headers });
  }
}
