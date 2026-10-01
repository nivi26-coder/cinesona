import "server-only";
import { MongoClient, type Db } from "mongodb";

// Reuse one client across hot reloads in dev and across invocations of a warm
// serverless function in production. Opening a new connection per request
// would exhaust the Atlas free tier's connection limit quickly.
const globalForMongo = globalThis as unknown as {
  _mongoClient?: Promise<MongoClient>;
};

export function isDbConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

export async function getDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.example to .env.local and add your Atlas connection string.",
    );
  }

  if (!globalForMongo._mongoClient) {
    globalForMongo._mongoClient = new MongoClient(uri, {
      appName: "cinesona",
      maxPoolSize: 10,
    })
      .connect()
      .catch((error: unknown) => {
        // Don't cache a failed connection, so the next request retries.
        globalForMongo._mongoClient = undefined;
        throw error;
      });
  }

  const client = await globalForMongo._mongoClient;
  return client.db(process.env.MONGODB_DB ?? "sample_mflix");
}
