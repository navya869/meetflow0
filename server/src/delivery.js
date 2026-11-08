import nodemailer from "nodemailer";

export class DeliveryConfigurationError extends Error {}

export async function sendOtp({ identity, code }) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) {
    throw new DeliveryConfigurationError("Email OTP delivery is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM.");
  }
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD }
  });
  await transport.sendMail({
    from: SMTP_FROM,
    to: identity,
    subject: "Your Meetflow verification code",
    text: `Your Meetflow verification code is ${code}. It expires in 5 minutes. If you did not request this, you can ignore this email.`,
    html: `<p>Your Meetflow verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It expires in 5 minutes. If you did not request this, you can ignore this email.</p>`
  });
}

export async function sendPasswordReset({ identity, resetUrl }) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) {
    throw new DeliveryConfigurationError("Password reset email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM.");
  }
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD }
  });
  await transport.sendMail({
    from: SMTP_FROM,
    to: identity,
    subject: "Reset your Meetflow password",
    text: `Use this link to reset your Meetflow password. It expires in 30 minutes: ${resetUrl}`,
    html: `<p>Use this link to reset your Meetflow password. It expires in 30 minutes:</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`
  });
}
