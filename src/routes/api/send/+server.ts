import { env } from "$env/dynamic/private";
import { requireEnv } from "$lib/server/assertEnv";
import { extractEmailAddresses } from "$lib/server/emailParsing";
import { gmailSendRawMessage } from "$lib/server/gmailApi";
import { getMailAddresses, type MailAccount } from "$lib/server/mailAccounts";
import { supabaseAdmin } from "$lib/server/supabaseAdmin";

type SendRequest = {
    fromAccount: MailAccount;
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    html: string;
    trackOpens?: boolean;
    threadId?: string;
    inReplyTo?: string;
    attachments?: Array<{ filename: string; contentType: string; contentBase64: string }>;
};

function unauthorizedResponse(): Response {
    return new Response("Unauthorized", { status: 401 });
}

function assertAuthorized(request: Request, locals: App.Locals): Response | null {
    if (locals.user) return null;
    const apiKey = request.headers.get("x-api-key") ?? "";
    if (apiKey !== requireEnv(env.API_KEY, "API_KEY")) return unauthorizedResponse();
    return null;
}

function parseSendRequest(payload: unknown): { ok: true; value: SendRequest } | { ok: false; response: Response } {
    if (!payload || typeof payload !== "object") {
        return { ok: false, response: new Response("Invalid payload", { status: 400 }) };
    }

    const body = payload as Partial<SendRequest>;
    const to = typeof body.to === "string" ? body.to : "";
    const subject = typeof body.subject === "string" ? body.subject : "";
    const html = typeof body.html === "string" ? body.html : "";

    if (!to || !subject || !html) {
        return { ok: false, response: new Response("Invalid payload", { status: 400 }) };
    }

    return { ok: true, value: body as SendRequest };
}

function addTrackingPixel(html: string, pixelUrl: string): string {
    const tag = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;
    if (html.includes("</body>")) return html.replace("</body>", `${tag}</body>`);
    return `${html}${tag}`;
}

function buildRawMime(params: {
    from: string;
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    html: string;
    inReplyTo?: string;
}): string {
    const lines: string[] = [];
    lines.push(`From: ${params.from}`);
    lines.push(`To: ${params.to}`);
    if (params.cc) lines.push(`Cc: ${params.cc}`);
    if (params.bcc) lines.push(`Bcc: ${params.bcc}`);
    lines.push(`Subject: ${params.subject}`);
    lines.push("MIME-Version: 1.0");
    lines.push('Content-Type: text/html; charset="UTF-8"');
    lines.push("Content-Transfer-Encoding: 7bit");
    if (params.inReplyTo) {
        lines.push(`In-Reply-To: ${params.inReplyTo}`);
        lines.push(`References: ${params.inReplyTo}`);
    }
    lines.push("");
    lines.push(params.html);
    return lines.join("\r\n");
}

function chunkBase64(b64: string, lineLen = 76): string {
    const clean = b64.replace(/\s+/g, "");
    const parts: string[] = [];
    for (let i = 0; i < clean.length; i += lineLen) parts.push(clean.slice(i, i + lineLen));
    return parts.join("\r\n");
}

function buildRawMimeMultipart(params: {
    from: string;
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    html: string;
    inReplyTo?: string;
    attachments: Array<{ filename: string; contentType: string; contentBase64: string }>;
}): string {
    const boundary = `mixed_${crypto.randomUUID()}`;
    const lines: string[] = [];
    lines.push(`From: ${params.from}`);
    lines.push(`To: ${params.to}`);
    if (params.cc) lines.push(`Cc: ${params.cc}`);
    if (params.bcc) lines.push(`Bcc: ${params.bcc}`);
    lines.push(`Subject: ${params.subject}`);
    lines.push("MIME-Version: 1.0");
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    if (params.inReplyTo) {
        lines.push(`In-Reply-To: ${params.inReplyTo}`);
        lines.push(`References: ${params.inReplyTo}`);
    }
    lines.push("");

    // HTML part
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/html; charset="UTF-8"');
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(params.html);
    lines.push("");

    for (const att of params.attachments) {
        if (!att?.filename || !att?.contentBase64) continue;
        const contentType = att.contentType || "application/octet-stream";
        lines.push(`--${boundary}`);
        lines.push(`Content-Type: ${contentType}; name="${att.filename}"`);
        lines.push("Content-Transfer-Encoding: base64");
        lines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
        lines.push("");
        lines.push(chunkBase64(att.contentBase64));
        lines.push("");
    }

    lines.push(`--${boundary}--`);
    return lines.join("\r\n");
}

async function handlePost({ request, locals }: { request: Request; locals: App.Locals }): Promise<Response> {
    const authError = assertAuthorized(request, locals);
    if (authError) return authError;

    const parsed = parseSendRequest(await request.json().catch(() => null));
    if (!parsed.ok) return parsed.response;
    const body = parsed.value;

    const { me, noreply } = getMailAddresses();
    const fromEmail = body.fromAccount === "noreply" ? noreply : me;
    const origin = new URL(request.url).origin;

    let trackingId: string | null = null;
    let html = body.html;

    if (body.trackOpens) {
        trackingId = crypto.randomUUID();
        await supabaseAdmin.from("mail_tracking").insert({ id: trackingId });
        html = addTrackingPixel(html, `${origin}/track/${trackingId}.png`);
    }

    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    const rawMime = attachments.length
        ? buildRawMimeMultipart({
              from: fromEmail,
              to: body.to,
              cc: body.cc,
              bcc: body.bcc,
              subject: body.subject,
              html,
              inReplyTo: body.inReplyTo,
              attachments,
          })
        : buildRawMime({
              from: fromEmail,
              to: body.to,
              cc: body.cc,
              bcc: body.bcc,
              subject: body.subject,
              html,
              inReplyTo: body.inReplyTo,
          });

    let sent;
    try {
        sent = await gmailSendRawMessage(rawMime, body.threadId);
    } catch (e) {
        const message = e instanceof Error ? e.message : "Gmail send failed";
        return new Response(message, { status: 502 });
    }

    // Persist outbound row (best-effort)
    try {
        const ccStr = typeof body.cc === "string" ? body.cc : "";
        const bccStr = typeof body.bcc === "string" ? body.bcc : "";

        // Build attachments metadata for storage (including content for outbound messages)
        const attachmentsMeta = attachments.map((att, idx) => ({
            filename: att.filename,
            mimeType: att.contentType,
            size: att.contentBase64 ? Math.floor(att.contentBase64.length * 0.75) : 0, // Approximate decoded size
            contentBase64: att.contentBase64, // Store content for outbound display
            localId: `local-${idx}`, // Local ID for serving
        }));

        const record: Record<string, unknown> = {
            gmail_message_id: sent.id,
            gmail_thread_id: sent.threadId,
            account: body.fromAccount,
            direction: "outbound",
            from_email: fromEmail,
            to_emails: extractEmailAddresses(body.to),
            cc_emails: extractEmailAddresses(ccStr),
            bcc_emails: extractEmailAddresses(bccStr),
            subject: body.subject,
            body_html: html,
            label_ids: sent.labelIds ?? null,
            internal_date: new Date().toISOString(),
        };

        // Only add attachments field if there are attachments
        if (attachmentsMeta.length > 0) {
            record.attachments = attachmentsMeta;
        }

        const { data } = await supabaseAdmin
            .from("mail_messages")
            .upsert(record, { onConflict: "gmail_message_id" })
            .select("id")
            .maybeSingle();

        if (trackingId && data?.id) {
            await supabaseAdmin.from("mail_tracking").update({ mail_message_id: data.id }).eq("id", trackingId);
        }
    } catch {
        // ignore persistence failures
    }

    return Response.json({ ok: true, gmailMessageId: sent.id, gmailThreadId: sent.threadId, trackingId });
}

export const POST = async (event: { request: Request; locals: App.Locals }) => handlePost(event);
