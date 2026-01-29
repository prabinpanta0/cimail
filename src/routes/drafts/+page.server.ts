import { env } from "$env/dynamic/private";
import { supabaseAdmin } from "$lib/server/supabaseAdmin";

export const load = async ({ url }: { url: URL }) => {
    const meAddress = env.MAIL_ME_ADDRESS ?? "me";
    const noreplyAddress = env.MAIL_NOREPLY_ADDRESS ?? "noreply";
    const selectedAccount = (url.searchParams.get("account") ?? "all").toLowerCase();
    const qRaw = url.searchParams.get("q") ?? "";
    const q = qRaw.replaceAll(",", " ").trim();

    // Query for draft messages (using is_draft column or DRAFT label)
    let query = supabaseAdmin
        .from("mail_messages")
        .select(
            "id,gmail_message_id,gmail_thread_id,from_email,to_emails,subject,snippet,internal_date,direction,account,label_ids,is_draft",
        )
        .or("is_draft.eq.true,label_ids.cs.{DRAFT}")
        .order("internal_date", { ascending: false });

    if (selectedAccount === "me" || selectedAccount === "noreply") {
        query = query.eq("account", selectedAccount);
    }

    if (q) {
        const like = `%${q}%`;
        query = query.or(`from_email.ilike.${like},subject.ilike.${like},snippet.ilike.${like}`);
    }

    const { data: messages, error } = await query.limit(50);

    if (error) {
        return {
            meAddress,
            noreplyAddress,
            selectedAccount,
            q: qRaw,
            messages: [],
            totalCount: 0,
            error: error.message,
        };
    }

    // Mark as drafts for display
    const draftMessages = (messages ?? []).map(m => ({ ...m, is_draft: true }));

    const countRes = await supabaseAdmin
        .from("mail_messages")
        .select("id", { head: true, count: "exact" })
        .or("is_draft.eq.true,label_ids.cs.{DRAFT}");

    return {
        meAddress,
        noreplyAddress,
        selectedAccount,
        q: qRaw,
        messages: draftMessages,
        totalCount: countRes.count ?? 0,
        error: null as string | null,
    };
};
