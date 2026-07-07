"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Swal from "sweetalert2";

import SerieFormLayout from "./SerieFormLayout";

function buildInitialFormData(initialData, brandId) {
  return {
    name: initialData?.name || "",
    title: initialData?.title || "",
    description: initialData?.description || "",
    shortDescription: initialData?.shortDescription || "",
    brand: brandId,
    parentSerie: initialData?.parentSerie?._id || initialData?.parentSerie || "",
    isLimitedEdition: Boolean(initialData?.isLimitedEdition),
    isNewSerie: Boolean(initialData?.isNewSerie),
    colors: {
      primary: initialData?.colors?.primary || "#000000",
      secondary: initialData?.colors?.secondary || "#ffffff",
    },
    logo: initialData?.logo || "",
    headImage: initialData?.headImage || "",
    image: initialData?.image || "",
    sportImages: Array.isArray(initialData?.sportImages)
      ? initialData.sportImages
      : [],
  };
}

export default function SerieCreateForm({
  initialData,
  brandId,
  brandName,
  parentSeries = [],
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(() =>
    buildInitialFormData(initialData, brandId)
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/series/create", {
        method: "POST",
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
          title: "سری با موفقیت ایجاد شد",
          text: `سری ${formData.title} ایجاد گردید.`,
          confirmButtonColor: "var(--color-primary)",
        }).then(() => {
          router.push(`/p-admin/admin-brands/${brandId}`);
          router.refresh();
        });
      } else {
        toast.error(result.error || "خطا در ثبت سری");
      }
    } catch (error) {
      console.error(error);
      toast.error("خطای شبکه؛ اتصال اینترنت را بررسی کنید");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-7xl pb-16" dir="rtl">
      <SerieFormLayout
        formData={formData}
        setFormData={setFormData}
        brandName={brandName}
        parentSeries={parentSeries}
        loading={loading}
        title="ساخت سری محصولات"
        submitLabel="ثبت سری"
      />
    </form>
  );
}
