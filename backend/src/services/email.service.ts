import nodemailer from "nodemailer";
import { env } from "../env.js";
import { logger } from "../utils/logger.js";
import {
  formatDateTimeMediumArgentina,
  formatExpedienteLabel,
  NOTIFICATION_PATHS,
  type CasoResumenNotificacion,
} from "./notification-copy.js";
import { formatSaldoCuota } from "./cobranza-recordatorio.js";

type UsuarioEmail = {
  email: string;
  nombre?: string | null;
  apellido?: string | null;
};

export type TareaRecordatorioEmail = {
  id: number;
  titulo: string;
  descripcion?: string | null;
  fechaLimite?: Date | null;
  caso?: CasoResumenNotificacion | null;
  /** @deprecated preferir caso.caratula */
  casoCaratula?: string | null;
  subtareas?: Array<{
    titulo: string;
    descripcion?: string | null;
    completada: boolean;
  }>;
};

export type EventoRecordatorioEmail = {
  id: number;
  descripcion?: string | null;
  fechaInicio: Date;
  caso?: CasoResumenNotificacion | null;
};

export type CuotaCobranzaEmailItem = {
  numero: number;
  vencimiento: Date;
  clienteNombre: string;
  casoCaratula?: string | null;
  montoPesos: string | null;
  montoJus: string | null;
  montoAplicado: string;
  valorJusRef: string | null;
  jusPagados?: string | null;
};

export type CobranzaRecordatorioEmail = {
  vencidas: CuotaCobranzaEmailItem[];
  porVencer: CuotaCobranzaEmailItem[];
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

/**
 * Azul primario del tema Iuris (frontend/src/theme/themeIuris.js, light primary.main).
 * No usar webfonts: clientes de email no cargan Inter.
 */
export const EMAIL_BRAND_COLOR = "#1A66C9";

const DEFAULT_FOOTER =
  "Recibís este email porque tenés recordatorios activos en Iuris.";

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
    })
  : null;

if (!transporter) {
  logger.warn("emails deshabilitados: SMTP_HOST no configurado");
}

function mailFrom() {
  return `"Iuris" <${env.SMTP_FROM ?? env.SMTP_USER}>`;
}

function mailReplyTo() {
  return env.SMTP_REPLY_TO?.trim() || undefined;
}

function appUrl(path: string) {
  const base = env.APP_URL.replace(/\/$/, "");
  return path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildDetailRow(label: string, value?: string | null) {
  if (!value) return "";
  return `
    <tr>
      <td style="padding:10px 0;color:#64748b;font-size:14px;width:130px;vertical-align:top;font-family:system-ui,Helvetica,Arial,sans-serif;">${escapeHtml(label)}</td>
      <td style="padding:10px 0;color:#0f172a;font-size:14px;font-weight:700;font-family:system-ui,Helvetica,Arial,sans-serif;">${escapeHtml(value)}</td>
    </tr>
  `;
}

function buildSubtareasSection(subtareas: TareaRecordatorioEmail["subtareas"]) {
  if (!subtareas || subtareas.length === 0) return { html: "", text: "" };

  const textLines = subtareas.map((s) => {
    const estado = s.completada ? "completada" : "pendiente";
    const desc = s.descripcion ? ` — ${s.descripcion}` : "";
    return `  - ${s.titulo} (${estado})${desc}`;
  });

  const items = subtareas.map((subtarea) => {
    const estado = subtarea.completada ? "Completada" : "Pendiente";
    const descripcion = subtarea.descripcion
      ? `<div style="margin-top:4px;color:#64748b;font-size:13px;line-height:1.45;font-family:system-ui,Helvetica,Arial,sans-serif;">${escapeHtml(subtarea.descripcion)}</div>`
      : "";
    return `
      <li style="margin:0 0 10px;font-family:system-ui,Helvetica,Arial,sans-serif;">
        <span style="color:#0f172a;font-weight:700;">${escapeHtml(subtarea.titulo)}</span>
        <span style="color:#64748b;font-size:12px;"> — ${estado}</span>
        ${descripcion}
      </li>
    `;
  }).join("");

  return {
    html: `
      <div style="margin:0 0 24px;">
        <h2 style="margin:0 0 10px;color:#111827;font-size:16px;line-height:1.3;font-family:system-ui,Helvetica,Arial,sans-serif;">Subtareas</h2>
        <ul style="margin:0;padding-left:20px;color:#0f172a;font-size:14px;line-height:1.5;">
          ${items}
        </ul>
      </div>
    `,
    text: ["Subtareas:", ...textLines].join("\n"),
  };
}

function buildCuotasTableSection(title: string, cuotas: CuotaCobranzaEmailItem[]) {
  if (cuotas.length === 0) return { html: "", text: "" };

  const textLines = cuotas.map((cuota) => {
    const saldo = formatSaldoCuota(cuota);
    return `  - ${cuota.clienteNombre} | ${cuota.casoCaratula ?? "—"} | #${cuota.numero} | ${formatDateTimeMediumArgentina(cuota.vencimiento)} | ${saldo}`;
  });

  const rows = cuotas.map((cuota) => {
    const saldo = formatSaldoCuota(cuota);
    return `
      <tr>
        <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-family:system-ui,Helvetica,Arial,sans-serif;">${escapeHtml(cuota.clienteNombre)}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-family:system-ui,Helvetica,Arial,sans-serif;">${escapeHtml(cuota.casoCaratula ?? "—")}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;text-align:center;font-family:system-ui,Helvetica,Arial,sans-serif;">${cuota.numero}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-family:system-ui,Helvetica,Arial,sans-serif;">${escapeHtml(formatDateTimeMediumArgentina(cuota.vencimiento))}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:700;text-align:right;font-family:system-ui,Helvetica,Arial,sans-serif;">${escapeHtml(saldo)}</td>
      </tr>
    `;
  }).join("");

  return {
    html: `
      <div style="margin:0 0 24px;">
        <h2 style="margin:0 0 10px;color:#111827;font-size:16px;line-height:1.3;font-family:system-ui,Helvetica,Arial,sans-serif;">${escapeHtml(title)}</h2>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <thead>
            <tr>
              <th style="padding:8px 6px;border-bottom:2px solid #cbd5e1;color:#64748b;font-size:12px;text-align:left;font-family:system-ui,Helvetica,Arial,sans-serif;">Cliente</th>
              <th style="padding:8px 6px;border-bottom:2px solid #cbd5e1;color:#64748b;font-size:12px;text-align:left;font-family:system-ui,Helvetica,Arial,sans-serif;">Carátula</th>
              <th style="padding:8px 6px;border-bottom:2px solid #cbd5e1;color:#64748b;font-size:12px;text-align:center;font-family:system-ui,Helvetica,Arial,sans-serif;">Cuota</th>
              <th style="padding:8px 6px;border-bottom:2px solid #cbd5e1;color:#64748b;font-size:12px;text-align:left;font-family:system-ui,Helvetica,Arial,sans-serif;">Vencimiento</th>
              <th style="padding:8px 6px;border-bottom:2px solid #cbd5e1;color:#64748b;font-size:12px;text-align:right;font-family:system-ui,Helvetica,Arial,sans-serif;">Saldo</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `,
    text: [title, ...textLines].join("\n"),
  };
}

/**
 * Template base único para todos los emails del sistema.
 * Estilos inline (compatibilidad clientes de correo).
 */
export function buildUnifiedEmail(params: {
  title: string;
  intro?: string;
  contentHtml: string;
  contentText: string;
  buttonText: string;
  buttonUrl: string;
  footerNote?: string;
}): { html: string; text: string } {
  const brand = EMAIL_BRAND_COLOR;
  const footerNote = params.footerNote ?? DEFAULT_FOOTER;
  const introHtml = params.intro
    ? `<p style="margin:0 0 20px;color:#334155;font-size:16px;line-height:1.55;font-family:system-ui,Helvetica,Arial,sans-serif;">${escapeHtml(params.intro)}</p>`
    : "";

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(params.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:${brand};padding:22px 28px;">
                <!-- TODO: reemplazar wordmark tipográfico por logo cuando exista el asset definitivo -->
                <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.01em;font-family:system-ui,Helvetica,Arial,sans-serif;">Iuris</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 14px;color:#0f172a;font-size:22px;line-height:1.25;font-weight:700;font-family:system-ui,Helvetica,Arial,sans-serif;">${escapeHtml(params.title)}</h1>
                ${introHtml}
                ${params.contentHtml}
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 16px;">
                  <tr>
                    <td style="border-radius:8px;background:${brand};">
                      <a href="${params.buttonUrl}" style="display:inline-block;background:${brand};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 20px;border-radius:8px;font-family:system-ui,Helvetica,Arial,sans-serif;">${escapeHtml(params.buttonText)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 28px;color:#64748b;font-size:13px;line-height:1.5;word-break:break-all;font-family:system-ui,Helvetica,Arial,sans-serif;">
                  Si el botón no funciona, abrí este enlace:<br />
                  <a href="${params.buttonUrl}" style="color:${brand};">${escapeHtml(params.buttonUrl)}</a>
                </p>
                <p style="margin:0;padding-top:20px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;line-height:1.5;font-family:system-ui,Helvetica,Arial,sans-serif;">
                  <strong style="color:#64748b;">Iuris</strong><br />
                  ${escapeHtml(footerNote)}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textParts = [
    "Iuris",
    "",
    params.title,
    params.intro ?? "",
    "",
    params.contentText,
    "",
    `${params.buttonText}: ${params.buttonUrl}`,
    "",
    "Iuris",
    footerNote,
  ].filter((line, idx, arr) => !(line === "" && arr[idx - 1] === ""));

  return { html, text: textParts.join("\n").trim() + "\n" };
}

function resolveCaso(tarea: TareaRecordatorioEmail): CasoResumenNotificacion | null {
  if (tarea.caso) return tarea.caso;
  if (tarea.casoCaratula) return { caratula: tarea.casoCaratula, nroExpte: null };
  return null;
}

export function renderRecordatorioTarea(tarea: TareaRecordatorioEmail): RenderedEmail {
  const caso = resolveCaso(tarea);
  const expediente = formatExpedienteLabel(caso);
  const subtareas = buildSubtareasSection(tarea.subtareas);
  const buttonUrl = appUrl(NOTIFICATION_PATHS.tarea(tarea.id));

  const rows = [
    buildDetailRow("Título", tarea.titulo),
    buildDetailRow("Descripción", tarea.descripcion),
    buildDetailRow("Fecha límite", formatDateTimeMediumArgentina(tarea.fechaLimite)),
    buildDetailRow("Expediente", expediente),
    buildDetailRow("Carátula", !expediente && caso?.caratula ? caso.caratula : null),
    buildDetailRow("Nro. expediente", !expediente && caso?.nroExpte ? caso.nroExpte : null),
  ].join("");

  const contentHtml = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin:0 0 24px;">
      ${rows}
    </table>
    ${subtareas.html}
  `;

  const contentText = [
    `Título: ${tarea.titulo}`,
    tarea.descripcion ? `Descripción: ${tarea.descripcion}` : null,
    `Fecha límite: ${formatDateTimeMediumArgentina(tarea.fechaLimite)}`,
    expediente ? `Expediente: ${expediente}` : null,
    subtareas.text || null,
  ].filter(Boolean).join("\n");

  const { html, text } = buildUnifiedEmail({
    title: "Recordatorio de tarea",
    intro: "Tenés una tarea pendiente con los siguientes detalles:",
    contentHtml,
    contentText,
    buttonText: "Ver tarea",
    buttonUrl,
  });

  return { subject: `Recordatorio: ${tarea.titulo}`, html, text };
}

export function renderRecordatorioEvento(evento: EventoRecordatorioEmail): RenderedEmail {
  const expediente = formatExpedienteLabel(evento.caso);
  const buttonUrl = appUrl(NOTIFICATION_PATHS.evento(evento.id));
  const descripcion = evento.descripcion?.trim() || "Evento sin descripción";

  const rows = [
    buildDetailRow("Descripción", descripcion),
    buildDetailRow("Fecha", formatDateTimeMediumArgentina(evento.fechaInicio)),
    buildDetailRow("Expediente", expediente),
  ].join("");

  const contentHtml = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin:0 0 24px;">
      ${rows}
    </table>
  `;

  const contentText = [
    `Descripción: ${descripcion}`,
    `Fecha: ${formatDateTimeMediumArgentina(evento.fechaInicio)}`,
    expediente ? `Expediente: ${expediente}` : null,
  ].filter(Boolean).join("\n");

  const { html, text } = buildUnifiedEmail({
    title: "Recordatorio de evento",
    intro: "Tenés un evento próximo:",
    contentHtml,
    contentText,
    buttonText: "Ver evento",
    buttonUrl,
  });

  return { subject: `Recordatorio: ${descripcion}`, html, text };
}

export function renderRecordatorioCobranza(cobranza: CobranzaRecordatorioEmail): RenderedEmail {
  const total = cobranza.vencidas.length + cobranza.porVencer.length;
  const intro = total === 1
    ? "Tenés 1 cuota pendiente de cobro:"
    : `Tenés ${total} cuotas pendientes de cobro:`;
  const buttonUrl = appUrl(NOTIFICATION_PATHS.cobranza());

  const vencidas = buildCuotasTableSection("Cuotas vencidas", cobranza.vencidas);
  const porVencer = buildCuotasTableSection("Cuotas por vencer", cobranza.porVencer);

  const rows = [
    buildDetailRow("Vencidas", String(cobranza.vencidas.length)),
    buildDetailRow("Por vencer", String(cobranza.porVencer.length)),
  ].join("");

  const contentHtml = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin:0 0 24px;">
      ${rows}
    </table>
    ${vencidas.html}
    ${porVencer.html}
  `;

  const contentText = [
    `Vencidas: ${cobranza.vencidas.length}`,
    `Por vencer: ${cobranza.porVencer.length}`,
    vencidas.text,
    porVencer.text,
  ].filter(Boolean).join("\n");

  const { html, text } = buildUnifiedEmail({
    title: "Recordatorio de cobranzas",
    intro,
    contentHtml,
    contentText,
    buttonText: "Ver cuotas pendientes",
    buttonUrl,
  });

  return { subject: "Recordatorio de cobranzas", html, text };
}

export function renderRecuperarPassword(input: {
  nombre: string;
  resetUrl: string;
}): RenderedEmail {
  const contentHtml = `
    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.55;font-family:system-ui,Helvetica,Arial,sans-serif;">
      Hola ${escapeHtml(input.nombre)}, recibimos una solicitud para restablecer tu contraseña de Iuris.
    </p>
    <p style="margin:0 0 24px;color:#334155;font-size:15px;line-height:1.55;font-family:system-ui,Helvetica,Arial,sans-serif;">
      Usá el siguiente botón para crear una nueva contraseña. El enlace expira en 1 hora.
    </p>
  `;

  const contentText = [
    `Hola ${input.nombre}, recibimos una solicitud para restablecer tu contraseña de Iuris.`,
    "Usá el enlace para crear una nueva contraseña. El enlace expira en 1 hora.",
  ].join("\n");

  const { html, text } = buildUnifiedEmail({
    title: "Recuperar contraseña",
    contentHtml,
    contentText,
    buttonText: "Restablecer contraseña",
    buttonUrl: input.resetUrl,
    footerNote: "Si no solicitaste este cambio, podés ignorar este email.",
  });

  return { subject: "Iuris — Recuperar contraseña", html, text };
}

async function sendRendered(to: string, rendered: RenderedEmail): Promise<boolean> {
  if (!transporter) {
    logger.warn("emails deshabilitados: envío omitido");
    return false;
  }

  await transporter.sendMail({
    from: mailFrom(),
    replyTo: mailReplyTo(),
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
  return true;
}

export class EmailService {
  static renderRecordatorioTarea = renderRecordatorioTarea;
  static renderRecordatorioEvento = renderRecordatorioEvento;
  static renderRecordatorioCobranza = renderRecordatorioCobranza;
  static renderRecuperarPassword = renderRecuperarPassword;

  /** @returns true si el email se envió; false si SMTP está deshabilitado. */
  static async sendRecordatorioTarea(tarea: TareaRecordatorioEmail, usuario: UsuarioEmail): Promise<boolean> {
    return sendRendered(usuario.email, renderRecordatorioTarea(tarea));
  }

  static async sendRecordatorioEvento(evento: EventoRecordatorioEmail, usuario: UsuarioEmail): Promise<boolean> {
    return sendRendered(usuario.email, renderRecordatorioEvento(evento));
  }

  static async sendRecordatorioCobranza(cobranza: CobranzaRecordatorioEmail, usuario: UsuarioEmail): Promise<boolean> {
    return sendRendered(usuario.email, renderRecordatorioCobranza(cobranza));
  }

  static async sendRecuperarPassword(
    input: { nombre: string; resetUrl: string },
    to: string,
  ): Promise<boolean> {
    return sendRendered(to, renderRecuperarPassword(input));
  }
}
