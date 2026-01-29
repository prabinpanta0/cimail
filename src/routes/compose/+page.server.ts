import { env } from "$env/dynamic/private";
import { supabaseAdmin } from "$lib/server/supabaseAdmin";

export const load = async ({ url }: { url: URL }) => {
    const draftId = url.searchParams.get("draft");

    let draft = null;
    if (draftId) {
        const { data } = await supabaseAdmin
            .from("mail_messages")
            .select("id,from_email,to_emails,cc_emails,bcc_emails,subject,body_html,attachments,account")
            .eq("id", draftId)
            .eq("is_draft", true)
            .maybeSingle();

        draft = data;
    }

    return {
        meAddress: env.MAIL_ME_ADDRESS ?? "me",
        noreplyAddress: env.MAIL_NOREPLY_ADDRESS ?? "noreply",
        draft,
    };
};
