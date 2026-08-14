import { useState } from 'react';
import { FiX, FiMapPin, FiPlus, FiCheck, FiPhone, FiUser, FiHome } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { joinAddressName } from '@/lib/addressName.mjs';
import {
  firstAddressError,
  normalizePhoneInput,
  validateAddressForm,
} from '@/lib/addressForm.mjs';

const initialFormState = {
  title: '',
  firstName: '',
  lastName: '',
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
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');

  if (!isOpen) return null;

  const handleInputChange = (field, value) => {
    const nextValue = field === 'phone' ? normalizePhoneInput(value) : value;
    setFormData((prev) => ({ ...prev, [field]: nextValue }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setSubmitError('');
  };

  const validateForm = () => {
    const nextErrors = validateAddressForm(formData);
    setErrors(nextErrors);

    const firstField = Object.keys(nextErrors)[0];
    if (firstField) {
      setSubmitError('لطفاً موارد مشخص‌شده را اصلاح کنید.');
      toast.error(firstAddressError(nextErrors));
      requestAnimationFrame(() => document.querySelector(`[name="${firstField}"]`)?.focus());
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    const addressData = {
      ...formData,
      fullName: joinAddressName(formData.firstName, formData.lastName),
    };
    // ─── آدرس موقت: بدون ذخیره در دیتابیس ───
    if (!saveAddress) {
      onSelectAddress({ ...addressData, _id: null, isTemporary: true });
      setFormData(initialFormState);
      setShowForm(false);
      onClose();
      return;
    }

    // ─── آدرس دائمی: ذخیره در دیتابیس ───
    setIsSubmitting(true);
    try {
      const newAddress = await onAddAddress({ ...addressData, saveAddress });
      onSelectAddress(newAddress);
      setFormData(initialFormState);
      setErrors({});
      setSubmitError('');
      setShowForm(false);
      toast.success('آدرس با موفقیت اضافه شد');
      onClose();
    } catch (error) {
      const message = error.message || 'ثبت آدرس انجام نشد. دوباره تلاش کنید.';
      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
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
                              {[address.city, address.addressLine].filter(Boolean).join('، ')}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <FiPhone className="w-3 h-3" />
                                {address.phone}
                              </span>
                              {address.postalCode && (
                                <span>کد پستی: {address.postalCode}</span>
                              )}
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
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
              </div>

              <p className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700">
                نام و نام خانوادگی را به فارسی وارد کنید
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* نام */}
                <div className="space-y-1">
                  <label htmlFor="order-address-firstName" className="text-xs text-gray-500">نام <span className="text-red-600">*</span></label>
                  <div className="relative">
                    <FiUser className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      id="order-address-firstName"
                      name="firstName"
                      autoComplete="given-name"
                      placeholder="نام تحویل گیرنده"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      required
                      aria-invalid={!!errors.firstName}
                      aria-describedby={errors.firstName ? 'order-address-firstName-error' : undefined}
                      className={`w-full border rounded-[6px] py-2.5 pr-9 pl-3 text-sm focus:outline-none focus:ring-2 transition ${errors.firstName ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-300 focus:border-[#aa4725] focus:ring-[#aa4725]/20'}`}
                    />
                  </div>
                  {errors.firstName && <p id="order-address-firstName-error" role="alert" className="text-xs text-red-600">{errors.firstName}</p>}
                </div>

                {/* نام خانوادگی */}
                <div className="space-y-1">
                  <label htmlFor="order-address-lastName" className="text-xs text-gray-500">نام خانوادگی <span className="text-red-600">*</span></label>
                  <div className="relative">
                    <FiUser className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      id="order-address-lastName"
                      name="lastName"
                      autoComplete="family-name"
                      placeholder="نام خانوادگی تحویل گیرنده"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      required
                      aria-invalid={!!errors.lastName}
                      aria-describedby={errors.lastName ? 'order-address-lastName-error' : undefined}
                      className={`w-full border rounded-[6px] py-2.5 pr-9 pl-3 text-sm focus:outline-none focus:ring-2 transition ${errors.lastName ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-300 focus:border-[#aa4725] focus:ring-[#aa4725]/20'}`}
                    />
                  </div>
                  {errors.lastName && <p id="order-address-lastName-error" role="alert" className="text-xs text-red-600">{errors.lastName}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* موبایل */}
                <div className="space-y-1">
                  <label htmlFor="order-address-phone" className="text-xs text-gray-500">شماره موبایل <span className="text-red-600">*</span></label>
                  <div className="relative">
                    <FiPhone className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="tel"
                      id="order-address-phone"
                      name="phone"
                      inputMode="numeric"
                      autoComplete="tel"
                      dir="ltr"
                      maxLength={11}
                      placeholder="09xxxxxxxxx"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      aria-invalid={!!errors.phone}
                      aria-describedby={errors.phone ? 'order-address-phone-error' : undefined}
                      className={`w-full border rounded-[6px] py-2.5 pr-9 pl-3 text-sm text-left focus:outline-none focus:ring-2 transition ${errors.phone ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-300 focus:border-[#aa4725] focus:ring-[#aa4725]/20'}`}
                    />
                  </div>
                  {errors.phone && <p id="order-address-phone-error" role="alert" className="text-xs text-red-600">{errors.phone}</p>}
                </div>

                {/* شهر */}
                <div className="space-y-1">
                  <label htmlFor="order-address-city" className="text-xs text-gray-500">شهر <span className="text-red-600">*</span></label>
                  <div className="relative">
                    <FiMapPin className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      id="order-address-city"
                      name="city"
                      placeholder="نام شهر"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      aria-invalid={!!errors.city}
                      aria-describedby={errors.city ? 'order-address-city-error' : undefined}
                      className={`w-full border rounded-[6px] py-2.5 pr-9 pl-3 text-sm focus:outline-none focus:ring-2 transition ${errors.city ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-300 focus:border-[#aa4725] focus:ring-[#aa4725]/20'}`}
                    />
                  </div>
                  {errors.city && <p id="order-address-city-error" role="alert" className="text-xs text-red-600">{errors.city}</p>}
                </div>

              </div>

              {/* کد پستی */}
              <div className="space-y-1">
                <label htmlFor="order-address-postalCode" className="text-xs text-gray-500">
                  کد پستی
                </label>
                <input
                  type="text"
                  id="order-address-postalCode"
                  name="postalCode"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="کد پستی"
                  value={formData.postalCode}
                  onChange={(e) => handleInputChange('postalCode', e.target.value)}
                  className="w-full border border-gray-300 rounded-[6px] py-2.5 px-3 text-sm focus:outline-none focus:border-[#aa4725] focus:ring-2 focus:ring-[#aa4725]/20 transition"
                />
              </div>

              {/* آدرس کامل */}
              <div className="space-y-1">
                <p id="order-address-addressLine-help" className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700">
                  آدرس را به فارسی وارد کنید
                </p>
                <label htmlFor="order-address-addressLine" className="block text-xs text-gray-500">آدرس کامل <span className="text-red-600">*</span></label>
                <textarea
                  id="order-address-addressLine"
                  name="addressLine"
                  rows={3}
                  placeholder="خیابان، کوچه، پلاک، واحد ..."
                  value={formData.addressLine}
                  onChange={(e) => handleInputChange('addressLine', e.target.value)}
                  required
                  aria-invalid={!!errors.addressLine}
                  aria-describedby={errors.addressLine ? 'order-address-addressLine-help order-address-addressLine-error' : 'order-address-addressLine-help'}
                  className={`w-full border rounded-[6px] py-2.5 px-3 text-sm resize-none focus:outline-none focus:ring-2 transition ${errors.addressLine ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-300 focus:border-[#aa4725] focus:ring-[#aa4725]/20'}`}
                />
                {errors.addressLine && <p id="order-address-addressLine-error" role="alert" className="text-xs text-red-600">{errors.addressLine}</p>}
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

              {submitError && (
                <p role="alert" aria-live="polite" className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {submitError}
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
