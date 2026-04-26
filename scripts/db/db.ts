import { Pool } from "pg";
import { env } from "@/lib/env";

let pool: Pool | undefined;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
    });
  }
  return pool;
}

