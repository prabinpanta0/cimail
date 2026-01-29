import { supabaseAdmin } from "$lib/server/supabaseAdmin";

type ActionRequest = {
    action: "archive" | "unarchive" | "trash" | "untrash" | "delete" | "star" | "unstar" | "markRead" | "markUnread";
    messageId: string; // gmail_message_id
};

// Local-only actions - no Gmail API calls, just update our database
async function updateMessageState(
    messageId: string,
    updates: { is_starred?: boolean; is_trashed?: boolean; is_archived?: boolean; is_read?: boolean },
): Promise<void> {
    const { error } = await supabaseAdmin.from("mail_messages").update(updates).eq("gmail_message_id", messageId);

    if (error) {
        throw new Error(`Failed to update message: ${error.message}`);
    }
}

async function permanentlyDelete(messageId: string): Promise<void> {
    const { error } = await supabaseAdmin.from("mail_messages").delete().eq("gmail_message_id", messageId);

    if (error) {
        throw new Error(`Failed to delete message: ${error.message}`);
    }
}

export const POST = async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    if (!locals.user) {
        return new Response("Unauthorized", { status: 401 });
    }

    let body: ActionRequest;
    try {
        body = await request.json();
    } catch {
        return new Response("Invalid JSON", { status: 400 });
    }

    const { action, messageId } = body;
    if (!action || !messageId) {
        return new Response("Missing action or messageId", { status: 400 });
    }

    try {
        switch (action) {
            case "archive":
                await updateMessageState(messageId, { is_archived: true });
                break;
            case "unarchive":
                await updateMessageState(messageId, { is_archived: false });
                break;
            case "trash":
                await updateMessageState(messageId, { is_trashed: true });
                break;
            case "untrash":
                await updateMessageState(messageId, { is_trashed: false });
                break;
            case "delete":
                await permanentlyDelete(messageId);
                break;
            case "star":
                await updateMessageState(messageId, { is_starred: true });
                break;
            case "unstar":
                await updateMessageState(messageId, { is_starred: false });
                break;
            case "markRead":
                await updateMessageState(messageId, { is_read: true });
                break;
            case "markUnread":
                await updateMessageState(messageId, { is_read: false });
                break;
            default:
                return new Response("Unknown action", { status: 400 });
        }

        return Response.json({ success: true });
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("[actions] Error:", message);
        return Response.json({ error: message }, { status: 500 });
    }
};
