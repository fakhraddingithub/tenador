import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import Event from "base/models/Event";

export const getActiveEvents = unstable_cache(
  async () => {
    await connectToDB();
    const now = new Date();
    const events = await Event.find({
      status: "active",
      $or: [{ endDate: null }, { endDate: { $gt: now } }],
    })
      .sort({ priority: -1, startDate: -1 })
      .lean();
    return JSON.parse(JSON.stringify(events));
  },
  ["active-events"],
  { revalidate: 300, tags: ["events"] }
);

export const getAllEventsForAdmin = unstable_cache(
  async () => {
    await connectToDB();
    const events = await Event.find({ isTemplate: { $ne: true } })
      .sort({ priority: -1, updatedAt: -1 })
      .lean();
    return JSON.parse(JSON.stringify(events));
  },
  ["all-events-admin"],
  { revalidate: 60, tags: ["events"] }
);

export const getEventBySlug = unstable_cache(
  async (slug) => {
    await connectToDB();
    const event = await Event.findOne({ slug, status: "active" }).lean();
    if (!event) return null;
    return JSON.parse(JSON.stringify(event));
  },
  ["event-by-slug"],
  { revalidate: 300, tags: ["events"] }
);

export const getEventTemplates = unstable_cache(
  async () => {
    await connectToDB();
    const templates = await Event.find({ isTemplate: true })
      .sort({ updatedAt: -1 })
      .lean();
    return JSON.parse(JSON.stringify(templates));
  },
  ["event-templates"],
  { revalidate: 600, tags: ["events"] }
);
