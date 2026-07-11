# RETOMAR — estado del proyecto iuris

> Documento para retomar el trabajo desde otra computadora o después de una pausa.
> Última actualización: sesión del 11/07/2026.

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

## 4. Qué falta (pendientes reales)

1. **Vista de Cobranzas** (en curso / prompt pasado a Cursor): la notificación de cobranza debe llevar a un listado específico de cuotas vencidas/por vencer, no al tab genérico de planes. El backend ya tiene el endpoint `GET /planes/cuotas/proyeccion`.
2. **Prueba funcional end-to-end** (la hace Gaspar): ejercer el sistema completo con datos reales —circuito financiero deudor-céntrico, ingresos con obligado, SISFE, reportes, y el iPhone con push/emails (probar el deep-link deslogueado → login → destino).
3. **Deploy a `iurispro.com.ar`** — la última etapa, todavía no empezada. Incluye:
   - Decisión de hosting (VPS vs PaaS) y dónde va Postgres.
   - `.env` de producción con secretos NUEVOS y fuertes (nunca los de dev): `JWT_SECRET`, `ENCRYPTION_KEY`, `AUDIT_HMAC_KEY` generados con `openssl rand -base64 48/32`.
   - `NODE_ENV=production`, `CORS_ORIGIN`, `APP_URL`, VAPID keys, SMTP real.
   - HTTPS obligatorio (para que funcionen push en iPhone y service worker).
   - Migraciones en prod con el script + verificación posterior.
   - Backups automáticos de la base.

### Deuda técnica documentada (no bloquea deploy)
- Agregación SQL para cuenta corriente si el volumen crece (hoy se lee en lotes, correcto pero no óptimo a gran escala).
- SSE multi-instancia (Redis pub/sub) si se escala horizontalmente.
- Migrar validación de `tipoPersonaId` de IDs hardcodeados a `codigo`.
- Módulo Plantillas: oculto en la UI, sin desarrollar.

---

## 5. Notas de contexto importantes

- **No hay producción todavía.** La base de dev es recreable; las migraciones y ops destructivas se pueden correr sin miedo a perder datos reales.
- **Dominio de prod:** `iurispro.com.ar` (registrado). Al desplegar toca CORS, APP_URL, VAPID.
- **Push en iPhone:** requiere HTTPS + PWA instalada. En dev sobre `http://IP-local` NO funciona (por eso se probó con un túnel Cloudflare).
- **Plan de integración de IA** (futuro, post-deploy): resúmenes de movimientos SISFE → redacción de escritos → sugerencia de plazos → chat sobre expedientes. Con la API de Claude (`@anthropic-ai/sdk`, modelo `claude-opus-4-8`), tool use sin RAG. La key nunca en el frontend.

---

## 6. Repo

`https://github.com/gasparhdz/iuris` — rama `main`. Todo el trabajo está commiteado y pusheado.
