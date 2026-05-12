
import Sport from "base/models/Sport";
import connectToDB from "base/configs/db";

async function run() {
  await connectToDB();

  const sports = await Sport.find();

  for (let i = 0; i < sports.length; i++) {
    sports[i].order = i;
    await sports[i].save();
  }

  console.log("DONE");

  process.exit(0);
}

run().catch(console.error);