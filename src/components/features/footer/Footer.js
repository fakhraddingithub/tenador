"use client";

import { useState, useEffect } from "react";
import { FiMail, FiMapPin, FiPhone } from "react-icons/fi";
import { FOOTER_SOCIAL_PLATFORMS, normalizeSiteFooter, phoneHref } from "@/lib/siteFooter";
import { SOCIAL_ICONS } from "./socialIcons";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Image from "next/image";
import Link from "next/link";

// فوتر در همه‌ی صفحات است؛ sweetalert2 فقط وقتی لازم می‌شود که فرم خبرنامه نتیجه بدهد.
const showAlert = (options) =>
  import("sweetalert2")
    .then(({ default: Swal }) => Swal.fire(options))
    .catch(() => window.alert(options.text));

const isExternal = (href) => /^https?:\/\//i.test(href);

/** محتوا از پنل ادمین می‌آید (services/siteFooter.service.js → layout). */
export default function Footer({ footer: footerProp }) {
  const footer = footerProp ?? normalizeSiteFooter(null);
  const { newsletter, contact } = footer;
  const socials = footer.socials.filter((s) => s.enabled && s.href);
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
      
      showAlert({
        icon: "success",
        title: "عضویت موفق",
        text: "از همراهی شما سپاسگزاریم!",
        confirmButtonColor: "#aa4725", // رنگ تم اصلی
        background: "#20232a",
        color: "#ffffff"
      });

      setEmail("");
    } catch (err) {
      showAlert({
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
                  {isSubscribed ? newsletter.subscribedTitle : newsletter.title}
                </h3>
                <p className="text-[#9da5b3]">
                  {isSubscribed ? newsletter.subscribedDescription : newsletter.description}
                </p>
              </div>

              {!isSubscribed ? (
                <form onSubmit={handleNewsletterSubmit} className="flex gap-3">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={newsletter.placeholder}
                    aria-label={newsletter.placeholder || "ایمیل"}
                    required
                    className="flex-grow bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-[#aa4725]"
                  />
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-[#aa4725] hover:bg-[#c2532d] text-white px-8"
                  >
                    {loading ? "در حال ثبت..." : newsletter.buttonLabel || "عضویت"}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-12">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <div className="mb-6 opacity-90">
              <Image src="/logo/logo.svg" alt="logo" width={120} height={120} />
            </div>
            {footer.description && (
              <p className="text-[#9da5b3] mb-8 leading-relaxed text-sm whitespace-pre-line">
                {footer.description}
              </p>
            )}

            {/* Contact Info — تلفن و آدرس بالای ایمیل */}
            {(contact.phone || contact.address || contact.email) && (
              <ul className="space-y-4">
                {contact.phone && (
                  <li>
                    <a
                      href={phoneHref(contact.phone)}
                      className="flex items-center gap-3 text-gray-300 hover:text-white transition-colors group"
                    >
                      <FiPhone className="text-[#aa4725] shrink-0 group-hover:scale-110 transition-transform" size={20} />
                      {/* globals.css: `* { direction: rtl }` بر dir غلبه می‌کند؛ بدونِ این، «(+98) 991…» به‌هم می‌ریزد */}
                      <span dir="ltr" className="text-sm [direction:ltr] [unicode-bidi:isolate]">{contact.phone}</span>
                    </a>
                  </li>
                )}
                {contact.address && (
                  <li className="flex items-start gap-3 text-gray-300">
                    <FiMapPin className="text-[#aa4725] shrink-0 mt-0.5" size={20} />
                    <span className="text-sm leading-relaxed whitespace-pre-line">{contact.address}</span>
                  </li>
                )}
                {contact.email && (
                  <li>
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-3 text-gray-300 hover:text-white transition-colors group"
                    >
                      <FiMail className="text-[#aa4725] shrink-0 group-hover:scale-110 transition-transform" size={20} />
                      <span dir="ltr" className="text-sm [direction:ltr] [unicode-bidi:isolate]">{contact.email}</span>
                    </a>
                  </li>
                )}
              </ul>
            )}

            {/* Social Media */}
            {socials.length > 0 && (
              <div className="flex flex-wrap gap-5 mt-8">
                {socials.map((social) => {
                  const Icon = SOCIAL_ICONS[social.platform];
                  const label = FOOTER_SOCIAL_PLATFORMS.find((p) => p.key === social.platform)?.label;
                  return (
                    <a
                      key={social.platform}
                      href={social.href}
                      aria-label={`${label} تنادور`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white hover:text-[#e6a18a] transition-all duration-300 ease-in-out transform hover:-translate-y-1"
                    >
                      <Icon size={24} />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Links Columns */}
          {footer.sections.map((section, index) => (
            <div key={index}>
              <h3 className="text-white font-bold mb-6 pb-2 border-b border-[#aa4725] inline-block">
                {section.title}
              </h3>
              <ul className="space-y-4">
                {section.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <Link
                      href={link.href}
                      {...(isExternal(link.href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="text-[#9da5b3] hover:text-[#e6a18a] transition-colors block text-sm"
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
      {footer.copyright && (
        <div className="border-t border-white/5">
          <div className="container mx-auto px-4 py-6">
            <p className="text-center text-xs text-[#9da5b3]">{footer.copyright}</p>
          </div>
        </div>
      )}
    </footer>
  );
}
