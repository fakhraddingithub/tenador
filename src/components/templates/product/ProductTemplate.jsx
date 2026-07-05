import ProductClientSection from "./ProductClientSection";
import ProductTabs from "./ProductTabs";
import ProductShare from "./ProductShare";

const ProductTemplate = ({ product, reviews = [], reviewStats }) => {
  const technicalStats = {
    productStats: product.technicalStats || [],
    categoryStats: product.category.technicalStats || [],
    color:product.color
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 sm:py-8 md:py-12 lg:px-8">
        {/* Gallery + Info — coupled via client state */}
        <ProductClientSection product={product} />

        {/* Tabs */}
        <div className="mt-10 sm:mt-12 md:mt-16">
          <ProductTabs
            description={product.longDescription}
            attributes={product.attributes}
            technicalStats={technicalStats}
            customTab={product.category.customTab}
            customTabItemIds={product.customTabItems || []}
            productId={product._id}
            reviews={reviews}
            reviewStats={reviewStats}
          />
        </div>
      <ProductShare/>
      </div>
    </div>
  );
};

export default ProductTemplate;
