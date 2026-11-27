import { CommentModel } from "./server/models";
import { connectToMongoDB } from "./server/connect/mongodb";

async function checkFlags() {
  try {
    await connectToMongoDB();
    const flagged = await CommentModel.find({ flagCount: { $gt: 0 } });
    console.warn("Flagged comments in DB count:", flagged.length);
    flagged.forEach((c) => {
      console.warn(`- ID: ${c._id}, Content: ${c.content}, FlagCount: ${c.flagCount}`);
    });
  } catch (err) {
    console.error("Error checking flags:", err);
  } finally {
    process.exit(0);
  }
}

checkFlags();
