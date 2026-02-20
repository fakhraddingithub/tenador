import mongoose from "mongoose";

const SlideSchema = new mongoose.Schema(
  {
    position: {
      type: String,
      required: true,
      index: true,
    },

    image: {
      type: String,
      required: true,
    },

    title: {
      type: String,
      trim: true,
    },

    subtitle: {
      type: String,
      trim: true,
    },

    link: {
      type: String,
      trim: true,
    },

    priority: {
      type: Number,
      required: true,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

SlideSchema.index({ position: 1, priority: 1 }, { unique: true });

export default mongoose.models.Slide ||
  mongoose.model("Slide", SlideSchema);