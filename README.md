tenador shop project

## Microsoft Clarity

پکیج رسمی `@microsoft/clarity` در layout فروشگاه، بعد از hydration بارگذاری می‌شود.
این اتصال صفحات گروه `(Site)` را پوشش می‌دهد؛ پنل مدیریت و داشبورد کاربر تحت پوشش نیستند.
در حالت توسعه (`npm run dev`) یا بدون شناسهٔ پروژه، Clarity اجرا نمی‌شود.

1. در [Microsoft Clarity](https://clarity.microsoft.com/) پروژهٔ سایت را بسازید و از Settings → Overview شناسهٔ پروژه را بردارید.
2. متغیر زیر را در `.env` برای اجرای محلی production و در تنظیمات محیط Production هاست (مثلاً Vercel) وارد کنید:

   ```dotenv
   NEXT_PUBLIC_CLARITY_PROJECT_ID=your_project_id
   ```

3. دوباره build و deploy کنید؛ متغیرهای `NEXT_PUBLIC_*` هنگام build در کد مرورگر قرار می‌گیرند. برای آزمایش محلی از `npm run build` و سپس `npm start` استفاده کنید.
4. سایت را باز کنید و در Network مرورگر بارگذاری `clarity.ms/tag/<project-id>` و درخواست‌های `collect` را بررسی کنید؛ سپس Dashboard و Recordings پروژهٔ Clarity را ببینید. مسدودکننده‌های تبلیغات ممکن است این درخواست‌ها را مسدود کنند.

شناسه را در محیط Preview تنظیم نکنید تا بازدیدهای آزمایشی وارد آمار اصلی نشوند.
این اتصال رضایت کاربر برای کوکی را خودکار اعلام نمی‌کند؛ در صورت فعال‌کردن نیاز به consent در Clarity، سیگنال آن باید از جریان رضایت کاربر ارسال شود.

راهنمای رسمی: [نصب و بررسی اتصال Clarity](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-setup).
