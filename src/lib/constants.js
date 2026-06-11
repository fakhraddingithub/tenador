// نرخ سود ماهانه پرداخت اقساطی — هم در ماشین‌حساب کلاینت و هم در اعتبارسنجی سرور استفاده می‌شود
export const INSTALLMENT_MONTHLY_INTEREST_RATE = 0.04;

export const SPORTS_CATEGORIES = [
  { id: 1, name: 'تنیس', slug: 'tennis', image: '/images/tennis.webp' },
  { id: 2, name: 'پدل', slug: 'padel', image: '/images/padel.webp' },
  { id: 3, name: 'اسکواش', slug: 'squash', image: '/images/squash.webp' },
  { id: 4, name: 'بدمینتون', slug: 'badminton', image: '/images/badminton.webp' },
  { id: 5, name: 'پینگ‌پنگ', slug: 'pingpong', image: '/images/pingpong.webp' },
];

export const BRANDS = {
  tennis: ['Wilson', 'Head', 'Babolat', 'Yonex', 'Dunlop', 'Tecnifibre'],
  padel: ['Bullpadel', 'Head', 'Nox', 'Adidas', 'Wilson'],
  squash: ['Dunlop', 'Head', 'Tecnifibre', 'Karakal', 'Prince'],
  badminton: ['Yonex', 'Victor', 'Li-Ning', 'Carlton', 'Forza'],
  pingpong: ['Butterfly', 'Stiga', 'Donic', 'Tibhar', 'Joola'],
};

export const NAVIGATION_ITEMS = [
  { id: 1, label: 'شگفت‌انگیزها', href: '/amazing-offers' },
  { id: 2, label: 'جدیدترین‌ها', href: '/newest' },
  { id: 3, label: 'پرفروش‌ها', href: '/bestsellers' },
];

export const FOOTER_SECTIONS = [
  {
    title: 'دسترسی سریع',
    links: [
      { label: 'درباره ما', href: '/about' },
      { label: 'تماس با ما', href: '/contact' },
      { label: 'قوانین و مقررات', href: '/terms' },
      { label: 'حریم خصوصی', href: '/privacy' },
    ],
  },
  {
    title: 'خدمات مشتریان',
    links: [
      { label: 'پاسخ به پرسش‌های متداول', href: '/faq' },
      { label: 'رویه‌های بازگرداندن کالا', href: '/returns' },
      { label: 'شرایط استفاده', href: '/usage' },
      { label: 'گزارش باگ', href: '/bug-report' },
    ],
  },
  {
    title: 'راهنمای خرید',
    links: [
      { label: 'نحوه ثبت سفارش', href: '/how-to-order' },
      { label: 'رویه ارسال سفارش', href: '/shipping' },
      { label: 'شیوه‌های پرداخت', href: '/payment' },
    ],
  },
];
