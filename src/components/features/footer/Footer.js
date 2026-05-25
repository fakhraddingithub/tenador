"use client";

import {
  FiMail,
  FiPhone,
  FiMapPin,
  FiInstagram,
  FiTwitter,
  FiYoutube,
} from "react-icons/fi";
import { FaTelegram } from "react-icons/fa";
import { FOOTER_SECTIONS } from "@/lib/constants";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { toast } from "react-toastify";
import Image from "next/image";

export default function Footer() {
  const handleNewsletterSubmit = (e) => {
    e.preventDefault();
    toast.success("با موفقیت در خبرنامه عضو شدید", {
      position: "top-left",
    });
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
                  عضویت در خبرنامه
                </h3>
                <p className="text-gray-400">
                  از جدیدترین محصولات و تخفیف‌های ویژه با خبر شوید
                </p>
              </div>
              <form onSubmit={handleNewsletterSubmit} className="flex gap-3">
                <Input
                  type="email"
                  placeholder="ایمیل خود را وارد کنید"
                  required
                  className="flex-grow bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-[#aa4725]"
                />
                <Button
                  type="submit"
                  variant="primary"
                  className="bg-[#aa4725] hover:bg-[#c2532d] text-white px-8"
                >
                  عضویت
                </Button>
              </form>
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
                  href: "https://instagram.com",
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
                    <a
                      href={link.href}
                      className="text-gray-400 hover:text-[#aa4725] transition-colors block text-sm"
                    >
                      {link.label}
                    </a>
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
              <a href="/terms" className="hover:text-white transition-colors">
                قوانین و مقررات
              </a>
              <a href="/privacy" className="hover:text-white transition-colors">
                حریم خصوصی
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
