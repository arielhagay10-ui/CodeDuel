import { Pool } from "pg";

declare global {
  var codewarsPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required for database-backed features.");
  }

  return new Pool({ connectionString, max: 10 });
}

export function getDb() {
  const pool = global.codewarsPool ?? createPool();
  if (process.env.NODE_ENV !== "production") {
    global.codewarsPool = pool;
  }
  return pool;
}
