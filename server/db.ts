import mongoose from "mongoose";

let memoryServer: { stop: () => Promise<boolean> } | null = null;

export async function connectDb(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;

  let uri = process.env.MONGODB_URI;
  if (!uri) {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create();
    memoryServer = server;
    uri = server.getUri();
    console.info("[db] Started in-memory MongoDB");
  }

  await mongoose.connect(uri);
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
