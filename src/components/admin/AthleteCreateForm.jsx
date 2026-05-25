"use client";

import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { 
  FaSave, FaTrophy, FaUser, FaTrash, FaIdCard, 
  FaHandshake, FaPlus, FaCheckCircle, FaSearch, FaMagic, FaAward 
} from "react-icons/fa";
import ImageUpload from "./ImageUpload";
import { useRouter } from "next/navigation";

export default function AthleteCreateForm({ initialData, sports, isEdit = false }) {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    ...initialData,
    sponsors: initialData?.sponsors || [],
    honors: initialData?.honors || [],
    gender: initialData?.gender || "" // اضافه شدن مقدار اولیه برای جنسیت
  });
  
  const [loading, setLoading] = useState(false);
  const [allSponsors, setAllSponsors] = useState([]); 
  const [sponsorSearch, setSponsorSearch] = useState("");

  useEffect(() => {
    const fetchSponsors = async () => {
        try {
            const res = await fetch('/api/brands');
            const data = await res.json();
            setAllSponsors(data.brands || []);
        } catch (e) { toast.error("خطا در دریافت لیست برندها"); }
    };
    fetchSponsors();
  }, []);

  useEffect(() => {
    if (initialData) {
        setFormData({
            ...initialData,
            sponsors: initialData.sponsors || [],
            honors: initialData.honors || [],
            gender: initialData.gender || ""
        });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // --- مدیریت اسپانسرها ---
  const toggleSponsor = (sponsorId) => {
    setFormData(prev => {
      const currentSponsors = prev.sponsors || [];
      const updatedSponsors = currentSponsors.includes(sponsorId)
        ? currentSponsors.filter(id => id !== sponsorId)
        : [...currentSponsors, sponsorId];
      return { ...prev, sponsors: updatedSponsors };
    });
  };

  // --- مدیریت افتخارات ---
  const handleHonorChange = (index, field, value) => {
    const updatedHonors = [...formData.honors];
    updatedHonors[index][field] = value;
    setFormData((prev) => ({ ...prev, honors: updatedHonors }));
  };

  const addHonor = () => {
    setFormData((prev) => ({
      ...prev,
      honors: [...(prev.honors || []), { title: "", quantity: 1, description: "" }],
    }));
  };

  const removeHonor = (index) => {
    setFormData((prev) => ({
      ...prev,
      honors: prev.honors.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // اعتبارسنجی اولیه برای جنسیت (اختیاری اما پیشنهاد می‌شود)
    if (!formData.gender) {
      return toast.warning("لطفاً جنسیت ورزشکار را انتخاب کنید");
    }

    setLoading(true);
    try {
      const url = isEdit ? `/api/athletes/${formData._id}` : "/api/athletes/create";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("خطا در ثبت اطلاعات");
      
      Swal.fire({
        icon: "success",
        title: "عملیات موفق",
        text: "اطلاعات ورزشکار با موفقیت ذخیره شد",
        confirmButtonColor: "#000",
      }).then(() => {
        router.push("/p-admin/admin-athletes");
        router.refresh();
      });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-10 pb-20">
      
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
        <div>
          <h2 className="text-3xl font-bold tracking-tighter text-gray-900 flex items-center gap-3">
            {isEdit ? 'ویرایش پروفایل قهرمان' : 'ثبت قهرمان جدید'}
          </h2>
        </div>
        <div className="flex items-center gap-2 bg-green-50 text-green-600 px-4 py-2 rounded-2xl border border-green-100 font-bold text-[10px] uppercase">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
            System Active
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* ستون چپ: رسانه و فیزیک */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-white p-6 rounded-[3rem] shadow-xl border border-white">
            <ImageUpload
              label="آواتار رسمی"
              value={formData.photo}
              onChange={(url) => setFormData((prev) => ({ ...prev, photo: url }))}
              folder="athletes"
              required={true}
            />
          </div>
          
          <div className="bg-black text-white p-8 rounded-[3rem] shadow-2xl">
             <h3 className="text-gray-500 font-bold text-[10px] uppercase tracking-widest mb-6 flex items-center gap-2">
                <FaUser className="text-[var(--color-primary)]" /> Physical Metrics
             </h3>
             <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                   <label className="block text-[9px] text-gray-400 font-bold mb-1">HEIGHT (CM)</label>
                   <input type="number" name="height" value={formData.height || ""} onChange={handleChange} className="bg-transparent w-full outline-none font-bold text-xl" />
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                   <label className="block text-[9px] text-gray-400 font-bold mb-1">WEIGHT (KG)</label>
                   <input type="number" name="weight" value={formData.weight || ""} onChange={handleChange} className="bg-transparent w-full outline-none font-bold text-xl" />
                </div>
             </div>
          </div>
        </div>

        {/* ستون راست: محتوا، افتخارات و اسپانسرها */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* هویت */}
          <div className="bg-white p-8 rounded-[3rem] border border-gray-50 shadow-sm space-y-6">
            <h3 className="flex items-center gap-3 font-bold text-gray-900">
              <FaIdCard className="text-blue-500" /> مشخصات اصلی
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                name="name"
                value={formData.name || ""}
                onChange={handleChange}
                className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold outline-none"
                placeholder="English Slug"
              />
              <input
                name="title"
                value={formData.title || ""}
                onChange={handleChange}
                className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold outline-none"
                placeholder="نام فارسی"
              />
            </div>

            {/* ── انتخاب جنسیت ── */}
            <div className="space-y-3 mt-2">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                جنسیت <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, gender: "male" }))}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 text-sm font-bold transition-all ${
                    formData.gender === "male"
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm shadow-blue-100'
                      : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-blue-200 hover:text-blue-500'
                  }`}
                >
                  {formData.gender === "male" && (
                    <FaCheckCircle className="text-blue-500 shrink-0" size={14} />
                  )}
                  <span>مرد (Male)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, gender: "female" }))}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 text-sm font-bold transition-all ${
                    formData.gender === "female"
                      ? 'border-pink-500 bg-pink-50 text-pink-700 shadow-sm shadow-pink-100'
                      : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-pink-200 hover:text-pink-500'
                  }`}
                >
                  {formData.gender === "female" && (
                    <FaCheckCircle className="text-pink-500 shrink-0" size={14} />
                  )}
                  <span>زن (Female)</span>
                </button>
              </div>
            </div>

            {/* ── انتخاب رشته ورزشی ── */}
            <div className="space-y-3">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                رشته ورزشی <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(sports || []).map(s => {
                  const isSelected = formData.sport === s._id;
                  return (
                    <button
                      key={s._id}
                      type="button"
                      onClick={() =>
                        setFormData(prev => ({ ...prev, sport: s._id }))
                      }
                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 text-sm font-bold transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm shadow-blue-100'
                          : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-blue-200 hover:text-blue-500'
                      }`}
                    >
                      {isSelected && (
                        <FaCheckCircle className="text-blue-500 shrink-0" size={12} />
                      )}
                      <span className="truncate">{s.name}</span>
                    </button>
                  );
                })}
                {(!sports || sports.length === 0) && (
                  <p className="col-span-full text-xs text-gray-300 italic text-center py-3">
                    هیچ ورزشی یافت نشد
                  </p>
                )}
              </div>
            </div>

            <textarea
              name="bio"
              value={formData.bio || ""}
              onChange={handleChange}
              rows={4}
              className="w-full p-6 bg-gray-50 border-none rounded-[2rem] text-sm font-medium outline-none"
              placeholder="بیوگرافی..."
            />
          </div>

          {/* تالار افتخارات */}
          <div className="bg-gradient-to-br from-yellow-50 to-white p-8 rounded-[3.5rem] border border-yellow-100 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="flex items-center gap-3 font-bold text-gray-900">
                <FaTrophy className="text-yellow-600" /> تالار افتخارات و مدال‌ها
              </h3>
              <button
                type="button"
                onClick={addHonor}
                className="bg-yellow-600 text-white p-3 rounded-2xl hover:rotate-90 transition-transform shadow-lg shadow-yellow-200"
              >
                <FaPlus size={14} />
              </button>
            </div>
            
            <div className="space-y-3">
              {formData.honors?.map((honor, index) => (
                <div key={index} className="flex gap-3 items-center bg-white p-4 rounded-[2rem] border border-yellow-50 shadow-sm group">
                  <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center font-bold text-yellow-700 text-xs">
                    {index + 1}
                  </div>
                  <input
                    placeholder="عنوان افتخار"
                    value={honor.title}
                    onChange={(e) => handleHonorChange(index, "title", e.target.value)}
                    className="flex-1 bg-transparent border-none font-bold text-sm outline-none"
                  />
                  <input
                    type="number"
                    value={honor.quantity}
                    onChange={(e) => handleHonorChange(index, "quantity", e.target.value)}
                    className="w-16 bg-gray-50 rounded-xl p-2 text-center font-bold text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeHonor(index)}
                    className="text-red-200 group-hover:text-red-500 transition-colors px-2"
                  >
                    <FaTrash size={14} />
                  </button>
                </div>
              ))}
              {formData.honors?.length === 0 && (
                <p className="text-center text-gray-300 text-xs font-bold py-4 italic">
                  هنوز افتخاری ثبت نشده است
                </p>
              )}
            </div>
          </div>

          {/* مدیریت اسپانسرها */}
          <div className="bg-white p-8 rounded-[3.5rem] border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="flex items-center gap-3 font-bold text-gray-900">
                <FaHandshake className="text-orange-500" /> مدیریت حامیان مالی
              </h3>
              <span className="text-[10px] font-bold bg-gray-900 text-white px-3 py-1 rounded-full uppercase italic tracking-widest">
                Selected: {formData.sponsors?.length || 0}
              </span>
            </div>
            
            <div className="relative mb-6">
               <FaSearch className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300" />
               <input
                 type="text"
                 placeholder="جستجوی برند..."
                 className="w-full pr-14 pl-6 py-4 bg-gray-50 rounded-2xl text-xs font-bold outline-none"
                 onChange={(e) => setSponsorSearch(e.target.value)}
               />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-64 overflow-y-auto p-2 custom-scrollbar">
              {allSponsors
                .filter(s => s.name.toLowerCase().includes(sponsorSearch.toLowerCase()))
                .map((sponsor) => {
                  const isSelected = formData.sponsors?.includes(sponsor._id);
                  return (
                    <div 
                      key={sponsor._id}
                      onClick={() => toggleSponsor(sponsor._id)}
                      className={`cursor-pointer p-4 rounded-[2.5rem] border-2 transition-all flex flex-col items-center gap-2 relative ${
                        isSelected
                          ? 'border-orange-500 bg-orange-50/30'
                          : 'border-gray-50 bg-white hover:border-orange-100'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-white border border-gray-50 p-1">
                        <img src={sponsor.logo} className="w-full h-full object-contain" alt="" />
                      </div>
                      <span className="text-[9px] font-bold text-center truncate w-full uppercase">
                        {sponsor.name}
                      </span>
                      {isSelected && (
                        <FaCheckCircle className="absolute top-2 right-4 text-orange-500 animate-pulse" size={14} />
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* دکمه نهایی */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-8 rounded-[3rem] font-bold text-xl hover:bg-[var(--color-primary)] transition-all shadow-2xl flex items-center justify-center gap-4 active:scale-95"
          >
            {loading
              ? <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              : <><FaSave /> ثبت و نهایی‌سازی پروفایل</>
            }
          </button>
        </div>
      </div>
    </form>
  );
}