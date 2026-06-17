"use client";

/**
 * Injects event-specific CSS custom properties scoped to .event-page.
 * The rest of the site is unaffected — all event colors use --event-* vars.
 */
export default function EventThemeWrapper({ theme = {}, children }) {
  const {
    primaryColor = "#aa4725",
    secondaryColor = "#ffbf00",
    accentColor = "#ffffff",
    backgroundColor = "#0d0d0d",
    textPrimary = "#ffffff",
    textSecondary = "rgba(255,255,255,0.65)",
    headingFont = "Vazirmatn",
    bodyFont = "Vazirmatn",
    borderRadius = "8px",
    gradient = "",
    customCss = "",
  } = theme;

  const cssVars = `
    .event-page {
      --event-primary: ${primaryColor};
      --event-secondary: ${secondaryColor};
      --event-accent: ${accentColor};
      --event-bg: ${backgroundColor};
      --event-text: ${textPrimary};
      --event-text-muted: ${textSecondary};
      --event-heading-font: '${headingFont}', 'Vazirmatn', sans-serif;
      --event-body-font: '${bodyFont}', 'Vazirmatn', sans-serif;
      --event-radius: ${borderRadius};
      --event-gradient: ${gradient || `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`};

      /* Re-point the SITE's existing brand tokens at the event theme so the
         reused storefront components (ProductCard, ProductList, SeriesSlider…)
         pick up this event's identity through the same CSS-variable mechanism
         the rest of the site uses — no separate styling system.
         --color-text is intentionally left untouched: the shared white product
         card depends on its dark default. */
      --color-primary: ${primaryColor};
      --color-secondary: ${secondaryColor};
      --radius: ${borderRadius};

      /* Page background surface — consumed by the reused Sport page root
         (bg-[var(--page-surface,#fcfcfc)]) so the admin's background color
         actually paints the campaign page backdrop (white storefront cards
         float on top of it). */
      --page-surface: ${backgroundColor};
    }
    ${customCss}
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      <div
        className="event-page min-h-screen"
        style={{
          background: backgroundColor,
          color: textPrimary,
          fontFamily: `'${bodyFont}', 'Vazirmatn', sans-serif`,
        }}
      >
        {children}
      </div>
    </>
  );
}
