"use client";

import { useState, useEffect } from "react";
import { FiMail, FiInstagram, FiTwitter, FiYoutube } from "react-icons/fi";
import { FaTelegram } from "react-icons/fa";
import { FOOTER_SECTIONS } from "@/lib/constants";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Swal from "sweetalert2";
import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // بررسی وضعیت کوکی هنگام لود شدن صفحه
  useEffect(() => {
    const cookies = document.cookie.split("; ");
    const hasSubscribed = cookies.find((row) => row.startsWith("newsletter_subscribed="));
    if (hasSubscribed) {
      setIsSubscribed(true);
    }
  }, []);

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "خطایی رخ داد");

      setIsSubscribed(true);
      
      Swal.fire({
        icon: "success",
        title: "عضویت موفق",
        text: "از همراهی شما سپاسگزاریم!",
        confirmButtonColor: "#aa4725", // رنگ تم اصلی
        background: "#20232a",
        color: "#ffffff"
      });

      setEmail("");
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "خطا",
        text: err.message,
        confirmButtonColor: "#aa4725",
        background: "#20232a",
        color: "#ffffff"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <footer className="bg-[#20232ae6] text-white border-t border-white/10">
      {/* Newsletter Section */}
      <div className="border-b border-white/5">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-2xl font-bold mb-2 text-white">
                  {isSubscribed ? "شما عضو خبرنامه هستید" : "عضویت در خبرنامه"}
                </h3>
                <p className="text-gray-400">
                  {isSubscribed 
                    ? "از اینکه ما را دنبال می‌کنید سپاسگزاریم." 
                    : "از جدیدترین محصولات و تخفیف‌های ویژه با خبر شوید"}
                </p>
              </div>

              {!isSubscribed ? (
                <form onSubmit={handleNewsletterSubmit} className="flex gap-3">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ایمیل خود را وارد کنید"
                    required
                    className="flex-grow bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-[#aa4725]"
                  />
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-[#aa4725] hover:bg-[#c2532d] text-white px-8"
                  >
                    {loading ? "در حال ثبت..." : "عضویت"}
                  </Button>
                </form>
              ) : (
                <div className="flex items-center justify-center p-4 bg-green-900/20 border border-green-500/30 rounded-2xl text-green-500 font-bold">
                  ✓ با موفقیت اشتراک فعال شد
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Main Footer Content */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <div className="mb-6 opacity-90">
              <Image src="/logo/logo.svg" alt="logo" width={120} height={120} />
            </div>
            <p className="text-gray-400 mb-8 leading-relaxed text-sm">
              فروشگاه تخصصی تجهیزات ورزش‌های راکتی در ایران. ارائه‌دهنده محصولات
              اصل و با کیفیت برندهای معتبر جهانی با بهترین قیمت و خدمات پس از
              فروش.
            </p>

            {/* Contact Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-gray-300 hover:text-white transition-colors group">
                <FiMail
                  className="text-[#aa4725] group-hover:scale-110 transition-transform"
                  size={20}
                />
                <span className="text-sm">info.tenador@gmail.com</span>
              </div>
            </div>

            {/* Social Media */}
            <div className="flex gap-5 mt-8">
              {[
                {
                  icon: <FiInstagram size={24} />,
                  href: "https://www.instagram.com/tenador.shop",
                },
                {
                  icon: <FaTelegram size={24} />,
                  href: "https://telegram.org",
                },
                { icon: <FiTwitter size={24} />, href: "https://twitter.com" },
                { icon: <FiYoutube size={24} />, href: "https://youtube.com" },
              ].map((social, idx) => (
                <a
                  key={idx}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white hover:text-[#aa4725] transition-all duration-300 ease-in-out transform hover:-translate-y-1"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Footer Links Columns */}
          {FOOTER_SECTIONS.map((section, index) => (
            <div key={index}>
              <h3 className="text-white font-bold mb-6 pb-2 border-b border-[#aa4725] inline-block">
                {section.title}
              </h3>
              <ul className="space-y-4">
                {section.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <Link
                      href={link.href}
                      className="text-gray-400 hover:text-[#aa4725] transition-colors block text-sm"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-white/5">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
            <p>© ۲۰۲۶ تمامی حقوق برای فروشگاه محفوظ است.</p>
            <div className="flex gap-6">
              <Link href="/terms" className="hover:text-white transition-colors">
                قوانین و مقررات
              </Link>
              <Link href="/privacy" className="hover:text-white transition-colors">
                حریم خصوصی
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
