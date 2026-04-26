import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { getPool } from "./db";

type MigrationRow = {
  filename: string;
};

async function main() {
  const migrationsDir = path.join(process.cwd(), "db", "migrations");
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id bigserial PRIMARY KEY,
        filename text NOT NULL UNIQUE,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query("COMMIT");

    const applied = await client.query<MigrationRow>(
      "SELECT filename FROM schema_migrations ORDER BY filename ASC",
    );
    const appliedSet = new Set(applied.rows.map((r) => r.filename));

    const pending = files.filter((f) => !appliedSet.has(f));
    if (pending.length === 0) {
      console.log("No pending migrations.");
      return;
    }

    for (const filename of pending) {
      const fullPath = path.join(migrationsDir, filename);
      const sql = await readFile(fullPath, "utf8");
      console.log(`Applying ${filename}...`);

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations(filename) VALUES ($1)",
          [filename],
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    console.log(`Applied ${pending.length} migration(s).`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

