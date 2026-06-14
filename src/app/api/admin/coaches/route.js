import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import User from "base/models/User";
import Order from "base/models/Order";

export async function GET(req) {
  try {
    await connectToDB();

    const { searchParams } = new URL(req.url);
    const coachId = searchParams.get("id");

    // Single coach detail (used by legacy sidebar panel and credit page)
    if (coachId) {
      const coach = await User.findById(coachId)
        .select("name email phone coachCode avatar walletBalance")
        .lean();
      if (!coach) return NextResponse.json({ error: "مربی یافت نشد" }, { status: 404 });

      const students = await User.find({ coach: coachId })
        .select("name email phone createdAt")
        .lean();

      return NextResponse.json({ coach, students });
    }

    // All coaches — enriched with student count, wallet balance, unreviewed orders
    const coaches = await User.find({ role: "coach" })
      .select("name email phone coachCode createdAt avatar walletBalance")
      .sort({ createdAt: -1 })
      .lean();

    if (!coaches.length) return NextResponse.json({ coaches: [] });

    const coachIds = coaches.map((c) => c._id);

    // Student counts per coach
    const studentAgg = await User.aggregate([
      { $match: { coach: { $in: coachIds } } },
      { $group: { _id: "$coach", count: { $sum: 1 } } },
    ]);

    // Map student → coach so we can count unreviewed orders per coach
    const studentsWithCoach = await User.find(
      { coach: { $in: coachIds } },
      "_id coach"
    ).lean();

    const studentToCoach = {};
    for (const s of studentsWithCoach) {
      studentToCoach[s._id.toString()] = s.coach.toString();
    }

    const allStudentIds = studentsWithCoach.map((s) => s._id);

    // Unreviewed orders belonging to any of those students
    const unreviewedOrders =
      allStudentIds.length > 0
        ? await Order.find(
            { user: { $in: allStudentIds }, reviewedAt: { $exists: false } },
            "user"
          ).lean()
        : [];

    // Tally per coach
    const unreviewedPerCoach = {};
    for (const o of unreviewedOrders) {
      const cid = studentToCoach[o.user.toString()];
      if (cid) unreviewedPerCoach[cid] = (unreviewedPerCoach[cid] || 0) + 1;
    }

    const studentCountMap = {};
    for (const agg of studentAgg) {
      studentCountMap[agg._id.toString()] = agg.count;
    }

    const enriched = coaches.map((c) => ({
      ...c,
      studentCount: studentCountMap[c._id.toString()] || 0,
      unreviewedOrderCount: unreviewedPerCoach[c._id.toString()] || 0,
      hasUnreviewed: !!(unreviewedPerCoach[c._id.toString()]),
    }));

    // Coaches with unreviewed orders first, then by count descending
    enriched.sort((a, b) => {
      if (a.hasUnreviewed && !b.hasUnreviewed) return -1;
      if (!a.hasUnreviewed && b.hasUnreviewed) return 1;
      return b.unreviewedOrderCount - a.unreviewedOrderCount;
    });

    return NextResponse.json({ coaches: enriched });
  } catch (error) {
    console.error("[admin/coaches GET]", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
