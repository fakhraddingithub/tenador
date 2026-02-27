import { useState } from "react";
import ProductCard from "@/components/modules/cart/ProductCard";
import QuickViewModal from "@/components/modules/cart/QuickViewModal";
export default function ProductList({
  products = [],
  rate,
  onAddToCart,
  onToggleWishlist,
}) {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!Array.isArray(products) || products.length === 0) {
    return (
      <div className="py-10 text-center text-gray-500">
        محصولی برای نمایش وجود ندارد
      </div>
    );
  }

  const openQuickView = (product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const closeQuickView = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {products.map((product) => (
        <ProductCard
          key={product._id}
          product={product}
          rate={rate}
          isWishlisted={product.isWishlisted}
          onQuickView={() => openQuickView(product)}
          onAddToCart={() => onAddToCart?.(product)}
          onToggleWishlist={() => onToggleWishlist?.(product)}
        />
      ))}

      <QuickViewModal
        product={selectedProduct}
        isOpen={isModalOpen}
        onClose={closeQuickView}
      />
    </div>
  );
}
