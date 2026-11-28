import mongoose from "mongoose";

export async function connectDb(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;

  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error(
      "MONGODB_URI is required. Set it in .env (e.g. mongodb://localhost:27017/green-initiatives after running 'npm run services:up').",
    );
  }

  await mongoose.connect(uri);
  console.info("[db] Connected to MongoDB");
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
