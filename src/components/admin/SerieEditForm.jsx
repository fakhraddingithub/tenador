"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Swal from "sweetalert2";

import {
  FaSave,
  FaPalette,
  FaIdCard,
  FaFont,
  FaQuoteRight,
  FaEdit,
  FaArrowRight,
  FaSync,
  FaTag,
  FaLayerGroup,
} from "react-icons/fa";

import ImageUpload from "./ImageUpload";

export default function SerieEditPage({ id }) {
  const router = useRouter();

  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);

  const [brandName, setBrandName] = useState("");
  const [allSeries, setAllSeries] = useState([]);

  const [formData, setFormData] = useState({
    name: "",
    title: "",
    description: "",
    brand: "",

    parentSerie: "",

    level: 1,

    tag: null,

    colors: {
      primary: "#000000",
      secondary: "#ffffff",
    },

    logo: "",
    icon: "",
    image: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [serieRes, seriesRes] = await Promise.all([
          fetch(`/api/series/${id}`),
          fetch(`/api/series`)
        ]);

        const serieResult = await serieRes.json();
        const seriesResult = await seriesRes.json();

        if (!serieRes.ok) {
          toast.error("خطا در دریافت اطلاعات سری");
          return;
        }

        const data = serieResult.data || serieResult;

        setFormData({
          ...data,

          brand: data?.brand?._id || "",

          parentSerie: data?.parentSerie?._id || "",

          level: data?.level || 1,

          tag: data?.tag || null,

          colors: data?.colors || {
            primary: "#000000",
            secondary: "#ffffff",
          },
        });

        setBrandName(data?.brand?.title || "");

        setAllSeries(seriesResult?.data || []);
      } catch (err) {
        console.error(err);
        toast.error("خطای شبکه");
      } finally {
        setFetching(false);
      }
    };

    if (id) fetchData();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleColorChange = (type, value) => {
    setFormData((prev) => ({
      ...prev,
      colors: {
        ...prev.colors,
        [type]: value,
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);

    try {
      const res = await fetch(`/api/series/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || "خطا در ذخیره");
        return;
      }

      Swal.fire({
        icon: "success",
        title: "ویرایش انجام شد",
        text: "اطلاعات سری با موفقیت ذخیره شد",
        confirmButtonColor: "black",
      }).then(() => {
        router.push(`/p-admin/admin-brands/${formData.brand}`);
      });
    } catch (err) {
      console.error(err);
      toast.error("خطای سرور");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4">
        <FaSync className="animate-spin text-3xl" />
        <p className="text-xs font-bold uppercase">
          Loading Serie...
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-6xl mx-auto space-y-8 pb-20"
    >
      {/* Header */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex justify-between items-center">
        <div className="flex items-center gap-4 text-right">
          <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center text-white">
            <FaEdit size={22} />
          </div>

          <div>
            <h2 className="text-2xl font-bold">
              ویرایش سری
            </h2>

            <p className="text-xs text-gray-400 mt-1">
              برند: {brandName}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            router.push(`/p-admin/admin-brands/${formData.brand}`)
          }
          className="p-4 bg-gray-100 rounded-2xl"
        >
          <FaArrowRight />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ستون چپ */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-[3rem] shadow-sm border border-gray-50 space-y-6">
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

            <div className="grid grid-cols-2 gap-4">
              <ImageUpload
                label="لوگو"
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
                label="آیکون"
                value={formData.icon}
                onChange={(url) =>
                  setFormData((p) => ({
                    ...p,
                    icon: url,
                  }))
                }
                folder="series/icons"
              />
            </div>
          </div>

          {/* Colors */}
          <div className="bg-black p-8 rounded-[3rem] text-white">
            <h3 className="text-sm font-bold mb-6 flex items-center gap-2">
              <FaPalette />
              رنگ‌بندی
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>رنگ اصلی</span>

                <input
                  type="color"
                  value={formData.colors.primary}
                  onChange={(e) =>
                    handleColorChange("primary", e.target.value)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <span>رنگ ثانویه</span>

                <input
                  type="color"
                  value={formData.colors.secondary}
                  onChange={(e) =>
                    handleColorChange("secondary", e.target.value)
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* ستون راست */}
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-50 space-y-8">
            <h3 className="font-bold flex items-center gap-2">
              <FaIdCard />
              اطلاعات سری
            </h3>

            {/* name + title */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-bold mb-2 block">
                  نام انگلیسی
                </label>

                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full p-4 rounded-2xl bg-gray-50"
                />
              </div>

              <div>
                <label className="text-xs font-bold mb-2 block">
                  عنوان فارسی
                </label>

                <input
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full p-4 rounded-2xl bg-gray-50"
                />
              </div>
            </div>

            {/* parent serie */}
            <div>
              <label className="text-xs font-bold mb-2 flex items-center gap-2">
                <FaLayerGroup />
                سری والد
              </label>

              <select
                name="parentSerie"
                value={formData.parentSerie || ""}
                onChange={handleChange}
                className="w-full p-4 rounded-2xl bg-gray-50"
              >
                <option value="">بدون والد</option>

                {allSeries
                  .filter((s) => s._id !== id)
                  .map((serie) => (
                    <option key={serie._id} value={serie._id}>
                      {serie.title}
                    </option>
                  ))}
              </select>
            </div>

            {/* tag */}
            <div>
              <label className="text-xs font-bold mb-2 flex items-center gap-2">
                <FaTag />
                تگ ویژه
              </label>

              <select
                name="tag"
                value={formData.tag || ""}
                onChange={handleChange}
                className="w-full p-4 rounded-2xl bg-gray-50"
              >
                <option value="">بدون تگ</option>

                <option value="LIMITED_EDITION">
                  LIMITED EDITION
                </option>
              </select>
            </div>

            {/* description */}
            <div>
              <label className="text-xs font-bold mb-2 block">
                توضیحات
              </label>

              <textarea
                name="description"
                rows={8}
                value={formData.description}
                onChange={handleChange}
                className="w-full p-6 rounded-[2rem] bg-gray-50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-6 rounded-[2rem] font-bold"
          >
            {loading ? "در حال ذخیره..." : "ذخیره تغییرات"}
          </button>
        </div>
      </div>
    </form>
  );
}