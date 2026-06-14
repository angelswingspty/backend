import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { loadEnv } from "../config/env.js";

let smtpTransporter: Transporter | null | undefined;

export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

function getSmtpTransporter(): Transporter | null {
  if (smtpTransporter !== undefined) return smtpTransporter;

  const env = loadEnv();
  const host = env.SMTP_HOST?.trim();
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASSWORD?.trim();

  if (!host || !user || !pass) {
    smtpTransporter = null;
    return smtpTransporter;
  }

  smtpTransporter = nodemailer.createTransport({
    host,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_SECURE ?? false,
    auth: { user, pass },
  });

  return smtpTransporter;
}

export function isEmailConfigured(): boolean {
  const env = loadEnv();
  return Boolean(env.RESEND_API_KEY?.trim() || getSmtpTransporter());
}

export function assertEmailConfigured(): void {
  if (!isEmailConfigured()) {
    throw new EmailDeliveryError(
      "Email delivery is not configured. Set RESEND_API_KEY or SMTP credentials in backend/.env",
    );
  }
}

function getFromAddress(): string {
  const env = loadEnv();
  if (env.EMAIL_FROM?.trim()) {
    return env.EMAIL_FROM.trim();
  }
  if (env.RESEND_API_KEY?.trim()) {
    return "GHRI Telehealth <onboarding@resend.dev>";
  }
  return "GHRI Telehealth <noreply@ghrif.org>";
}

async function sendViaResend(
  to: string,
  subject: string,
  text: string,
  html: string,
): Promise<void> {
  const env = loadEnv();
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new EmailDeliveryError("Resend API key is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new EmailDeliveryError(
      `Resend rejected the email (${response.status}): ${body}`,
    );
  }
}

async function sendViaSmtp(
  to: string,
  subject: string,
  text: string,
  html: string,
): Promise<void> {
  const mailer = getSmtpTransporter();
  if (!mailer) {
    throw new EmailDeliveryError("SMTP is not configured");
  }

  await mailer.sendMail({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });
}

export async function sendTelehealthOtpEmail(
  to: string,
  name: string,
  code: string,
): Promise<void> {
  assertEmailConfigured();

  const subject = "Your GHRI Telehealth sign-in code";
  const text = [
    `Hello ${name},`,
    "",
    `Your sign-in verification code is: ${code}`,
    "",
    "This code expires in 10 minutes. If you did not try to sign in, you can ignore this email.",
    "",
    "— GHRI Telehealth",
  ].join("\n");

  const html = `
    <p>Hello ${name},</p>
    <p>Your sign-in verification code is:</p>
    <p style="font-size:28px;font-weight:bold;letter-spacing:0.25em;">${code}</p>
    <p>This code expires in 10 minutes. If you did not try to sign in, you can ignore this email.</p>
    <p>— GHRI Telehealth</p>
  `;

  const env = loadEnv();
  if (env.RESEND_API_KEY?.trim()) {
    await sendViaResend(to, subject, text, html);
    return;
  }

  await sendViaSmtp(to, subject, text, html);
}
