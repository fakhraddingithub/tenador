import { NextResponse } from "next/server";
import { cookies } from 'next/headers';
import connectToDB from "base/configs/db";
import User from "base/models/User";
import Product from "base/models/Product";
import { verifyToken } from 'base/utils/auth';
import { getCachedRate } from "@/lib/Exchangerate";
import { attachListingPrices } from "base/services/priceEngine";
import mongoose from "mongoose";

export async function GET() {
  try {
    await connectToDB();
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;

    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    const user = await User.findById(decoded.userId).select('wishlist').lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const products = await Product.find({
      _id: { $in: user.wishlist },
      isActive: true,
    })
      .populate("brand")
      .populate("category")
      .populate("serie")
      .populate("variants")
      .lean();

    const byId = new Map(products.map((product) => [String(product._id), product]));
    const ordered = user.wishlist.map((id) => byId.get(String(id))).filter(Boolean);
    const rate = await getCachedRate();
    const wishlist = await attachListingPrices(ordered, rate);

    return NextResponse.json({ wishlist });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await connectToDB();

    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;

    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const { productId } = body;

    if (!productId) {
      return NextResponse.json({ error: "Product ID required" }, { status: 400 });
    }
    if (!mongoose.isValidObjectId(productId)) {
      return NextResponse.json({ error: "شناسه محصول نامعتبر است" }, { status: 400 });
    }

    const product = await Product.exists({ _id: productId, isActive: true });
    if (!product) return NextResponse.json({ error: "محصول پیدا نشد" }, { status: 404 });

    const user = await User.findByIdAndUpdate(
      decoded.userId,
      { $addToSet: { wishlist: productId } },
      { new: true }
    );
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({ message: "Product added to wishlist" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await connectToDB();

    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;

    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const { productId } = body;

    if (!productId) {
      return NextResponse.json({ error: "Product ID required" }, { status: 400 });
    }
    if (!mongoose.isValidObjectId(productId)) {
      return NextResponse.json({ error: "شناسه محصول نامعتبر است" }, { status: 400 });
    }

    const user = await User.findByIdAndUpdate(
      decoded.userId,
      { $pull: { wishlist: productId } },
      { new: true }
    );
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({ message: "Product removed from wishlist" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
