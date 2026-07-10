import nodemailer from "nodemailer";
import { env } from "../env.js";
import { logger } from "./logger.js";

export const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

if (!transporter) {
  logger.warn("emails deshabilitados: SMTP_HOST no configurado");
}

export async function sendEmail(to: string, subject: string, html: string) {
  if (!transporter) {
    logger.warn("emails deshabilitados: envío omitido");
    return;
  }

  await transporter.sendMail({
    from: `"Iuris" <${env.SMTP_FROM ?? env.SMTP_USER}>`,
    replyTo: env.SMTP_REPLY_TO?.trim() || undefined,
    to,
    subject,
    html,
  });
}
