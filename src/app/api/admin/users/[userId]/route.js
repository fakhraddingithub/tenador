/**
 * src/app/api/admin/users/[userId]/route.js
 *
 * GET   → جزئیات کامل یک کاربر (پروفایل، آدرس‌ها، سفارش‌ها، پرداخت‌ها، مربی، شاگردان)
 * PATCH → ویرایش اطلاعات کاربر توسط ادمین
 */

import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import connectToDB from "base/configs/db";
import Address from "base/models/Address";
import Order from "base/models/Order";
import Payment from "base/models/Payment";

import requireAdminPermission, { forbidden } from "@/lib/requireAdminPermission";
import { auditor, diffDocuments } from "@/lib/adminActivity";
import { resolveUserPatchPermissions } from "@/lib/apiPermissions";
import { validateUserPatchPayload } from "@/lib/adminGuards";
import {
  invariantResponse,
  saveWithSuperAdminInvariant,
} from "@/lib/superAdminInvariant";

import User from "base/models/User";
async function generateUniqueCoachCode() {
  let code = "";
  let isUnique = false;
  while (!isUnique) {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    code = `TR${randomDigits}`;
    const exists = await User.findOne({ coachCode: code });
    if (!exists) isUnique = true;
  }
  return code;
}

/** فقط فیلدهای ممیزی‌شده، به شکلِ ساده و قابل مقایسه. */
function snapshotUser(user, fields) {
  const out = {};
  for (const field of fields) {
    const value = user[field];
    out[field] = value && typeof value === "object" && value.toString ? String(value) : value;
  }
  return out;
}

/**
 * انتخابِ نامِ اقدام از روی تفاوتِ واقعی — به ترتیبِ اهمیت، چون یک درخواست
 * می‌تواند چند فیلد را هم‌زمان عوض کند.
 */
function pickUserAction(changes) {
  if (!changes) return "user.profile.update";
  if ("isBanned" in changes) return changes.isBanned.to ? "user.ban" : "user.unban";
  if ("walletBalance" in changes) return "user.wallet.adjust";
  if ("role" in changes) return "user.role.change";
  return "user.profile.update";
}

export async function GET(req, { params }) {
  const { denied } = await requireAdminPermission("users.view");
  if (denied) return denied;

  try {
    await connectToDB();
    const { userId } = await params;

    // idِ بدشکل نباید به کوئری برسد: findById روی آن CastError و ۵۰۰ می‌دهد.
    if (!isValidObjectId(userId)) {
      return NextResponse.json({ message: "کاربر یافت نشد" }, { status: 404 });
    }

    const user = await User.findById(userId)
      .select("-password -otp")
      .populate("coach", "name lastName coachCode avatar phone email")
      .lean();

    if (!user) {
      return NextResponse.json({ message: "کاربر یافت نشد" }, { status: 404 });
    }

    // آدرس‌ها
    const addresses = await Address.find({ user: userId })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();

    // سفارش‌ها
    const orders = await Order.find({ user: userId })
      .select(
        "trackingCode items subtotalPrice discountAmount couponDiscount totalPrice paymentMethod paymentStatus fulfillmentStatus orderDate createdAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    const orderIds = orders.map((o) => o._id);

    // پرداخت‌ها (بر اساس سفارش‌های کاربر)
    const payments = orderIds.length
      ? await Payment.find({ order: { $in: orderIds } })
          .select("order method amount status bankReceipt onlinePayment createdAt")
          .sort({ createdAt: -1 })
          .lean()
      : [];

    // نگاشت کد رهگیری به هر پرداخت برای نمایش راحت‌تر
    const orderTrackingMap = {};
    orders.forEach((o) => {
      orderTrackingMap[o._id.toString()] = {
        trackingCode: o.trackingCode,
        _id: o._id,
      };
    });
    const paymentsWithOrder = payments.map((p) => ({
      ...p,
      orderInfo: orderTrackingMap[p.order?.toString()] || null,
    }));

    // شاگردان (در صورتی که کاربر مربی است)
    let students = [];
    if (user.role === "coach") {
      students = await User.find({ coach: userId })
        .select("name lastName phone email avatar createdAt isBanned")
        .sort({ createdAt: -1 })
        .lean();
    }

    return NextResponse.json(
      {
        user,
        addresses,
        orders,
        payments: paymentsWithOrder,
        students,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/users/[userId] GET]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  // ۱) هویت اول — تا درخواستِ ناشناس ۴۰۱ بگیرد، نه ۴۰۳ ناشی از شکلِ بدنه.
  const identity = await requireAdminPermission();
  if (identity.denied) return identity.denied;

  try {
    await connectToDB();
    const { userId } = await params;

    if (!isValidObjectId(userId)) {
      return NextResponse.json({ message: "کاربر یافت نشد" }, { status: 404 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ message: "بدنه‌ی درخواست نامعتبر است" }, { status: 400 });
    }

    // ۲) کلیدِ لازم به فیلدهای بدنه وابسته است (ویرایش / مسدودسازی /
    //    تغییر نقش / تغییر موجودی کیف پول). ورودیِ ناشناخته fail-closed است.
    const resolved = resolveUserPatchPermissions(body);
    if (!resolved.allowed) return forbidden();

    // ۳) و حالا خودِ کلید
    const { ctx, denied } = await requireAdminPermission(resolved.permissions, {
      mode: resolved.mode,
      // این روت خودش اقدام را با نامِ دقیق (مسدودسازی، تغییر نقش، …) و
      // تفاوتِ قبل/بعد ثبت می‌کند.
      audit: false,
    });
    if (denied) return denied;

    // ۴) نوع‌های سخت — پیش از هر نوشتنی. رشته‌ی "false"، عددِ نامعتبر و مقدار
    //    منفی اینجا ۴۲۲ می‌گیرند، نه اینکه بی‌صدا تفسیر شوند.
    const valid = validateUserPatchPayload(body);
    if (!valid.ok) {
      return NextResponse.json({ message: valid.message }, { status: 422 });
    }

    // مسدودکردنِ حسابِ خود = قفل‌شدنِ بیرونِ پنل. عمداً ممنوع است؛ رفعِ
    // مسدودیتِ خود بی‌معنا ولی بی‌ضرر است، پس فقط true رد می‌شود.
    if (valid.values.isBanned === true && String(identity.ctx.userId) === String(userId)) {
      return NextResponse.json(
        { message: "نمی‌توانید حساب کاربری خودتان را مسدود کنید" },
        { status: 403 }
      );
    }

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ message: "کاربر یافت نشد" }, { status: 404 });
    }

    // عکسِ پیش از تغییر برای دفترِ فعالیت — پس از save دیگر در دسترس نیست.
    const AUDITED_FIELDS = ["name","lastName","email","phone","avatar","level","walletBalance","isBanned","role","coach"];
    const beforeSnapshot = snapshotUser(user, AUDITED_FIELDS);

    const editableFields = ["name", "lastName", "email", "phone", "avatar"];
    for (const field of editableFields) {
      if (body[field] !== undefined) {
        user[field] = body[field] === "" ? undefined : body[field];
      }
    }

    if (valid.values.level !== undefined) user.level = valid.values.level;
    if (valid.values.walletBalance !== undefined)
      user.walletBalance = valid.values.walletBalance;
    if (valid.values.isBanned !== undefined) user.isBanned = valid.values.isBanned;

    if (body.role !== undefined) {
      // "admin" عمداً در این فهرست نیست: عضویتِ پنل فقط از مسیر Admin
      // Management داده می‌شود. resolveUserPatchPermissions هم آن را رد
      // می‌کند؛ این لایه‌ی دومِ همان قاعده است.
      const validRoles = ["user", "coach", "seller", "national_player", "store"];
      if (!validRoles.includes(body.role)) {
        return NextResponse.json({ message: "نقش نامعتبر است" }, { status: 400 });
      }
      user.role = body.role;
      // اگر کاربر مربی شد و هنوز کد مربیگری ندارد، یک کد جدید بساز
      if (body.role === "coach" && !user.coachCode) {
        user.coachCode = await generateUniqueCoachCode();
      }
    }

    // امکان ویرایش/پاک کردن مربی متصل به کاربر
    if (body.coach !== undefined) {
      if (body.coach && !isValidObjectId(body.coach)) {
        return NextResponse.json(
          { message: "شناسه‌ی مربی نامعتبر است" },
          { status: 422 }
        );
      }
      user.coach = body.coach || null;
    }

    // مسدودسازی می‌تواند آخرین سوپرادمینِ قابل‌استفاده را از کار بیندازد بدون
    // اینکه هیچ سند Admin ای تغییر کند — پس همان تراکنشِ محافظت‌شده‌ای که
    // لغو/تغییرِ عضویت از آن عبور می‌کند لازم است، وگرنه write-skew دوباره
    // ممکن می‌شود (مثلاً هم‌زمان: مسدودکردنِ سوپرادمینِ الف و لغو عضویتِ ب).
    // رفعِ مسدودیت هم از همین مسیر می‌رود تا یک شاخه بیشتر نداشته باشیم.
    if (valid.values.isBanned !== undefined) {
      try {
        await saveWithSuperAdminInvariant(user);
      } catch (error) {
        const response = invariantResponse(error);
        if (response) return response;
        throw error;
      }
    } else {
      await user.save();
    }

    const updated = await User.findById(userId)
      .select("-password -otp")
      .populate("coach", "name lastName coachCode avatar phone email")
      .lean();

    // نامِ اقدام از روی چیزی که *واقعاً* عوض شده انتخاب می‌شود، نه از روی
    // کلیدِ درخواستی: یک PATCH می‌تواند هم‌زمان چند چیز را عوض کند، ولی
    // مسدودسازی و تغییرِ موجودی مهم‌ترند و باید در خطِ زمانی برجسته باشند.
    const changes = diffDocuments(beforeSnapshot, snapshotUser(user, AUDITED_FIELDS));
    await auditor(ctx, {
      permissions: resolved.permissions,
      method: "PATCH",
      route: "/admin/users/[userId]",
      action: pickUserAction(changes),
    }).success({
      resource: {
        type: "User",
        id: userId,
        label: [user.name, user.lastName].filter(Boolean).join(" ") || user.phone || "",
      },
      changes,
    });

    return NextResponse.json(
      { message: "اطلاعات کاربر با موفقیت بروزرسانی شد", user: updated },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/users/[userId] PATCH]", error);
    if (error?.code === 11000) {
      return NextResponse.json(
        { message: "این ایمیل یا شماره تلفن قبلاً ثبت شده است" },
        { status: 409 }
      );
    }
    // ورودیِ بدشکل روی فیلدهای متنی (یا پاک‌کردنِ فیلدِ الزامی) خطای کاربر
    // است، نه خطای سرور.
    if (error?.name === "ValidationError" || error?.name === "CastError") {
      return NextResponse.json(
        { message: "اطلاعات ارسال‌شده معتبر نیست" },
        { status: 422 }
      );
    }
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
