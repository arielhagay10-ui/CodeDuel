import { Pool } from "pg";

declare global {
  var codeduelPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required for database-backed features.");
  }

  return new Pool({ connectionString, max: 10 });
}

export function getDb() {
  const pool = global.codeduelPool ?? createPool();
  if (process.env.NODE_ENV !== "production") {
    global.codeduelPool = pool;
  }
  return pool;
}
