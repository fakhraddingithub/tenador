import { getImageProps } from "next/image";

// Keep the native image's existing layout and error handling. Only the resource
// selection is delegated to Next's configured ImageKit/Cloudinary loader.
export default function ResponsiveImage({
  src,
  alt = "",
  sizes = "100vw",
  loading = "eager",
  ...rest
}) {
  const { props } = getImageProps({
    src,
    alt,
    fill: true,
    sizes,
    // Local placeholders are served as-is by the custom CDN loader.
    unoptimized: typeof src === "string" && src.startsWith("/"),
  });
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...rest} src={props.src} srcSet={props.srcSet} sizes={props.sizes} alt={alt} loading={loading} />
  );
}
