/**
 * src/app/api/admin/roles/[id]/route.js
 *
 * PUT    → ویرایش نقش
 * DELETE → حذف نقش (فقط اگر سیستمی نباشد و ادمینی به آن متصل نباشد)
 */

import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import connectToDB from "base/configs/db";
import AdminRole from "base/models/AdminRole";
import Admin from "base/models/Admin";
import {
  stripProtectedRoleFields,
  validatePermissionKeys,
} from "@/lib/permissions";
import {
  assertNoPrivilegeEscalation,
  assertRoleModifiable,
  validateOptionalText,
} from "@/lib/adminGuards";

import requireAdminPermission from "@/lib/requireAdminPermission";
import { auditor, diffDocuments } from "@/lib/adminActivity";

export async function PUT(req, { params }) {
  // audit:false — رکوردِ کاملِ role.update با تفاوتِ قبل/بعد پایین‌تر نوشته می‌شود.
  const { ctx, denied } = await requireAdminPermission("roles.edit", { audit: false });
  if (denied) return denied;

  try {
    await connectToDB();

    const { id } = await params;

    // idِ بدشکل نباید به کوئری برسد: findById روی آن CastError و ۵۰۰ می‌دهد.
    if (!isValidObjectId(id)) {
      return NextResponse.json({ message: "نقش یافت نشد" }, { status: 404 });
    }

    const { payload: body, rejected } = stripProtectedRoleFields(
      await req.json()
    );
    if (rejected.length) {
      return NextResponse.json(
        { message: `این فیلدها از طریق API قابل تغییر نیستند: ${rejected.join("، ")}` },
        { status: 422 }
      );
    }

    const role = await AdminRole.findById(id);
    if (!role) {
      return NextResponse.json({ message: "نقش یافت نشد" }, { status: 404 });
    }

    // عکسِ پیش از تغییر — بعد از save دیگر در دسترس نیست.
    const before = {
      name: role.name,
      description: role.description,
      permissions: [...(role.permissions || [])],
    };

    // نقشِ محافظت‌شده از مسیر API تغییر نمی‌کند؛ و نقشِ *قوی‌تر از actor* هم
    // نباید توسط او تضعیف شود (وگرنه یک ادمینِ ضعیف می‌تواند نقشِ قوی را
    // خالی کند و ادمین‌های آن نقش را از کار بیندازد).
    const modifiable = assertRoleModifiable({
      actorPermissions: ctx.permissions,
      actorIsFullAccess: ctx.isFullAccess,
      role,
    });
    if (!modifiable.ok) {
      return NextResponse.json(
        {
          message:
            modifiable.reason === "protected-role"
              ? "نقش‌های سیستمی قابل ویرایش نیستند"
              : "این نقش دسترسی‌هایی فراتر از دسترسی شما دارد",
        },
        { status: 403 }
      );
    }

    // ورودیِ غیرمتنی ۴۲۲ می‌گیرد، نه ۵۰۰ ناشی از TypeError روی trim.
    const text = validateOptionalText(body, ["name", "description"]);
    if (!text.ok) {
      return NextResponse.json({ message: text.message }, { status: 422 });
    }

    if (text.values.name !== undefined) {
      if (!text.values.name) {
        return NextResponse.json(
          { message: "نام نقش نمی‌تواند خالی باشد" },
          { status: 422 }
        );
      }

      // بدون RegExp — توضیح در POST /api/admin/roles (تزریقِ الگو + ReDoS).
      const duplicate = await AdminRole.findOne({
        name: text.values.name,
        _id: { $ne: id },
      }).collation({ locale: "en", strength: 2 });
      if (duplicate) {
        return NextResponse.json(
          { message: "نقشی با این نام قبلاً ثبت شده است" },
          { status: 409 }
        );
      }

      role.name = text.values.name;
    }

    if (text.values.description !== undefined) {
      role.description = text.values.description;
    }

    if (body.permissions !== undefined) {
      const check = validatePermissionKeys(body.permissions);
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

      role.permissions = check.permissions;
    }

    await role.save();

    await auditor(ctx, {
      action: "role.update",
      permissions: ["roles.edit"],
      method: "PUT",
      route: "/admin/roles/[id]",
    }).success({
      resource: { type: "AdminRole", id: role._id, label: role.name },
      changes: diffDocuments(before, {
        name: role.name,
        description: role.description,
        permissions: [...(role.permissions || [])],
      }),
    });

    return NextResponse.json(
      { message: "نقش با موفقیت به‌روزرسانی شد", role },
      { status: 200 }
    );
  } catch (error) {
    console.error("[PUT role]", error);
    return NextResponse.json(
      { message: "خطا در ویرایش نقش" },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  // audit:false — رکوردِ کاملِ role.delete پایین‌تر نوشته می‌شود.
  const { ctx, denied } = await requireAdminPermission("roles.delete", { audit: false });
  if (denied) return denied;

  try {
    await connectToDB();

    const { id } = await params;

    if (!isValidObjectId(id)) {
      return NextResponse.json({ message: "نقش یافت نشد" }, { status: 404 });
    }

    const role = await AdminRole.findById(id);
    if (!role) {
      return NextResponse.json({ message: "نقش یافت نشد" }, { status: 404 });
    }

    // شامل نقشِ «دسترسی کامل»، و نیز نقشِ قوی‌تر از خودِ actor.
    const modifiable = assertRoleModifiable({
      actorPermissions: ctx.permissions,
      actorIsFullAccess: ctx.isFullAccess,
      role,
    });
    if (!modifiable.ok) {
      return modifiable.reason === "protected-role"
        ? NextResponse.json(
            { message: "نقش‌های سیستمی قابل حذف نیستند" },
            { status: 400 }
          )
        : NextResponse.json(
            { message: "این نقش دسترسی‌هایی فراتر از دسترسی شما دارد" },
            { status: 403 }
          );
    }

    const inUse = await Admin.countDocuments({ role: id });
    if (inUse > 0) {
      return NextResponse.json(
        {
          message: `این نقش به ${inUse} ادمین متصل است؛ ابتدا نقش آن‌ها را تغییر دهید`,
        },
        { status: 400 }
      );
    }

    await AdminRole.findByIdAndDelete(id);

    // حذفِ نقش برگشت‌پذیر نیست؛ فهرستِ کلیدهایش در رکورد می‌ماند تا بشود
    // بعداً بازسازی‌اش کرد.
    await auditor(ctx, {
      action: "role.delete",
      permissions: ["roles.delete"],
      method: "DELETE",
      route: "/admin/roles/[id]",
    }).success({
      resource: { type: "AdminRole", id, label: role.name },
      metadata: { permissions: role.permissions || [] },
    });

    return NextResponse.json(
      { message: "نقش با موفقیت حذف شد" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DELETE role]", error);
    return NextResponse.json(
      { message: "خطا در حذف نقش" },
      { status: 500 }
    );
  }
}
