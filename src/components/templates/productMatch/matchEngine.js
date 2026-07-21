// موتور یافتن نزدیک‌ترین محصول — منطق خالص، بدون وابستگی به React/Next
/**
 * @param {Object} targetStats        - { [statName]: number } مقادیر فعلی اسلایدرها
 * @param {Array}  candidateProducts  - [{ _id, technicalStats, ... }]
 * @param {Array}  categoryStats      - [{ name, min, max }] از category.technicalStats
 * @param {String} excludeId          - آیدی محصول پایه (از نتایج حذف می‌شود)
 * @param {Number} topN               - پیش‌فرض 3
 * @returns {Array} مرتب‌شده صعودی بر اساس فاصله، هر عضو { product, distance, diffs }
 */
export function findClosestProducts({ targetStats, candidateProducts, categoryStats, excludeId, topN = 3 }) {
  const usableStats = categoryStats.filter(
    (s) => Number.isFinite(s.min) && Number.isFinite(s.max) && s.max > s.min
  );

  const scored = candidateProducts
    .filter((p) => String(p._id) !== String(excludeId))
    .map((p) => {
      let sumSq = 0;
      let dims = 0;
      const diffs = {};
      for (const s of usableStats) {
        const pv = p.technicalStats?.[s.name];
        const tv = targetStats?.[s.name];
        if (!Number.isFinite(pv) || !Number.isFinite(tv)) continue; // این محور نادیده گرفته می‌شود، جریمه نمی‌شود
        const normP = (pv - s.min) / (s.max - s.min);
        const normT = (tv - s.min) / (s.max - s.min);
        const d = normP - normT;
        sumSq += d * d;
        dims += 1;
        diffs[s.name] = pv - tv; // اختلاف خام برای نمایش
      }
      if (dims === 0) return null; // بدون محور مشترک → حذف کامل
      const distance = Math.sqrt(sumSq / dims);
      const matchPercent = Math.round((1 - Math.min(distance, 1)) * 100);
      return { product: p, distance, matchPercent, diffs };
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance);

  return scored.slice(0, topN);
}

// جداسازی نام دوزبانه — همان منطق QuickViewModal (برند و عنوان)
export function splitBilingualName(name = "") {
  const match = name.match(/[a-zA-Z\(].*/);
  const farsi = match ? name.substring(0, match.index).trim() : name;
  const english = match ? match[0].trim() : "";
  return { farsi, english };
}
