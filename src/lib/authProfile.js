import "base/models/registerModels";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import User from "base/models/User";
import { verifyToken } from "base/utils/auth";

// Shared read model; authentication is always verified on the server.
export async function readAuthProfile(origin) {
  const token = (await cookies()).get("accessToken")?.value;
  const authUser = token ? verifyToken(token) : null;
  if (!authUser?.userId) return { status: 401, user: null };
  await connectToDB();
  const user = await User.findById(authUser.userId)
    .select("-password")
    .populate("coach", "name lastName avatar coachCode");
  if (!user) return { status: 404, user: null };
  const referralLink = user.coachCode ? `${origin}/register?ref=${user.coachCode}` : null;
  return { status: 200, user: {
    id: user._id,
    name: user.name,
    lastName: user.lastName,
    phone: user.phone,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    isCoach: user.role === 'coach', // فلگ برای کنترل فرانت‌اند
    coachCode: user.coachCode,
    walletBalance: user.walletBalance || 0,
    coachApplicationStatus: user.coachApplication?.status || 'none',
    // مدرک/حکم مربیگری (برای ویرایش توسط خودِ مربی)
    coachCertificate: user.role === 'coach' ? (user.coachApplication?.certificateImage || '') : null,
    coach: user.coach || null,
    referralLink: referralLink,
    createdAt: user.createdAt,
  } };
}
