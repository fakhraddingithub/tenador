"use client";
// components/admin/discounts/DiscountManager.jsx
import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import DiscountRuleForm from "./DiscountRuleForm";
import CoachCreditForm from "./CoachCreditForm";
import DiscountRuleCard from "./DiscountRuleCard";
import CoachCreditCard from "./CoachCreditCard";

const TABS = [
  { id: "discounts", label: "قوانین تخفیف" },
  { id: "coachCredits", label: "کردیت مربیان" },
];

const TYPE_LABELS = {
  product: "محصول",
  category: "دسته‌بندی",
  serie: "سری",
  brand: "برند",
  global: "همه محصولات",
  userRole: "نقش کاربر",
  userLevel: "سطح کاربر",
  cartValue: "حداقل سبد",
};

export default function DiscountManager() {
  const [activeTab, setActiveTab] = useState("discounts");
  const [discounts, setDiscounts] = useState([]);
  const [coachCredits, setCoachCredits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [filterType, setFilterType] = useState("");
  const [filterActive, setFilterActive] = useState("");

  const fetchDiscounts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set("type", filterType);
      if (filterActive !== "") params.set("active", filterActive);
      const res = await fetch(`/api/admin/discounts?${params}`);
      const data = await res.json();
      setDiscounts(data.rules || []);
    } catch {
      toast.error("خطا در دریافت تخفیف‌ها");
    } finally {
      setLoading(false);
    }
  }, [filterType, filterActive]);

  const fetchCoachCredits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/coach-credits");
      const data = await res.json();
      setCoachCredits(data.rules || []);
    } catch {
      toast.error("خطا در دریافت کردیت‌ها");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "discounts") fetchDiscounts();
    else fetchCoachCredits();
  }, [activeTab, fetchDiscounts, fetchCoachCredits]);

  const handleDelete = async (id, type) => {
    if (!confirm("آیا مطمئن هستید؟")) return;
    const url = type === "discount" ? `/api/admin/discounts/${id}` : `/api/admin/coach-credits/${id}`;
    const res = await fetch(url, { method: "DELETE" });
    if (res.ok) {
      toast.success("حذف شد");
      type === "discount" ? fetchDiscounts() : fetchCoachCredits();
    } else {
      toast.error("خطا در حذف");
    }
  };

  const handleToggleActive = async (id, current, type) => {
    const url = type === "discount" ? `/api/admin/discounts/${id}` : `/api/admin/coach-credits/${id}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !current }),
    });
    if (res.ok) {
      toast.success(current ? "غیرفعال شد" : "فعال شد");
      type === "discount" ? fetchDiscounts() : fetchCoachCredits();
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditItem(null);
    activeTab === "discounts" ? fetchDiscounts() : fetchCoachCredits();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">مدیریت تخفیف‌ها و کردیت</h1>
        <p className="text-gray-500 text-sm mt-1">
          تعریف قوانین تخفیف و سیستم کردیت مربیان
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1 w-fit mb-6 shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setShowForm(false);
              setEditItem(null);
            }}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? "bg-[#aa4725] text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex gap-2 flex-wrap">
          {activeTab === "discounts" && (
            <>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#aa4725]"
              >
                <option value="">همه نوع‌ها</option>
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <select
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#aa4725]"
              >
                <option value="">همه وضعیت‌ها</option>
                <option value="true">فعال</option>
                <option value="false">غیرفعال</option>
              </select>
            </>
          )}
        </div>
        <button
          onClick={() => { setShowForm(true); setEditItem(null); }}
          className="flex items-center gap-2 bg-[#aa4725] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#8f3a1e] transition-colors shadow-sm"
        >
          <span className="text-lg leading-none">+</span>
          {activeTab === "discounts" ? "تخفیف جدید" : "کردیت جدید"}
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">
                {editItem ? "ویرایش" : "ایجاد"}{" "}
                {activeTab === "discounts" ? "قانون تخفیف" : "قانون کردیت مربی"}
              </h2>
              <button
                onClick={() => { setShowForm(false); setEditItem(null); }}
                className="text-gray-400 hover:text-gray-700 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
              >
                ×
              </button>
            </div>
            <div className="p-5">
              {activeTab === "discounts" ? (
                <DiscountRuleForm
                  initial={editItem}
                  onSuccess={handleFormSuccess}
                  onCancel={() => { setShowForm(false); setEditItem(null); }}
                />
              ) : (
                <CoachCreditForm
                  initial={editItem}
                  onSuccess={handleFormSuccess}
                  onCancel={() => { setShowForm(false); setEditItem(null); }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="w-8 h-8 border-4 border-[#aa4725] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab === "discounts" ? (
        <div className="grid gap-3">
          {discounts.length === 0 ? (
            <EmptyState text="هیچ قانون تخفیفی تعریف نشده است" />
          ) : (
            discounts.map((rule) => (
              <DiscountRuleCard
                key={rule._id}
                rule={rule}
                typeLabels={TYPE_LABELS}
                onEdit={(item) => { setEditItem(item); setShowForm(true); }}
                onDelete={(id) => handleDelete(id, "discount")}
                onToggle={(id, current) => handleToggleActive(id, current, "discount")}
              />
            ))
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {coachCredits.length === 0 ? (
            <EmptyState text="هیچ قانون کردیتی تعریف نشده است" />
          ) : (
            coachCredits.map((rule) => (
              <CoachCreditCard
                key={rule._id}
                rule={rule}
                onEdit={(item) => { setEditItem(item); setShowForm(true); }}
                onDelete={(id) => handleDelete(id, "credit")}
                onToggle={(id, current) => handleToggleActive(id, current, "credit")}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="text-center py-16 text-gray-400">
      <div className="text-5xl mb-3">🏷️</div>
      <p>{text}</p>
    </div>
  );
}
