"use client";

import { useState, useEffect } from "react";

import { toast } from "react-toastify";

import Swal from "sweetalert2";

import {
  FaPalette,
  FaIdCard,
  FaFont,
  FaQuoteRight,
  FaRocket,
  FaCrown,
  FaCodeBranch,
  FaSync,
  FaArrowRight,
  FaEdit,
  FaStar,
} from "react-icons/fa";

import { useRouter } from "next/navigation";

import ImageUpload from "./ImageUpload";
import SerieSportContentManager from "./SerieSportContentManager";

export default function SerieEditForm({ id,brandId }) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  const [fetching, setFetching] = useState(true);

  const [brandName, setBrandName] = useState("");

  const [parentSeries, setParentSeries] = useState([]);

  const [formData, setFormData] = useState({
    name: "",

    title: "",

    description: "",

    shortDescription: "",

    brand: "",

    parentSerie: "",

    isLimitedEdition: false,

    isNewSerie: false,

    colors: {
      primary: "#000000",

      secondary: "#ffffff",
    },

    logo: "",

    headImage: "",

    image: "",

    sportImages: [],
  });

  /*
   |------------------------------------------------------------------
   | Fetch Data
   |------------------------------------------------------------------
   */

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [serieRes, seriesRes] = await Promise.all([
          fetch(`/api/series/${id}`),

          // منبعِ یکسان با حالتِ ساخت (SerieCreateFlow): کالکشنِ Serie به‌صورتِ
          // مستقیم — نه آرایه‌ی denormalizedِ Brand.series که ممکن است ناقص باشد.
          fetch(`/api/series?brand=${brandId}`),
        ]);

        const serieResult = await serieRes.json();

        const seriesResult = await seriesRes.json();

        if (!serieRes.ok) {
          toast.error("خطا در دریافت اطلاعات سری");

          return;
        }

        const data = serieResult.data || serieResult;

        setFormData({
          name: data?.name || "",

          title: data?.title || "",

          description: data?.description || "",

          shortDescription: data?.shortDescription || "",

          brand: data?.brand?._id || data?.brand || "",

          parentSerie: data?.parentSerie?._id || data?.parentSerie || "",

          isLimitedEdition: data?.isLimitedEdition || false,

          isNewSerie: data?.isNewSerie || false,

          colors: {
            primary: data?.colors?.primary || "#000000",

            secondary: data?.colors?.secondary || "#ffffff",
          },

          logo: data?.logo || "",

          headImage: data?.headImage || "",

          image: data?.image || "",

          sportImages: data?.sportImages || [],
        });

        setBrandName(data?.brand?.title || "");

        // فیلترِ یکسان با حالتِ ساخت: فقط سری‌های ریشه (بدونِ والد) به‌عنوان والدِ مجاز
        const rootSeries =
        seriesResult?.series?.filter(
          (serie) => !serie.parentSerie
        ) || [];

        setParentSeries(
          (rootSeries || []).filter((serie) => serie._id !== id),
        );
      } catch (err) {
        console.error(err);

        toast.error("خطای شبکه");
      } finally {
        setFetching(false);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id, brandId]);

  /*
   |------------------------------------------------------------------
   | Handlers
   |------------------------------------------------------------------
   */

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,

      [name]: type === "checkbox" ? checked : value,
    }));
  };

  /*
   |------------------------------------------------------------------
   | Submit
   |------------------------------------------------------------------
   */

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);

    try {
      const payload = {
        ...formData,

        parentSerie: formData.parentSerie || null,
      };

      const res = await fetch(`/api/series/${id}`, {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (res.ok) {
        Swal.fire({
          headImage: "success",

          title: "ویرایش انجام شد",

          text: `سری ${formData.title} بروزرسانی شد.`,

          confirmButtonColor: "var(--color-primary)",
        }).then(() => {
          router.push(`/p-admin/admin-brands/${formData.brand}`);

          router.refresh();
        });
      } else {
        toast.error(result.error || "خطا در بروزرسانی سری");
      }
    } catch (err) {
      console.error(err);

      toast.error("خطای شبکه؛ اتصال اینترنت را بررسی کنید");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="h-96 flex items-center justify-center flex-col gap-4">
        <FaSync className="animate-spin text-4xl" />

        <p className="text-xs font-bold uppercase">Loading Serie...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Header */}

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center text-[var(--color-primary)] shadow-xl">
            <FaEdit size={22} />
          </div>

          <div>
            <h2 className="text-2xl font-bold italic">ویرایش سری محصولات</h2>

            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">
              Brand:
              <span className="text-black mr-2">{brandName}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => router.push(`/p-admin/admin-brands/${formData.brand}`)}
          className="p-4 bg-gray-100 rounded-2xl"
        >
          <FaArrowRight />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column */}

        <div className="lg:col-span-4 space-y-6">
          {/* Uploads */}

          <div className="bg-white p-6 rounded-[3rem] shadow-sm border border-gray-50 space-y-6">
            <ImageUpload
              label="تصویر هدر"
              value={formData.headImage}
              onChange={(url) =>
                setFormData((p) => ({
                  ...p,

                  headImage: url,
                }))
              }
              folder="series/headImages"
            />

            <div className="grid grid-cols-2 gap-4">
              <ImageUpload
                label="آیکون"
                value={formData.logo}
                onChange={(url) =>
                  setFormData((p) => ({
                    ...p,

                    logo: url,
                  }))
                }
                folder="series/logos"
              />
              <ImageUpload
                label="تصویر اصلی"
                value={formData.image}
                onChange={(url) =>
                  setFormData((p) => ({
                    ...p,

                    image: url,
                  }))
                }
                folder="series/covers"
              />
            </div>
          </div>

          <div className="bg-white p-6 rounded-[3rem] shadow-sm border border-gray-50 space-y-4">
            <h3 className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">
              محتوای اختصاصی هر ورزش
            </h3>

            <p className="text-xs text-gray-400 leading-relaxed">
              برای هر ورزش می‌توانید تصویر اصلی، تصویر هدر، توضیحات و توضیح کوتاه جداگانه ثبت کنید. اگر ورزشی مقدار اختصاصی نداشته باشد، مقدار عمومی سری استفاده می‌شود.
            </p>

            <SerieSportContentManager
              sportImages={formData.sportImages}
              onChange={(sportImages) =>
                setFormData((p) => ({
                  ...p,
                  sportImages,
                }))
              }
            />
          </div>

          {/* Colors */}

          <div className="bg-black p-8 rounded-[3rem] shadow-2xl text-white">
            <h3 className="text-[10px] font-bold uppercase text-gray-500 mb-6 flex items-center gap-2">
              <FaPalette className="text-[var(--color-primary)]" />
              Color Branding
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10">
                <span className="text-xs font-bold text-gray-300">
                  رنگ اصلی
                </span>

                <input
                  type="color"
                  value={formData.colors.primary}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,

                      colors: {
                        ...p.colors,

                        primary: e.target.value,
                      },
                    }))
                  }
                  className="w-10 h-10 bg-transparent border-none cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10">
                <span className="text-xs font-bold text-gray-300">
                  رنگ ثانویه
                </span>

                <input
                  type="color"
                  value={formData.colors.secondary}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,

                      colors: {
                        ...p.colors,

                        secondary: e.target.value,
                      },
                    }))
                  }
                  className="w-10 h-10 bg-transparent border-none cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}

        <div className="lg:col-span-8 space-y-8">
          <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-gray-50 space-y-8">
            {/* Identity */}

            <h3 className="flex items-center gap-3 font-bold text-gray-900 italic uppercase">
              <FaIdCard className="text-blue-500" />
              Identity Info
            </h3>

            {/* Parent Serie */}

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 flex items-center gap-2">
                <FaCodeBranch />
                سری والد
              </label>

              <select
                name="parentSerie"
                value={formData.parentSerie}
                onChange={handleChange}
                className="w-full p-5 bg-gray-50 rounded-2xl outline-none"
              >
                <option value="">بدون والد (Root Serie)</option>

                {parentSeries.map((serie) => (
                  <option key={serie._id} value={serie._id}>
                    {serie.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Limited Edition */}

            <div className="bg-amber-50 border border-amber-100 rounded-3xl p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FaCrown className="text-amber-500" />

                <div>
                  <h4 className="font-bold text-sm">Limited Edition</h4>

                  <p className="text-xs text-gray-500 mt-1">
                    این سری به‌عنوان نسخه محدود ثبت شود
                  </p>
                </div>
              </div>

              <input
                type="checkbox"
                name="isLimitedEdition"
                checked={formData.isLimitedEdition}
                onChange={handleChange}
                className="w-6 h-6"
              />
            </div>

            {/* New Serie */}

            <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FaStar className="text-emerald-500" />

                <div>
                  <h4 className="font-bold text-sm">New</h4>

                  <p className="text-xs text-gray-500 mt-1">
                    این سری به‌عنوان سری جدید در اسلایدر صفحه ورزش نمایش داده شود
                  </p>
                </div>
              </div>

              <input
                type="checkbox"
                name="isNewSerie"
                checked={formData.isNewSerie}
                onChange={handleChange}
                className="w-6 h-6"
              />
            </div>

            {/* Name + Title */}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <FaFont />
                  Name (English Only)
                </label>

                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full p-5 bg-gray-50 rounded-2xl font-bold"
                  placeholder="e.g. Blade-V9"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  عنوان فارسی
                </label>

                <input
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full p-5 bg-gray-50 rounded-2xl font-bold text-right"
                  placeholder="مثلاً بلید نسخه ۹"
                  required
                />
              </div>
            </div>

            {/* Short Description */}

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <FaQuoteRight />
                توضیحات کوتاه
              </label>

              <textarea
                name="shortDescription"
                value={formData.shortDescription}
                onChange={handleChange}
                rows={3}
                className="w-full p-6 bg-gray-50 rounded-[2rem] leading-7 text-sm"
                placeholder="خلاصه کوتاه برای نمایش زیر عنوان سری..."
              />
            </div>

            {/* Description */}

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <FaQuoteRight />
                توضیحات
              </label>

              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={6}
                className="w-full p-8 bg-gray-50 rounded-[2.5rem] leading-8"
                placeholder="توضیحات تخصصی سری..."
              />
            </div>
          </div>

          {/* Submit */}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-8 rounded-[3rem] font-bold text-xl hover:-translate-y-1 transition-all flex items-center justify-center gap-4 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                ذخیره تغییرات
                <FaRocket className="text-[var(--color-primary)]" />
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
