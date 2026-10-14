import { getAppHost } from "@/lib/app-url";

/**
 * Transactional email via SendGrid's v3 API.
 *
 * A single JSON POST, so it is done with fetch rather than a client library:
 * keeping the dependency out means no lockfile or server-bundle change for one
 * endpoint. Failures are returned, never thrown -- mail is a best-effort side
 * channel, and the caller's real work (an invite, a settlement) must not fail
 * just because SendGrid had a bad minute.
 */

const SENDGRID_ENDPOINT = "https://api.sendgrid.com/v3/mail/send";

// Must be a sender verified in SendGrid (a Single Sender or a domain you have
// authenticated), or SendGrid rejects the send. Override per environment.
const DEFAULT_FROM_EMAIL = "noreply@bidabeat.com";
const DEFAULT_FROM_NAME = "BidaBeat";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Optional Reply-To, so the recipient can answer the original sender directly. */
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  /** True when no API key is configured, so nothing was even attempted. */
  skipped?: boolean;
  error?: string;
}

function fromAddress(): { email: string; name: string } {
  return {
    email: process.env.SENDGRID_FROM_EMAIL || DEFAULT_FROM_EMAIL,
    name: process.env.SENDGRID_FROM_NAME || DEFAULT_FROM_NAME,
  };
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    return { ok: false, skipped: true, error: "SENDGRID_API_KEY is not set." };
  }

  try {
    const res = await fetch(SENDGRID_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: params.to }] }],
        from: fromAddress(),
        ...(params.replyTo ? { reply_to: { email: params.replyTo } } : {}),
        subject: params.subject,
        content: [
          { type: "text/plain", value: params.text },
          { type: "text/html", value: params.html },
        ],
      }),
    });

    if (!res.ok) {
      // SendGrid explains rejections in the body (bad sender, bad key, etc.);
      // keep enough of it to diagnose without dumping a whole payload to logs.
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `SendGrid ${res.status}: ${detail.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Email send failed.",
    };
  }
}

/** Names and event titles come from user input, so they are escaped, not trusted. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The "you've been added as the organizer" invite for an event, carrying the
 * Stripe onboarding link that lets the organizer set up payouts.
 */
export function organizerInviteEmail(params: {
  organizerName: string;
  djName: string;
  eventName: string;
  onboardingUrl: string;
}): { subject: string; html: string; text: string } {
  const organizerName = escapeHtml(params.organizerName);
  const djName = escapeHtml(params.djName);
  const eventName = escapeHtml(params.eventName);
  const onboardingUrl = params.onboardingUrl;

  const subject = `Set up your payouts for ${params.eventName}`;

  const text = [
    `Hi ${params.organizerName},`,
    "",
    `${params.djName} added you as the organizer for ${params.eventName}. You'll ` +
      `receive the organizer's share of the credits guests buy for this event, ` +
      `sent to your account about 7–8 days after it closes.`,
    "",
    "To get paid, finish your secure payout setup with Stripe. It takes about " +
      "two minutes and you do not need a BidaBeat account.",
    "",
    `Set up payouts: ${onboardingUrl}`,
    "",
    "This link is personal to you, and you can reopen it from this email at any " +
      "time.",
    "",
    "— BidaBeat",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#080808;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#080808;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#111111;border:1px solid #2a2a2a;border-radius:16px;">
            <tr>
              <td style="padding:28px 28px 4px;font-family:Arial,Helvetica,sans-serif;font-size:22px;letter-spacing:2px;font-weight:bold;color:#00ffe1;">
                BIDABEAT
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 0;font-family:Arial,Helvetica,sans-serif;color:#f0f0f0;font-size:16px;line-height:1.6;">
                Hi ${organizerName},
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 0;font-family:Arial,Helvetica,sans-serif;color:#f0f0f0;font-size:15px;line-height:1.6;">
                <strong>${djName}</strong> added you as the organizer for
                <strong>${eventName}</strong>. You&rsquo;ll receive the organizer&rsquo;s
                share of the credits guests buy for this event, sent to your account
                about 7&ndash;8 days after it closes.
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 0;font-family:Arial,Helvetica,sans-serif;color:#888888;font-size:14px;line-height:1.6;">
                To get paid, finish your secure payout setup with Stripe. It takes
                about two minutes and you do not need a BidaBeat account.
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px 6px;">
                <a href="${onboardingUrl}" style="display:inline-block;background:#00ffe1;color:#080808;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;padding:14px 30px;border-radius:10px;">
                  Set up payouts
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 28px 28px;font-family:Arial,Helvetica,sans-serif;color:#666666;font-size:12px;line-height:1.6;">
                This link is personal to you, and you can reopen it from this
                email at any time. If the button does not work, copy this address
                into your browser:<br />
                <span style="color:#00ffe1;word-break:break-all;">${onboardingUrl}</span>
              </td>
            </tr>
          </table>
          <div style="max-width:520px;padding:16px 8px 0;font-family:Arial,Helvetica,sans-serif;color:#666666;font-size:11px;text-align:center;">
            Sent by BidaBeat &middot; ${escapeHtml(getAppHost())}
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}

/** Booking dates arrive as `YYYY-MM-DD`; render them the way a human reads them. */
function formatBookingDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * The booking enquiry a guest sends the DJ/Band from an event page: the guest's
 * contact details and brief, delivered to the DJ's inbox. The Reply-To is set to
 * the guest by the caller, so hitting reply reaches them directly.
 */
export function djBookingRequestEmail(params: {
  djName: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  eventDate: string;
  eventType: string;
  message: string;
  eventName?: string | null;
}): { subject: string; html: string; text: string } {
  const djName = params.djName.trim() || "there";
  const guestName = params.guestName;
  const guestEmail = params.guestEmail;
  const guestPhone = params.guestPhone.trim();
  const eventDate = formatBookingDate(params.eventDate);
  const eventType = params.eventType;
  const message = params.message.trim();
  const eventName = params.eventName?.trim() || null;

  const subject = `New booking request from ${guestName}`;
  const context = eventName
    ? ` They're reaching out from ${eventName} on BidaBeat.`
    : " They sent this through BidaBeat.";

  const text = [
    `Hi ${djName},`,
    "",
    `${guestName} would like to book you.${context}`,
    "",
    `  Name:        ${guestName}`,
    `  Email:       ${guestEmail}`,
    ...(guestPhone ? [`  Phone:       ${guestPhone}`] : []),
    `  Event date:  ${eventDate}`,
    `  Event type:  ${eventType}`,
    ...(message
      ? ["", "  Details:", ...message.split("\n").map((line) => `    ${line}`)]
      : []),
    "",
    `Reply to this email to reach ${guestName} directly at ${guestEmail}.`,
    "",
    "— BidaBeat",
  ].join("\n");

  const row = (label: string, value: string) => `
            <tr>
              <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;color:#888888;font-size:13px;white-space:nowrap;vertical-align:top;">${escapeHtml(
                label
              )}</td>
              <td style="padding:6px 0 6px 16px;font-family:Arial,Helvetica,sans-serif;color:#f0f0f0;font-size:14px;line-height:1.5;">${value}</td>
            </tr>`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#080808;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#080808;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#111111;border:1px solid #2a2a2a;border-radius:16px;">
            <tr>
              <td style="padding:28px 28px 4px;font-family:Arial,Helvetica,sans-serif;font-size:22px;letter-spacing:2px;font-weight:bold;color:#00ffe1;">
                BIDABEAT
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 0;font-family:Arial,Helvetica,sans-serif;color:#f0f0f0;font-size:16px;line-height:1.6;">
                Hi ${escapeHtml(djName)},
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 0;font-family:Arial,Helvetica,sans-serif;color:#f0f0f0;font-size:15px;line-height:1.6;">
                <strong>${escapeHtml(guestName)}</strong> would like to book you.${context}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${row("Name", escapeHtml(guestName))}
                  ${row("Email", `<a href="mailto:${escapeHtml(guestEmail)}" style="color:#00ffe1;text-decoration:none;">${escapeHtml(guestEmail)}</a>`)}
                  ${guestPhone ? row("Phone", escapeHtml(guestPhone)) : ""}
                  ${row("Event date", escapeHtml(eventDate))}
                  ${row("Event type", escapeHtml(eventType))}
                  ${message ? row("Details", escapeHtml(message).replace(/\n/g, "<br />")) : ""}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px 6px;">
                <a href="mailto:${escapeHtml(guestEmail)}" style="display:inline-block;background:#00ffe1;color:#080808;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;padding:14px 30px;border-radius:10px;">
                  Reply to ${escapeHtml(guestName)}
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 28px 28px;font-family:Arial,Helvetica,sans-serif;color:#666666;font-size:12px;line-height:1.6;">
                Replying to this email reaches ${escapeHtml(guestName)} directly at
                ${escapeHtml(guestEmail)}.
              </td>
            </tr>
          </table>
          <div style="max-width:520px;padding:16px 8px 0;font-family:Arial,Helvetica,sans-serif;color:#666666;font-size:11px;text-align:center;">
            Sent by BidaBeat &middot; ${escapeHtml(getAppHost())}
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}

/**
 * The "your night is still live" heads-up sent ~30 hours into an event, before
 * the 36-hour auto-close. Gives the DJ a last chance to end the night (or keep
 * it open on purpose) instead of finding it closed.
 */
export function eventAutoCloseWarningEmail(params: {
  djName: string;
  eventName: string;
  hoursRemaining: number;
  queueUrl: string;
}): { subject: string; html: string; text: string } {
  const djName = escapeHtml(params.djName);
  const eventName = escapeHtml(params.eventName);
  const hours = params.hoursRemaining;
  const queueUrl = params.queueUrl;

  const subject = `${params.eventName} is still live — closes in ~${hours}h`;

  const text = [
    `Hi ${params.djName},`,
    "",
    `${params.eventName} has been live for about 30 hours. If it is still open, ` +
      `we will close and settle it automatically in about ${hours} hour${hours === 1 ? "" : "s"}.`,
    "",
    "If the night is over, end it now so guests stop bidding and everyone gets " +
      "settled right away:",
    "",
    `End the event: ${queueUrl}`,
    "",
    "If you are still going, you can ignore this — but remember the event closes " +
      "itself at 36 hours.",
    "",
    "— BidaBeat",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#080808;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#080808;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#111111;border:1px solid #2a2a2a;border-radius:16px;">
            <tr>
              <td style="padding:28px 28px 4px;font-family:Arial,Helvetica,sans-serif;font-size:22px;letter-spacing:2px;font-weight:bold;color:#00ffe1;">
                BIDABEAT
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 0;font-family:Arial,Helvetica,sans-serif;color:#f0f0f0;font-size:16px;line-height:1.6;">
                Hi ${djName},
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 0;font-family:Arial,Helvetica,sans-serif;color:#f0f0f0;font-size:15px;line-height:1.6;">
                <strong>${eventName}</strong> has been live for about 30 hours. If
                it is still open, we&rsquo;ll close and settle it automatically in
                about ${hours} hour${hours === 1 ? "" : "s"}.
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 0;font-family:Arial,Helvetica,sans-serif;color:#888888;font-size:14px;line-height:1.6;">
                If the night is over, end it now so guests stop bidding and everyone
                gets settled right away. If you&rsquo;re still going, you can ignore
                this &mdash; but remember the event closes itself at 36 hours.
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px 6px;">
                <a href="${queueUrl}" style="display:inline-block;background:#00ffe1;color:#080808;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;padding:14px 30px;border-radius:10px;">
                  End the event
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 28px 28px;font-family:Arial,Helvetica,sans-serif;color:#666666;font-size:12px;line-height:1.6;">
                If the button does not work, copy this address into your browser:<br />
                <span style="color:#00ffe1;word-break:break-all;">${queueUrl}</span>
              </td>
            </tr>
          </table>
          <div style="max-width:520px;padding:16px 8px 0;font-family:Arial,Helvetica,sans-serif;color:#666666;font-size:11px;text-align:center;">
            Sent by BidaBeat &middot; ${escapeHtml(getAppHost())}
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}
