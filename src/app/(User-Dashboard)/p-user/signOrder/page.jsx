"use client";

/**
 * src/app/(User-Dashboard)/p-user/signOrder/page.jsx
 *
 * صفحه ثبت سفارش — اصلاح فیلدهای ارسالی سبد خرید برای پشتیبانی از محصولات دست‌دوم
 */

import { useState } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { FiShoppingCart, FiArrowRight } from "react-icons/fi";
import Link from "next/link";

import CartItems from "@/components/order/CartItems";
import CartSummary from "@/components/order/CartSummary";
import AddressSelector from "@/components/order/AddressSelector";
import AddressModal from "@/components/order/AddressModal";
import PaymentMethods from "@/components/order/PaymentMethods";
import OrderActions from "@/components/order/OrderActions";

import { useCart } from "@/hooks/useCart";
import { useAddresses } from "@/hooks/useAddresses";

const OrderPage = () => {
  const {
    cartItems,
    isLoading: isCartLoading,
    updateQuantity,
    removeItem,
    applyCoupon,
    removeCoupon,
    appliedCoupon,
    couponDiscount,
    couponError,
    totalItems,
    totalPrice,
    totalRawPrice,
    totalDiscount,
  } = useCart();

  const { addresses, isLoading: isAddressLoading, addAddress } = useAddresses();

  const [selectedAddress, setSelectedAddress] = useState(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);

  const handleOrderSuccess = (trackingCode) => {
    window.location.replace(`/p-user/payments/${trackingCode}`);
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <ToastContainer
        position="top-center"
        autoClose={3000}
        rtl
        theme="light"
        toastClassName="font-vazir"
      />

      <AddressModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        addresses={addresses}
        selectedAddress={selectedAddress}
        onSelectAddress={setSelectedAddress}
        onAddAddress={addAddress}
        isLoading={isAddressLoading}
      />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/p-user"
                className="p-2 rounded-md hover:bg-gray-100 transition-colors"
                aria-label="بازگشت"
              >
                <FiArrowRight className="w-5 h-5 text-[#0d0d0d]" />
              </Link>

              <h1 className="absolute flex items-center px-13 gap-2 text-lg md:text-xl font-bold text-[#0d0d0d]">
                <FiShoppingCart className="w-5 h-5 md:w-6 md:h-6 text-[#aa4725]" />
                ثبت سفارش
              </h1>

              {totalItems > 0 && (
                <div className="relative bottom-3 left-4 px-3 py-1 rounded-full text-sm font-medium bg-[#ffbf00]/20 text-[#aa4725]">
                  {totalItems}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container py-6 md:py-10 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">

          {/* ─── ستون چپ ─── */}
          <div className="lg:col-span-2 space-y-8">
            <section className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-[6px] p-4 md:p-6">
                <h2 className="flex items-center gap-2 text-base font-semibold text-[#0d0d0d] mb-4">
                  <FiShoppingCart className="w-5 h-5 text-[#aa4725]" />
                  سبد خرید شما
                </h2>
                <CartItems
                  items={cartItems}
                  onUpdateQuantity={updateQuantity}
                  onRemoveItem={removeItem}
                  isLoading={isCartLoading}
                />
              </div>
            </section>

            <AddressSelector
              selectedAddress={selectedAddress}
              onOpenModal={() => setIsAddressModalOpen(true)}
            />

            <PaymentMethods
              selectedMethod={selectedPaymentMethod}
              onSelectMethod={setSelectedPaymentMethod}
            />
          </div>

          {/* ─── ستون راست / خلاصه ─── */}
          <div className="space-y-6">
            <div className="lg:sticky lg:top-28 space-y-6">

              <div className="bg-white border border-gray-200 rounded-[6px] p-4 md:p-6">
                <CartSummary
                  totalItems={totalItems}
                  totalPrice={totalPrice}
                  totalRawPrice={totalRawPrice}
                  totalDiscount={totalDiscount}
                  couponDiscount={couponDiscount}
                  appliedCoupon={appliedCoupon}
                  couponError={couponError}
                  onApplyCoupon={applyCoupon}
                  onRemoveCoupon={removeCoupon}
                  isLoading={isCartLoading}
                />
              </div>

              {/* 🛡️ اصلاح شد: انتقال کامل و امن کلیدهای محصولات نو و دست‌دوم */}
              <OrderActions
                cartItems={cartItems.map((i) => ({
                  // 🛡️ اگر محصول اصلی وجود داشت آن را بگذارد، در غیر این صورت آیدی دست‌دوم را به عنوان پشتیبان قرار دهد
                  productId: i.productId || i.usedProductId || null,
                  variantId: i.variantId ?? null,
                  usedProductId: i.usedProductId || null,
                  itemType: i.itemType || 'product',
                  quantity: i.quantity,
                }))}
                finalTotalToman={totalPrice}
                selectedAddress={selectedAddress}
                selectedPaymentMethod={selectedPaymentMethod}
                couponCode={appliedCoupon?.code ?? null}
                onSuccess={handleOrderSuccess}
              />

            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="container py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-sm text-gray-500">
            <div className="flex items-center px-5 gap-4">
              <a href="#" className="hover:text-[#aa4725] transition-colors">قوانین و مقررات</a>
              <a href="#" className="hover:text-[#aa4725] transition-colors">پشتیبانی</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default OrderPage;