import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import SiteSetting from "base/models/SiteSetting";
import {
  normalizeRolandGarrosBanner,
  ROLAND_GARROS_BANNER_CACHE_TAG,
  ROLAND_GARROS_BANNER_SETTING_KEY,
} from "@/lib/rolandGarrosBanner";

export const getHomeRolandGarrosBanner = unstable_cache(
  async () => {
    await connectToDB();

    const setting = await SiteSetting.findOne({
      key: ROLAND_GARROS_BANNER_SETTING_KEY,
    }).lean();

    return normalizeRolandGarrosBanner(setting?.value);
  },
  ["home-roland-garros-banner"],
  { revalidate: 10800, tags: [ROLAND_GARROS_BANNER_CACHE_TAG] }
);
