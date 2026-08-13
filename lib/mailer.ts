import nodemailer from "nodemailer";

// OTP-based signup (see app/api/auth/signup/{start,verify-otp,complete}).
// Gmail SMTP via an app password — GMAIL_USER is the sending address,
// GMAIL_APP_PASSWORD is a 16-char app password (not the real account
// password; generate one at myaccount.google.com/apppasswords with 2FA on).
//
// Dev fallback: if those env vars aren't set, nothing is actually sent —
// the email is logged to the server console instead, so the OTP flow is
// fully testable locally before real credentials exist. Same spirit as the
// locally-generated JWT_ACCESS_SECRET (Reference B): works out of the box,
// swap in real values before deploying.

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
let loggedDevModeNotice = false;

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  transporter ??= nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return transporter;
}

const BRAND_COLOR = "#0f766e"; // --primary (other-light) — the pre-auth default theme

function emailShell(preheader: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f7f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <span style="display:none;font-size:0;color:transparent;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:${BRAND_COLOR};padding:24px 32px;">
                <span style="color:#ffffff;font-size:18px;font-weight:600;">Ilazdoot</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;color:#101a17;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 28px;color:#5b6b66;font-size:12px;">
                You&rsquo;re receiving this because this email was used on Ilazdoot.
                If that wasn&rsquo;t you, you can ignore it.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function send(to: string, subject: string, html: string, devFallbackLabel: string) {
  const t = getTransporter();
  if (!t) {
    if (!loggedDevModeNotice) {
      console.warn(
        "[mailer] GMAIL_USER/GMAIL_APP_PASSWORD not set — running in dev mode, emails are logged instead of sent."
      );
      loggedDevModeNotice = true;
    }
    console.log(`[mailer:dev] ${devFallbackLabel} -> ${to}`);
    return;
  }

  await t.sendMail({
    from: `"Ilazdoot" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

/** Shared "here's a big 6-digit code" body, reused by both the signup and
 *  password-reset OTP emails — same layout, different lead-in copy. */
function otpBodyHtml(leadIn: string, otp: string): string {
  return `
    <p style="margin:0 0 24px;font-size:15px;line-height:1.5;">
      ${leadIn} It expires in <strong>10 minutes</strong>.
    </p>
    <div style="text-align:center;margin:0 0 24px;">
      <span style="display:inline-block;padding:14px 28px;border-radius:10px;background:#f6f7f5;font-size:28px;font-weight:700;letter-spacing:8px;color:${BRAND_COLOR};">
        ${otp}
      </span>
    </div>
    <p style="margin:0;font-size:13px;color:#5b6b66;">
      Didn&rsquo;t request this? You can safely ignore this email.
    </p>
  `;
}

export async function sendOtpEmail(to: string, name: string, otp: string): Promise<void> {
  const html = emailShell(
    `Your verification code is ${otp}`,
    `
      <p style="margin:0 0 16px;font-size:15px;">Hi ${escapeHtml(name)},</p>
      ${otpBodyHtml("Use this code to verify your email and finish setting up your patient log.", otp)}
    `
  );
  await send(to, `${otp} is your verification code`, html, `OTP ${otp} for ${name}`);
}

export async function sendPasswordResetOtpEmail(to: string, name: string, otp: string): Promise<void> {
  const html = emailShell(
    `Your password reset code is ${otp}`,
    `
      <p style="margin:0 0 16px;font-size:15px;">Hi ${escapeHtml(name)},</p>
      ${otpBodyHtml("Use this code to reset your password.", otp)}
    `
  );
  await send(to, `${otp} is your password reset code`, html, `Password reset OTP ${otp} for ${name}`);
}

export async function sendPasswordChangedEmail(to: string, name: string): Promise<void> {
  const html = emailShell(
    "Your password was changed",
    `
      <p style="margin:0 0 16px;font-size:15px;">Hi ${escapeHtml(name)},</p>
      <p style="margin:0;font-size:15px;line-height:1.5;">
        Your Ilazdoot password was just reset. If this wasn&rsquo;t you, your account&rsquo;s
        other sessions have already been signed out — reset your password again right away.
      </p>
    `
  );
  await send(to, "Your password was changed", html, `Password-changed notice for ${name}`);
}

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  const html = emailShell(
    "Your patient log is ready",
    `
      <p style="margin:0 0 16px;font-size:15px;">Welcome, ${escapeHtml(name)} 👋</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">
        Your account is set up. Your patient list is private to you — scan a
        prescription or add a visit manually whenever you&rsquo;re ready.
      </p>
      <div style="text-align:center;margin:0 0 8px;">
        <span style="display:inline-block;padding:12px 24px;border-radius:8px;background:${BRAND_COLOR};color:#ffffff;font-size:14px;font-weight:600;">
          Open your dashboard
        </span>
      </div>
    `
  );
  await send(to, "Welcome to Ilazdoot", html, `Welcome email for ${name}`);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
