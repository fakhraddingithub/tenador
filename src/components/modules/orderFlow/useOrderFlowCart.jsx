"use client";

import { useCallback, useState } from "react";
import { addToCart, addToCartWithFlow } from "@/lib/cart";
import { buildStepSequence } from "@/lib/flowTraversal";
import OrderFlowModal from "./OrderFlowModal";

/**
 * هوک افزودن به سبد با پشتیبانی از فرایند سفارش.
 *
 * استفاده:
 *   const { requestAddToCart, flowModal } = useOrderFlowCart();
 *   ...
 *   requestAddToCart({ product, quantity, variantId, onAdded });
 *   ...
 *   {flowModal}   // در انتهای JSX رندر شود
 *
 * رفتار:
 *  - اگر دسته‌بندی محصول فرایند فعال با حداقل یک مرحله داشته باشد → مودال باز می‌شود.
 *  - در غیر این صورت محصول مستقیماً به سبد افزوده می‌شود.
 *  - onAdded پس از افزوده شدن (چه با فرایند، چه مستقیم) صدا زده می‌شود.
 */
export function useOrderFlowCart() {
  // { product, quantity, variantId, flow, onAdded } | null
  const [modalState, setModalState] = useState(null);

  const getCategoryId = (product) => {
    const cat = product?.category;
    if (!cat) return null;
    return typeof cat === "object" ? cat._id || cat.id : cat;
  };

  const requestAddToCart = useCallback(
    async ({ product, quantity = 1, variantId = null, onAdded }) => {
      if (!product?._id) return;

      const categoryId = getCategoryId(product);
      let flow = null;

      if (categoryId) {
        try {
          const res = await fetch(`/api/order-flows/category/${categoryId}`);
          const data = await res.json();
          flow = data?.flow || null;
        } catch {
          flow = null;
        }
      }

      const hasSteps = flow && buildStepSequence(flow).length > 0;

      if (hasSteps) {
        setModalState({ product, quantity, variantId, flow, onAdded });
      } else {
        addToCart(product._id, quantity, variantId);
        onAdded?.();
      }
    },
    []
  );

  const handleConfirm = useCallback(
    (flowSelections) => {
      if (!modalState) return;
      const { product, quantity, variantId, onAdded } = modalState;

      if (Array.isArray(flowSelections) && flowSelections.length > 0) {
        addToCartWithFlow(product._id, quantity, variantId, flowSelections);
      } else {
        addToCart(product._id, quantity, variantId);
      }
      onAdded?.();
    },
    [modalState]
  );

  const flowModal = modalState ? (
    <OrderFlowModal
      isOpen
      flow={modalState.flow}
      product={modalState.product}
      quantity={modalState.quantity}
      variantId={modalState.variantId}
      onClose={() => setModalState(null)}
      onConfirm={handleConfirm}
    />
  ) : null;

  return { requestAddToCart, flowModal };
}
