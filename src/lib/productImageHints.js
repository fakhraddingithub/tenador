import { getImageProps } from "next/image";
import { preload } from "react-dom";
import imagekitLoader from "./imagekitLoader";
import { buildGalleryImages } from "./variantImages";
import { PRODUCT_IMAGE_SIZES } from "./productImageSizing";

// Use exactly the gallery's initial source and responsive candidates. A separate
// fixed-width preload would download a second image on some screen sizes.
export function preloadProductImage(product) {
  const src = buildGalleryImages(product)[0];
  if (!src) return;
  const { props } = getImageProps({ src, alt: "", fill: true, sizes: PRODUCT_IMAGE_SIZES, loader: imagekitLoader });
  preload(props.src, { as: "image", imageSrcSet: props.srcSet, imageSizes: props.sizes, fetchPriority: "high" });
}
