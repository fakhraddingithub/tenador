"use client";

import { useEffect, useMemo, useState } from "react";
import { FiPlus, FiTrash2 } from "react-icons/fi";

import ImageUpload from "./ImageUpload";

function sportIdOf(value) {
  return String(value?._id || value || "");
}

function hasText(value) {
  return typeof value === "string" && value.trim() !== "";
}

function hasAnyContent(entry) {
  return Boolean(
    entry.image ||
      entry.headImage ||
      hasText(entry.description) ||
      hasText(entry.shortDescription)
  );
}

export default function SerieSportContentManager({
  sportImages = [],
  onChange,
}) {
  const [sports, setSports] = useState([]);
  const [pending, setPending] = useState({
    sport: "",
    image: "",
    headImage: "",
    description: "",
    shortDescription: "",
  });

  useEffect(() => {
    let mounted = true;

    fetch("/api/sports")
      .then((res) => res.json())
      .then((data) => {
        if (mounted) setSports(data.sports || []);
      })
      .catch((err) => console.error("Error fetching sports:", err));

    return () => {
      mounted = false;
    };
  }, []);

  const usedSportIds = useMemo(
    () => new Set(sportImages.map((entry) => sportIdOf(entry.sport))),
    [sportImages]
  );

  const availableSports = sports.filter(
    (sport) => !usedSportIds.has(String(sport._id))
  );

  const sportTitle = (entry) => {
    const sportId = sportIdOf(entry.sport);
    return (
      entry.sport?.title ||
      sports.find((sport) => String(sport._id) === sportId)?.title ||
      "ورزش نامشخص"
    );
  };

  const setPendingField = (field, value) => {
    setPending((prev) => ({ ...prev, [field]: value }));
  };

  const handleAdd = () => {
    if (!pending.sport || !hasAnyContent(pending)) return;

    onChange([
      ...sportImages,
      {
        sport: pending.sport,
        image: pending.image,
        headImage: pending.headImage,
        description: pending.description,
        shortDescription: pending.shortDescription,
      },
    ]);

    setPending({
      sport: "",
      image: "",
      headImage: "",
      description: "",
      shortDescription: "",
    });
  };

  const handleUpdate = (sportId, patch) => {
    onChange(
      sportImages.map((entry) =>
        sportIdOf(entry.sport) === sportId ? { ...entry, ...patch } : entry
      )
    );
  };

  const handleRemove = (sportId) => {
    onChange(sportImages.filter((entry) => sportIdOf(entry.sport) !== sportId));
  };

  return (
    <div className="space-y-5">
      {sportImages.length > 0 && (
        <div className="space-y-4">
          {sportImages.map((entry) => {
            const sportId = sportIdOf(entry.sport);

            return (
              <div
                key={sportId}
                className="space-y-4 bg-gray-50 border border-gray-100 rounded-2xl p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex gap-2 shrink-0">
                    {entry.image && (
                      <img
                        src={entry.image}
                        alt=""
                        className="w-12 h-12 object-cover rounded-xl border border-gray-200"
                      />
                    )}

                    {entry.headImage && (
                      <img
                        src={entry.headImage}
                        alt=""
                        className="w-12 h-12 object-cover rounded-xl border border-gray-200"
                      />
                    )}
                  </div>

                  <span className="flex-1 text-sm font-bold text-gray-700 truncate">
                    {sportTitle(entry)}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleRemove(sportId)}
                    className="shrink-0 text-red-400 hover:text-red-600 transition-colors p-2"
                    aria-label="حذف محتوای این ورزش"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ImageUpload
                    label="تصویر اصلی این ورزش"
                    value={entry.image || ""}
                    onChange={(url) => handleUpdate(sportId, { image: url })}
                    folder="series/sportImages/covers"
                  />

                  <ImageUpload
                    label="تصویر هدر این ورزش"
                    value={entry.headImage || ""}
                    onChange={(url) =>
                      handleUpdate(sportId, { headImage: url })
                    }
                    folder="series/sportImages/headImages"
                  />
                </div>

                <textarea
                  value={entry.shortDescription || ""}
                  onChange={(e) =>
                    handleUpdate(sportId, {
                      shortDescription: e.target.value,
                    })
                  }
                  rows={2}
                  className="w-full text-sm leading-7 bg-white border border-gray-100 rounded-xl px-4 py-3 outline-none focus:border-[var(--color-primary)]"
                  placeholder="توضیح کوتاه مخصوص این ورزش"
                />

                <textarea
                  value={entry.description || ""}
                  onChange={(e) =>
                    handleUpdate(sportId, { description: e.target.value })
                  }
                  rows={4}
                  className="w-full text-sm leading-8 bg-white border border-gray-100 rounded-xl px-4 py-3 outline-none focus:border-[var(--color-primary)]"
                  placeholder="توضیحات کامل مخصوص این ورزش"
                />
              </div>
            );
          })}
        </div>
      )}

      {availableSports.length > 0 && (
        <div className="border-t border-dashed border-gray-200 pt-4 space-y-3">
          <select
            value={pending.sport}
            onChange={(e) => setPendingField("sport", e.target.value)}
            className="w-full text-sm font-bold border border-gray-200 rounded-xl px-3 py-2.5 bg-white"
          >
            <option value="">انتخاب ورزش برای افزودن محتوای اختصاصی...</option>

            {availableSports.map((sport) => (
              <option key={sport._id} value={sport._id}>
                {sport.title}
              </option>
            ))}
          </select>

          {pending.sport && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ImageUpload
                  label="تصویر اصلی این ورزش"
                  value={pending.image}
                  onChange={(url) => setPendingField("image", url)}
                  folder="series/sportImages/covers"
                />

                <ImageUpload
                  label="تصویر هدر این ورزش"
                  value={pending.headImage}
                  onChange={(url) => setPendingField("headImage", url)}
                  folder="series/sportImages/headImages"
                />
              </div>

              <textarea
                value={pending.shortDescription}
                onChange={(e) =>
                  setPendingField("shortDescription", e.target.value)
                }
                rows={2}
                className="w-full text-sm leading-7 bg-white border border-gray-100 rounded-xl px-4 py-3 outline-none focus:border-[var(--color-primary)]"
                placeholder="توضیح کوتاه مخصوص این ورزش"
              />

              <textarea
                value={pending.description}
                onChange={(e) => setPendingField("description", e.target.value)}
                rows={4}
                className="w-full text-sm leading-8 bg-white border border-gray-100 rounded-xl px-4 py-3 outline-none focus:border-[var(--color-primary)]"
                placeholder="توضیحات کامل مخصوص این ورزش"
              />

              <button
                type="button"
                onClick={handleAdd}
                disabled={!hasAnyContent(pending)}
                className="w-full flex items-center justify-center gap-2 text-xs font-bold text-white bg-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed py-2.5 rounded-xl transition-opacity"
              >
                <FiPlus size={14} /> افزودن محتوای ورزش
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
