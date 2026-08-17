/**
 * src/app/api/admin/admins/[id]/route.js
 *
 * GET    → دریافت یک ادمین
 * PUT    → ویرایش ادمین (شامل فعال‌سازی/لغو دسترسی و دسترسی‌ها)
 * DELETE → لغو دسترسی ادمین (soft revoke — سند هرگز حذف نمی‌شود)
 *
 * هیچ مسیری در این فایل سند Admin را حذف فیزیکی نمی‌کند: تاریخچه‌ی ممیزی باید
 * پس از لغو دسترسی هم باقی بماند.
 */

import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import connectToDB from "base/configs/db";
import Admin from "base/models/Admin";
import AdminRole from "base/models/AdminRole";
import User from "base/models/User";
import { validatePermissionKeys } from "@/lib/permissions";
import { resolveAdminPatchPermissions } from "@/lib/apiPermissions";
import {
  applyAdminStatusTransition,
  assertNoPrivilegeEscalation,
  assertRoleAssignable,
  canManageAdmin,
  deriveDisplayName,
  interpretRevokeOutcome,
  validateOptionalText,
  validateStatusPayload,
} from "@/lib/adminGuards";
import {
  invariantResponse,
  saveWithSuperAdminInvariant,
  withSuperAdminInvariant,
} from "@/lib/superAdminInvariant";

import requireAdminPermission, { forbidden } from "@/lib/requireAdminPermission";

export async function GET(req, { params }) {
  const { denied } = await requireAdminPermission("admins.view");
  if (denied) return denied;

  try {
    await connectToDB();

    const { id } = await params;

    // idِ بدشکل نباید به کوئری برسد: findById روی آن CastError و ۵۰۰ می‌دهد.
    if (!isValidObjectId(id)) {
      return NextResponse.json({ message: "ادمین یافت نشد" }, { status: 404 });
    }

    const admin = await Admin.findById(id)
      .populate("role", "name description permissions isSystem isFullAccess")
      .populate("user", "name lastName phone email avatar isBanned")
      .lean();

    if (!admin) {
      return NextResponse.json({ message: "ادمین یافت نشد" }, { status: 404 });
    }

    return NextResponse.json({ admin }, { status: 200 });
  } catch (error) {
    console.error("[GET admin]", error);
    return NextResponse.json(
      { message: "خطا در دریافت اطلاعات ادمین" },
      { status: 500 }
    );
  }
}

export async function PUT(req, { params }) {
  // ۱) هویت اول — تا ناشناس ۴۰۱ بگیرد، نه ۴۰۳ ناشی از شکلِ بدنه.
  const identity = await requireAdminPermission();
  if (identity.denied) return identity.denied;

  try {
    await connectToDB();

    const { id } = await params;

    // idِ بدشکل نباید به کوئری برسد: findById روی آن CastError و ۵۰۰ می‌دهد.
    if (!isValidObjectId(id)) {
      return NextResponse.json({ message: "ادمین یافت نشد" }, { status: 404 });
    }

    const body = await req.json();

    // ۲) کلیدِ لازم به فیلدهای بدنه وابسته است: ویرایشِ ساده، فعال‌سازی،
    //    لغو دسترسی و مدیریت دسترسی‌ها سه چیزِ متفاوت‌اند.
    const resolved = resolveAdminPatchPermissions(body);
    if (!resolved.allowed) return forbidden();

    // ۳) و حالا خودِ کلید(ها)
    const { actor, ctx, denied } = await requireAdminPermission(
      resolved.permissions,
      { mode: resolved.mode }
    );
    if (denied) return denied;

    const admin = await Admin.findById(id).populate(
      "role",
      "permissions isFullAccess isSystem systemKey"
    );
    if (!admin) {
      return NextResponse.json({ message: "ادمین یافت نشد" }, { status: 404 });
    }

    // ۴) خودمدیریتی و دست‌کاریِ ادمینِ قوی‌تر ممنوع
    const manageable = canManageAdmin({
      actorUserId: ctx.userId,
      actorIsFullAccess: ctx.isFullAccess,
      target: admin,
      targetRoleIsFullAccess: !!admin.role?.isFullAccess,
    });
    if (!manageable.ok) {
      return NextResponse.json(
        {
          message:
            manageable.reason === "self-management"
              ? "نمی‌توانید حساب ادمینِ خودتان را از این مسیر تغییر دهید"
              : "این ادمین دسترسی بالاتری از شما دارد",
        },
        { status: 403 }
      );
    }

    // ─── تنها متنِ آزاد: عنوان/سمت ───
    // فاز ۳: نام/نام‌کاربری/ایمیل دیگر دستی ویرایش نمی‌شوند؛
    // resolveAdminPatchPermissions آن‌ها را «فیلدِ ناشناخته» و در نتیجه ۴۰۳
    // می‌کند. اینجا فقط برچسبِ نمایشیِ شغلی می‌ماند.
    const text = validateOptionalText(body, ["title"]);
    if (!text.ok) {
      return NextResponse.json({ message: text.message }, { status: 422 });
    }
    if (text.values.title !== undefined) admin.title = text.values.title;

    // هویتِ نمایشی با کاربرِ لینک‌شده هم‌گام می‌شود تا فهرستِ ادمین‌ها بعد از
    // تغییرِ نامِ کاربر کهنه نماند. اسناد legacy (بدون user) دست‌نخورده‌اند.
    if (admin.user) {
      const linked = await User.findById(admin.user)
        .select("name lastName phone email")
        .lean();
      if (linked) {
        admin.name = deriveDisplayName(linked);
        admin.email = linked.email || "";
      }
    }
    // ─── فعال‌سازی / لغو دسترسی ───
    // منطق در applyAdminStatusTransition متمرکز است تا PUT و DELETE دقیقاً یک
    // رفتار داشته باشند و متادیتای ممیزی جا نیفتد.
    const status = validateStatusPayload({
      isActive: body.isActive,
      revokeReason: body.revokeReason,
    });
    if (!status.ok) {
      return NextResponse.json({ message: status.message }, { status: 422 });
    }

    if (status.isActive !== undefined) {
      const { patch, error } = applyAdminStatusTransition({
        current: admin,
        nextActive: status.isActive,
        actorUserId: actor.userId,
        reason: status.revokeReason,
      });
      if (error) {
        return NextResponse.json(
          { message: "مقدار isActive نامعتبر است" },
          { status: 422 }
        );
      }
      admin.set(patch);
    }

    // نام کاربری از `_id`ِ کاربر مشتق می‌شود و پایدار است؛ ویرایشِ دستی‌اش
    // حذف شد (فاز ۳). فرستادنِ `username` حالا در گیت ۴۰۳ می‌گیرد.

    // ─── نقش ───
    if (body.role !== undefined) {
      if (body.role) {
        if (!isValidObjectId(body.role)) {
          return NextResponse.json(
            { message: "شناسه‌ی نقش نامعتبر است" },
            { status: 422 }
          );
        }
        const roleDoc = await AdminRole.findById(body.role).lean();
        if (!roleDoc) {
          return NextResponse.json(
            { message: "نقش انتخاب‌شده یافت نشد" },
            { status: 404 }
          );
        }

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

        admin.role = roleDoc._id;
      } else {
        admin.role = null;
      }
    }

    // ─── دسترسی‌ها ───
    // کلید نامعتبر/بازنشسته/مبهم بی‌صدا حذف نمی‌شود؛ ۴۲۲ با جزئیات برمی‌گردد.
    //
    // `permissions` نامِ legacyِ همان grants است. پیش‌تر فقط همین یکی خوانده
    // می‌شد و `permissionGrants` / `permissionDenials` بی‌صدا دور ریخته
    // می‌شدند — یعنی گیت اجازه‌ی admins.managePermissions می‌خواست، ۲۰۰
    // برمی‌گرداند، و هیچ‌چیز تغییر نمی‌کرد.
    if (body.permissions !== undefined && body.permissionGrants !== undefined) {
      return NextResponse.json(
        {
          message:
            "همزمان permissions و permissionGrants نفرستید؛ این دو یک چیزند و کدام مقصود است مشخص نیست",
        },
        { status: 422 }
      );
    }

    const rawGrants =
      body.permissionGrants !== undefined ? body.permissionGrants : body.permissions;

    if (rawGrants !== undefined) {
      const check = validatePermissionKeys(rawGrants);
      if (!check.ok) {
        return NextResponse.json(
          { message: `دسترسی نامعتبر — ${check.message}`, invalid: check.invalid },
          { status: 422 }
        );
      }
      // و نمی‌تواند کلیدی بدهد که خودش ندارد
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

      // legacy + منبع جدید هم‌زمان (توضیح در POST /api/admin/admins)
      admin.permissions = check.permissions;
      admin.permissionGrants = check.permissions;
    }

    // سلبِ دسترسی ارتقا نیست (چیزی اضافه نمی‌کند)، پس بررسیِ escalation
    // ندارد؛ فقط باید کلیدهایش معتبر باشند.
    if (body.permissionDenials !== undefined) {
      const check = validatePermissionKeys(body.permissionDenials);
      if (!check.ok) {
        return NextResponse.json(
          { message: `دسترسی نامعتبر — ${check.message}`, invalid: check.invalid },
          { status: 422 }
        );
      }
      admin.permissionDenials = check.permissions;
    }

    admin.updatedBy = actor.userId;

    // تغییرِ isActive یا role می‌تواند آخرین سوپرادمین را از بین ببرد؛ این دو
    // حالت داخل تراکنشِ محافظت‌شده انجام می‌شوند (توضیح طراحی در
    // src/lib/superAdminInvariant.js). بقیه‌ی ویرایش‌ها بی‌خطرند.
    const touchesInvariant =
      body.isActive !== undefined || body.role !== undefined;

    if (touchesInvariant) {
      try {
        await saveWithSuperAdminInvariant(admin);
      } catch (error) {
        const response = invariantResponse(error);
        if (response) return response;
        throw error;
      }
    } else {
      await admin.save();
    }

    const populated = await Admin.findById(admin._id)
      .populate("role", "name description permissions isSystem")
      .lean();

    return NextResponse.json(
      { message: "ادمین با موفقیت به‌روزرسانی شد", admin: populated },
      { status: 200 }
    );
  } catch (error) {
    console.error("[PUT admin]", error);

    if (error.code === 11000) {
      return NextResponse.json(
        { message: "این نام کاربری قبلاً ثبت شده است" },
        { status: 409 }
      );
    }

    // ویرایشِ هم‌زمان: سند بین خواندن و ذخیره تغییر کرده. به‌جای بازنویسیِ
    // متادیتای ممیزیِ درخواستِ دیگر، از کلاینت می‌خواهیم دوباره تلاش کند.
    if (error.name === "VersionError") {
      return NextResponse.json(
        {
          message:
            "این ادمین هم‌زمان توسط درخواست دیگری تغییر کرد؛ صفحه را تازه کنید و دوباره تلاش کنید",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: "خطا در ویرایش ادمین" },
      { status: 500 }
    );
  }
}

/**
 * DELETE = «لغو دسترسی» (soft revoke)، نه حذف فیزیکی.
 *
 * سند Admin هرگز حذف نمی‌شود: تاریخچه‌ی ممیزیِ آینده (چه کسی، کِی و چرا
 * دسترسی داشته) باید بعد از لغو هم قابل بازیابی بماند. قبلاً این هندلر
 * findByIdAndDelete می‌زد و همان تاریخچه را نابود می‌کرد.
 *
 * idempotent: فراخوانی دوباره روی ادمینِ از قبل لغو‌شده چیزی را بازنویسی
 * نمی‌کند (revokedAt/revokedBy اولیه حفظ می‌شود) و همچنان ۲۰۰ می‌دهد.
 */
export async function DELETE(req, { params }) {
  const { actor, ctx, denied } = await requireAdminPermission("admins.revoke");
  if (denied) return denied;

  try {
    await connectToDB();

    const { id } = await params;

    if (!isValidObjectId(id)) {
      return NextResponse.json({ message: "ادمین یافت نشد" }, { status: 404 });
    }

    // دلیل لغو اختیاری است و ممکن است بدنه‌ای ارسال نشود.
    let rawReason;
    try {
      const body = await req.json();
      rawReason = body?.revokeReason;
    } catch {
      // بدون بدنه — طبیعی است
    }

    const status = validateStatusPayload({ revokeReason: rawReason });
    if (!status.ok) {
      return NextResponse.json({ message: status.message }, { status: 422 });
    }

    // خودمدیریتی و لغوِ ادمینِ قوی‌تر ممنوع
    const target = await Admin.findById(id)
      .populate("role", "isFullAccess")
      .lean();
    if (target) {
      const manageable = canManageAdmin({
        actorUserId: ctx.userId,
        actorIsFullAccess: ctx.isFullAccess,
        target,
        targetRoleIsFullAccess: !!target.role?.isFullAccess,
      });
      if (!manageable.ok) {
        return NextResponse.json(
          {
            message:
              manageable.reason === "self-management"
                ? "نمی‌توانید دسترسی خودتان را لغو کنید"
                : "این ادمین دسترسی بالاتری از شما دارد",
          },
          { status: 403 }
        );
      }
    }

    const { patch } = applyAdminStatusTransition({
      current: { isActive: true },
      nextActive: false,
      actorUserId: actor.userId,
      reason: status.revokeReason,
    });

    // لغوِ شرطیِ اتمیک، داخل تراکنشِ محافظِ ناوردا: فقط سندی که *همین حالا*
    // فعال است لغو می‌شود، و اگر نتیجه صفر شدنِ سوپرادمین باشد کل تراکنش
    // برمی‌گردد. دو درخواست هم‌زمان روی sentinel تعارض می‌گیرند و سریال می‌شوند.
    let updated;
    try {
      updated = await withSuperAdminInvariant((session) =>
        Admin.findOneAndUpdate(
          { _id: id, isActive: true },
          { $set: patch },
          { new: true, session }
        )
          .populate("role", "name description permissions isSystem isFullAccess")
          .lean()
      );
    } catch (error) {
      const response = invariantResponse(error);
      if (response) return response;
      throw error;
    }

    // miss یعنی «وجود ندارد» یا «از قبل لغو شده» — این دو نباید یکی شوند.
    const exists = updated ? true : !!(await Admin.exists({ _id: id }));
    const outcome = interpretRevokeOutcome({ updated, exists });

    return NextResponse.json(
      outcome.outcome === "not-found"
        ? { message: outcome.message }
        : { message: outcome.message, outcome: outcome.outcome, admin: updated },
      { status: outcome.status }
    );
  } catch (error) {
    console.error("[DELETE admin]", error);
    return NextResponse.json(
      { message: "خطا در لغو دسترسی ادمین" },
      { status: 500 }
    );
  }
}
