import pg from "pg";
const pool = new pg.Pool({ connectionString: "postgresql://postgres:123456@localhost:5432/iuris" });
async function main() {
  const h = await pool.query("SELECT id, estudio_id, cliente_id, caso_id, jus, monto_pesos, valor_jus_ref FROM honorarios WHERE jus = '46.0000';");
  console.log("=== HONORARIOS OF 46 JUS ===");
  console.log({ count: h.rows.length, ids: h.rows.map((row) => row.id) });
  
  if (h.rows[0]?.cliente_id) {
    const allH = await pool.query("SELECT id FROM honorarios WHERE cliente_id = $1;", [h.rows[0].cliente_id]);
    console.log("=== ALL HONORARIOS FOR THIS CLIENT ===");
    console.log({ count: allH.rows.length, ids: allH.rows.map((row) => row.id) });
  }
  
  process.exit(0);
}
main().catch(err => { console.error(err); process.exit(1); });
