import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  QUICK_VIEW_REQUIRED_FIELDS,
  mergeRankedWithDisplay,
  missingQuickViewFields,
} from "../src/lib/racketMatch/resultPayload.js";
/**
 * productListing.service.js زنجیره‌ای از `next/cache` را ایمپورت می‌کند و بیرون
 * از باندلِ Next قابل بارگذاری نیست؛ پس قراردادش از روی متنِ خودِ فایل خوانده
 * می‌شود. اگر کسی «gallery» یا «shortDescription» را از projection بردارد،
 * همین تست می‌ترکد — که دقیقاً هدف است.
 */
async function readListingContract() {
  const source = await readFile(
    new URL("../services/productListing.service.js", import.meta.url),
    "utf8",
  );

  const fieldsBlock = source.match(/export const LISTING_FIELDS = \[([\s\S]*?)\]\.join/)?.[1];
  assert.ok(fieldsBlock, "LISTING_FIELDS پیدا نشد");
  const fields = [...fieldsBlock.matchAll(/"([^"]+)"/g)].map((match) => match[1]);

  const populatesBlock = source.match(/export const POPULATES = \[([\s\S]*?)\n\];/)?.[1];
  assert.ok(populatesBlock, "POPULATES پیدا نشد");
  const populates = [...populatesBlock.matchAll(/path:\s*"([^"]+)",\s*select:\s*"([^"]+)"/g)].map(
    ([, path, select]) => ({ path, select }),
  );

  return { fields, populates };
}

/** شکلِ سبکی که موتور تطبیق تولید می‌کند — فقط برای امتیازدهی */
function rankedItem(overrides = {}) {
  return {
    _id: "6a1741f45a75b48c7f4ebb93",
    name: "راکت تنیس ویلسون Blade 98",
    slug: "racket-blade-98",
    mainImage: "https://ik.example/blade.png",
    basePrice: 290,
    specs: { unstrungWeight: 305, headSize: 98 },
    match: { score: 92.9, coverage: 1 },
    rank: 0,
    explanation: { why: ["وزنش با شما جور است."], notes: [] },
    ...overrides,
  };
}

/** شکلِ کاملی که LISTING_FIELDS + POPULATES از دیتابیس می‌دهد */
function displayProduct(overrides = {}) {
  return {
    _id: "6a1741f45a75b48c7f4ebb93",
    name: "راکت تنیس ویلسون Blade 98",
    slug: "racket-blade-98",
    shortDescription: "راکت کنترلی برای بازیکن متوسط تا پیشرفته.",
    mainImage: "https://ik.example/blade.png",
    gallery: ["https://ik.example/blade-1.png", "https://ik.example/blade-2.png"],
    basePrice: 290,
    label: "none",
    brand: { _id: "b1", name: "Wilson", title: "ویلسون", slug: "wilson", icon: "i.png" },
    category: {
      _id: "c1",
      title: "راکت",
      slug: "racket",
      variantAttributes: [{ name: "Grip", label: "شماره گریپ" }],
    },
    sport: { _id: "s1", title: "تنیس", slug: "tennis" },
    serie: { _id: "se1", title: "بلید" },
    attributes: { "Head Size": "98", "Unstrung Weight": "305" },
    variantMeta: {},
    variants: [
      { _id: "v1", sku: "SKU-L2", attributes: { Grip: "L2" }, images: ["g1.png"], stock: 3 },
      { _id: "v2", sku: "SKU-L3", attributes: { Grip: "L3" }, images: [], stock: 1 },
    ],
    basePriceToman: 66_700_000,
    finalPriceToman: 60_000_000,
    discountPercent: 10,
    ...overrides,
  };
}

/* ─────────── خروجی باید کاملِ کامل باشد، نه نسخهٔ خلاصه ─────────── */

test("نتیجهٔ تطبیق همان محصولِ کاملی است که بقیهٔ سایت به نمایش سریع می‌دهد", () => {
  const item = rankedItem();
  const display = new Map([[item._id, displayProduct()]]);

  const merged = mergeRankedWithDisplay(item, display, []);

  assert.deepEqual(missingQuickViewFields(merged), [], "هیچ فیلدی نباید جا بیفتد");

  // دقیقاً همان فیلدهایی که قبلاً در نتایجِ تطبیق خالی بودند
  assert.deepEqual(merged.gallery, ["https://ik.example/blade-1.png", "https://ik.example/blade-2.png"]);
  assert.equal(merged.shortDescription, "راکت کنترلی برای بازیکن متوسط تا پیشرفته.");
  assert.equal(merged.brand.title, "ویلسون", "قبلاً فقط icon برند می‌آمد");
  assert.deepEqual(merged.attributes, { "Head Size": "98", "Unstrung Weight": "305" });
  assert.ok(merged.variantMeta);
  assert.deepEqual(merged.variants[0].images, ["g1.png"], "قبلاً images همیشه خالی بود");
  assert.equal(merged.variants[0].sku, "SKU-L2");
  assert.equal(merged.category.variantAttributes[0].label, "شماره گریپ");
});

test("فیلدهای مخصوصِ تطبیق روی محصولِ کامل حفظ می‌شوند", () => {
  const item = rankedItem({ rank: 1, tradeoff: { axis: "stability", text: "پایدارتر است." } });
  const merged = mergeRankedWithDisplay(item, new Map([[item._id, displayProduct()]]), []);

  assert.equal(merged.match.score, 92.9);
  assert.equal(merged.rank, 1);
  assert.deepEqual(merged.explanation.why, ["وزنش با شما جور است."]);
  assert.equal(merged.tradeoff.axis, "stability");
  assert.equal(merged.specs.headSize, 98);
  // قیمت‌ها از مسیرِ استانداردِ قیمت‌گذاری می‌آیند
  assert.equal(merged.finalPriceToman, 60_000_000);
  assert.equal(merged.discountPercent, 10);
});

test("بهترین گزینه بده‌بستان ندارد و کلیدِ اضافه هم نمی‌گیرد", () => {
  const merged = mergeRankedWithDisplay(
    rankedItem(),
    new Map([[rankedItem()._id, displayProduct()]]),
    [],
  );
  assert.ok(!("tradeoff" in merged));
});

test("اگر محصول بین کش و کوئری غیرفعال شود، نتیجه دور انداخته نمی‌شود", () => {
  const item = rankedItem();
  const merged = mergeRankedWithDisplay(item, new Map(), [{ name: "Grip", label: "شماره گریپ" }]);

  assert.equal(merged._id, item._id);
  assert.equal(merged.match.score, 92.9);
  assert.equal(merged.category.variantAttributes[0].label, "شماره گریپ");
});

test("ورودیِ خالی، خروجیِ خالی می‌دهد", () => {
  assert.equal(mergeRankedWithDisplay(null, new Map(), []), null);
});

test("فیلدِ خالی هم «ناقص» حساب می‌شود", () => {
  const merged = mergeRankedWithDisplay(
    rankedItem(),
    new Map([[rankedItem()._id, displayProduct({ shortDescription: "  ", gallery: null })]]),
    [],
  );
  assert.deepEqual(missingQuickViewFields(merged).sort(), ["gallery", "shortDescription"]);
});

/* ─────────── هم‌سویی با projectionِ رسمیِ سایت ─────────── */

test("هر فیلدی که نمایش سریع می‌خواهد، از همان projectionِ مشترک تأمین می‌شود", async () => {
  const { fields, populates } = await readListingContract();
  const provided = new Set([...fields, ...populates.map((populate) => populate.path), "_id"]);

  for (const field of QUICK_VIEW_REQUIRED_FIELDS) {
    assert.ok(
      provided.has(field),
      `«${field}» در LISTING_FIELDS/POPULATES نیست — یعنی نمایش سریع باز هم ناقص می‌شود`,
    );
  }

  // برچسبِ فارسیِ ویژگی‌های واریانت از populate دستهٔ محصول می‌آید
  const categoryPopulate = populates.find((populate) => populate.path === "category");
  assert.ok(categoryPopulate.select.includes("variantAttributes"));
  // تصاویرِ واریانت باید بیایند، وگرنه سوآچ‌های مودال خالی می‌مانند
  const variantsPopulate = populates.find((populate) => populate.path === "variants");
  assert.ok(variantsPopulate.select.includes("images"));
});

test("سرویسِ تطبیق projectionِ اختصاصی نمی‌سازد و از همان مسیرِ مشترک می‌خواند", async () => {
  const source = await readFile(
    new URL("../services/racketMatch.service.js", import.meta.url),
    "utf8",
  );
  assert.ok(source.includes("LISTING_FIELDS"), "باید از projectionِ رسمی استفاده کند");
  assert.ok(source.includes("POPULATES"));
  assert.ok(source.includes("attachListingPrices"));
  assert.ok(source.includes("export async function loadDisplayProducts"));
});

test("مسیرِ API خروجی را روی محصولِ کامل می‌سازد، نه روی شیءِ سبک", async () => {
  const source = await readFile(
    new URL("../src/app/api/match/racket/route.js", import.meta.url),
    "utf8",
  );
  assert.ok(source.includes("loadDisplayProducts"));
  assert.ok(source.includes("mergeRankedWithDisplay"));
  assert.ok(
    !source.includes("category: { variantAttributes: catalog.variantAttributes }"),
    "ادغامِ دستیِ قبلی باید برداشته شده باشد",
  );
});
