import connectToDB from "base/configs/db";
import Brand from "base/models/Brand";
import { registerSlug } from "base/actions/registerSlug";
import { revalidateContent } from "@/lib/revalidate";

export async function POST(req) {
  try {
    await connectToDB();

    const body = await req.json();

    const {
      name,
      title,
      country = null,
      foundedYear = null,
      description = "",
      logo = "",
      icon = "",
      image = "",
      prompts = [],
    } = body;

    // validation
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

    // check name regex (same as model, fail fast)
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(normalizedName)) {
      return Response.json(
        { error: "Name format is invalid" },
        { status: 400 }
      );
    }


    let sanitizedPrompts = [];
    if (Array.isArray(prompts)) {
      sanitizedPrompts = prompts
        .filter(p => p.field && p.context) // فقط مواردی که هر دو فیلد را دارند نگه دار
        .map(p => ({
          field: p.field.trim(),
          context: p.context.trim()
        }));
    }

    // duplicate check
    const exists = await Brand.findOne({ name: normalizedName });
    if (exists) {
      return Response.json(
        { error: "Brand already exists" },
        { status: 409 }
      );
    }

    // create brand
    const created = await Brand.create({
      name: normalizedName,
      title: title.trim(),
      country,
      foundedYear,
      description: description.trim(),
      logo: logo.trim(),
      icon: icon.trim(),
      image: image.trim(),
      prompts: sanitizedPrompts,
    });

    // register slug
    await registerSlug({
      slug: created.slug,
      type: "brand",
      model: "Brand",
      refId: created._id,
      filterField: "brand",
      filterValue: created._id,
      label: created.title,
      parentSlug: null,
    });

    revalidateContent(["navbar", "brands"]);

    return Response.json(
      {
        message: "Brand created successfully",
        brand: created,
      },
      { status: 201 }
    );
  } catch (err) {
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
