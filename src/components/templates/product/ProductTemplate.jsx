import ProductClientSection from "./ProductClientSection";
import ProductTabs from "./ProductTabs";

const ProductTemplate = ({ product }) => {
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
            reviews={[]}
          />
        </div>
      </div>
    </div>
  );
};

export default ProductTemplate;
