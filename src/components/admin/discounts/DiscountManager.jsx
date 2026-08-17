"use client";
// components/admin/discounts/DiscountManager.jsx
import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import DiscountRuleForm from "./DiscountRuleForm";
import CoachCreditForm from "./CoachCreditForm";
import DiscountRuleCard from "./DiscountRuleCard";
import CoachCreditCard from "./CoachCreditCard";
import CouponForm from "./CouponForm";
import CouponCard from "./CouponCard";
import QuantityDiscountForm from "./QuantityDiscountForm";
import QuantityDiscountCard from "./QuantityDiscountCard";
import AdminLoader from "@/components/admin/AdminLoader";
import { useAdminPermissions } from "@/components/admin/AdminPermissionProvider";
import useSWR from "swr";

// 🟡 تخفیف‌ها، تخفیفِ تعدادی و کدهای تخفیف: کشِ کوتاه. عمداً پایین نگه داشته
// شده چون ورودیِ worker قیمت‌اند و ادمین باید اثرِ تغییرِ یک قانون را تقریباً
// بلافاصله ببیند. بعد از هر ویرایش/حذف هم mutate() صدا زده می‌شود که این
// پنجره را دور می‌زند.
const DISCOUNT_TTL = { dedupingInterval: 10_000 };

// 🔴 «کردیت مربیان» (کیف‌پول/پول) عمداً با SWR کش نمی‌شود و همان fetch مستقیم
// را نگه می‌دارد.

/**
 * تب‌ها به دو ماژولِ متفاوت تعلق دارند و همان تفکیکی را دارند که روت‌های
 * API دارند: سه تبِ اول زیرِ «تخفیف‌ها» و «کردیت مربیان» زیرِ ماژولِ «مربیان»
 * (/api/admin/coach-credits با coaches.* گیت شده است، نه discounts.*).
 */
const TABS = [
  { id: "discounts", label: "قوانین تخفیف", view: "discounts.view", create: "discounts.create" },
  { id: "quantity", label: "تخفیف تعدادی", view: "discounts.view", create: "discounts.create" },
  { id: "coupons", label: "کدهای تخفیف", view: "discounts.view", create: "discounts.create" },
  { id: "coachCredits", label: "کردیت مربیان", view: "coaches.view", create: "coaches.manageCredits" },
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
  variant: "واریانت",
};

export default function DiscountManager() {
  const { can } = useAdminPermissions();

  // آرایه قبل از رندر کوتاه می‌شود و تبِ پیش‌فرض از همان فهرست می‌آید، وگرنه
  // ادمینی که فقط «کردیت مربیان» را دارد داخل تبِ قوانین تخفیف می‌افتاد.
  const visibleTabs = TABS.filter((tab) => can(tab.view));
  const [activeTab, setActiveTab] = useState(() => visibleTabs[0]?.id || null);
  const activeTabMeta = TABS.find((tab) => tab.id === activeTab);

  const [coachCredits, setCoachCredits] = useState([]);
  const [manualLoading, setManualLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [filterType, setFilterType] = useState("");
  const [filterActive, setFilterActive] = useState("");

  // ─── 🟡 تخفیف‌ها و تخفیفِ تعدادی (SWR، فقط تبِ فعال واکشی می‌شود) ───
  const discountsParams = new URLSearchParams();
  if (filterType) discountsParams.set("type", filterType);
  if (filterActive !== "") discountsParams.set("active", filterActive);

  const {
    data: discountsData,
    isLoading: discountsLoading,
    mutate: mutateDiscounts,
  } = useSWR(
    activeTab === "discounts" ? `/api/admin/discounts?${discountsParams}` : null,
    DISCOUNT_TTL,
  );

  const {
    data: quantityData,
    isLoading: quantityLoading,
    mutate: mutateQuantity,
  } = useSWR(
    activeTab === "quantity" ? "/api/admin/quantity-discounts" : null,
    DISCOUNT_TTL,
  );

  const discounts = discountsData?.rules || [];
  const quantityDiscounts = quantityData?.items || [];

  // ─── 🟡 کدهای تخفیف: قانون‌اند نه موجودی، و بعد از هر تغییر mutate می‌شوند ───
  const {
    data: couponsData,
    isLoading: couponsLoading,
    mutate: mutateCoupons,
  } = useSWR(activeTab === "coupons" ? "/api/admin/coupons" : null, DISCOUNT_TTL);

  const coupons = couponsData?.coupons || [];

  // ─── 🔴 کردیت مربیان (کیف‌پول/پول): بدون کش، دقیقاً مثل قبل ───
  const fetchCoachCredits = useCallback(async () => {
    setManualLoading(true);
    try {
      const res = await fetch("/api/admin/coach-credits");
      const data = await res.json();
      setCoachCredits(data.rules || []);
    } catch {
      toast.error("خطا در دریافت کردیت‌ها");
    } finally {
      setManualLoading(false);
    }
  }, []);

  // یک microtask تأخیر تا setManualLoading(true) مستقیماً در بدنه‌ی effect اجرا
  // نشود (همان الگویی که EventList قبلاً برای این هشدار داشت).
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      if (activeTab === "coachCredits") fetchCoachCredits();
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab, fetchCoachCredits]);

  const loading =
    manualLoading ||
    (activeTab === "discounts" && discountsLoading) ||
    (activeTab === "quantity" && quantityLoading) ||
    (activeTab === "coupons" && couponsLoading);

  const API_BASE = {
    discount: "/api/admin/discounts",
    quantity: "/api/admin/quantity-discounts",
    coupon: "/api/admin/coupons",
    credit: "/api/admin/coach-credits",
  };

  // بعد از هر ساخت/ویرایش/حذف: mutate() بدونِ توجه به dedupingInterval
  // بلافاصله دوباره واکشی می‌کند، پس ادمین همیشه نتیجه‌ی کارش را می‌بیند.
  const refreshByType = (type) => {
    if (type === "discount") mutateDiscounts();
    else if (type === "quantity") mutateQuantity();
    else if (type === "coupon") mutateCoupons();
    else fetchCoachCredits();
  };

  const handleDelete = async (id, type) => {
    if (!confirm("آیا مطمئن هستید؟")) return;
    const res = await fetch(`${API_BASE[type]}/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("حذف شد");
      refreshByType(type);
    } else {
      toast.error("خطا در حذف");
    }
  };

  const handleToggleActive = async (id, current, type) => {
    const res = await fetch(`${API_BASE[type]}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !current }),
    });
    if (res.ok) {
      toast.success(current ? "غیرفعال شد" : "فعال شد");
      refreshByType(type);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditItem(null);
    if (activeTab === "discounts") mutateDiscounts();
    else if (activeTab === "quantity") mutateQuantity();
    else if (activeTab === "coupons") mutateCoupons();
    else fetchCoachCredits();
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
        {visibleTabs.map((tab) => (
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
        {activeTabMeta && can(activeTabMeta.create) && (
        <button
          onClick={() => { setShowForm(true); setEditItem(null); }}
          className="flex items-center gap-2 bg-[#aa4725] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#8f3a1e] transition-colors shadow-sm"
        >
          <span className="text-lg leading-none">+</span>
          {activeTab === "discounts"
            ? "تخفیف جدید"
            : activeTab === "quantity"
              ? "تخفیف تعدادی جدید"
              : activeTab === "coupons"
                ? "کد تخفیف جدید"
                : "کردیت جدید"}
        </button>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">
                {editItem ? "ویرایش" : "ایجاد"}{" "}
                {activeTab === "discounts"
                  ? "قانون تخفیف"
                  : activeTab === "quantity"
                    ? "تخفیف تعدادی"
                    : activeTab === "coupons"
                      ? "کد تخفیف"
                      : "قانون کردیت مربی"}
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
              ) : activeTab === "quantity" ? (
                <QuantityDiscountForm
                  initial={editItem}
                  onSuccess={handleFormSuccess}
                  onCancel={() => { setShowForm(false); setEditItem(null); }}
                />
              ) : activeTab === "coupons" ? (
                <CouponForm
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
        <AdminLoader />
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
      ) : activeTab === "quantity" ? (
        <div className="grid gap-3">
          {quantityDiscounts.length === 0 ? (
            <EmptyState text="هیچ تخفیف تعدادی‌ای تعریف نشده است — مثلاً «۲ عدد به بالا ۱۰٪ تخفیف»" />
          ) : (
            quantityDiscounts.map((item) => (
              <QuantityDiscountCard
                key={item._id}
                item={item}
                onEdit={(it) => { setEditItem(it); setShowForm(true); }}
                onDelete={(id) => handleDelete(id, "quantity")}
                onToggle={(id, current) => handleToggleActive(id, current, "quantity")}
              />
            ))
          )}
        </div>
      ) : activeTab === "coupons" ? (
        <div className="grid gap-3">
          {coupons.length === 0 ? (
            <EmptyState text="هیچ کد تخفیفی تعریف نشده است — کاربر این کد را هنگام ثبت سفارش وارد می‌کند" />
          ) : (
            coupons.map((coupon) => (
              <CouponCard
                key={coupon._id}
                coupon={coupon}
                onEdit={(item) => { setEditItem(item); setShowForm(true); }}
                onDelete={(id) => handleDelete(id, "coupon")}
                onToggle={(id, current) => handleToggleActive(id, current, "coupon")}
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
