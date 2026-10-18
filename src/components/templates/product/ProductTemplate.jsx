import { Suspense } from "react";
import ProductClientSection from "./ProductClientSection";
import ProductTabs from "./ProductTabs";
import ProductShare from "./ProductShare";
import ProductExploreNav from "./ProductExploreNav";
import RelatedProducts from "./RelatedProducts";
import ProductAssurance from "./ProductAssurance";

const ProductTemplate = ({ product, reviews = [], reviewStats, rate }) => {
  const technicalStats = {
    productStats: product.technicalStats || [],
    categoryStats: product.category.technicalStats || [],
    color: product.color,
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 pt-8">
        <div className="container mx-auto px-4 pt-6 sm:pt-8 md:pt-12 lg:px-8">
          {/* Gallery + Info — coupled via client state */}
          <ProductClientSection product={product} />

          {/* Tabs */}
          <div className="mt-10 sm:mt-12 md:mt-16">
            <ProductTabs
              description={product.longDescription}
              attributes={product.attributes}
              technicalStats={technicalStats}
              targetAudience={product.targetAudience}
              customTab={product.category.customTab}
              customTabItemIds={product.customTabItems || []}
              productId={product._id}
              reviews={reviews}
              reviewStats={reviewStats}
            />
          </div>
          <div className="mt-10 sm:mt-12 md:mt-16">
            <ProductAssurance />
            <div className="mt-3 sm:mt-4">
              <ProductShare />
            </div>
            <div className="mt-6">
              <ProductExploreNav product={product} />
            </div>
          </div>
        </div>
      </div>
      <Suspense fallback={null}>
        <RelatedProducts productId={product._id} rate={rate} />
      </Suspense>
    </div>
  );
};

export default ProductTemplate;
