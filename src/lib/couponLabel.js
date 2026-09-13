export function couponDisplayCode(coupon) {
  const code = coupon?.code || '';
  return coupon?.coachName ? `${code} — ${coupon.coachName}` : code;
}
