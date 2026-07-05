"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiTrash2 } from "react-icons/fi";

import ImageUpload from "./ImageUpload";

export default function SerieSportImagesManager({ sportImages = [], onChange }) {
  const [sports, setSports] = useState([]);
  const [pendingSportId, setPendingSportId] = useState("");
  const [pendingImage, setPendingImage] = useState("");
  const [pendingHeadImage, setPendingHeadImage] = useState("");

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

  const usedSportIds = new Set(sportImages.map((entry) => String(entry.sport)));
  const availableSports = sports.filter(
    (sport) => !usedSportIds.has(String(sport._id))
  );

  const sportTitle = (sportId) =>
    sports.find((sport) => String(sport._id) === String(sportId))?.title ||
    "ورزش نامشخص";

  const handleAdd = () => {
    if (!pendingSportId || (!pendingImage && !pendingHeadImage)) return;

    onChange([
      ...sportImages,
      {
        sport: pendingSportId,
        image: pendingImage,
        headImage: pendingHeadImage,
      },
    ]);

    setPendingSportId("");
    setPendingImage("");
    setPendingHeadImage("");
  };

  const handleRemove = (sportId) => {
    onChange(
      sportImages.filter((entry) => String(entry.sport) !== String(sportId))
    );
  };

  return (
    <div className="space-y-4">
      {sportImages.length > 0 && (
        <div className="space-y-3">
          {sportImages.map((entry) => (
            <div
              key={String(entry.sport)}
              className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl p-3"
            >
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
                {sportTitle(entry.sport)}
              </span>

              <button
                type="button"
                onClick={() => handleRemove(entry.sport)}
                className="shrink-0 text-red-400 hover:text-red-600 transition-colors p-2"
              >
                <FiTrash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {availableSports.length > 0 && (
        <div className="border-t border-dashed border-gray-200 pt-4 space-y-3">
          <select
            value={pendingSportId}
            onChange={(e) => setPendingSportId(e.target.value)}
            className="w-full text-sm font-bold border border-gray-200 rounded-xl px-3 py-2.5 bg-white"
          >
            <option value="">انتخاب ورزش برای افزودن تصاویر اختصاصی...</option>

            {availableSports.map((sport) => (
              <option key={sport._id} value={sport._id}>
                {sport.title}
              </option>
            ))}
          </select>

          {pendingSportId && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <ImageUpload
                  label="تصویر اصلی این ورزش"
                  value={pendingImage}
                  onChange={setPendingImage}
                  folder="series/sportImages/covers"
                />

                <ImageUpload
                  label="تصویر هدر این ورزش"
                  value={pendingHeadImage}
                  onChange={setPendingHeadImage}
                  folder="series/sportImages/headImages"
                />
              </div>

              <button
                type="button"
                onClick={handleAdd}
                disabled={!pendingImage && !pendingHeadImage}
                className="w-full flex items-center justify-center gap-2 text-xs font-bold text-white bg-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed py-2.5 rounded-xl transition-opacity"
              >
                <FiPlus size={14} /> افزودن به گالری
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
