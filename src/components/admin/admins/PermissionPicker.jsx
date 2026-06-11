'use client';

/**
 * src/components/admin/admins/PermissionPicker.jsx
 *
 * انتخابگر دسترسی‌ها — گروه‌بندی‌شده بر اساس ماژول/صفحه، با انتخاب گروهی
 * هر ماژول و انتخاب/حذف سراسری. ماژول‌ها از رجیستری سرور
 * (GET /api/admin/permissions) می‌آیند و هیچ دسترسی‌ای اینجا هاردکد نیست.
 *
 * Props:
 *  - modules:  آرایه ماژول‌های رجیستری [{ key, title, description, permissions: [{key,title}] }]
 *  - selected: آرایه کلیدهای انتخاب‌شده مثل ["products.view"]
 *  - onChange: (nextSelectedArray) => void
 */

import { useMemo } from 'react';
import { ShieldCheck, CheckSquare, Square, ListChecks, Eraser } from 'lucide-react';

const buildKey = (moduleKey, actionKey) => `${moduleKey}.${actionKey}`;

export default function PermissionPicker({ modules = [], selected = [], onChange }) {
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const allKeys = useMemo(
    () => modules.flatMap((mod) => mod.permissions.map((p) => buildKey(mod.key, p.key))),
    [modules]
  );

  const emit = (nextSet) => onChange([...nextSet]);

  const togglePermission = (fullKey) => {
    const next = new Set(selectedSet);
    if (next.has(fullKey)) next.delete(fullKey);
    else next.add(fullKey);
    emit(next);
  };

  const toggleModule = (mod) => {
    const keys = mod.permissions.map((p) => buildKey(mod.key, p.key));
    const allChecked = keys.every((k) => selectedSet.has(k));
    const next = new Set(selectedSet);
    for (const k of keys) {
      if (allChecked) next.delete(k);
      else next.add(k);
    }
    emit(next);
  };

  const selectAll = () => emit(new Set(allKeys));
  const clearAll = () => emit(new Set());

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border rounded-2xl p-4"
        style={{ borderColor: '#e8e4df' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShieldCheck size={17} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">دسترسی‌ها</h3>
            <p className="text-[11px] font-bold text-gray-400">
              {selectedSet.size} از {allKeys.length} دسترسی انتخاب شده
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-[var(--radius)] bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all"
          >
            <ListChecks size={13} />
            انتخاب همه
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-[var(--radius)] bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-800 hover:text-white transition-all"
          >
            <Eraser size={13} />
            حذف همه
          </button>
        </div>
      </div>

      {/* Module groups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modules.map((mod) => {
          const keys = mod.permissions.map((p) => buildKey(mod.key, p.key));
          const checkedCount = keys.filter((k) => selectedSet.has(k)).length;
          const allChecked = checkedCount === keys.length;
          const someChecked = checkedCount > 0 && !allChecked;

          return (
            <div
              key={mod.key}
              className={`bg-white border rounded-2xl overflow-hidden transition-all ${
                checkedCount > 0 ? 'border-emerald-200 shadow-sm' : ''
              }`}
              style={checkedCount > 0 ? {} : { borderColor: '#e8e4df' }}
            >
              {/* Module header — کلیک = انتخاب/حذف کل ماژول */}
              <button
                type="button"
                onClick={() => toggleModule(mod)}
                className="w-full flex items-center justify-between gap-3 p-4 text-right hover:bg-gray-50/70 transition-colors"
                style={{ background: checkedCount > 0 ? '#f3faf6' : '#faf9f8' }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={
                      allChecked
                        ? 'text-emerald-600'
                        : someChecked
                          ? 'text-emerald-400'
                          : 'text-gray-300'
                    }
                  >
                    {allChecked || someChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-[13px] font-bold text-gray-800 truncate">{mod.title}</h4>
                    {mod.description && (
                      <p className="text-[10px] font-bold text-gray-400 truncate">{mod.description}</p>
                    )}
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${
                    checkedCount > 0
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {checkedCount}/{keys.length}
                </span>
              </button>

              {/* Permission checkboxes */}
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {mod.permissions.map((perm) => {
                  const fullKey = buildKey(mod.key, perm.key);
                  const checked = selectedSet.has(fullKey);

                  return (
                    <label
                      key={fullKey}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer select-none transition-colors ${
                        checked
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'border-gray-100 hover:bg-gray-50 text-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePermission(fullKey)}
                        className="accent-emerald-600 w-4 h-4 flex-shrink-0"
                      />
                      <span className="text-xs font-bold truncate">{perm.title}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
