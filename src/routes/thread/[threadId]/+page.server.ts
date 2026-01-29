import { env } from "$env/dynamic/private";
import { supabaseAdmin } from "$lib/server/supabaseAdmin";

export const load = async ({ params, url }) => {
    const threadId = params.threadId;
    const fromFolder = url.searchParams.get("from") ?? "inbox";

    // Get messages for this thread
    const { data: messagesByThread, error: threadErr } = await supabaseAdmin
        .from("mail_messages")
        .select(
            "id,gmail_message_id,gmail_thread_id,from_email,to_emails,cc_emails,subject,snippet,body_text,body_html,internal_date,direction,label_ids,is_read,is_starred,is_trashed,is_archived,attachments",
        )
        .eq("gmail_thread_id", threadId)
        .order("internal_date", { ascending: true })
        .limit(50);

    const messages =
        messagesByThread && messagesByThread.length > 0
            ? messagesByThread
            : ((
                  await supabaseAdmin
                      .from("mail_messages")
                      .select(
                          "id,gmail_message_id,gmail_thread_id,from_email,to_emails,cc_emails,subject,snippet,body_text,body_html,internal_date,direction,label_ids,is_read,is_starred,is_trashed,is_archived,attachments",
                      )
                      .eq("gmail_message_id", threadId)
                      .order("internal_date", threadId)
                      .limit(50)
              ).data ?? []);

    // Note: Auto-read is disabled - users mark as read explicitly via toolbar button

    // Get tracking info for outbound messages
    const messageIds = messages.map((m: any) => m.id).filter(Boolean);
    let trackingInfo: Record<string, { firstOpenedAt: string | null; openCount: number }> = {};

    if (messageIds.length > 0) {
        const { data: trackingData } = await supabaseAdmin
            .from("mail_tracking")
            .select("mail_message_id, mail_opens(opened_at)")
            .in("mail_message_id", messageIds);

        if (trackingData) {
            for (const track of trackingData) {
                const opens = (track.mail_opens as any[]) ?? [];
                trackingInfo[track.mail_message_id] = {
                    firstOpenedAt: opens.length > 0 ? opens[0]?.opened_at : null,
                    openCount: opens.length,
                };
            }
        }
    }

    const subject = messages?.[messages.length - 1]?.subject ?? null;
    const currentDate = messages?.[0]?.internal_date ?? null;

    // Get previous thread (newer)
    let prevThreadId: string | null = null;
    if (currentDate) {
        const { data: prevData } = await supabaseAdmin
            .from("mail_messages")
            .select("gmail_thread_id")
            .eq("direction", "inbound")
            .gt("internal_date", currentDate)
            .order("internal_date", { ascending: true })
            .limit(1);
        prevThreadId = prevData?.[0]?.gmail_thread_id ?? null;
    }

    // Get next thread (older)
    let nextThreadId: string | null = null;
    if (currentDate) {
        const { data: nextData } = await supabaseAdmin
            .from("mail_messages")
            .select("gmail_thread_id")
            .eq("direction", "inbound")
            .lt("internal_date", currentDate)
            .order("internal_date", { ascending: false })
            .limit(1);
        nextThreadId = nextData?.[0]?.gmail_thread_id ?? null;
    }

    // Get total count for position display
    const { count: totalCount } = await supabaseAdmin
        .from("mail_messages")
        .select("id", { head: true, count: "exact" })
        .eq("direction", "inbound");

    // Get position of current thread
    let position = 1;
    if (currentDate) {
        const { count: posCount } = await supabaseAdmin
            .from("mail_messages")
            .select("id", { head: true, count: "exact" })
            .eq("direction", "inbound")
            .gt("internal_date", currentDate);
        position = (posCount ?? 0) + 1;
    }

    return {
        meAddress: env.MAIL_ME_ADDRESS ?? "me",
        noreplyAddress: env.MAIL_NOREPLY_ADDRESS ?? "noreply",
        threadId,
        subject,
        messages,
        trackingInfo,
        prevThreadId,
        nextThreadId,
        position,
        totalCount: totalCount ?? 0,
        fromFolder,
        error: threadErr?.message ?? null,
    };
};
