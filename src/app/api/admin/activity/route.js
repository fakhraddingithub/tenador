/**
 * GET /api/admin/activity — دفترِ فعالیتِ ادمین‌ها (فاز ۶)
 *
 * فقط خواندنی. هیچ متدِ نوشتنی‌ای عمداً وجود ندارد: دفتر فقط‌افزودنی است و
 * تنها مسیرِ نوشتن، سرویسِ داخلیِ src/lib/adminActivity.js است.
 *
 * پارامترها (همه اختیاری):
 *   actorUser, actorAdmin   ObjectId — سخت‌گیرانه اعتبارسنجی می‌شوند
 *   action, result, resourceType, resourceId
 *   from, to                ISO date
 *   sort                    createdAt | -createdAt   (فهرستِ سفید)
 *   page, limit             صفحه‌بندی با سقفِ سخت
 */

import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import connectToDB from "base/configs/db";
import "base/models/registerModels";
import AdminActivity, { ACTIVITY_RESULTS } from "base/models/AdminActivity";
import requireAdminPermission from "@/lib/requireAdminPermission";
import { ACTIVITY_ACTIONS } from "@/lib/activityLabels";

export const runtime = "nodejs";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

/** شکلِ مجازِ شناسه‌ی اقدام: `a.b` تا `a.b.c.d` — بدون regexِ ورودی‌ساخته. */
const ACTION_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9]{0,29}(\.[a-zA-Z0-9]{1,30}){1,3}$/;

/** فقط این دو ترتیب مجازند — ورودیِ آزاد به sort یعنی تزریق. */
const SORTS = {
  "-createdAt": { createdAt: -1 },
  createdAt: { createdAt: 1 },
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export async function GET(req) {
  const { denied } = await requireAdminPermission("admins.viewActivity");
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const filter = {};

    // ── شناسه‌ها: یا ObjectIdِ معتبر، یا ۴۲۲. «بی‌صدا نادیده گرفتن» یعنی
    //    فیلترِ اشتباهِ کاربر به «همه‌ی رکوردها» تبدیل شود.
    for (const field of ["actorUser", "actorAdmin"]) {
      const value = searchParams.get(field);
      if (!value) continue;
      if (!isValidObjectId(value)) {
        return NextResponse.json(
          { message: `شناسه‌ی ${field} نامعتبر است` },
          { status: 422 }
        );
      }
      filter[field] = value;
    }

    // شناسه‌ی اقدام یا در رجیستری است، یا دست‌کم *شکلِ* یک شناسه را دارد.
    // شکل هم پذیرفته می‌شود چون دفتر رکوردهای قدیمی و رکوردهای موجودیت‌های
    // تازه‌ثبت‌شده را هم دارد؛ رد کردنشان یعنی ممیز نتواند فیلتر کند. الگو
    // به‌قدر کافی بسته است که چیزی جز یک شناسه‌ی نقطه‌دار از آن رد نشود.
    const action = searchParams.get("action");
    if (action) {
      if (!ACTIVITY_ACTIONS[action] && !ACTION_ID_PATTERN.test(action)) {
        return NextResponse.json({ message: "اقدامِ ناشناخته" }, { status: 422 });
      }
      filter.action = action;
    }

    const result = searchParams.get("result");
    if (result) {
      if (!ACTIVITY_RESULTS.includes(result)) {
        return NextResponse.json({ message: "نتیجه‌ی ناشناخته" }, { status: 422 });
      }
      filter.result = result;
    }

    const resourceType = searchParams.get("resourceType");
    if (resourceType) filter.resourceType = resourceType.slice(0, 60);

    const resourceId = searchParams.get("resourceId");
    if (resourceId) filter.resourceId = resourceId.slice(0, 60);

    const from = parseDate(searchParams.get("from"));
    const to = parseDate(searchParams.get("to"));
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = from;
      if (to) filter.createdAt.$lte = to;
    }

    const sortKey = searchParams.get("sort") || "-createdAt";
    const sort = SORTS[sortKey];
    if (!sort) {
      return NextResponse.json({ message: "ترتیبِ نامعتبر" }, { status: 422 });
    }

    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get("limit")) || DEFAULT_LIMIT));

    await connectToDB();

    const [items, total] = await Promise.all([
      AdminActivity.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AdminActivity.countDocuments(filter),
    ]);

    return NextResponse.json(
      {
        items,
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET /api/admin/activity]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
