import { getGoogleAccessToken } from "$lib/server/googleOAuth";

export const GET = async ({
    params,
    locals,
}: {
    params: { messageId: string; attachmentId: string };
    locals: App.Locals;
}) => {
    if (!locals.user) {
        return new Response("Unauthorized", { status: 401 });
    }

    const { messageId, attachmentId } = params;

    try {
        const token = await getGoogleAccessToken();
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`;

        const res = await fetch(url, {
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        if (!res.ok) {
            return new Response("Attachment not found", { status: 404 });
        }

        const data = await res.json();

        // Gmail returns base64url-encoded data
        const base64Data = data.data;
        if (!base64Data) {
            return new Response("No attachment data", { status: 404 });
        }

        // Convert base64url to regular base64
        const base64 = base64Data.replace(/-/g, "+").replace(/_/g, "/");
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        return new Response(bytes, {
            headers: {
                "Content-Type": "application/octet-stream",
                "Cache-Control": "private, max-age=3600",
            },
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("[attachment] Error:", message);
        return new Response("Failed to fetch attachment", { status: 500 });
    }
};
