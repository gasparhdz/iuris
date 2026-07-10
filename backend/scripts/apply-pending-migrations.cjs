/**
 * Aplica manualmente las migraciones pendientes (0004, 0005, 0006) que
 * drizzle-kit migrate no logra aplicar (muere silenciosamente en este entorno).
 * Ejecuta cada SQL en una transacción y la registra en drizzle.__drizzle_migrations
 * con el mismo formato que usa drizzle (sha256 del contenido + "when" del journal),
 * para que las corridas futuras de drizzle-kit las consideren aplicadas.
 *
 * Uso: node scripts/apply-pending-migrations.cjs
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Client } = require("pg");
const fs = require("fs");
const crypto = require("crypto");

const DRIZZLE_DIR = path.join(__dirname, "..", "drizzle");
const journal = require(path.join(DRIZZLE_DIR, "meta", "_journal.json"));

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const applied = await c.query("select created_at from drizzle.__drizzle_migrations order by created_at desc limit 1");
  const lastApplied = applied.rows.length ? Number(applied.rows[0].created_at) : 0;
  console.log("Última migración aplicada (created_at):", lastApplied);

  const pending = journal.entries.filter((e) => e.when > lastApplied);
  if (!pending.length) {
    console.log("No hay migraciones pendientes.");
    await c.end();
    return;
  }
  console.log("Pendientes:", pending.map((e) => e.tag).join(", "));

  for (const entry of pending) {
    const file = path.join(DRIZZLE_DIR, entry.tag + ".sql");
    const sql = fs.readFileSync(file, "utf8");
    const statements = sql.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
    const hash = crypto.createHash("sha256").update(sql).digest("hex");

    console.log("\nAplicando " + entry.tag + " (" + statements.length + " statements)...");
    await c.query("BEGIN");
    try {
      for (let i = 0; i < statements.length; i++) {
        try {
          await c.query(statements[i]);
        } catch (e) {
          console.error("  FALLA en statement #" + (i + 1) + ": " + e.message);
          console.error("  SQL: " + statements[i].slice(0, 160));
          throw e;
        }
      }
      await c.query(
        "insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)",
        [hash, entry.when]
      );
      await c.query("COMMIT");
      console.log("  ✔ " + entry.tag + " aplicada y registrada.");
    } catch (e) {
      await c.query("ROLLBACK");
      console.error("  ✖ ROLLBACK de " + entry.tag + " — la base no fue modificada por esta migración.");
      process.exitCode = 1;
      break;
    }
  }
  await c.end();
}

main().catch((e) => { console.error("ERROR: " + e.message); process.exit(1); });
