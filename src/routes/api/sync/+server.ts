import { env } from "$env/dynamic/private";
import { requireEnv } from "$lib/server/assertEnv";
import { extractEmailAddresses } from "$lib/server/emailParsing";
import {
    gmailExtractAttachments,
    gmailExtractBodies,
    gmailGetHeader,
    gmailGetMessage,
    gmailListMessages,
} from "$lib/server/gmailApi";
import { getMailAddresses } from "$lib/server/mailAccounts";
import { supabaseAdmin } from "$lib/server/supabaseAdmin";

async function syncLabel(labelId: string, fullSync: boolean, meLower: string, noreplyLower: string, stateKey: string) {
    let pageToken: string | undefined = undefined;

    if (!fullSync) {
        const { data: state } = await supabaseAdmin
            .from("mail_sync_state")
            .select("next_page_token")
            .eq("account", stateKey)
            .maybeSingle();
        pageToken = state?.next_page_token ?? undefined;
    }

    let totalFetched = 0;
    let totalUpserted = 0;
    let hasMore = true;
    const maxPages = fullSync ? 10 : 1;
    let pageCount = 0;

    while (hasMore && pageCount < maxPages) {
        const list = await gmailListMessages({
            labelIds: [labelId],
            maxResults: 50,
            pageToken,
        });
        const messageRefs = list.messages ?? [];
        totalFetched += messageRefs.length;

        for (const ref of messageRefs) {
            const { data: existing } = await supabaseAdmin
                .from("mail_messages")
                .select("gmail_message_id")
                .eq("gmail_message_id", ref.id)
                .maybeSingle();

            if (existing && !fullSync) continue;

            const msg = await gmailGetMessage(ref.id);
            const subject = gmailGetHeader(msg, "Subject");
            const fromHeader = gmailGetHeader(msg, "From");
            const toHeader = gmailGetHeader(msg, "To");
            const ccHeader = gmailGetHeader(msg, "Cc");
            const bccHeader = gmailGetHeader(msg, "Bcc");
            const bodies = gmailExtractBodies(msg);
            const attachments = gmailExtractAttachments(msg);

            const toEmails = extractEmailAddresses(toHeader);
            const ccEmails = extractEmailAddresses(ccHeader);
            const bccEmails = extractEmailAddresses(bccHeader);

            const anyHeader =
                `${toHeader ?? ""} ${ccHeader ?? ""} ${bccHeader ?? ""} ${fromHeader ?? ""}`.toLowerCase();
            const allRecipients = [...toEmails, ...ccEmails, ...bccEmails].map(e => e.toLowerCase());

            // For SENT, also check the from header
            const hasDomainRecipient =
                anyHeader.includes(meLower) ||
                anyHeader.includes(noreplyLower) ||
                allRecipients.includes(meLower) ||
                allRecipients.includes(noreplyLower);

            if (!hasDomainRecipient) continue;

            const account = anyHeader.includes(noreplyLower) || allRecipients.includes(noreplyLower) ? "noreply" : "me";
            const direction = (msg.labelIds ?? []).includes("SENT") ? "outbound" : "inbound";

            const internalDateMs = msg.internalDate ? Number(msg.internalDate) : undefined;
            const internalDate = internalDateMs ? new Date(internalDateMs).toISOString() : null;

            const record = {
                gmail_message_id: msg.id,
                gmail_thread_id: msg.threadId,
                account,
                direction,
                from_email: fromHeader,
                to_emails: toEmails,
                cc_emails: ccEmails,
                bcc_emails: bccEmails,
                subject: subject ?? null,
                snippet: msg.snippet ?? null,
                body_text: bodies.text ?? null,
                body_html: bodies.html ?? null,
                label_ids: msg.labelIds ?? null,
                internal_date: internalDate,
                attachments: attachments.length > 0 ? attachments : null,
            };

            const { error } = await supabaseAdmin
                .from("mail_messages")
                .upsert(record, { onConflict: "gmail_message_id" });
            if (!error) totalUpserted++;
        }

        pageToken = list.nextPageToken ?? undefined;
        hasMore = !!pageToken && messageRefs.length > 0;
        pageCount++;
    }

    // Update sync state for this label
    await supabaseAdmin.from("mail_sync_state").upsert(
        {
            account: stateKey,
            next_page_token: pageToken ?? null,
            updated_at: new Date().toISOString(),
        },
        { onConflict: "account" },
    );

    return {
        fetched: totalFetched,
        upserted: totalUpserted,
        pages: pageCount,
        hasMore,
        nextPageToken: pageToken ?? null,
    };
}

async function syncOnce(fullSync = false) {
    const { me, noreply } = getMailAddresses();
    const meLower = me.toLowerCase();
    const noreplyLower = noreply.toLowerCase();

    // Sync both INBOX and SENT
    const inboxResult = await syncLabel("INBOX", fullSync, meLower, noreplyLower, "me_inbox");
    const sentResult = await syncLabel("SENT", fullSync, meLower, noreplyLower, "me_sent");

    const totalFetched = inboxResult.fetched + sentResult.fetched;
    const totalUpserted = inboxResult.upserted + sentResult.upserted;
    const pageCount = inboxResult.pages + sentResult.pages;
    const hasMore = inboxResult.hasMore || sentResult.hasMore;

    return Response.json({
        fetched: totalFetched,
        upserted: totalUpserted,
        pages: pageCount,
        hasMore,
        inbox: inboxResult,
        sent: sentResult,
    });
}

export const GET = async ({ request }: { request: Request }) => {
    const provided = request.headers.get("x-sync-secret") ?? "";
    if (provided !== requireEnv(env.SYNC_SECRET, "SYNC_SECRET")) {
        return new Response("Unauthorized", { status: 401 });
    }

    try {
        return await syncOnce();
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("[sync] Error:", message);
        return Response.json({ error: message }, { status: 500 });
    }
};

export const POST = async ({ locals, url }: { locals: App.Locals; url: URL }) => {
    if (!locals.user) return new Response("Unauthorized", { status: 401 });

    const fullSync = url.searchParams.get("full") === "true";

    try {
        return await syncOnce(fullSync);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("[sync] Error:", message);
        return Response.json({ error: message }, { status: 500 });
    }
};
