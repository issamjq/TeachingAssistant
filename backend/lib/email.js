// Thin Resend wrapper used by the email-verification OTP flow.
//
// When RESEND_API_KEY is unset (local dev), the code is logged to
// stdout instead of sent — so the developer can read it from the
// terminal and complete the flow without setting up a sender domain.
// In production (Render), set RESEND_API_KEY in the dashboard and
// optionally RESEND_FROM to override the default sender.
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY || "";
const FROM = process.env.RESEND_FROM || "Murchid <onboarding@resend.dev>";
const resend = apiKey ? new Resend(apiKey) : null;

export function isEmailServiceConfigured() {
  return !!resend;
}

export async function sendVerificationCode({ to, code }) {
  if (!resend) {
    // Dev fallback — printed alongside any other server logs.
    console.log(`[email] (no RESEND_API_KEY) verification code for ${to}: ${code}`);
    return { dev: true };
  }
  const subject = `${code} is your Murchid verification code`;
  const text =
`Your Murchid verification code is: ${code}

It expires in 1 minute. If you didn't request this code, you can ignore this email.

— Murchid`;

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f7f3ec;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f1c16;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f7f3ec;padding:48px 16px;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="480" style="background:#fffdf6;border:1px solid #e6dcc6;border-radius:16px;padding:32px 28px;">
        <tr><td>
          <p style="margin:0 0 4px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#9a907a;">Murchid</p>
          <h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.2;color:#1f1c16;">Verify your email</h1>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#5f5a4d;">Enter this 6-digit code in Murchid to finish signing up.</p>
          <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:32px;font-weight:600;letter-spacing:.4em;padding:18px 12px;background:#f7f3ec;border:1px solid #e6dcc6;border-radius:12px;text-align:center;color:#1f1c16;">${code}</div>
          <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#9a907a;">The code expires in 1 minute. If you didn't request it, you can safely ignore this email — no account changes will be made.</p>
        </td></tr>
      </table>
      <p style="margin:24px 0 0;font-size:11px;color:#9a907a;">Murchid · AI lesson director for teachers</p>
    </td></tr>
  </table>
</body></html>`;

  const result = await resend.emails.send({ from: FROM, to, subject, text, html });
  if (result?.error) {
    const msg = result.error.message || JSON.stringify(result.error);
    throw new Error(`Resend send failed: ${msg}`);
  }
  return result;
}
