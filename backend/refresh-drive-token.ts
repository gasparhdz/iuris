/**
 * Script para regenerar el refresh_token de Google Drive OAuth2.
 *
 * Uso:
 *   npx tsx refresh-drive-token.ts
 *
 * 1. Se abre automáticamente el navegador con la pantalla de login de Google.
 * 2. Iniciá sesión con la cuenta drive.iuris@gmail.com.
 * 3. Autorizá la aplicación.
 * 4. El código se captura automáticamente y se imprime el nuevo refresh_token.
 */

import { OAuth2Client } from "google-auth-library";
import http from "node:http";
import { exec } from "node:child_process";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("\n❌ Falta GOOGLE_CLIENT_ID y/o GOOGLE_CLIENT_SECRET en el entorno (.env).\n");
  process.exit(1);
}
const PORT = 3333;
const REDIRECT_URI = `http://localhost:${PORT}`;

const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/drive"],
});

console.log("\n=============================================");
console.log("  REGENERAR REFRESH TOKEN DE GOOGLE DRIVE");
console.log("=============================================\n");
console.log("Abriendo el navegador para iniciar sesión con Google...\n");
console.log("Si no se abre automáticamente, copiá esta URL:\n");
console.log(`  ${authUrl}\n`);

// Abrir navegador automáticamente (Windows)
exec(`start "" "${authUrl}"`);

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith("/?") && !req.url?.startsWith("/oauth2callback")) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<h1>❌ Autorización denegada</h1><p>${error}</p><p>Podés cerrar esta pestaña.</p>`);
    console.error(`\n❌ Error: ${error}`);
    server.close();
    process.exit(1);
    return;
  }

  if (!code) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h1>❌ No se recibió código</h1><p>Podés cerrar esta pestaña.</p>");
    return;
  }

  try {
    const { tokens } = await oAuth2Client.getToken(code);

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#1a1a2e;color:#e0e0e0">
        <h1 style="color:#4ade80">✅ ¡Token generado exitosamente!</h1>
        <p>Volvé a la terminal para ver el nuevo token.</p>
        <p style="color:#888">Podés cerrar esta pestaña.</p>
      </body></html>
    `);

    console.log("\n=============================================");
    console.log("  ✅ ¡TOKEN GENERADO EXITOSAMENTE!");
    console.log("=============================================\n");
    console.log("Copiá la siguiente línea y reemplazala en tu archivo .env:\n");
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    console.log("Después reiniciá el backend para que tome el nuevo token.");
    console.log("=============================================\n");
  } catch (err) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<h1>❌ Error al obtener el token</h1><p>Revisá la terminal.</p>`);
    console.error("\n❌ Error al obtener el token:", err instanceof Error ? err.message : err);
  } finally {
    server.close();
    setTimeout(() => process.exit(0), 1000);
  }
});

server.listen(PORT, () => {
  console.log(`Esperando respuesta de Google en http://localhost:${PORT} ...\n`);
});
