import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import ContactMessage from "base/models/ContactMessage";

export const runtime = "nodejs";

/**
 * PATCH /api/admin/contact-messages/[id] → تغییر وضعیت (new|read|archived)
 */
export async function PATCH(req, { params }) {
  const { id } = await params;
  const body = await req.json();
  const status = String(body.status || "");
  if (!["new", "read", "archived"].includes(status))
    return NextResponse.json({ error: "وضعیت نامعتبر" }, { status: 400 });

  await connectToDB();
  const updated = await ContactMessage.findByIdAndUpdate(
    id,
    { status },
    { new: true }
  ).lean();

  if (!updated)
    return NextResponse.json({ error: "پیام یافت نشد" }, { status: 404 });

  return NextResponse.json({ ok: true, message: JSON.parse(JSON.stringify(updated)) });
}

/**
 * DELETE /api/admin/contact-messages/[id]
 */
export async function DELETE(_req, { params }) {
  const { id } = await params;
  await connectToDB();
  const deleted = await ContactMessage.findByIdAndDelete(id);
  if (!deleted)
    return NextResponse.json({ error: "پیام یافت نشد" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
