import connectToDB from "base/configs/db";
import Athlete from "base/models/Athlete";
import Sport from "base/models/Sport";
import { NextResponse } from "next/server";

// GET: دریافت جزئیات یک ورزشکار
export async function GET(req, { params }) {
  try {
    await connectToDB();
    const { athleteId } = await params;
    
    const athlete = await Athlete.findById(athleteId).populate('sport');
    
    if (!athlete) {
      return NextResponse.json({ error: "ورزشکار پیدا نشد" }, { status: 404 });
    }

    return NextResponse.json({ athlete });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: به‌روزرسانی اطلاعات ورزشکار
export async function PUT(req, { params }) {
  try {
    await connectToDB();
    const { athleteId } = await params;
    const body = await req.json();

    // استخراج تمام فیلدها از body
    const { 
      name, title, sport, birthDate, gender, nationality, 
      bio, photo, height, weight, honors, sponsors 
    } = body;

    const athlete = await Athlete.findById(athleteId);
    if (!athlete) {
      return NextResponse.json({ error: "ورزشکار پیدا نشد" }, { status: 404 });
    }

    /* --- اعمال تغییرات --- */

    if (name?.trim()) athlete.name = name.trim();
    if (title?.trim()) athlete.title = title.trim();
    
    if (sport) {
      const sportFound = await Sport.findById(sport);
      if (!sportFound) {
        return NextResponse.json({ error: "ورزش مورد نظر یافت نشد" }, { status: 404 });
      }
      athlete.sport = sport;
    }

    if (birthDate !== undefined) athlete.birthDate = birthDate ? new Date(birthDate) : null;
    if (nationality !== undefined) athlete.nationality = nationality;
    if (gender !== undefined) athlete.gender = gender;
    if (bio !== undefined) athlete.bio = bio;
    if (photo !== undefined) athlete.photo = photo;

    // فیلدهای جدید
    if (height !== undefined) athlete.height = height;
    if (weight !== undefined) athlete.weight = weight;
    if (honors !== undefined) athlete.honors = Array.isArray(honors) ? honors : athlete.honors;
    if (sponsors !== undefined) athlete.sponsors = Array.isArray(sponsors) ? sponsors : athlete.sponsors;

    // متد save باعث اجرای Middleware (تولید اسلاگ جدید) می‌شود
    await athlete.save();

    return NextResponse.json({
      message: "ورزشکار با موفقیت به‌روزرسانی شد",
      athlete,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: حذف ورزشکار
export async function DELETE(req, { params }) {
  try {
    await connectToDB();
    const { athleteId } = await params;
    
    // نکته: اگر اسلاگ را در جای دیگری (مثل جدول Slugs) ذخیره کرده‌اید، 
    // بهتر است ابتدا رکورد را پیدا کنید، اسلاگ را حذف کنید و بعد ورزشکار را.
    const athlete = await Athlete.findByIdAndDelete(athleteId);
    
    if (!athlete) {
      return NextResponse.json({ error: "ورزشکار پیدا نشد" }, { status: 404 });
    }

    return NextResponse.json({ message: "ورزشکار با موفقیت حذف شد" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}