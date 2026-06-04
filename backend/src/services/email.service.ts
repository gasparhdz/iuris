import nodemailer from "nodemailer";
import { env } from "../env.js";

type UsuarioEmail = {
  email: string;
  nombre?: string | null;
  apellido?: string | null;
};

type TareaRecordatorio = {
  titulo: string;
  descripcion?: string | null;
  fechaLimite?: Date | null;
  casoCaratula?: string | null;
  subtareas?: Array<{
    titulo: string;
    descripcion?: string | null;
    completada: boolean;
  }>;
};

type EventoRecordatorio = {
  descripcion?: string | null;
  fechaInicio: Date;
};

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: "America/Argentina/Buenos_Aires",
  dateStyle: "medium",
  timeStyle: "short",
};

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: env.SMTP_USER && env.SMTP_PASS
    ? {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      }
    : undefined,
});

function formatDate(date?: Date | null) {
  if (!date) return "Sin fecha";
  return date.toLocaleString("es-AR", DATE_FORMAT_OPTIONS);
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
      <td style="padding:10px 0;color:#64748b;font-size:14px;width:120px;">${label}</td>
      <td style="padding:10px 0;color:#0f172a;font-size:14px;font-weight:700;">${escapeHtml(value)}</td>
    </tr>
  `;
}

function buildSubtareasSection(subtareas: TareaRecordatorio["subtareas"]) {
  if (!subtareas || subtareas.length === 0) return "";

  const items = subtareas.map((subtarea) => {
    const estado = subtarea.completada ? "Completada" : "Pendiente";
    const descripcion = subtarea.descripcion
      ? `<div style="margin-top:4px;color:#64748b;font-size:13px;line-height:1.45;">${escapeHtml(subtarea.descripcion)}</div>`
      : "";

    return `
      <li style="margin:0 0 10px;">
        <span style="color:#0f172a;font-weight:700;">${escapeHtml(subtarea.titulo)}</span>
        <span style="color:#64748b;font-size:12px;"> - ${estado}</span>
        ${descripcion}
      </li>
    `;
  }).join("");

  return `
    <div style="margin:0 0 24px;">
      <h2 style="margin:0 0 10px;color:#111827;font-size:16px;line-height:1.3;">Subtareas</h2>
      <ul style="margin:0;padding-left:20px;color:#0f172a;font-size:14px;line-height:1.5;">
        ${items}
      </ul>
    </div>
  `;
}

function buildEmailTemplate(params: {
  title: string;
  intro: string;
  rows: string;
  extraContent?: string;
  footerText: string;
  buttonText: string;
  buttonUrl: string;
}) {
  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(params.title)}</title>
      </head>
      <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="background:#6366f1;padding:24px 28px;">
                    <div style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:0;">Iuris</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px;">
                    <h1 style="margin:0 0 14px;color:#111827;font-size:22px;line-height:1.25;">${escapeHtml(params.title)}</h1>
                    <p style="margin:0 0 20px;color:#334155;font-size:16px;line-height:1.55;">${escapeHtml(params.intro)}</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin:8px 0 24px;">
                      ${params.rows}
                    </table>
                    ${params.extraContent ?? ""}
                    <p style="margin:0 0 24px;color:#334155;font-size:15px;line-height:1.55;">${escapeHtml(params.footerText)}</p>
                    <a href="${params.buttonUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;font-weight:800;font-size:15px;padding:13px 18px;border-radius:10px;">${escapeHtml(params.buttonText)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

export class EmailService {
  static async sendRecordatorioTarea(tarea: TareaRecordatorio, usuario: UsuarioEmail) {
    const html = buildEmailTemplate({
      title: "Recordatorio de tarea",
      intro: "Tenés una tarea pendiente con los siguientes detalles:",
      rows: [
        buildDetailRow("Título:", tarea.titulo),
        buildDetailRow("Descripción:", tarea.descripcion),
        buildDetailRow("Fecha límite:", formatDate(tarea.fechaLimite)),
        buildDetailRow("Caso:", tarea.casoCaratula),
      ].join(""),
      extraContent: buildSubtareasSection(tarea.subtareas),
      footerText: "Por favor, revisá tu panel de tareas en Iuris.",
      buttonText: "Ir a mis tareas",
      buttonUrl: `${env.APP_URL}/tareas`,
    });

    await transporter.sendMail({
      from: env.SMTP_FROM ?? env.SMTP_USER,
      to: usuario.email,
      subject: "📌 Recordatorio de tarea",
      html,
    });
  }

  static async sendRecordatorioEvento(evento: EventoRecordatorio, usuario: UsuarioEmail) {
    const html = buildEmailTemplate({
      title: "Recordatorio de evento",
      intro: "Tenés un evento próximo:",
      rows: [
        buildDetailRow("Descripción:", evento.descripcion ?? "Evento sin descripción"),
        buildDetailRow("Fecha:", formatDate(evento.fechaInicio)),
      ].join(""),
      footerText: "Por favor, revisá tu agenda en Iuris.",
      buttonText: "Ir a la agenda",
      buttonUrl: `${env.APP_URL}/agenda`,
    });

    await transporter.sendMail({
      from: env.SMTP_FROM ?? env.SMTP_USER,
      to: usuario.email,
      subject: "📅 Recordatorio de evento",
      html,
    });
  }
}
