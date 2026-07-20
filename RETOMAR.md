# RETOMAR — estado del proyecto iuris

> Documento para retomar el trabajo desde otra computadora o después de una pausa.
> Última actualización: sesión del 20/07/2026 (deploy a producción completado).

---

## 1. Qué necesito instalar en la otra computadora

Para **solo mirar/editar código y pasar prompts a Cursor/Codex**: alcanza con clonar el repo y un editor. No hace falta nada más.

Para **levantar y probar la app de verdad** (backend + frontend corriendo):

| Requisito | Versión / nota |
|---|---|
| **Node.js** | 22.x (en la máquina original es v22.16.0) |
| **PostgreSQL** | La base de datos. Sin esto el backend no arranca. |
| **Redis** | Colas (BullMQ), rate-limit y SSE. Sin esto el backend no arranca bien. |
| **Chromium / Playwright** | Para el sync SISFE (descarga de PDFs con browser headless). Se instala con `npx playwright install chromium` dentro de `backend/`. Solo necesario si vas a probar SISFE. |
| **Git** | Para clonar el repo. |

### Archivos que NO están en git y necesito llevar aparte
- **`backend/.env`** — variables de entorno (secretos, conexión a DB, credenciales SISFE/Drive, VAPID, SMTP). **Está excluido de git a propósito por seguridad.** Copiarlo por un medio seguro (gestor de contraseñas), NO por email ni Drive público. Sin este archivo el backend no arranca.
- (Opcional) La carpeta `~/.claude` si quiero llevar la memoria de Claude — ojo: solo funciona si el proyecto queda en la MISMA ruta (`C:\Users\Gaspar\Proyectos\iuris`); si la ruta cambia, la memoria no se detecta.

---

## 2. Cómo levantar el entorno desde cero

```bash
# 1. Clonar
git clone https://github.com/gasparhdz/iuris.git
cd iuris

# 2. Backend
cd backend
npm install
# copiar acá el archivo .env (ver arriba)
# asegurarse de que Postgres y Redis estén corriendo
node scripts/apply-pending-migrations.cjs   # aplicar migraciones (NO usar db:migrate, ver nota)
npm run dev                                   # levanta backend en :3000

# 3. Frontend (otra terminal)
cd ../frontend
npm install
npm run dev                                   # levanta frontend en :5173
```

### ⚠️ Nota crítica sobre migraciones
`npm run db:migrate` (drizzle-kit) **falla en silencio en Windows** en este proyecto: dice "applying migrations..." y sale sin aplicar nada ni avisar. **Usar siempre** `node scripts/apply-pending-migrations.cjs` — reporta statement por statement. Después de migrar, verificar el estado real de la base con una query, nunca confiar en el exit del comando.

---

## 3. Estado del proyecto: qué está hecho

**Todo el desarrollo de features está cerrado.** La etapa fue "cerrar y estabilizar antes del deploy", auditando módulo por módulo (flujo: Codex analiza → Claude verifica y triaga → Cursor implementa).

Cerrado y verificado:
- **Financiero completo** (lo más trabajado): honorarios con "obligado al pago" como persona real (cliente o tercero) → cuenta corriente / planes de pago / cobranza / reportes **deudor-céntricos** (los saldos pivotan sobre quién debe, no sobre el cliente del caso). Gastos siempre del cliente (por diseño).
- **Clientes, Terceros, Expedientes, Agenda/Eventos/Tareas** — saneados (soft-delete en joins, padre vivo en mutaciones, estados de error UI, etc.).
- **Dashboard/bandeja** — saneado; vista clásica eliminada.
- **SISFE** — sync robusto, lock atómico, proxy seguro, fechas en timezone Argentina.
- **Notificaciones** — bugs + rediseño de emails (template unificado, azul del sistema) + deep-links al item específico.
- **Seguridad** — 2 tandas de hardening aplicadas (SSRF proxy, escalada de roles, registro cerrado en prod, ticket SSE, valor JUS solo-admin, cross-tenant, reset tokens, JWT_SECRET, passwords, rate-limit fail-safe, swagger off, etc.).
- **Sin topes silenciosos de datos** — ningún cálculo ni listado descarta registros por límite; todo se lee en lotes hasta agotar.
- **Migraciones** aplicadas hasta la 0007 y verificadas contra la base.
- **UX financiera** — flujo expediente-primero en honorarios/ingresos/gastos; estado de listados persistido en la URL (`useListState`).

---

## 4. Recarga de finanzas — estado al 18/07/2026

- Se truncaron las tablas de finanzas de la base `iuris` local y Gaspar está **recargando a mano** honorarios/gastos/ingresos desde lexmanager (decisión: carga manual, no re-volcado automático).
- Convenciones vigentes: montos JUS con 2 decimales ("X,XX JUS", helper `formatJusQty`); saldo CC positivo = cliente debe; ingresos JUS se guardan en pesos + cotización (`valor_jus_al_cobro`); política JUS **AL_COBRO** en todos los honorarios JUS (el saldo en pesos se revalúa al valor JUS vigente — por eso "monto − saldo ≠ cobrado" en la vista Honorarios: el monto se muestra al JUS histórico y el saldo al actual).
- **Análisis caso por caso en curso.** Verificado ZALAZAR, DEBORA (expte 21-27883724-3): honorario 9.28 JUS, 2 ingresos (dic/2025 y abr/2026), saldo 8.0159 JUS = $1.092.709,88 — cruza al centavo en Honorarios, Planes y CC. **Continuar con los demás clientes.**
- Las bases de referencia `iuris_check`, `iuris_orig_check` y `lexmanager_check` fueron **eliminadas el 18/07** — quedan dumps en `_backups/*-20260718.dump` (carpeta NO versionada; restaurar con `pg_restore` si hace falta comparar contra lexmanager).
- Para mudar de PC: dump fresco de `iuris` + clone del repo + los `.env` (backend y frontend). Los adjuntos viven en Drive, no en disco.
- Después del análisis: cutover (backup fresco lexmanager → delta → verificación con `backend/scripts/verify-lexmanager-migration.cjs`) y deploy.

---

## 5. PRODUCCIÓN — desplegado el 18-20/07/2026

**iuris está EN PRODUCCIÓN en https://iurispro.com.ar**, conviviendo con lexmanager en el VPS (`ssh lex-vps` → root@200.58.103.155). Arquitectura:

- **Backend:** servicio systemd `iuris-backend` (usuario `iuris`, `node dist/server.js`, límites de memoria). Postgres 18 propio en :5433 (el 14 de :5432 es de lexmanager; ambos solo-localhost). Redis 8 (repo oficial). Node 22. Swap 2 GB.
- **Frontend:** build estático servido por nginx; `/api/*` se reescribe a `/api/v1/*` hacia :3000 (misma reescritura que el proxy de Vite en dev).
- **HTTPS:** certbot/Let's Encrypt con renovación automática. DNS en Cloudflare (delegado desde nic.ar).
- **Deploy:** `powershell -File scripts\deploy.ps1` (build local de ambos, scp, git pull en VPS, migraciones, restart). **NUNCA buildear en el VPS** (tsc y vite OOMean con 2 GB).
- **Backups:** `pg_dump` diario 3 AM (`/etc/cron.d/backup-iuris` → `/var/backups/iuris/`, 14 días).
- **SISFE:** sync headless funciona en el VPS (usa Google Chrome real instalado vía Playwright). El **login interactivo** corre sobre pantalla virtual (servicios `iuris-xvfb`/`iuris-x11vnc`/`iuris-novnc`, backend con `DISPLAY=:99`) y el usuario lo ve en `https://iurispro.com.ar/sisfe-vnc/` (basic auth, user `iuris`; Gaspar tiene la password). El frontend abre esa pestaña solo.
- **Drive:** app OAuth publicada (token permanente, se acabó el `invalid_grant` semanal del modo Testing). Estructura: raíz global → `Estudio Meotto` → cliente → expediente (`estudios.drive_folder_id` corregido en ambas bases).
- **Usuario de Nadir:** `nadirmeotto@hotmail.com`.

### ⚠️ REGLA DE ORO desde el 20/07/2026

**La base del VPS es LA FUENTE DE VERDAD.** El análisis financiero está terminado, el cutover está HECHO y las suscripciones push de producción son las reales. La base local es solo de desarrollo: **NUNCA volcar un dump local sobre producción**. Si hace falta datos reales en dev, el dump va VPS → local (y en local borrar `push_subscriptions` si molestan los errores de push).

Todo verificado en producción: login, finanzas, SISFE completo (sesión remota, descarga de PDFs, subida a Drive), push, emails.

### Deuda técnica documentada (no bloquea)
- Agregación SQL para cuenta corriente si el volumen crece (hoy se lee en lotes, correcto pero no óptimo a gran escala).
- SSE multi-instancia (Redis pub/sub) si se escala horizontalmente.
- Migrar validación de `tipoPersonaId` de IDs hardcodeados a `codigo`.
- Módulo Plantillas: oculto en la UI, sin desarrollar.
- Drive por estudio (cliente con cuenta propia): hoy una cuenta central comparte la carpeta del estudio al admin; si un cliente exige propiedad/cuota propia, falta feature (credenciales OAuth por estudio cifradas + flujo "Conectar mi Drive" + provider con fallback).
- Deploy vía GitHub Actions (hoy `deploy.ps1` local).

---

## 6. Notas de contexto importantes

- **HAY PRODUCCIÓN y su base es la fuente de verdad** (ver sección 5). Ops destructivas en el VPS ahora SÍ pierden datos reales — siempre backup antes (además del automático diario).
- **Push en iPhone:** requiere HTTPS + PWA instalada — en producción ya se cumple; instalar la PWA desde https://iurispro.com.ar.
- **Plan de integración de IA** (futuro, post-deploy): resúmenes de movimientos SISFE → redacción de escritos → sugerencia de plazos → chat sobre expedientes. Con la API de Claude (`@anthropic-ai/sdk`, modelo `claude-opus-4-8`), tool use sin RAG. La key nunca en el frontend.

---

## 7. Repo

`https://github.com/gasparhdz/iuris` — rama `main`. Todo el trabajo está commiteado y pusheado.
