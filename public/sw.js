/* public/sw.js
 *
 * Service Worker تنادور — مدیریت Web Push.
 *
 * - رویداد `push`: payload را می‌خواند و یک نوتیفیکیشن با عنوان/متن/آیکن/URL نشان می‌دهد.
 * - رویداد `notificationclick`: با کلیک کاربر، تب موجود را focus یا تب جدید باز می‌کند و
 *   به URLِ موجود در payload می‌رود (صفحهٔ محصول دست‌دوم).
 * - روی دسکتاپ و موبایل (Chrome/Firefox/Safari iOS که پشتیبانی می‌کنند) کار می‌کند.
 */

// فعال‌سازی فوری SW جدید بدون نیاز به بستن همهٔ تب‌ها
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    // اگر payload متنِ خام بود
    payload = { title: "تنادور", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "تنادور";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/android-chrome-192x192.png",
    badge: payload.badge || "/favicon-32x32.png",
    // روی موبایل خود به‌خود بسته نشود تا کاربر آن را ببیند
    requireInteraction: true,
    dir: "rtl",
    lang: "fa",
    // tag مانع انباشت نوتیفیکیشن‌های تکراری می‌شود؛ یکتا بودنش را تضمین می‌کنیم
    tag: payload.tag || `tenador-${Date.now()}`,
    renotify: true,
    data: {
      url: payload.url || "/second-hand",
      ...(payload.data || {}),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || "/second-hand";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // اگر تبی از سایت باز است، همان را focus کن و به URL هدایت کن
        for (const client of clientList) {
          try {
            const clientUrl = new URL(client.url);
            const target = new URL(targetUrl, self.location.origin);
            if (clientUrl.origin === target.origin && "focus" in client) {
              client.navigate(target.href);
              return client.focus();
            }
          } catch (e) {
            // ادامه به تب بعدی
          }
        }
        // در غیر این صورت یک تب جدید باز کن
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// هندل تغییر/منقضی‌شدن اشتراک توسط مرورگر — تلاش برای ثبت مجدد
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const applicationServerKey = event.oldSubscription?.options?.applicationServerKey;
        const newSub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: newSub.toJSON() }),
        });
      } catch (e) {
        // اگر کلید موجود نبود کاری نمی‌کنیم؛ کاربر در بازدید بعدی دوباره subscribe می‌شود
      }
    })()
  );
});
