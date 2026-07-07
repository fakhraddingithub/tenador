"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FaSync } from "react-icons/fa";
import { toast } from "react-toastify";
import Swal from "sweetalert2";

import SerieFormLayout from "./SerieFormLayout";

const emptyFormData = {
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
};

function buildFormData(data) {
  return {
    name: data?.name || "",
    title: data?.title || "",
    description: data?.description || "",
    shortDescription: data?.shortDescription || "",
    brand: data?.brand?._id || data?.brand || "",
    parentSerie: data?.parentSerie?._id || data?.parentSerie || "",
    isLimitedEdition: Boolean(data?.isLimitedEdition),
    isNewSerie: Boolean(data?.isNewSerie),
    colors: {
      primary: data?.colors?.primary || "#000000",
      secondary: data?.colors?.secondary || "#ffffff",
    },
    logo: data?.logo || "",
    headImage: data?.headImage || "",
    image: data?.image || "",
    sportImages: Array.isArray(data?.sportImages) ? data.sportImages : [],
  };
}

export default function SerieEditForm({ id, brandId }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [brandName, setBrandName] = useState("");
  const [parentSeries, setParentSeries] = useState([]);
  const [formData, setFormData] = useState(emptyFormData);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [serieRes, seriesRes] = await Promise.all([
          fetch(`/api/series/${id}`),
          fetch(`/api/series?brand=${brandId}`),
        ]);

        const serieResult = await serieRes.json();
        const seriesResult = await seriesRes.json();

        if (!serieRes.ok) {
          toast.error("خطا در دریافت اطلاعات سری");
          return;
        }

        const data = serieResult.data || serieResult;

        setFormData(buildFormData(data));
        setBrandName(data?.brand?.title || "");

        const rootSeries =
          seriesResult?.series?.filter((serie) => !serie.parentSerie) || [];

        setParentSeries(
          rootSeries.filter((serie) => String(serie._id) !== String(id))
        );
      } catch (error) {
        console.error(error);
        toast.error("خطای شبکه");
      } finally {
        setFetching(false);
      }
    };

    if (id) fetchData();
  }, [id, brandId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/series/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          parentSerie: formData.parentSerie || null,
        }),
      });

      const result = await res.json();

      if (res.ok) {
        Swal.fire({
          icon: "success",
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
    } catch (error) {
      console.error(error);
      toast.error("خطای شبکه؛ اتصال اینترنت را بررسی کنید");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <FaSync className="animate-spin text-4xl" />
        <p className="text-xs font-bold">در حال بارگذاری سری...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-7xl pb-16" dir="rtl">
      <SerieFormLayout
        formData={formData}
        setFormData={setFormData}
        brandName={brandName}
        parentSeries={parentSeries}
        loading={loading}
        title="ویرایش سری محصولات"
        submitLabel="ذخیره تغییرات"
        onBack={() => router.push(`/p-admin/admin-brands/${formData.brand}`)}
      />
    </form>
  );
}
