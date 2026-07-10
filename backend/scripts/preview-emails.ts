/**
 * Genera HTML de preview de los 4 templates unificados.
 * Invocado por scripts/preview-emails.cjs vía tsx.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  renderRecordatorioCobranza,
  renderRecordatorioEvento,
  renderRecordatorioTarea,
  renderRecuperarPassword,
} from "../src/services/email.service.js";
import { artLocalToUtc } from "../src/utils/timezone.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "tmp", "email-previews");

const samples = {
  "01-tarea.html": renderRecordatorioTarea({
    id: 42,
    titulo: "Contestar demanda",
    descripcion: "Plazo de traslado — 15 días hábiles",
    fechaLimite: artLocalToUtc("2026-07-10", "18:00"),
    caso: { caratula: "Albetti c/ Ormaechea", nroExpte: "123/2024" },
    subtareas: [
      { titulo: "Revisar documental", completada: true },
      { titulo: "Armar escrito de contestación", completada: false, descripcion: "Incluir excepciones" },
    ],
  }),
  "02-evento.html": renderRecordatorioEvento({
    id: 15,
    descripcion: "Audiencia preliminar",
    fechaInicio: artLocalToUtc("2026-07-11", "10:30"),
    caso: { caratula: "Albetti c/ Ormaechea", nroExpte: "123/2024" },
  }),
  "03-cobranza.html": renderRecordatorioCobranza({
    vencidas: [
      {
        numero: 2,
        vencimiento: artLocalToUtc("2026-07-01", "00:00"),
        clienteNombre: "García, Ana",
        casoCaratula: "García c/ López",
        montoPesos: "150000.00",
        montoJus: null,
        montoAplicado: "0.00",
        valorJusRef: null,
      },
    ],
    porVencer: [
      {
        numero: 3,
        vencimiento: artLocalToUtc("2026-07-15", "00:00"),
        clienteNombre: "García, Ana",
        casoCaratula: "García c/ López",
        montoPesos: "150000.00",
        montoJus: null,
        montoAplicado: "50000.00",
        valorJusRef: null,
      },
    ],
  }),
  "04-recuperar-password.html": renderRecuperarPassword({
    nombre: "Gaspar",
    resetUrl: "http://localhost:5173/reset-password?token=preview-token&email=gaspar%40ejemplo.com",
  }),
};

fs.mkdirSync(outDir, { recursive: true });

for (const [filename, rendered] of Object.entries(samples)) {
  const filePath = path.join(outDir, filename);
  fs.writeFileSync(filePath, rendered.html, "utf8");
  const textPath = filePath.replace(/\.html$/, ".txt");
  fs.writeFileSync(textPath, rendered.text, "utf8");
  console.log(`Wrote ${filePath}`);
  console.log(`  subject: ${rendered.subject}`);
}

console.log(`\nAbrí los HTML en el navegador desde:\n  ${outDir}`);
