import Image from "next/image";

/**
 * Optional decoration layer that mounts into the shared <ProductCard overlay=...>
 * slot. It only draws event-specific flair (ribbon / sticker / badge) defined in
 * the event's cardCustomization — it is NOT a product card and never reimplements
 * the card's image/price/actions. Regular (non-event) pages pass no overlay, so
 * the shared card renders exactly as before.
 */

// The sticker is locked to the brand logo's exact footprint: the logo Image is
// rendered at 30px × 30px (ProductCard), so the sticker is the same 30px square.
const STICKER_SIZE = "w-[30px] h-[30px]";

const stickerPositions = {
  "top-right": "top-2 right-2",
  "bottom-right": "bottom-2 right-2",
  "bottom-left": "bottom-2 left-2",
  // The brand logo lives at top-3 left-3 (12px) and is 30px tall → its bottom edge
  // is at 42px. top-12 (48px) places the sticker directly below the logo, sharing
  // its left edge (left-3), with a 6px gap (48 = 12 + 30 + 6) — aligned, no overlap.
  "top-left": "top-12 left-3",
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
  // NOTE: the campaign *badge* is no longer drawn here — it now renders inside
  // ProductCard's badge stack with the exact discount-badge style (via the
  // `campaignBadge` prop). This overlay only handles ribbon + sticker flair.
  const { ribbon = {}, sticker = {} } = customization;

  const hasRibbon = ribbon.enabled && ribbon.text;
  const hasSticker = sticker.enabled && sticker.image;

  if (!hasRibbon && !hasSticker) return null;

  return (
    // No z-index on the root: that lets each child set its OWN stacking level
    // relative to the card (the brand logo is z-20). The ribbon sits above
    // everything (z-30); the sticker sits BELOW the logo (z-10) so the logo always
    // wins if they ever touch — together with the top-14 offset, zero overlap.
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {/* Ribbon — diagonal corner banner */}
      {hasRibbon && (
        <div className="absolute inset-0 overflow-hidden z-30">
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

      {/* Sticker — circular badge image. z-10 keeps it UNDER the brand logo (z-20). */}
      {hasSticker && (
        <div className={`absolute z-10 ${stickerPositions[sticker.position] || stickerPositions["top-left"]}`}>
          <div className={`relative ${STICKER_SIZE} rounded-full overflow-hidden`}>
            <Image src={sticker.image} alt="" fill className="object-contain" sizes="30px" />
          </div>
        </div>
      )}
    </div>
  );
}
