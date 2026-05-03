// Transactional email — invitation when a giver sends a gift.
//
// Provider: Resend. Switching providers means changing the fetch call
// here; the rest of the module (body builders, signature) stays put.

export interface SendInvitationInput {
	recipientEmail: string;
	recipientName: string;
	giverName: string;
	link: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "gifts@ember.app";

export function previewLine(recipientName: string): string {
	return `${recipientName} — I made you something. Open when you have a quiet minute.`;
}

export function renderHtml(input: SendInvitationInput): string {
	const preview = previewLine(input.recipientName);
	const safeLink = escapeAttr(input.link);
	const safeRecipient = escapeText(input.recipientName);
	const safeGiver = escapeText(input.giverName);
	const safePreview = escapeText(preview);
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeText(`${input.giverName} sent you an Ember gift`)}</title>
</head>
<body style="margin:0;padding:0;background:#fafaf8;font-family:Georgia,'Times New Roman',serif;color:#2a2a28;">
<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;font-size:1px;line-height:1px;mso-hide:all;">${safePreview}</span>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#fafaf8;">
<tr><td align="center" style="padding:48px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;">
<tr><td style="padding:44px 36px 32px;">
<p style="margin:0 0 24px;font-size:18px;line-height:1.7;color:#2a2a28;">${safeRecipient} —</p>
<p style="margin:0 0 24px;font-size:18px;line-height:1.7;color:#2a2a28;">I made you something. Open when you have a quiet minute.</p>
<p style="margin:0 0 32px;font-size:17px;line-height:1.7;color:#5a5a56;">There's no rush. Answer one question, leave it for a week, come back when it feels right. The whole thing is built around your pace.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 36px;">
<tr><td>
<a href="${safeLink}" style="display:inline-block;background:#1a1a1a;color:#ffffff;padding:14px 28px;border-radius:999px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;font-size:15px;font-weight:500;">Open your gift</a>
</td></tr>
</table>
<p style="margin:0;font-size:18px;line-height:1.7;color:#2a2a28;">Love,<br />${safeGiver}</p>
</td></tr>
<tr><td style="padding:20px 36px 36px;border-top:1px solid #f0eeea;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#8a8a86;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;">If the button doesn't work, paste this into your browser:<br /><span style="color:#5a5a56;word-break:break-all;">${safeLink}</span></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function renderText(input: SendInvitationInput): string {
	return [
		`${input.recipientName} —`,
		"",
		"I made you something. Open when you have a quiet minute.",
		"",
		"There's no rush. Answer one question, leave it for a week, come back when it feels right. The whole thing is built around your pace.",
		"",
		input.link,
		"",
		"Love,",
		input.giverName,
		"",
	].join("\n");
}

export function buildSubject(giverName: string): string {
	return `${giverName} sent you an Ember gift`;
}

export type InvitationOutcome =
	| { sent: true }
	| { sent: false; reason: "no-api-key" };

// Sends the invitation through Resend. If `EMAIL_PROVIDER_API_KEY` is
// unset (the dev/CI default), returns `{sent:false, reason:"no-api-key"}`
// instead of throwing — the gift is still created, the recipient still
// has a token, the giver can resend once the key is configured. Real
// upstream failures (Resend non-2xx) still throw so the route handler
// can log them with full context.
export async function sendInvitation(
	input: SendInvitationInput,
): Promise<InvitationOutcome> {
	const apiKey = process.env.EMAIL_PROVIDER_API_KEY;
	if (!apiKey) return { sent: false, reason: "no-api-key" };
	const from = process.env.EMAIL_FROM ?? DEFAULT_FROM;

	const res = await fetch(RESEND_ENDPOINT, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from,
			to: [input.recipientEmail],
			subject: buildSubject(input.giverName),
			html: renderHtml(input),
			text: renderText(input),
		}),
	});

	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`Resend ${res.status}: ${body || res.statusText}`);
	}
	return { sent: true };
}

function escapeText(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
	return escapeText(s);
}
