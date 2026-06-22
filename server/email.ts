import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST;
const port = process.env.SMTP_PORT
  ? parseInt(process.env.SMTP_PORT, 10)
  : undefined;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const secure = process.env.SMTP_SECURE || false;
const fromAddress = process.env.SMTP_FROM;

let transporter: nodemailer.Transporter | null = null;

const hasSmtpConfig =
  !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS;

if (hasSmtpConfig) {
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: typeof secure === "string" ? secure === "true" : secure,
    auth: {
      user,
      pass,
    },
  });
  console.log(
    `[Email Service] Real SMTP mailer configured via env (Host: ${host}:${port}, From: ${fromAddress})`,
  );
} else {
  console.log(
    `[Email Service] SMTP environment variables not fully configured. Using simulation logger fallback.`,
  );
}

/**
 * Sends an email notification.
 * Uses nodemailer if SMTP env variables are provided; otherwise falls back to console logging.
 */
export async function sendEmail(
  to: string,
  subject: string,
  body: string,
): Promise<boolean> {
  if (!to) {
    console.log(
      `[Email Service] Skipped sending email: "to" address is empty. (Subject: "${subject}")`,
    );
    return false;
  }

  if (transporter) {
    try {
      await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        text: body,
      });
      console.log(
        `[Email Service] Real email sent to ${to} (Subject: "${subject}")`,
      );
      return true;
    } catch (err) {
      console.error(
        `[Email Service] Failed to send real email to ${to} via SMTP:`,
        err,
      );
    }
  }

  // Fallback to console simulation
  console.log(`
=========================================
📧 EMAIL SENT OUT (SIMULATION - SMTP NOT CONFIGURED)
From:    ${fromAddress}
To:      ${to}
Subject: ${subject}
Date:    ${new Date().toLocaleString()}
-----------------------------------------
${body}
=========================================
  `);
  return true;
}
