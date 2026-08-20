import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn(
    "DATABASE_URL is not set. Database queries will fail until configured.",
  );
}

const client = connectionString ? postgres(connectionString) : null;

export const db = client ? drizzle(client, { schema }) : null;

export type Database = NonNullable<typeof db>;
