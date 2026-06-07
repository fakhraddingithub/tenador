import mongoose from "mongoose";
// ثبت همه‌ی اسکیماها به صورت side-effect تا populate دچار MissingSchemaError نشود
import "base/models/registerModels";

const url = process.env.MONGODB_URI_TENADOR;

const connectToDB = async () => {
  if (mongoose.connection.readyState >= 1) return;

  try {
    await mongoose.connect(url);
    console.log("<<<🎇 MongoDB Connected Successfully 🎇>>>");
  } catch (err) {
    console.error("MongoDB Error:", err.message);
  }
};

export default connectToDB;
