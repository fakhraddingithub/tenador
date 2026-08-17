/**
 * src/app/api/admin/roles/route.js
 *
 * GET  → لیست نقش‌های ادمین (همراه تعداد ادمین‌های هر نقش)
 * POST → ساخت نقش جدید (مجموعه دسترسی نام‌دار)
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import AdminRole from "base/models/AdminRole";
import Admin from "base/models/Admin";
import {
  stripProtectedRoleFields,
  validatePermissionKeys,
} from "@/lib/permissions";

import requireAdminPermission from "@/lib/requireAdminPermission";
import { auditor } from "@/lib/adminActivity";
import {
  assertNoPrivilegeEscalation,
  validateOptionalText,
} from "@/lib/adminGuards";

export async function GET() {
  const { denied } = await requireAdminPermission("roles.view");
  if (denied) return denied;

  try {
    await connectToDB();

    const roles = await AdminRole.find({}).sort({ createdAt: 1 }).lean();

    // تعداد ادمین‌های متصل به هر نقش — برای نمایش و جلوگیری از حذف نقش درحال‌استفاده
    const counts = await Admin.aggregate([
      { $match: { role: { $ne: null } } },
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));

    const rolesWithCounts = roles.map((role) => ({
      ...role,
      adminCount: countMap.get(role._id.toString()) || 0,
    }));

    return NextResponse.json({ roles: rolesWithCounts }, { status: 200 });
  } catch (error) {
    console.error("[GET roles]", error);
    return NextResponse.json(
      { message: "خطا در دریافت نقش‌ها" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  // audit:false — این روت خودش رکوردِ کاملِ role.create را می‌نویسد.
  const { ctx, denied } = await requireAdminPermission("roles.create", { audit: false });
  if (denied) return denied;

  try {
    await connectToDB();

    // فیلدهای محافظت‌شده (isSystem / isFullAccess / systemKey) هرگز از API
    // قابل تنظیم نیستند — فقط اسکریپت سیستمی آن‌ها را ست می‌کند.
    const { payload: body, rejected } = stripProtectedRoleFields(
      await req.json()
    );
    if (rejected.length) {
      return NextResponse.json(
        { message: `این فیلدها از طریق API قابل تنظیم نیستند: ${rejected.join("، ")}` },
        { status: 422 }
      );
    }

    const { permissions } = body;

    // `description?.trim()` روی ورودیِ غیرمتنی TypeError و ۵۰۰ می‌داد.
    const text = validateOptionalText(body, ["name", "description"]);
    if (!text.ok) {
      return NextResponse.json({ message: text.message }, { status: 422 });
    }
    const { name, description = "" } = text.values;

    if (!name) {
      return NextResponse.json(
        { message: "نام نقش الزامی است" },
        { status: 422 }
      );
    }

    // ⚠️ عمداً بدون RegExp: ساختنِ `new RegExp(\`^${name}$\`)` از ورودیِ کاربر
    // هم منطق را می‌شکند (`.*` با همه‌ی نقش‌ها برابر می‌شد) و هم ReDoS است
    // (`(a+)+$` سرور را قفل می‌کند). collation همان مقایسه‌ی بی‌توجه به
    // بزرگی/کوچکیِ حروف را به‌صورت بومی و بی‌خطر انجام می‌دهد.
    const duplicate = await AdminRole.findOne({ name }).collation({
      locale: "en",
      strength: 2,
    });
    if (duplicate) {
      return NextResponse.json(
        { message: "نقشی با این نام قبلاً ثبت شده است" },
        { status: 409 }
      );
    }

    // مرز اعتبارسنجی سخت: کلید نامعتبر/بازنشسته/مبهم بی‌صدا حذف نمی‌شود.
    const check = validatePermissionKeys(permissions);
    if (!check.ok) {
      return NextResponse.json(
        { message: `دسترسی نامعتبر — ${check.message}`, invalid: check.invalid },
        { status: 422 }
      );
    }

    // جلوگیری از ارتقای دسترسی: کسی نمی‌تواند نقشی بسازد که کلیدهایی فراتر
    // از دسترسی مؤثرِ خودش دارد (دارنده‌ی full-access مستثناست).
    const escalation = assertNoPrivilegeEscalation({
      actorPermissions: ctx.permissions,
      actorIsFullAccess: ctx.isFullAccess,
      requestedPermissions: check.permissions,
    });
    if (!escalation.ok) {
      return NextResponse.json(
        { message: "نمی‌توانید دسترسی‌ای بدهید که خودتان ندارید" },
        { status: 403 }
      );
    }

    const role = await AdminRole.create({
      name,
      description,
      permissions: check.permissions,
    });

    // ساختِ نقش یعنی ساختِ یک بسته‌ی دسترسی — await می‌شود تا رکورد قبل از
    // پاسخ قطعی باشد (اقدامِ پرارزش).
    await auditor(ctx, {
      action: "role.create",
      permissions: ["roles.create"],
      method: "POST",
      route: "/admin/roles",
    }).success({
      resource: { type: "AdminRole", id: role._id, label: role.name },
      metadata: { permissionCount: check.permissions.length },
    });

    return NextResponse.json(
      { message: "نقش با موفقیت ایجاد شد", role },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST roles]", error);

    if (error.code === 11000) {
      return NextResponse.json(
        { message: "نقشی با این نام قبلاً ثبت شده است" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: "خطای داخلی سرور در ایجاد نقش" },
      { status: 500 }
    );
  }
}
