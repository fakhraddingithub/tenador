import mongoose from "mongoose";

const PageSectionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    order: { type: Number, required: true },
    visible: { type: Boolean, default: true },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const ProductRuleSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "manual",
        "category",
        "brand",
        "serie",
        "sport",
        "featured",
        "bestseller",
        "new",
        "discount",
        "discountRule",
        "tag",
        "color",
      ],
      required: true,
    },
    operator: { type: String, enum: ["include", "exclude"], default: "include" },
    value: { type: mongoose.Schema.Types.Mixed },
    label: { type: String },
  },
  { _id: false }
);

const EventSchema = new mongoose.Schema(
  {
    // Basic Info
    name: { type: String, required: true, trim: true },
    // English name — drives slug generation in the admin form
    nameEn: { type: String, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    shortDescription: { type: String, trim: true },
    description: { type: String },

    // Status & Scheduling
    status: {
      type: String,
      enum: ["draft", "scheduled", "active", "paused", "ended", "archived"],
      default: "draft",
      index: true,
    },
    startDate: { type: Date },
    endDate: { type: Date },
    priority: { type: Number, default: 0 },

    // Visual Identity
    // headerImage + icon are the current fields (one header used everywhere a
    // cover/hero is needed). The legacy fields below are kept ONLY so old event
    // documents don't lose data / error — they are no longer edited or required.
    visualIdentity: {
      headerImage: { type: String },
      icon: { type: String },
      // legacy (deprecated) — read as fallback for old events
      logo: { type: String },
      coverImage: { type: String },
      heroImage: { type: String },
      mobileHeroImage: { type: String },
      backgroundImages: [{ type: String }],
      decorativeImages: [{ type: String }],
    },

    // Theme — all colors are hex strings; effect controls ambient animation
    theme: {
      primaryColor: { type: String, default: "#aa4725" },
      secondaryColor: { type: String, default: "#ffbf00" },
      accentColor: { type: String, default: "#ffffff" },
      backgroundColor: { type: String, default: "#0d0d0d" },
      textPrimary: { type: String, default: "#ffffff" },
      textSecondary: { type: String, default: "rgba(255,255,255,0.65)" },
      headingFont: { type: String, default: "Vazirmatn" },
      bodyFont: { type: String, default: "Vazirmatn" },
      borderRadius: { type: String, default: "8px" },
      gradient: { type: String, default: "" },
      effect: {
        type: {
          type: String,
          enum: ["none", "snow", "confetti", "particles", "sparkles", "leaves"],
          default: "none",
        },
        intensity: {
          type: String,
          enum: ["low", "medium", "high"],
          default: "medium",
        },
      },
      customCss: { type: String, default: "" },
    },

    // Product Selection Engine
    productSelection: {
      rules: [ProductRuleSchema],
      limit: { type: Number, default: 24 },
      sortBy: {
        type: String,
        enum: ["createdAt", "score", "basePrice", "name"],
        default: "createdAt",
      },
      sortOrder: { type: String, enum: ["asc", "desc"], default: "desc" },
    },

    // Product Card Customization
    cardCustomization: {
      badge: {
        enabled: { type: Boolean, default: false },
        text: { type: String, default: "" },
        bgColor: { type: String, default: "#ef4444" },
        textColor: { type: String, default: "#ffffff" },
      },
      ribbon: {
        enabled: { type: Boolean, default: false },
        text: { type: String, default: "" },
        bgColor: { type: String, default: "#ef4444" },
        textColor: { type: String, default: "#ffffff" },
        position: {
          type: String,
          enum: ["top-right", "top-left"],
          default: "top-right",
        },
      },
      sticker: {
        enabled: { type: Boolean, default: false },
        image: { type: String, default: "" },
        position: {
          type: String,
          enum: ["top-right", "top-left", "bottom-right", "bottom-left"],
          default: "top-left",
        },
        size: { type: String, enum: ["sm", "md", "lg"], default: "md" },
      },
      priceHighlight: { type: Boolean, default: false },
    },

    // Page Sections — ordered list of content blocks
    pageSections: [PageSectionSchema],

    // SEO & Social
    seo: {
      title: { type: String },
      description: { type: String },
      keywords: [{ type: String }],
    },
    social: {
      ogTitle: { type: String },
      ogDescription: { type: String },
      ogImage: { type: String },
      twitterTitle: { type: String },
      twitterDescription: { type: String },
    },

    // Template support
    isTemplate: { type: Boolean, default: false },
    templateName: { type: String },
    clonedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      default: null,
    },
  },
  { timestamps: true }
);

EventSchema.index({ status: 1, startDate: 1, endDate: 1 });

export default mongoose.models.Event || mongoose.model("Event", EventSchema);
