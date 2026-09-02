/**
 * src/app/api/admin/admins/route.js
 *
 * GET  → لیست ادمین‌ها (با نقش populate شده) + آمار
 * POST → ساخت ادمین جدید
 *
 * GET با admins.view و POST با admins.create محافظت می‌شوند؛ اعطای نقش و
 * دسترسی هم در برابر ارتقای دسترسی بررسی می‌شود.
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Admin from "base/models/Admin";
import AdminRole from "base/models/AdminRole";
import { validatePermissionKeys } from "@/lib/permissions";

import User from "base/models/User";
import { isValidObjectId } from "mongoose";
import requireAdminPermission from "@/lib/requireAdminPermission";
import {
  assertNoPrivilegeEscalation,
  assertRoleAssignable,
  deriveDisplayName,
  deriveUsername,
  validateOptionalText,
} from "@/lib/adminGuards";

export async function GET() {
  const { denied } = await requireAdminPermission("admins.view");
  if (denied) return denied;

  try {
    await connectToDB();

    const admins = await Admin.find({})
      .populate("role", "name description permissions isSystem")
      // کاربرِ لینک‌شده هم برمی‌گردد تا فهرست بتواند «این عضویت مالِ کیست»
      // را نشان دهد و اسناد legacyِ بدون کاربر قابل تشخیص باشند.
      .populate("user", "name lastName phone email avatar isBanned")
      .sort({ createdAt: -1 })
      .lean();

    const stats = {
      total: admins.length,
      active: admins.filter((a) => a.isActive).length,
      inactive: admins.filter((a) => !a.isActive).length,
    };

    return NextResponse.json({ admins, stats }, { status: 200 });
  } catch (error) {
    console.error("[GET admins]", error);
    return NextResponse.json(
      { message: "خطا در دریافت ادمین‌ها" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  const { actor, ctx, denied } = await requireAdminPermission("admins.create");
  if (denied) return denied;

  try {
    await connectToDB();

    const body = await req.json();
    const { userId, role, permissions, isActive } = body;

    // ─── هویت: از روی کاربرِ سایت، نه از روی متنِ دستی ───────────────────
    // فاز ۳: عضویت فقط به یک User واقعی داده می‌شود. ساختِ «هویتِ ادمینِ
    // آزاد» حذف شد چون سندی می‌ساخت که به هیچ نشستی map نمی‌شد — یعنی یک
    // ردیفِ بی‌اثر در UI که ظاهرش «ادمینِ فعال» بود.
    if (!isValidObjectId(userId)) {
      return NextResponse.json(
        { message: "برای ساختِ ادمین باید یک کاربر انتخاب شود" },
        { status: 422 }
      );
    }

    const user = await User.findById(userId)
      .select("name lastName phone email isBanned")
      .lean();
    if (!user) {
      return NextResponse.json({ message: "کاربر یافت نشد" }, { status: 404 });
    }

    // عضویت برای کاربرِ مسدود از همان ابتدا مرده است (resolveAdminContext او
    // را رد می‌کند)؛ ساختنش فقط یک ردیفِ گمراه‌کننده می‌سازد.
    if (user.isBanned) {
      return NextResponse.json(
        { message: "این کاربر مسدود است؛ ابتدا مسدودیت را بردارید" },
        { status: 422 }
      );
    }

    const existing = await Admin.findOne({ user: user._id })
      .select("_id isActive")
      .lean();
    if (existing) {
      return NextResponse.json(
        {
          message: existing.isActive
            ? "این کاربر از قبل ادمین است"
            : "این کاربر عضویتِ لغو‌شده دارد؛ به‌جای ساختِ دوباره آن را فعال کنید",
          adminId: existing._id,
          isActive: existing.isActive,
        },
        { status: 409 }
      );
    }

    // فقط «عنوان/سمت» متنِ آزاد می‌ماند — یک برچسبِ نمایشی، نه هویت.
    const text = validateOptionalText(body, ["title"]);
    if (!text.ok) {
      return NextResponse.json({ message: text.message }, { status: 422 });
    }
    const { title = "" } = text.values;

    const name = deriveDisplayName(user);
    const takenUsernames = new Set(
      (await Admin.find({}).select("username").lean()).map((a) => a.username)
    );
    const normalizedUsername = deriveUsername(user, takenUsernames);
    const email = user.email || "";

    // isActive فقط boolean واقعی — `!!` باعث می‌شد "false" یعنی فعال.
    if (isActive !== undefined && typeof isActive !== "boolean") {
      return NextResponse.json(
        { message: "مقدار isActive باید دقیقاً true یا false باشد" },
        { status: 422 }
      );
    }

    // اعتبارسنجی نقش (در صورت انتخاب)
    let roleId = null;
    if (role) {
      // شناسه‌ی بدشکل → ۴۲۲ کنترل‌شده، نه CastError و ۵۰۰
      if (!isValidObjectId(role)) {
        return NextResponse.json(
          { message: "شناسه‌ی نقش نامعتبر است" },
          { status: 422 }
        );
      }
      const roleDoc = await AdminRole.findById(role).lean();
      if (!roleDoc) {
        return NextResponse.json(
          { message: "نقش انتخاب‌شده یافت نشد" },
          { status: 404 }
        );
      }

      // actorِ غیر full-access نه نقشِ full-access می‌دهد و نه نقشی که
      // کلیدهایش فراتر از دسترسی مؤثرِ خودش است.
      const assignable = assertRoleAssignable({
        actorPermissions: ctx.permissions,
        actorIsFullAccess: ctx.isFullAccess,
        role: roleDoc,
      });
      if (!assignable.ok) {
        return NextResponse.json(
          {
            message:
              assignable.reason === "cannot-grant-full-access"
                ? "برای اعطای نقش دسترسی کامل، خودتان باید دسترسی کامل داشته باشید"
                : "این نقش دسترسی‌هایی فراتر از دسترسی شما دارد",
          },
          { status: 403 }
        );
      }

      roleId = roleDoc._id;
    }

    // مرز اعتبارسنجی سخت: کلید نامعتبر/بازنشسته/مبهم بی‌صدا حذف نمی‌شود.
    const check = validatePermissionKeys(permissions);
    if (!check.ok) {
      return NextResponse.json(
        { message: `دسترسی نامعتبر — ${check.message}`, invalid: check.invalid },
        { status: 422 }
      );
    }

    // و نه کلیدی که خودش ندارد (grantهای اختصاصیِ همین ادمین)
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

    const active = isActive === undefined ? true : isActive;

    const admin = await Admin.create({
      // ⚠️ نقشِ کسب‌وکاریِ کاربر (coach/store/...) عمداً دست نمی‌خورد:
      // «عضویت در پنل» یک چیز است و «نقش کاربر در سایت» چیز دیگری.
      user: user._id,
      name,
      username: normalizedUsername,
      email,
      role: roleId,
      title,
      // `permissions` فیلد legacy است و UI فعلی از همان می‌خواند؛
      // `permissionGrants` منبعِ محاسبه‌ی دسترسی مؤثر است. تا زمانی که فرم
      // به فیلد جدید منتقل شود، هر دو هم‌زمان نوشته می‌شوند.
      permissions: check.permissions,
      permissionGrants: check.permissions,
      isActive: active,
      activatedAt: active ? new Date() : null,
      activatedBy: active ? actor.userId : null,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    });

    const populated = await Admin.findById(admin._id)
      .populate("role", "name description permissions isSystem")
      .lean();

    return NextResponse.json(
      { message: "ادمین با موفقیت ایجاد شد", admin: populated },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST admins]", error);

    // مسابقه‌ی دو درخواستِ هم‌زمان روی یک کاربر: بررسیِ بالا هر دو را رد
    // نمی‌کند، ولی ایندکسِ یکتای partial (`admin_user_unique`) قطعاً یکی را
    // رد می‌کند. پیام باید همان پیامِ «از قبل ادمین است» باشد، نه ۵۰۰.
    if (error.code === 11000) {
      const onUser = error.keyPattern?.user || /admin_user_unique/.test(error.message || "");
      return NextResponse.json(
        {
          message: onUser
            ? "این کاربر هم‌زمان توسط درخواست دیگری ادمین شد"
            : "این نام کاربری قبلاً ثبت شده است",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: "خطای داخلی سرور در ایجاد ادمین" },
      { status: 500 }
    );
  }
}
