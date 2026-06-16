import Image from "next/image";

/**
 * Optional decoration layer that mounts into the shared <ProductCard overlay=...>
 * slot. It only draws event-specific flair (ribbon / sticker / badge) defined in
 * the event's cardCustomization — it is NOT a product card and never reimplements
 * the card's image/price/actions. Regular (non-event) pages pass no overlay, so
 * the shared card renders exactly as before.
 */

const stickerSizes = { sm: "w-10 h-10", md: "w-14 h-14", lg: "w-20 h-20" };

const stickerPositions = {
  "top-right": "top-2 right-2",
  "bottom-right": "bottom-2 right-2",
  "bottom-left": "bottom-2 left-2",
  "top-left": "top-2 left-2",
};

const ribbonStyles = {
  "top-right": {
    top: 0,
    right: 0,
    transformOrigin: "top right",
    transform: "translate(29.3%,0) rotate(45deg) translate(0,70%)",
    padding: "2px 28px",
  },
  "top-left": {
    top: 0,
    left: 0,
    transformOrigin: "top left",
    transform: "translate(-29.3%,0) rotate(-45deg) translate(0,70%)",
    padding: "2px 28px",
  },
};

export default function EventCardOverlay({ customization = {} }) {
  const { badge = {}, ribbon = {}, sticker = {} } = customization;

  const hasRibbon = ribbon.enabled && ribbon.text;
  const hasSticker = sticker.enabled && sticker.image;
  const hasBadge = badge.enabled && badge.text;

  if (!hasRibbon && !hasSticker && !hasBadge) return null;

  return (
    <div className="absolute inset-0 z-30 pointer-events-none" aria-hidden="true">
      {/* Ribbon — diagonal corner banner */}
      {hasRibbon && (
        <div className="absolute inset-0 overflow-hidden">
          <span
            className="absolute text-[10px] font-black whitespace-nowrap"
            style={{
              ...ribbonStyles[ribbon.position || "top-right"],
              background: ribbon.bgColor || "var(--event-primary, #aa4725)",
              color: ribbon.textColor || "#ffffff",
            }}
          >
            {ribbon.text}
          </span>
        </div>
      )}

      {/* Sticker — circular badge image */}
      {hasSticker && (
        <div className={`absolute ${stickerPositions[sticker.position] || stickerPositions["top-left"]}`}>
          <div className={`relative ${stickerSizes[sticker.size || "md"]} rounded-full overflow-hidden`}>
            <Image src={sticker.image} alt="" fill className="object-contain" sizes="80px" />
          </div>
        </div>
      )}

      {/* Badge — text chip pinned bottom-right of the image area */}
      {hasBadge && (
        <span
          className="absolute bottom-2 right-2 text-[9px] font-black px-2 py-0.5 rounded-full"
          style={{
            background: badge.bgColor || "var(--event-primary, #aa4725)",
            color: badge.textColor || "#ffffff",
          }}
        >
          {badge.text}
        </span>
      )}
    </div>
  );
}
