import { env } from "$env/dynamic/private";
import { supabaseAdmin } from "$lib/server/supabaseAdmin";

type DraftRequest = {
    id?: string; // For updating existing draft
    fromAccount: "me" | "noreply";
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    html: string;
    attachments?: { filename: string; contentType: string; contentBase64: string }[];
};

export const POST = async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    if (!locals.user) {
        return new Response("Unauthorized", { status: 401 });
    }

    let body: DraftRequest;
    try {
        body = await request.json();
    } catch {
        return new Response("Invalid JSON", { status: 400 });
    }

    const { id, fromAccount, to, cc, bcc, subject, html, attachments } = body;

    const fromAddress =
        fromAccount === "noreply" ? (env.MAIL_NOREPLY_ADDRESS ?? "noreply") : (env.MAIL_ME_ADDRESS ?? "me");

    // Parse recipients
    const toEmails = to
        .split(",")
        .map(e => e.trim())
        .filter(Boolean);
    const ccEmails =
        cc
            ?.split(",")
            .map(e => e.trim())
            .filter(Boolean) ?? [];
    const bccEmails =
        bcc
            ?.split(",")
            .map(e => e.trim())
            .filter(Boolean) ?? [];

    const draftRecord = {
        account: fromAccount,
        direction: "outbound" as const,
        from_email: fromAddress,
        to_emails: toEmails,
        cc_emails: ccEmails,
        bcc_emails: bccEmails,
        subject: subject || "(no subject)",
        body_html: html,
        body_text: html.replace(/<[^>]*>/g, ""), // Strip HTML for text version
        label_ids: ["DRAFT"],
        is_draft: true,
        internal_date: new Date().toISOString(),
        attachments: attachments && attachments.length > 0 ? attachments : null,
    };

    try {
        if (id) {
            // Update existing draft
            const { error } = await supabaseAdmin
                .from("mail_messages")
                .update(draftRecord)
                .eq("id", id)
                .eq("is_draft", true);

            if (error) throw error;
            return Response.json({ success: true, id });
        } else {
            // Create new draft with a temporary ID
            const tempMessageId = `draft_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const { data, error } = await supabaseAdmin
                .from("mail_messages")
                .insert({
                    ...draftRecord,
                    gmail_message_id: tempMessageId,
                    gmail_thread_id: tempMessageId,
                })
                .select("id")
                .single();

            if (error) throw error;
            return Response.json({ success: true, id: data.id });
        }
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("[drafts] Error:", message);
        return Response.json({ error: message }, { status: 500 });
    }
};

export const DELETE = async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    if (!locals.user) {
        return new Response("Unauthorized", { status: 401 });
    }

    let body: { id: string };
    try {
        body = await request.json();
    } catch {
        return new Response("Invalid JSON", { status: 400 });
    }

    try {
        const { error } = await supabaseAdmin.from("mail_messages").delete().eq("id", body.id).eq("is_draft", true);

        if (error) throw error;
        return Response.json({ success: true });
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("[drafts] Delete error:", message);
        return Response.json({ error: message }, { status: 500 });
    }
};
