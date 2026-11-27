import { CommentModel } from "./server/models";
import { connectToMongoDB } from "./server/connect/mongodb";

async function checkFlags() {
  await connectToMongoDB();
  const flagged = await CommentModel.find({ flagCount: { $gt: 0 } });
  console.warn("Flagged comments in DB:", JSON.stringify(flagged, null, 2));
  process.exit(0);
}

checkFlags();
