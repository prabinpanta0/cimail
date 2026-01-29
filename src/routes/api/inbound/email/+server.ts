import { env } from "$env/dynamic/private";
import { requireEnv } from "$lib/server/assertEnv";
import { supabaseAdmin } from "$lib/server/supabaseAdmin";
import PostalMime from "postal-mime";

function pickAccount(params: {
    headerAccount?: string | null;
    to?: string | null;
    meAddress: string;
    noreplyAddress: string;
}): "me" | "noreply" {
    const header = (params.headerAccount ?? "").toLowerCase();
    if (header === "noreply") return "noreply";
    if (header === "me") return "me";

    const to = (params.to ?? "").toLowerCase();
    if (to.includes(params.noreplyAddress.toLowerCase())) return "noreply";
    return "me";
}

export const POST = async ({ request }) => {
    const expected = requireEnv(env.EMAIL_ROUTING_SECRET, "EMAIL_ROUTING_SECRET");
    const got = request.headers.get("x-email-routing-secret") ?? "";
    if (got !== expected) return new Response("Unauthorized", { status: 401 });

    const raw = await request.arrayBuffer();
    const parser = new PostalMime();
    const parsed = await parser.parse(raw);

    const originalTo = request.headers.get("x-original-to") ?? "";
    const account = pickAccount({
        headerAccount: request.headers.get("x-mail-account"),
        to:
            originalTo ||
            parsed?.to
                ?.map((t: any) => t?.address)
                .filter(Boolean)
                .join(", ") ||
            "",
        meAddress: (env.MAIL_ME_ADDRESS ?? "").toLowerCase(),
        noreplyAddress: (env.MAIL_NOREPLY_ADDRESS ?? "").toLowerCase(),
    });

    const messageId = (parsed?.messageId as string | undefined) ?? crypto.randomUUID();
    const gmailMessageId = `rfc822:${messageId}`;

    const fromAny = parsed?.from as any;
    const fromEmail =
        typeof fromAny?.address === "string"
            ? fromAny.address
            : typeof fromAny?.text === "string"
              ? fromAny.text
              : null;

    const toEmails = Array.isArray(parsed?.to) ? parsed.to : [];
    const ccEmails = Array.isArray(parsed?.cc) ? parsed.cc : [];
    const bccEmails = Array.isArray(parsed?.bcc) ? parsed.bcc : [];

    const bodyText = typeof parsed?.text === "string" ? parsed.text : null;
    const bodyHtml = typeof parsed?.html === "string" ? parsed.html : null;
    const snippet = bodyText
        ? bodyText.slice(0, 240)
        : bodyHtml
          ? bodyHtml.replace(/<[^>]+>/g, "").slice(0, 240)
          : null;

    const internalDate = parsed?.date ? new Date(parsed.date as any).toISOString() : new Date().toISOString();

    const upserted = await supabaseAdmin.from("mail_messages").upsert(
        {
            gmail_message_id: gmailMessageId,
            gmail_thread_id: `rfc822-thread:${messageId}`,
            account,
            direction: "inbound",
            from_email: fromEmail,
            to_emails: toEmails,
            cc_emails: ccEmails,
            bcc_emails: bccEmails,
            subject: (parsed?.subject as string | undefined) ?? null,
            snippet,
            body_text: bodyText,
            body_html: bodyHtml,
            label_ids: [],
            internal_date: internalDate,
        },
        { onConflict: "gmail_message_id" },
    );

    if (upserted.error) {
        return new Response(`DB error: ${upserted.error.message}`, { status: 500 });
    }

    return new Response("ok", { status: 200 });
};
