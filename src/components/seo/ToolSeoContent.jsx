const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com").replace(
  /\/+$/,
  "",
);

const TOOL_CONTENT = {
  match: {
    name: "ابزار مچ و انتخاب محصول تنادور",
    heading: "مچ محصول؛ انتخاب دقیق‌تر بر اساس مشخصات فنی",
    description:
      "در ابزار مچ تنادور، محصول فعلی و اولویت‌های خود را مشخص می‌کنید تا گزینه‌های نزدیک‌تر به نیازتان بر اساس مشخصات فنی پیدا شوند.",
    steps: [
      "دسته‌بندی محصول موردنظر را انتخاب کنید.",
      "محصول فعلی یا ویژگی‌های مهم برای خودتان را مشخص کنید.",
      "پیشنهادهای نزدیک را بررسی کنید و برای تصمیم نهایی، مشخصات و قیمت هر محصول را ببینید.",
    ],
    faqs: [
      {
        question: "ابزار مچ محصول تنادور چه کاری انجام می‌دهد؟",
        answer:
          "این ابزار مشخصات فنی و اولویت‌های انتخابی شما را بررسی می‌کند و محصولات نزدیک‌تر به نیازتان را برای بررسی بیشتر پیشنهاد می‌دهد.",
      },
      {
        question: "نتیجه مچ محصول به معنی بهترین انتخاب قطعی است؟",
        answer:
          "خیر. نتیجه، پیشنهاد فنی برای محدودکردن گزینه‌هاست و بهتر است پیش از خرید، توضیحات کامل محصول، قیمت و شرایط استفاده خود را نیز بررسی کنید.",
      },
      {
        question: "برای استفاده از مچ محصول باید ثبت‌نام کنم؟",
        answer:
          "خیر. می‌توانید بدون ثبت‌نام از ابزار مچ استفاده کنید و پیشنهادها را ببینید.",
      },
    ],
  },
  compare: {
    name: "ابزار مقایسه محصولات تنادور",
    heading: "مقایسه محصولات؛ بررسی تفاوت‌ها در یک نگاه",
    description:
      "با ابزار مقایسه تنادور می‌توانید محصولات هم‌دسته را کنار هم قرار دهید و تفاوت مشخصات فنی آن‌ها را در جدول و نمودار بررسی کنید.",
    steps: [
      "دسته‌بندی موردنظر را انتخاب کنید.",
      "محصولاتی را که بین آن‌ها مردد هستید به مقایسه اضافه کنید.",
      "مشخصات، تفاوت‌ها و نمودار مقایسه را بررسی کنید و سپس وارد صفحه هر محصول شوید.",
    ],
    faqs: [
      {
        question: "چه محصولاتی را می‌توانم با هم مقایسه کنم؟",
        answer:
          "محصولات یک دسته‌بندی که اطلاعات فنی قابل مقایسه دارند در این ابزار نمایش داده می‌شوند.",
      },
      {
        question: "نمودار مقایسه بر چه اساسی ساخته می‌شود؟",
        answer:
          "نمودار از مشخصات فنی ثبت‌شده برای محصولات همان دسته‌بندی استفاده می‌کند تا تفاوت گزینه‌ها خواناتر شود.",
      },
      {
        question: "آیا قیمت محصول هم در مقایسه نمایش داده می‌شود؟",
        answer:
          "در صورت ثبت قیمت و موجودبودن اطلاعات محصول، قیمت در کنار مشخصات آن نمایش داده می‌شود؛ برای اطلاعات نهایی صفحه محصول را بررسی کنید.",
      },
    ],
  },
};

export default function ToolSeoContent({ type, categoryTitle, canonicalPath }) {
  const content = TOOL_CONTENT[type];
  if (!content) return null;

  const url = `${SITE_URL}${canonicalPath}`;
  const description = categoryTitle
    ? `${content.description} این صفحه برای انتخاب و بررسی ${categoryTitle} تنظیم شده است.`
    : content.description;
  const name = categoryTitle ? `${content.name} برای ${categoryTitle}` : content.name;
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name,
      url,
      description,
      applicationCategory: "ShoppingApplication",
      operatingSystem: "Any",
      inLanguage: "fa-IR",
      isAccessibleForFree: true,
      provider: {
        "@type": "Organization",
        name: "تنادور",
        url: SITE_URL,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: content.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
        }}
      />
      <section
        className="mx-auto w-full max-w-[1440px] px-4 pb-12 pt-6 lg:px-8"
        aria-labelledby={`${type}-seo-heading`}
      >
        <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-7">
          <h2
            id={`${type}-seo-heading`}
            className="mb-3 text-xl font-black text-gray-900 md:text-2xl"
          >
            {categoryTitle
              ? `${content.heading} برای ${categoryTitle}`
              : content.heading}
          </h2>
          <p className="leading-8 text-gray-600">{description}</p>

          <ol className="mt-5 grid gap-3 md:grid-cols-3">
            {content.steps.map((step, index) => (
              <li
                key={step}
                className="rounded-xl bg-gray-50 p-4 leading-7 text-gray-700"
              >
                <span className="ml-2 font-black text-primary">
                  {index + 1}.
                </span>
                {step}
              </li>
            ))}
          </ol>

          <div className="mt-7">
            <h3 className="mb-3 text-lg font-black text-gray-900">
              پرسش‌های متداول
            </h3>
            <div className="grid gap-3">
              {content.faqs.map((faq) => (
                <details
                  key={faq.question}
                  className="rounded-xl border border-gray-100 px-4 py-3"
                >
                  <summary className="cursor-pointer font-bold text-gray-800">
                    {faq.question}
                  </summary>
                  <p className="pt-3 leading-7 text-gray-600">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
