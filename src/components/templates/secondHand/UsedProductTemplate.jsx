import UsedProductClientSection from "./Usedproductclientsection";
import UsedProductTabs from "./UsedProductTabs";

const UsedProductTemplate = ({ product }) => {
  const technicalStats = {
    productStats:  product.baseProduct.technicalStats || [],
    categoryStats: product.baseProduct.category?.technicalStats || [],
    color:         product.baseProduct.color,
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 sm:py-8 md:py-12 lg:px-8">
        {/* Gallery + Info */}
        <UsedProductClientSection product={product} />

        {/* Tabs */}
        <div className="mt-10 sm:mt-12 md:mt-16">
          <UsedProductTabs
            healthScores={product.healthScores}
            customFields={product.customFields}
            overallScore={product.overallScore}
            description={product.baseProduct.longDescription}
            attributes={product.baseProduct.attributes}
            technicalStats={technicalStats}
          />
        </div>
      </div>
    </div>
  );
};

export default UsedProductTemplate;