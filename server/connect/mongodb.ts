import mongoose from "mongoose";
import { logger } from "../logger";
import type { MongoMemoryServer } from "mongodb-memory-server";

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "greenInitiatives";

let mongod: MongoMemoryServer | null = null;

/**
 * Connects to MongoDB.
 * In production, uses the MONGODB_URI environment variable.
 * In development/sandbox, uses MongoMemoryServer if MONGODB_URI is not provided.
 */
export async function connectToMongoDB(): Promise<typeof mongoose> {
  try {
    const nodeEnv = process.env.NODE_ENV || "development";
    const isProduction = nodeEnv === "production";
    const isTest = nodeEnv === "test" || !!process.env.JEST_WORKER_ID;
    // In tests, ALWAYS use memory server for isolation, unless explicitly forced otherwise
    const useMemoryServer = (!MONGODB_URI && !isProduction) || isTest;

    let connectionUri = MONGODB_URI || "mongodb://localhost:27017";

    if (useMemoryServer) {
      logger.info("🧠 Starting in-memory MongoDB server...");
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      // Dev/sandbox: fixed port 27018 so you can inspect with mongosh/Compass (mongodb://localhost:27018)
      // Tests: random port for isolation
      const opts = isTest ? {} : { instance: { port: 27018, portGeneration: false } };
      mongod = await MongoMemoryServer.create(opts);
      connectionUri = mongod.getUri();
      logger.info(`🧠 In-memory MongoDB started at: ${connectionUri}`);
      if (!isTest) {
        logger.info(
          `   Inspect locally: mongosh mongodb://localhost:27018 --eval 'use ${DB_NAME}'`,
        );
      }
    }

    logger.info("🔌 Connecting to MongoDB with Mongoose...");

    const options: mongoose.ConnectOptions = {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: isProduction ? 10000 : 5000,
    };

    if (
      connectionUri.includes("localhost") ||
      connectionUri.includes("127.0.0.1") ||
      useMemoryServer
    ) {
      logger.info(
        useMemoryServer ? "🏠 Using in-memory MongoDB" : "🏠 Connecting to local MongoDB",
      );
    } else {
      logger.info("☁️  Connecting to remote MongoDB");
    }

    await mongoose.connect(connectionUri, options);

    logger.info("✅ Connected to MongoDB successfully with Mongoose");

    return mongoose;
  } catch (error) {
    const uriToLog = MONGODB_URI
      ? MONGODB_URI.replace(/\/\/[^@]+@/, "//<credentials>@")
      : "In-memory/Local";

    logger.error("❌ MongoDB connection error", {
      error: error instanceof Error ? error.message : String(error),
      uriPattern: uriToLog,
    });
    throw error;
  }
}

export function getDb() {
  if (!mongoose.connection.db) {
    throw new Error("Database not initialized. Call connectToMongoDB first.");
  }
  return mongoose.connection.db;
}

/**
 * Closes the connection and stops the memory server if it was started.
 */
export async function closeMongoConnection(): Promise<void> {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
    logger.info("🧠 In-memory MongoDB stopped");
  }
  logger.info("MongoDB connection closed");
}

// Helper to convert MongoDB _id to id - kept for compatibility if needed
export function toId<T>(doc: mongoose.Document | null): (T & { id: string }) | null {
  if (!doc) return null;
  const id = doc._id ? doc._id.toString() : (doc as unknown as { id: string }).id;
  const { _id, __v, ...rest } = doc.toObject ? doc.toObject() : doc;
  return { ...rest, id } as T & { id: string };
}
