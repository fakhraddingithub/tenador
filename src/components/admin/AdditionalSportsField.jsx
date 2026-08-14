"use client";

export default function AdditionalSportsField({
  sports = [],
  ownerSportId,
  value = [],
  onChange,
}) {
  const selectedIds = new Set((value || []).map(String));
  const options = sports.filter((sport) => String(sport._id) !== String(ownerSportId));

  const toggleSport = (sportId) => {
    const id = String(sportId);
    const next = selectedIds.has(id)
      ? (value || []).filter((item) => String(item) !== id)
      : [...(value || []), id];
    onChange(next);
  };

  return (
    <fieldset className="mb-6 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
      <legend className="px-2 text-sm font-bold text-neutral-800">
        نمایش در ورزش‌های دیگر
      </legend>
      <p className="mb-4 text-xs leading-6 text-neutral-500">
        با انتخاب هر ورزش، تمام محصولات این دسته بدون ساخت نسخه جدید در ویترین آن ورزش هم نمایش داده می‌شوند.
        ورزش اصلی و اطلاعات محصولات تغییر نمی‌کند.
      </p>

      {!ownerSportId ? (
        <p className="text-xs font-medium text-amber-700">
          ابتدا ورزش اصلی را انتخاب کنید.
        </p>
      ) : options.length === 0 ? (
        <p className="text-xs text-neutral-500">ورزش دیگری برای انتخاب وجود ندارد.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {options.map((sport) => {
            const id = String(sport._id);
            const checked = selectedIds.has(id);
            return (
              <label
                key={id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                  checked
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-neutral-900"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSport(id)}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                <span className="font-medium">{sport.title || sport.name}</span>
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

