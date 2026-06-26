"use server";

import SlugRegistry from "base/models/SlugRegistery";
import connectToDB from "base/configs/db";

export async function registerSlug({
  slug,
  type,
  model,
  refId,
  filterField,
  filterValue,
  label = null,
  parentSlug = null
}) {
  await connectToDB();

  // اسلاگ دیگر سراسری یکتا نیست؛ هم‌نامی فقط در محدوده‌ی همان موجودیتِ مقصد
  // (type + slug + filterValue) تکراری محسوب می‌شود. این اجازه می‌دهد دو ورزش
  // مختلف هرکدام دسته‌ای با اسلاگ یکسان (مثلاً "racket") ثبت کنند.
  const exists = await SlugRegistry.findOne({ slug, type, filterValue });

  if (exists) return exists;

  const record = await SlugRegistry.create({
    slug,
    type,
    model,
    refId,
    filterField,
    filterValue,
    label,
    parentSlug,
  });

  return record;
}
