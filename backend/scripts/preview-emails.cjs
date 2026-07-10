/**
 * Renderiza los 4 templates de email a HTML local para revisión visual.
 *
 * Uso (desde backend/):
 *   node scripts/preview-emails.cjs
 *
 * Salida: tmp/email-previews/*.html
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const runner = path.join(__dirname, "preview-emails.ts");
const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsx", runner],
  {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

process.exit(result.status ?? 1);
