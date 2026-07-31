import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import User from "base/models/User";
import { cookies } from "next/headers";
import { verifyToken } from "base/utils/auth";
import mongoose from "mongoose";

export async function DELETE(req, { params }) {
  try {
    await connectToDB();
    const { productId } = await params;
    const token = (await cookies()).get("accessToken")?.value;
    const decoded = token ? verifyToken(token) : null;
    if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!mongoose.isValidObjectId(productId)) {
      return NextResponse.json({ error: "شناسه محصول نامعتبر است" }, { status: 400 });
    }

    const user = await User.findByIdAndUpdate(
      decoded.userId,
      { $pull: { wishlist: productId } },
      { new: true }
    );
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Product removed from wishlist" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
