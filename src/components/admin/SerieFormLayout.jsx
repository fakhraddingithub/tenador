"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FaArrowRight,
  FaChevronDown,
  FaCodeBranch,
  FaCrown,
  FaFont,
  FaImage,
  FaLayerGroup,
  FaPalette,
  FaPlus,
  FaRocket,
  FaStar,
  FaTrash,
} from "react-icons/fa";

import ImageUpload from "./ImageUpload";

const inputClass =
  "w-full rounded-[6px] border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 outline-none transition focus:border-[var(--color-primary)] focus:bg-white focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-60";

const textareaClass =
  "w-full resize-y rounded-[6px] border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm leading-7 text-gray-900 outline-none transition focus:border-[var(--color-primary)] focus:bg-white focus:ring-2 focus:ring-orange-100";

const uploadClass =
  "!mb-0 [&_button]:rounded-[6px] [&_img]:!h-28 [&_img]:!max-w-full [&_img]:rounded-[6px] [&_input]:rounded-[6px] [&_label]:!mb-1 [&_label]:!text-xs";

function sportIdOf(value) {
  return String(value?._id || value || "");
}

function fieldValue(value) {
  return value || "";
}

function Field({ label, icon: Icon, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center gap-2 text-xs font-bold text-gray-500">
        {Icon ? <Icon className="text-gray-400" /> : null}
        {label}
      </span>
      {children}
    </label>
  );
}

function TextInput({ label, icon, dir = "rtl", ...props }) {
  return (
    <Field label={label} icon={icon}>
      <input {...props} dir={dir} className={inputClass} />
    </Field>
  );
}

function TextareaInput({ label, rows = 3, ...props }) {
  return (
    <Field label={label}>
      <textarea {...props} rows={rows} className={textareaClass} />
    </Field>
  );
}

function CheckboxControl({ label, helper, icon: Icon, checked, onChange }) {
  return (
    <label className="flex h-full cursor-pointer items-center justify-between gap-3 rounded-[6px] border border-gray-200 bg-gray-50 px-3 py-2.5 transition hover:border-gray-300">
      <span className="flex min-w-0 items-center gap-2">
        {Icon ? <Icon className="shrink-0 text-[var(--color-primary)]" /> : null}
        <span className="min-w-0">
          <span className="block text-sm font-bold text-gray-800">{label}</span>
          {helper ? (
            <span className="block truncate text-[11px] text-gray-500">{helper}</span>
          ) : null}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 shrink-0 accent-[var(--color-primary)]"
      />
    </label>
  );
}

function ColorInput({ label, value, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-[6px] border border-gray-200 bg-gray-50 px-3 py-2.5">
      <span className="text-xs font-bold text-gray-600">{label}</span>
      <input
        type="color"
        value={value || "#000000"}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-11 cursor-pointer rounded-[6px] border-0 bg-transparent p-0"
      />
    </label>
  );
}

function AccordionBox({ title, eyebrow, icon: Icon, open, onToggle, actions, badges, children }) {
  return (
    <section className="overflow-hidden rounded-[6px] border border-gray-200 bg-white shadow-sm">
      <div
        className={`flex w-full items-stretch ${
          open ? "border-b border-gray-200" : ""
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-right transition hover:bg-gray-50"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] bg-gray-100 text-[var(--color-primary)]">
              {Icon ? <Icon /> : null}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold text-gray-900">
                {title}
              </span>
              {eyebrow ? (
                <span className="block truncate text-[11px] font-medium text-gray-500">
                  {eyebrow}
                </span>
              ) : null}
            </span>
          </span>

          <span className="flex shrink-0 items-center gap-2">
            {badges}
            <FaChevronDown
              className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </span>
        </button>

        {actions ? (
          <div className="flex shrink-0 items-center px-2">{actions}</div>
        ) : null}
      </div>

      {open ? <div className="p-4">{children}</div> : null}
    </section>
  );
}

function StatusBadges({ isLimitedEdition, isNewSerie }) {
  return (
    <span className="hidden items-center gap-1 sm:flex">
      {isLimitedEdition ? (
        <span className="rounded-[6px] bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">
          Limited
        </span>
      ) : null}
      {isNewSerie ? (
        <span className="rounded-[6px] bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
          New
        </span>
      ) : null}
    </span>
  );
}

function EmptySportState({ availableSports, selectedSport, onSelect, onAdd }) {
  if (availableSports.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-[6px] border border-dashed border-gray-300 bg-white p-3 sm:flex-row">
      <select
        value={selectedSport}
        onChange={(event) => onSelect(event.target.value)}
        className={`${inputClass} sm:flex-1`}
      >
        <option value="">انتخاب ورزش برای افزودن باکس...</option>
        {availableSports.map((sport) => (
          <option key={sport._id} value={sport._id}>
            {sport.title || sport.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={onAdd}
        disabled={!selectedSport}
        className="inline-flex items-center justify-center gap-2 rounded-[6px] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <FaPlus />
        افزودن باکس ورزش
      </button>
    </div>
  );
}

export default function SerieFormLayout({
  formData,
  setFormData,
  brandName,
  parentSeries = [],
  loading = false,
  title = "پیکربندی سری محصولات",
  submitLabel = "ثبت سری",
  onBack,
}) {
  const [sports, setSports] = useState([]);
  const [selectedSport, setSelectedSport] = useState("");
  const [openBoxes, setOpenBoxes] = useState({ default: true });

  const sportImages = Array.isArray(formData?.sportImages)
    ? formData.sportImages
    : [];

  useEffect(() => {
    let mounted = true;

    fetch("/api/sports")
      .then((res) => res.json())
      .then((data) => {
        if (mounted) setSports(data.sports || []);
      })
      .catch((error) => console.error("Error fetching sports:", error));

    return () => {
      mounted = false;
    };
  }, []);

  const usedSportIds = useMemo(
    () => new Set(sportImages.map((entry) => sportIdOf(entry.sport))),
    [sportImages]
  );

  const availableSports = useMemo(
    () => sports.filter((sport) => !usedSportIds.has(String(sport._id))),
    [sports, usedSportIds]
  );

  const toggleBox = (key) => {
    setOpenBoxes((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? false),
    }));
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateColor = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      colors: {
        ...(prev.colors || {}),
        [field]: value,
      },
    }));
  };

  const updateSportEntry = (sportId, patch) => {
    setFormData((prev) => ({
      ...prev,
      sportImages: (prev.sportImages || []).map((entry) =>
        sportIdOf(entry.sport) === sportId ? { ...entry, ...patch } : entry
      ),
    }));
  };

  const removeSportEntry = (sportId) => {
    setFormData((prev) => ({
      ...prev,
      sportImages: (prev.sportImages || []).filter(
        (entry) => sportIdOf(entry.sport) !== sportId
      ),
    }));

    setOpenBoxes((prev) => {
      const next = { ...prev };
      delete next[`sport-${sportId}`];
      return next;
    });
  };

  const addSportEntry = () => {
    if (!selectedSport) return;

    setFormData((prev) => ({
      ...prev,
      sportImages: [
        ...(prev.sportImages || []),
        {
          sport: selectedSport,
          image: "",
          headImage: "",
          description: "",
          shortDescription: "",
          isLimitedEdition: false,
          isNewSerie: false,
        },
      ],
    }));

    setOpenBoxes((prev) => ({ ...prev, [`sport-${selectedSport}`]: true }));
    setSelectedSport("");
  };

  const sportTitle = (entry) => {
    const sportId = sportIdOf(entry.sport);
    return (
      entry.sport?.title ||
      sports.find((sport) => String(sport._id) === sportId)?.title ||
      "ورزش انتخاب‌شده"
    );
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-col gap-3 rounded-[6px] border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] bg-black text-[var(--color-primary)]">
            <FaLayerGroup />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-extrabold text-gray-950">{title}</h2>
            <p className="truncate text-xs font-bold text-gray-500">
              برند: <span className="text-gray-900">{brandName || "-"}</span>
            </p>
          </div>
        </div>

        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="بازگشت"
            className="inline-flex h-10 w-10 items-center justify-center rounded-[6px] border border-gray-200 bg-gray-50 text-gray-700 transition hover:bg-gray-100"
          >
            <FaArrowRight />
          </button>
        ) : null}
      </div>

      <AccordionBox
        title="اطلاعات پیش‌فرض سری"
        eyebrow="برای حالت عمومی و fallback همه ورزش‌ها"
        icon={FaLayerGroup}
        open={openBoxes.default}
        onToggle={() => toggleBox("default")}
        badges={
          <StatusBadges
            isLimitedEdition={formData.isLimitedEdition}
            isNewSerie={formData.isNewSerie}
          />
        }
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(240px,33%)_minmax(0,1fr)]" dir="rtl">
          <div className="min-w-0 space-y-3">
            <ImageUpload
              label="تصویر هدر"
              value={fieldValue(formData.headImage)}
              onChange={(url) => updateField("headImage", url)}
              folder="series/headImages"
              className={uploadClass}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <ImageUpload
                label="تصویر اصلی"
                value={fieldValue(formData.image)}
                onChange={(url) => updateField("image", url)}
                folder="series/covers"
                className={uploadClass}
              />

              <ImageUpload
                label="لوگو"
                value={fieldValue(formData.logo)}
                onChange={(url) => updateField("logo", url)}
                folder="series/logos"
                className={uploadClass}
              />
            </div>
          </div>

          <div className="min-w-0 space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <TextInput
                label="اسم فارسی"
                value={fieldValue(formData.title)}
                onChange={(event) => updateField("title", event.target.value)}
                placeholder="مثلاً بلید نسخه ۹"
                required
              />

              <TextInput
                label="اسم انگلیسی"
                icon={FaImage}
                dir="ltr"
                value={fieldValue(formData.name)}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Blade-V9"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(150px,0.85fr)_minmax(150px,0.85fr)]">
              <Field label="سری والد" icon={FaCodeBranch}>
                <select
                  value={fieldValue(formData.parentSerie)}
                  onChange={(event) => updateField("parentSerie", event.target.value)}
                  className={inputClass}
                >
                  <option value="">بدون والد</option>
                  {parentSeries.map((serie) => (
                    <option key={serie._id} value={serie._id}>
                      {serie.title || serie.name}
                    </option>
                  ))}
                </select>
              </Field>

              <CheckboxControl
                label="Limited Edition"
                helper="نمایش در اسلایدر لیمیتد"
                icon={FaCrown}
                checked={Boolean(formData.isLimitedEdition)}
                onChange={(checked) => updateField("isLimitedEdition", checked)}
              />

              <CheckboxControl
                label="New"
                helper="نمایش در اسلایدر جدید"
                icon={FaStar}
                checked={Boolean(formData.isNewSerie)}
                onChange={(checked) => updateField("isNewSerie", checked)}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
              <TextareaInput
                label="توضیحات کوتاه"
                value={fieldValue(formData.shortDescription)}
                onChange={(event) =>
                  updateField("shortDescription", event.target.value)
                }
                rows={2}
                placeholder="خلاصه کوتاه برای نمایش زیر عنوان سری"
              />

              <div className="space-y-2">
                <span className="flex items-center gap-2 text-xs font-bold text-gray-500">
                  <FaPalette className="text-gray-400" />
                  رنگ‌ها
                </span>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                  <ColorInput
                    label="اصلی"
                    value={formData.colors?.primary || "#000000"}
                    onChange={(value) => updateColor("primary", value)}
                  />
                  <ColorInput
                    label="ثانویه"
                    value={formData.colors?.secondary || "#ffffff"}
                    onChange={(value) => updateColor("secondary", value)}
                  />
                </div>
              </div>
            </div>

            <TextareaInput
              label="توضیحات"
              value={fieldValue(formData.description)}
              onChange={(event) => updateField("description", event.target.value)}
              rows={4}
              placeholder="توضیحات کامل سری"
            />
          </div>
        </div>
      </AccordionBox>

      <EmptySportState
        availableSports={availableSports}
        selectedSport={selectedSport}
        onSelect={setSelectedSport}
        onAdd={addSportEntry}
      />

      <div className="space-y-3">
        {sportImages.map((entry) => {
          const sportId = sportIdOf(entry.sport);
          const boxKey = `sport-${sportId}`;

          return (
            <AccordionBox
              key={sportId}
              title={`اطلاعات ${sportTitle(entry)}`}
              eyebrow="مخصوص همین ورزش"
              icon={FaImage}
              open={Boolean(openBoxes[boxKey])}
              onToggle={() => toggleBox(boxKey)}
              badges={
                <StatusBadges
                  isLimitedEdition={entry.isLimitedEdition}
                  isNewSerie={entry.isNewSerie}
                />
              }
              actions={
                <button
                  type="button"
                  onClick={() => removeSportEntry(sportId)}
                  aria-label="حذف باکس ورزش"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-red-500 transition hover:bg-red-50"
                >
                  <FaTrash />
                </button>
              }
            >
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(240px,33%)_minmax(0,1fr)]" dir="rtl">
                <div className="min-w-0 space-y-3">
                  <ImageUpload
                    label="تصویر هدر این ورزش"
                    value={fieldValue(entry.headImage)}
                    onChange={(url) => updateSportEntry(sportId, { headImage: url })}
                    folder="series/sportImages/headImages"
                    className={uploadClass}
                  />

                  <ImageUpload
                    label="تصویر اصلی این ورزش"
                    value={fieldValue(entry.image)}
                    onChange={(url) => updateSportEntry(sportId, { image: url })}
                    folder="series/sportImages/covers"
                    className={uploadClass}
                  />
                </div>

                <div className="min-w-0 space-y-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <CheckboxControl
                      label="Limited Edition"
                      helper="فقط برای این ورزش"
                      icon={FaCrown}
                      checked={Boolean(entry.isLimitedEdition)}
                      onChange={(checked) =>
                        updateSportEntry(sportId, { isLimitedEdition: checked })
                      }
                    />

                    <CheckboxControl
                      label="New"
                      helper="فقط برای این ورزش"
                      icon={FaStar}
                      checked={Boolean(entry.isNewSerie)}
                      onChange={(checked) =>
                        updateSportEntry(sportId, { isNewSerie: checked })
                      }
                    />
                  </div>

                  <TextareaInput
                    label="توضیحات کوتاه"
                    value={fieldValue(entry.shortDescription)}
                    onChange={(event) =>
                      updateSportEntry(sportId, {
                        shortDescription: event.target.value,
                      })
                    }
                    rows={2}
                    placeholder="خلاصه مخصوص این ورزش"
                  />

                  <TextareaInput
                    label="توضیحات"
                    value={fieldValue(entry.description)}
                    onChange={(event) =>
                      updateSportEntry(sportId, { description: event.target.value })
                    }
                    rows={4}
                    placeholder="توضیحات کامل مخصوص این ورزش"
                  />
                </div>
              </div>
            </AccordionBox>
          );
        })}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-[6px] bg-black px-5 py-4 text-base font-extrabold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <span className="h-6 w-6 rounded-full border-4 border-white/20 border-t-white animate-spin" />
        ) : (
          <>
            {submitLabel}
            <FaRocket className="text-[var(--color-primary)]" />
          </>
        )}
      </button>
    </div>
  );
}
