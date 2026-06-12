import * as dotenv from "dotenv";

// Carga el .env (para obtener host/credenciales) y reescribe SOLO el nombre de la base a la de
// test, derivándola de la URL de dev. Corre como setupFile de vitest, antes de que se importe
// `env.ts`/`db` — y como dotenv.config() no pisa vars ya seteadas, este valor gana.
dotenv.config();

const original = process.env.DATABASE_URL ?? "";
const testUrl = original.replace(/\/([^/?]+)(\?|$)/, "/iuris_test$2");

// Guarda de seguridad: estos tests CREAN y BORRAN datos. Si por cualquier motivo la URL no
// apunta a una base *_test, abortamos para no tocar jamás la base de desarrollo/producción.
const dbName = testUrl.split("/").pop()?.split("?")[0] ?? "";
if (!dbName.endsWith("_test")) {
  throw new Error(`Tests de integración abortados: la base "${dbName}" no termina en _test. No se ejecutan contra dev.`);
}

process.env.DATABASE_URL = testUrl;
