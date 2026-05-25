import mongoose from "mongoose";

const newsletterSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true, // جلوگیری از ثبت ایمیل تکراری
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'لطفاً یک ایمیل معتبر وارد کنید']
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

export default mongoose.models.Newsletter || mongoose.model("Newsletter", newsletterSchema);