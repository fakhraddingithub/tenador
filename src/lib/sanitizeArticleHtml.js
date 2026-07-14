import sanitizeHtml from "sanitize-html";

const OPTIONS = {
  allowedTags: [
    "p", "br", "strong", "b", "em", "i", "u", "s", "mark", "small",
    "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "code", "pre",
    "a", "span", "div", "figure", "figcaption", "img", "table", "thead",
    "tbody", "tr", "th", "td", "hr",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    th: ["colspan", "rowspan", "scope"],
    td: ["colspan", "rowspan"],
    "*": ["dir", "lang"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        ...(attribs.target === "_blank" ? { rel: "noopener noreferrer" } : {}),
      },
    }),
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
  },
};

export function sanitizeArticleHtml(value) {
  return sanitizeHtml(String(value || ""), OPTIONS);
}