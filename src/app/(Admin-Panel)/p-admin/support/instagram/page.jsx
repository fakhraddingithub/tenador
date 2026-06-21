import InstagramInbox from "@/components/admin/support/InstagramInbox";

export const metadata = {
  title: "پشتیبانی اینستاگرام | پنل مدیریت تنادور",
  description: "خواندن و پاسخ به دایرکت‌های اینستاگرام از داخل پنل مدیریت",
};

// داده‌ها سمت کلاینت با پولینگ واکشی می‌شوند؛ این صفحه نباید استاتیک شود
export const dynamic = "force-dynamic";

export default function InstagramSupportPage() {
  return <InstagramInbox />;
}
