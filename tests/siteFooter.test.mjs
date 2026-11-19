import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  DEFAULT_SITE_FOOTER,
  FOOTER_SOCIAL_PLATFORMS,
  normalizeSiteFooter,
  phoneHref,
  validateSiteFooter,
} from "../src/lib/siteFooter.js";

const valid = () => JSON.parse(JSON.stringify(DEFAULT_SITE_FOOTER));

test("nothing saved → defaults; the default content passes its own validator", () => {
  assert.deepEqual(normalizeSiteFooter(null), valid());
  const { footer, errors } = validateSiteFooter(valid());
  assert.deepEqual(errors, []);
  assert.deepEqual(footer, valid());
});

test("a saved empty string hides the field; a missing key falls back to the default", () => {
  const out = normalizeSiteFooter({ description: "", contact: { phone: "۰۲۱-۱۲" } });
  assert.equal(out.description, "");
  assert.equal(out.contact.phone, "۰۲۱-۱۲");
  assert.equal(out.contact.email, DEFAULT_SITE_FOOTER.contact.email);
  assert.equal(out.copyright, DEFAULT_SITE_FOOTER.copyright);
  // sections: [] is "no columns", not "defaults"
  assert.deepEqual(normalizeSiteFooter({ sections: [] }).sections, []);
});

test("socials always come back complete, in platform order, unknown ones dropped", () => {
  const out = normalizeSiteFooter({
    socials: [
      { platform: "youtube", enabled: true, href: "https://youtube.com/x" },
      { platform: "myspace", enabled: true, href: "https://myspace.com" },
    ],
  });
  assert.deepEqual(out.socials.map((s) => s.platform), FOOTER_SOCIAL_PLATFORMS.map((p) => p.key));
  assert.equal(out.socials.find((s) => s.platform === "youtube").href, "https://youtube.com/x");
});

test("validator rejects unsafe or missing links and enabled socials without a URL", () => {
  const f = valid();
  f.sections[0].links.push({ label: "x", href: "javascript:alert(1)" });
  f.sections[1].links.push({ label: "y", href: "//evil.com" });
  f.sections[2].title = "";
  f.socials.find((s) => s.platform === "aparat").enabled = true;
  f.socials.find((s) => s.platform === "linkedin").href = "linkedin.com/x";
  f.contact.email = "nope";
  const { footer, errors } = validateSiteFooter(f);
  assert.equal(footer, null);
  assert.equal(errors.length, 6, errors.join("\n"));
});

test("phone, address, mailto and https links are accepted", () => {
  const f = valid();
  f.contact.phone = "۰۲۱-۸۸۷۷۶۶۵۵";
  f.contact.address = "تهران، خیابان ولیعصر";
  f.sections[0].links.push({ label: "ایمیل", href: "mailto:a@b.co" }, { label: "بیرونی", href: "https://x.com" });
  const { footer, errors } = validateSiteFooter(f);
  assert.deepEqual(errors, []);
  assert.equal(footer.contact.address, "تهران، خیابان ولیعصر");
  assert.equal(phoneHref("۰۲۱-۸۸۷۷۶۶۵۵"), "tel:02188776655");
  assert.equal(phoneHref("+98 21 123"), "tel:+9821123");
});

test("footer renders from config: bottom terms/privacy links gone, copyright centred", () => {
  const src = fs.readFileSync("src/components/features/footer/Footer.js", "utf8");
  assert.doesNotMatch(src, /href="\/terms"|href="\/privacy"/);
  assert.doesNotMatch(src, /تمامی حقوق|فروشگاه تخصصی تجهیزات/);
  assert.match(src, /className="text-center[^"]*">\{footer\.copyright\}/);
  // تلفن و آدرس پیش از ایمیل
  assert.ok(src.indexOf("contact.phone &&") < src.indexOf("contact.email &&"));
  assert.ok(src.indexOf("contact.address &&") < src.indexOf("contact.email &&"));
  // `* { direction: rtl }` در globals.css بر dir="ltr" غلبه می‌کند — «(+98) 991…» برعکس می‌شد
  assert.match(src, /\[direction:ltr\][^"]*">\{contact\.phone\}/);
  const admin = fs.readFileSync("src/components/admin/pages/FooterManager.jsx", "utf8");
  assert.match(admin, /type="tel"\s+dir="ltr"\s+className=\{`\$\{inputClass\} text-left \[direction:ltr\]`\}/);
});
