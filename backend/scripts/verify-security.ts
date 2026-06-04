/**
 * Script de verificacion funcional de los fixes de seguridad de Iuris.
 *
 * Prueba 3 escenarios que DEBEN comportarse de cierta forma:
 *   1. Aislamiento de plataforma: DIRECTOR de un estudio cliente -> 403 en /admin/estudios,
 *      usuario de plataforma (estudio 1) -> 200.
 *   2. Invalidacion inmediata: tras change-password, el access token viejo da 401 al instante.
 *      (La contrasena se restaura automaticamente al terminar.)
 *   3. Reuso de refresh token: usar 2 veces el mismo refresh -> 401 + familia revocada.
 *
 * USO (PowerShell):
 *   $env:PLATFORM_EMAIL="admin@plataforma.com"; $env:PLATFORM_PASS="..."
 *   $env:DIRECTOR_EMAIL="director@estudio.com"; $env:DIRECTOR_PASS="..."
 *   npx tsx scripts/verify-security.ts
 *
 * Variables opcionales:
 *   BASE_URL  (default http://localhost:3000/api/v1)
 *
 * Nada de esto modifica datos de forma permanente: la prueba 2 cambia la contrasena del
 * DIRECTOR a una temporal y la vuelve a dejar como estaba.
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000/api/v1";
const PLATFORM_EMAIL = process.env.PLATFORM_EMAIL ?? "";
const PLATFORM_PASS = process.env.PLATFORM_PASS ?? "";
const DIRECTOR_EMAIL = process.env.DIRECTOR_EMAIL ?? "";
const DIRECTOR_PASS = process.env.DIRECTOR_PASS ?? "";

type LoginResult = {
  accessToken: string;
  refreshCookie: string | null;
  rol: string;
  estudioId: number;
};

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail: string) {
  const tag = ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  console.log(`  [${tag}] ${label} -> ${detail}`);
  if (ok) passed++; else failed++;
}

/** Extrae el valor de la cookie refreshToken de las cabeceras Set-Cookie. */
function extractRefreshCookie(res: Response): string | null {
  const setCookies = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookies) {
    const m = c.match(/^refreshToken=([^;]+)/);
    if (m) return `refreshToken=${m[1]}`;
  }
  return null;
}

async function login(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (res.status === 429) {
    throw new Error(
      `RATE LIMIT alcanzado en /login (max 5 por 15 min, por IP).\n` +
      `  El login esta limitado, por eso no se puede seguir. Soluciones:\n` +
      `  - Reinicia el backend (el rate-limit en memoria se resetea) y volve a correr el script, O\n` +
      `  - Espera ~15 minutos.`
    );
  }
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Login fallo para ${email}: ${res.status} ${txt}`);
  }
  const json = (await res.json()) as { data: { accessToken: string; user: { rol: string; estudioId: number } } };
  return {
    accessToken: json.data.accessToken,
    refreshCookie: extractRefreshCookie(res),
    rol: json.data.user.rol,
    estudioId: json.data.user.estudioId,
  };
}

async function getAdminEstudios(accessToken: string): Promise<number> {
  const res = await fetch(`${BASE_URL}/admin/estudios`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  return res.status;
}

async function getMe(accessToken: string): Promise<number> {
  const res = await fetch(`${BASE_URL}/auth/me`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  return res.status;
}

async function changePassword(accessToken: string, currentPassword: string, newPassword: string): Promise<number> {
  const res = await fetch(`${BASE_URL}/auth/change-password`, {
    method: "PUT",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return res.status;
}

/** Llama /auth/refresh con una cookie de refresh dada. Devuelve {status, nextCookie}. */
async function refresh(refreshCookie: string): Promise<{ status: number; nextCookie: string | null }> {
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { cookie: refreshCookie },
  });
  return { status: res.status, nextCookie: extractRefreshCookie(res) };
}

// ---------------------------------------------------------------------------

async function prueba1_aislamientoPlataforma(): Promise<LoginResult> {
  console.log("\n\x1b[1m[1] Aislamiento de plataforma (fix critico #1)\x1b[0m");

  const director = await login(DIRECTOR_EMAIL, DIRECTOR_PASS);
  const statusDirector = await getAdminEstudios(director.accessToken);
  check(
    "DIRECTOR de estudio cliente NO accede a /admin/estudios",
    statusDirector === 403,
    `esperado 403, recibido ${statusDirector} (rol=${director.rol}, estudioId=${director.estudioId})`
  );

  const platform = await login(PLATFORM_EMAIL, PLATFORM_PASS);
  const statusPlatform = await getAdminEstudios(platform.accessToken);
  check(
    "Usuario de plataforma SI accede a /admin/estudios",
    statusPlatform === 200,
    `esperado 200, recibido ${statusPlatform} (rol=${platform.rol}, estudioId=${platform.estudioId})`
  );

  return director; // reutilizamos esta sesion en la prueba 2 para no gastar otro login (rate limit).
}

async function prueba2_invalidacionInmediata(directorSession: LoginResult) {
  console.log("\n\x1b[1m[2] Invalidacion inmediata tras cambio de contrasena (fix #3)\x1b[0m");

  const tempPass = `${DIRECTOR_PASS}_tmp1`;
  const oldToken = directorSession.accessToken;

  // Confirmamos que el token sirve ANTES del cambio.
  const before = await getMe(oldToken);
  check("Access token valido antes del cambio", before === 200, `esperado 200, recibido ${before}`);

  // Cambiamos la contrasena usando ese mismo token.
  const changeStatus = await changePassword(oldToken, DIRECTOR_PASS, tempPass);
  if (changeStatus !== 200) {
    check("Cambio de contrasena", false, `esperado 200, recibido ${changeStatus} (no se pudo continuar la prueba)`);
    return;
  }

  // El token VIEJO debe quedar invalidado de inmediato (tokenVersion incrementada).
  const after = await getMe(oldToken);
  check(
    "Access token viejo invalidado al instante tras change-password",
    after === 401,
    `esperado 401, recibido ${after}`
  );

  // Restauramos la contrasena original para dejar la cuenta como estaba.
  const reloginTmp = await login(DIRECTOR_EMAIL, tempPass);
  const restoreStatus = await changePassword(reloginTmp.accessToken, tempPass, DIRECTOR_PASS);
  check(
    "Restauracion de la contrasena original",
    restoreStatus === 200,
    restoreStatus === 200 ? "contrasena restaurada OK" : `ATENCION: no se restauro (status ${restoreStatus}); la pass del director quedo en "${tempPass}"`
  );
}

async function prueba3_reusoRefresh() {
  console.log("\n\x1b[1m[3] Deteccion de reuso de refresh token (fix #4)\x1b[0m");

  const session = await login(DIRECTOR_EMAIL, DIRECTOR_PASS);
  const R1 = session.refreshCookie;
  if (!R1) {
    check("Obtencion de cookie refreshToken en login", false, "no se encontro Set-Cookie refreshToken");
    return;
  }

  // Primer refresh con R1: debe funcionar y entregar R2.
  const first = await refresh(R1);
  const R2 = first.nextCookie;
  check("Primer refresh con R1 funciona", first.status === 200 && !!R2, `status ${first.status}, R2 ${R2 ? "recibido" : "ausente"}`);

  // Segundo refresh REUSANDO R1: debe ser rechazado (reuso detectado).
  const reuse = await refresh(R1);
  check("Reuso de R1 rechazado", reuse.status === 401, `esperado 401, recibido ${reuse.status}`);

  // Tras el reuso, la familia entera queda revocada: R2 tambien debe fallar.
  if (R2) {
    const r2after = await refresh(R2);
    check("R2 invalidado por revocacion de familia", r2after.status === 401, `esperado 401, recibido ${r2after.status}`);
  }
}

async function main() {
  console.log(`\x1b[1mVerificacion de seguridad Iuris\x1b[0m  (BASE_URL=${BASE_URL})`);

  const missing = [
    ["PLATFORM_EMAIL", PLATFORM_EMAIL],
    ["PLATFORM_PASS", PLATFORM_PASS],
    ["DIRECTOR_EMAIL", DIRECTOR_EMAIL],
    ["DIRECTOR_PASS", DIRECTOR_PASS],
  ].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    console.error(`\n\x1b[31mFaltan variables de entorno: ${missing.join(", ")}\x1b[0m`);
    console.error("Ejemplo (PowerShell):");
    console.error('  $env:PLATFORM_EMAIL="admin@plataforma.com"; $env:PLATFORM_PASS="..."');
    console.error('  $env:DIRECTOR_EMAIL="director@estudio.com"; $env:DIRECTOR_PASS="..."');
    console.error("  npx tsx scripts/verify-security.ts");
    process.exit(2);
  }

  try {
    const directorSession = await prueba1_aislamientoPlataforma();
    await prueba2_invalidacionInmediata(directorSession);
    await prueba3_reusoRefresh();
  } catch (e) {
    console.error(`\n\x1b[31mError ejecutando las pruebas:\x1b[0m ${(e as Error).message}`);
    process.exit(1);
  }

  console.log(`\n\x1b[1mResultado:\x1b[0m ${passed} PASS, ${failed} FAIL`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
