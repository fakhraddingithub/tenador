import { NextResponse } from 'next/server'
import { verifyToken } from 'base/utils/auth'

// نام‌های دقیقِ تمامِ مسیرهای استاتیکِ سطحِ اول در گروهِ (Site) — یعنی هر مسیری که
// اولین بخشش یکی از این‌ها نباشد، به‌طور قطع متعلق به روتِ داینامیکِ
// [sportSlug] / [sportSlug]/[...slug] است (چون Next همیشه پوشه‌ی استاتیکِ هم‌نام
// را به پوشه‌ی داینامیک ترجیح می‌دهد؛ این لیست همان اولویت را این‌جا هم‌ رعایت می‌کند).
// این لیست باید هر بار که یک مسیرِ سطحِ اولِ جدید به src/app/(Site)/ اضافه شد، به‌روزرسانی شود.
const STATIC_TOP_LEVEL_SEGMENTS = new Set([
  'about', 'about-us', 'articles', 'athletes', 'auth', 'collection', 'compare',
  'contact', 'contact-us', 'faq', 'how-to-order', 'login-register', 'payment',
  'products', 'returns', 'second-hand', 'shipping', 'terms',
])

function isSportOrCategoryPath(pathname) {
  if (pathname === '/' || pathname === '') return false
  const firstSegment = pathname.split('/')[1]
  if (!firstSegment) return false
  if (firstSegment === 'api' || firstSegment === 'p-admin' || firstSegment === 'p-user') return false
  return !STATIC_TOP_LEVEL_SEGMENTS.has(firstSegment)
}

function isProductDetailPath(pathname) {
  return /^\/products\/[^/]+\/?$/.test(pathname)
}

export function middleware(request) {
  const { pathname } = request.nextUrl

  // ── بخشِ ۱: احرازِ هویت — دقیقاً همان منطقِ قبلی، بدونِ هیچ تغییری ──
  const token = request.cookies.get('accessToken')?.value
  const isProtected =
    pathname.startsWith('/p-user') || pathname.startsWith('/p-admin')

  if (!token && isProtected) {
    const loginUrl = new URL('/login-register', request.url)
    loginUrl.searchParams.set(
      'callbackUrl',
      request.nextUrl.pathname + request.nextUrl.search
    )
    return NextResponse.redirect(loginUrl)
  }

  // ── بخشِ ۱.۵ (جدید): اتوریزیشنِ نقش برای پنل ادمین ──
  // ورود به هر مسیرِ زیرِ /p-admin فقط برای کاربرِ با نقشِ "admin" مجاز است.
  // اگر توکن معتبر نبود یا نقشِ کاربر ادمین نبود → صفحه‌ی ۴۰۴ (بدونِ افشای
  // اینکه مسیر واقعاً وجود دارد، دقیقاً طبق درخواست).
  // نکته: این بخش فقط برای مسیرهای زیرِ p-admin اجرا می‌شود؛ رفتارِ /p-user و
  // بقیه‌ی سایت کاملاً دست‌نخورده می‌ماند.
  if (pathname.startsWith('/p-admin') && token) {
    const payload = verifyToken(token)
    if (!payload || payload.role !== 'admin') {
      // مسیرِ مقصد عمداً زیرِ همان /p-admin نگه داشته می‌شود (نه یک مسیرِ سراسریِ
      // جدید) تا با روتِ داینامیکِ فروشگاه ([sportSlug]) تداخل نکند و به‌جای آن
      // مستقیماً به not-found.jsx سراسری برسد؛ بدونِ کوئریِ اضافه به دیتابیس.
      const notFoundUrl = new URL('/p-admin/404-not-authorized', request.url)
      return NextResponse.rewrite(notFoundUrl)
    }
  }

  const response = NextResponse.next()

  // ── بخشِ ۲ (جدید): کشِ CDN برای صفحاتِ پرترافیکِ force-dynamic فروشگاه ──
  // این صفحات به‌دلیلِ یک باگِ Next با اسلاگِ فارسی force-dynamic هستند (کوئری‌های
  // دیتابیس در لایه‌ی سرویس با unstable_cache کش می‌مانند)، اما خودِ HTML هیچ کشِ
  // CDNای نداشت. این بخش صرفاً هدرِ Cache-Control را دستی روی پاسخ می‌گذارد تا
  // Vercel Edge Network بتواند نسخه‌ی کانونیکالِ (بدونِ query-string) این صفحات
  // را کش کند — کاملاً مستقل از مکانیزمِ خودکارِ tag-based کشِ خودِ Next که همان
  // باگ را داشت، پس آن باگ برنمی‌گردد و dynamic="force-dynamic" دست‌نخورده می‌ماند.
  // فقط درخواست‌های بدونِ query-string کش می‌شوند (صفحاتِ فیلترشده با ?attr=... از
  // این کش صرف‌نظر می‌کنند تا محتوای شخصی‌سازی‌شده/فیلترشده هرگز اشتباهی کش نشود).
  const hasNoQueryString = request.nextUrl.search === ''

  if (hasNoQueryString && !isProtected) {
    if (isProductDetailPath(pathname) || isSportOrCategoryPath(pathname)) {
      response.headers.set(
        'Cache-Control',
        'public, s-maxage=3600, stale-while-revalidate=86400'
      )
    }
  }

  return response
}

export const config = {
  // اجرای میدل‌ور روی Node.js runtime (نه Edge) — چون verifyToken از jsonwebtoken
  // استفاده می‌کند که به ماژول‌های Node (crypto) نیاز دارد و در Edge Runtime کار
  // نمی‌کند. از Next 15.5 به بعد این گزینه پشتیبانی می‌شود.
  runtime: 'nodejs',
  matcher: [
    '/p-user/:path*',
    '/p-admin/:path*',
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico|css|js|map)$).*)',
  ],
}
