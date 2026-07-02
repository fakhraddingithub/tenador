'use client';

import ImageUpload from '@/components/admin/ImageUpload';

function cleanImages(images) {
  return Array.isArray(images) ? images.filter(Boolean) : [];
}

export default function VariantValueImageUpload({
  value,
  onChange,
  folder = 'product/variant-values',
}) {
  const images = cleanImages(value);
  const mainImage = images[0] || '';
  const galleryImages = images.slice(1);

  const updateImages = (main, gallery) => {
    const cleanGallery = cleanImages(gallery).filter((url) => url !== main);
    onChange(main ? [main, ...cleanGallery] : cleanGallery);
  };

  return (
    <div className="space-y-4">
      <ImageUpload
        key={mainImage || 'empty-main'}
        label="عکس اصلی مقدار"
        value={mainImage}
        onChange={(url) => updateImages(url, galleryImages)}
        folder={folder}
        className="mb-0"
      />
      <ImageUpload
        key={galleryImages.join('|') || 'empty-gallery'}
        label="عکس‌های گالری مقدار"
        multiple
        value={galleryImages}
        onChange={(imgs) => updateImages(mainImage, imgs)}
        folder={folder}
        className="mb-0"
      />
    </div>
  );
}
