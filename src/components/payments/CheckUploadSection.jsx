import React from 'react';
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

import { HiOutlineTrash, HiOutlinePhotograph, HiOutlineDotsVertical, HiOutlinePlus } from 'react-icons/hi';

const CheckUploadSection = ({ checks, onUpdate, onRemove, remainingBalance }) => {
  
  const handleImageChange = (index, e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdate(index, 'image', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex justify-between items-center border-b border-gray-100 pb-2">
        <h3 className="text-lg font-bold text-gray-800">جزییات چک‌های اقساط</h3>
        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-mono">
          {checks.length} عدد چک
        </span>
      </div>

      <div className="space-y-6">
        {checks.map((check, index) => (
          <div key={check.id} className="relative group p-4 border border-gray-200 rounded-[var(--radius)] bg-white hover:border-[var(--color-secondary)] transition-colors">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-[var(--color-primary)]">چک قسط شماره {index + 1}</span>
              <button
                onClick={() => onRemove(index)}
                className="text-gray-300 hover:text-red-500 transition-colors"
                title="حذف این قسط"
              >
                <HiOutlineTrash />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Image Upload */}
              <div className="md:col-span-1">
                <div className="relative h-32 w-full border-2 border-dashed border-gray-200 rounded-[var(--radius)] overflow-hidden flex flex-col items-center justify-center bg-gray-50 group-hover:bg-white transition-colors">
                  {check.image ? (
                    <>
                      <img src={check.image} alt="پیش‌نمایش چک" className="w-full h-full object-cover" />
                      <button
                        onClick={() => onUpdate(index, 'image', null)}
                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full text-xs shadow-sm hover:scale-110 transition-transform"
                      >
                        <HiOutlineTrash />
                      </button>
                    </>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center p-2 text-center">
                      <HiOutlinePhotograph className="text-2xl text-gray-300 mb-1" />
                      <span className="text-[10px] text-gray-400">تصویر چک</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageChange(index, e)}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Data Inputs */}
              <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 mr-1">شماره چک</label>
                  <input
                    type="text"
                    value={check.number}
                    onChange={(e) => onUpdate(index, 'number', e.target.value)}
                    className="w-full p-2 text-xs border border-gray-200 rounded-[var(--radius)] outline-none focus:border-[var(--color-secondary)] transition-all font-bold"
                    placeholder="مثلا: ۱۲۳۴۵۶"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 mr-1">مبلغ چک (ریال)</label>
                  <input
                    type="text"
                    value={check.amount.toLocaleString()}
                    onChange={(e) => {
                      const val = Number(e.target.value.replace(/\D/g, ''));
                      onUpdate(index, 'amount', val);
                    }}
                    className="w-full p-2 text-xs border border-gray-200 rounded-[var(--radius)] outline-none focus:border-[var(--color-secondary)] transition-all font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 mr-1">تاریخ چک</label>
                  <DatePicker
                    calendar={persian}
                    locale={persian_fa}
                    containerClassName="w-full"
                    value={check.date || new Date()}
                    onChange={(dateObject) => {
                      if (!dateObject) return;
                      const jalaliDate = dateObject.format("YYYY-MM-DD");
                      onUpdate(index, "date", jalaliDate);
                    }}
                    inputClass="w-full p-2 text-xs border border-gray-200 rounded-[var(--radius)] outline-none focus:border-[var(--color-secondary)] transition-all"
                    format="YYYY/MM/DD" // نمایش تاریخ به فرمت شمسی
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default CheckUploadSection;
