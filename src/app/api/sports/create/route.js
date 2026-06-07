import connectToDB from "base/configs/db";
import Sport from "base/models/Sport";
import { registerSlug } from "base/actions/registerSlug";
import { revalidateContent } from "@/lib/revalidate";

export async function POST(req) {
  try {
    await connectToDB();

    const body = await req.json();
    const {
      name,
      title,
      description = "",
      icon = "",
      image = "",
    } = body;

    // basic validation
    if (!name || !name.trim()) {
      return Response.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (!title || !title.trim()) {
      return Response.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const normalizedName = name.trim();

    // duplicate check (name)
    const exists = await Sport.findOne({ name: normalizedName });
    if (exists) {
      return Response.json(
        { error: "Sport with this name already exists" },
        { status: 409 }
      );
    }
    const count = await Sport.countDocuments();
    // create sport (slug handled by model)
    const created = await Sport.create({
      name: normalizedName,
      title: title.trim(),
      description: description.trim(),
      icon: icon.trim(),
      image: image.trim(),
      order: count,
    });

    // register slug
    await registerSlug({
      slug: created.slug,
      type: "sport",
      model: "Sport",
      refId: created._id,
      filterField: "sport",
      filterValue: created._id,
      label: created.name || created.title,
      parentSlug: null,
    });

    revalidateContent(["navbar", "sports"]);

    return Response.json(
      {
        message: "Sport created successfully",
        sport: created,
      },
      { status: 201 }
    );
  } catch (err) {
    // mongoose validation error
    if (err.name === "ValidationError") {
      return Response.json(
        { error: err.message },
        { status: 400 }
      );
    }

    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
