import { useState } from 'react';
import { FiX, FiMapPin, FiPlus, FiCheck, FiPhone, FiUser, FiHome } from 'react-icons/fi';
import { toast } from 'react-toastify';

const initialFormState = {
  title: '',
  fullName: '',
  phone: '',
  city: '',
  addressLine: '',
  postalCode: '',
};

const AddressModal = ({
  isOpen,
  onClose,
  addresses,
  selectedAddress,
  onSelectAddress,
  onAddAddress,
  isLoading,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(initialFormState);
  const [saveAddress, setSaveAddress] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    // title دیگه اجباری نیست
    if (!formData.fullName.trim()) {
      toast.error('نام و نام خانوادگی الزامی است');
      return false;
    }
    if (!formData.phone.trim() || !/^09\d{9}$/.test(formData.phone)) {
      toast.error('شماره موبایل معتبر نیست');
      return false;
    }
    if (!formData.city.trim()) {
      toast.error('شهر الزامی است');
      return false;
    }
    if (!formData.addressLine.trim()) {
      toast.error('آدرس کامل الزامی است');
      return false;
    }
    if (!formData.postalCode.trim() || !/^\d{10}$/.test(formData.postalCode)) {
      toast.error('کد پستی باید ۱۰ رقمی باشد');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    // ─── آدرس موقت: بدون ذخیره در دیتابیس ───
    if (!saveAddress) {
      onSelectAddress({ ...formData, _id: null, isTemporary: true });
      setFormData(initialFormState);
      setShowForm(false);
      onClose();
      return;
    }

    // ─── آدرس دائمی: ذخیره در دیتابیس ───
    setIsSubmitting(true);
    const newAddress = await onAddAddress({ ...formData, saveAddress });
    setIsSubmitting(false);

    if (newAddress) {
      onSelectAddress(newAddress);
      setFormData(initialFormState);
      setShowForm(false);
      toast.success('آدرس با موفقیت اضافه شد');
      onClose();
    }
  };

  const handleSelectAndClose = (address) => {
    onSelectAddress(address);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-[8px] shadow-xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#0d0d0d]">
            <FiMapPin className="w-5 h-5 text-[#aa4725]" />
            انتخاب آدرس
          </h2>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-100 transition-colors">
            <FiX className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 max-h-[65vh] overflow-y-auto">
          {!showForm ? (
            <>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-[72px] rounded-md bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : addresses.length > 0 ? (
                <div className="space-y-3">
                  {addresses.map((address) => {
                    const selected = selectedAddress?._id === address._id;
                    return (
                      <div
                        key={address._id}
                        onClick={() => handleSelectAndClose(address)}
                        className={`
                          relative cursor-pointer rounded-[6px] border p-4 transition
                          ${selected
                            ? 'border-[#aa4725] bg-[#ffbf00]/10'
                            : 'border-gray-200 hover:border-[#aa4725]/60 hover:bg-gray-50'}
                        `}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {address.title && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-[#ffbf00]/30 text-[#aa4725] font-medium">
                                  {address.title}
                                </span>
                              )}
                              <span className="text-sm font-medium text-[#0d0d0d]">
                                {address.fullName}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">
                              {address.city}، {address.addressLine}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <FiPhone className="w-3 h-3" />
                                {address.phone}
                              </span>
                              <span>کد پستی: {address.postalCode}</span>
                            </div>
                          </div>
                          {selected && (
                            <div className="w-6 h-6 rounded-full bg-[#aa4725] flex items-center justify-center shrink-0">
                              <FiCheck className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-10 text-center text-gray-500">
                  <FiMapPin className="w-10 h-10 mx-auto mb-3" />
                  هنوز آدرسی ثبت نشده است
                </div>
              )}

              <button
                onClick={() => setShowForm(true)}
                className="
                  w-full mt-2 py-3
                  border-2 border-dashed border-gray-300
                  rounded-[6px] text-sm text-gray-600
                  hover:border-[#aa4725] hover:text-[#aa4725]
                  transition flex items-center justify-center gap-2
                "
              >
                <FiPlus className="w-4 h-4" />
                افزودن آدرس جدید
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-sm text-[#aa4725] hover:underline"
              >
                ← بازگشت به لیست آدرس‌ها
              </button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* عنوان آدرس — اختیاری */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">
                    عنوان آدرس
                    <span className="text-gray-400 mr-1">(اختیاری)</span>
                  </label>
                  <div className="relative">
                    <FiHome className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="مثلاً خانه"
                      value={formData.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      className="w-full border border-gray-300 rounded-[6px] py-2.5 pr-9 pl-3 text-sm focus:outline-none focus:border-[#aa4725] focus:ring-2 focus:ring-[#aa4725]/20 transition"
                    />
                  </div>
                </div>

                {/* نام */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">نام و نام خانوادگی</label>
                  <div className="relative">
                    <FiUser className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="نام تحویل گیرنده"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange('fullName', e.target.value)}
                      className="w-full border border-gray-300 rounded-[6px] py-2.5 pr-9 pl-3 text-sm focus:outline-none focus:border-[#aa4725] focus:ring-2 focus:ring-[#aa4725]/20 transition"
                    />
                  </div>
                </div>

                {/* موبایل */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">شماره موبایل</label>
                  <div className="relative">
                    <FiPhone className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="tel"
                      placeholder="09xxxxxxxxx"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      className="w-full border border-gray-300 rounded-[6px] py-2.5 pr-9 pl-3 text-sm focus:outline-none focus:border-[#aa4725] focus:ring-2 focus:ring-[#aa4725]/20 transition"
                    />
                  </div>
                </div>

                {/* شهر */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">شهر</label>
                  <div className="relative">
                    <FiMapPin className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="نام شهر"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      className="w-full border border-gray-300 rounded-[6px] py-2.5 pr-9 pl-3 text-sm focus:outline-none focus:border-[#aa4725] focus:ring-2 focus:ring-[#aa4725]/20 transition"
                    />
                  </div>
                </div>

              </div>

              {/* کد پستی */}
              <div className="space-y-1">
                <label className="text-xs text-gray-500">کد پستی</label>
                <input
                  type="text"
                  placeholder="۱۰ رقم"
                  value={formData.postalCode}
                  onChange={(e) => handleInputChange('postalCode', e.target.value)}
                  className="w-full border border-gray-300 rounded-[6px] py-2.5 px-3 text-sm focus:outline-none focus:border-[#aa4725] focus:ring-2 focus:ring-[#aa4725]/20 transition"
                />
              </div>

              {/* آدرس کامل */}
              <div className="space-y-1">
                <label className="text-xs text-gray-500">آدرس کامل</label>
                <textarea
                  rows={3}
                  placeholder="خیابان، کوچه، پلاک، واحد ..."
                  value={formData.addressLine}
                  onChange={(e) => handleInputChange('addressLine', e.target.value)}
                  className="w-full border border-gray-300 rounded-[6px] py-2.5 px-3 text-sm resize-none focus:outline-none focus:border-[#aa4725] focus:ring-2 focus:ring-[#aa4725]/20 transition"
                />
              </div>

              {/* ذخیره آدرس */}
              <label className="flex items-center gap-2 text-sm text-gray-600 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveAddress}
                  onChange={(e) => setSaveAddress(e.target.checked)}
                  className="w-4 h-4 accent-[#aa4725] cursor-pointer"
                />
                ذخیره این آدرس در حساب کاربری
              </label>

              {!saveAddress && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-[6px] px-3 py-2">
                  این آدرس فقط برای این سفارش استفاده می‌شود و ذخیره نخواهد شد
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="
                  w-full py-3 rounded-[6px]
                  bg-[#aa4725] text-white font-medium
                  hover:opacity-90 transition
                  disabled:opacity-60
                "
              >
                {isSubmitting ? 'در حال ثبت...' : 'تایید و انتخاب آدرس'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddressModal;