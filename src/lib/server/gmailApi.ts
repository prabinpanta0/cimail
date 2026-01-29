import { base64UrlDecodeToString, base64UrlEncode } from "./base64url";
import { getGoogleAccessToken } from "./googleOAuth";

type GmailListResponse = {
    messages?: Array<{ id: string; threadId: string }>;
    nextPageToken?: string;
    resultSizeEstimate?: number;
};

type GmailHeader = { name: string; value: string };

type GmailPayload = {
    mimeType?: string;
    filename?: string;
    headers?: GmailHeader[];
    body?: { size?: number; data?: string };
    parts?: GmailPayload[];
};

type GmailMessage = {
    id: string;
    threadId: string;
    labelIds?: string[];
    snippet?: string;
    internalDate?: string;
    payload?: GmailPayload;
};

export async function gmailListMessages(params: {
    labelIds?: string[];
    q?: string;
    maxResults?: number;
    pageToken?: string;
}): Promise<GmailListResponse> {
    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    if (params.labelIds) for (const label of params.labelIds) url.searchParams.append("labelIds", label);
    if (params.q) url.searchParams.set("q", params.q);
    if (params.maxResults) url.searchParams.set("maxResults", String(params.maxResults));
    if (params.pageToken) url.searchParams.set("pageToken", params.pageToken);

    return gmailFetchJson(url.toString());
}

export async function gmailGetMessage(id: string): Promise<GmailMessage> {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`;
    return gmailFetchJson(url);
}

export async function gmailSendRawMessage(rawMime: string, threadId?: string): Promise<GmailMessage> {
    const body: Record<string, unknown> = { raw: base64UrlEncode(rawMime) };
    if (threadId) body.threadId = threadId;
    return gmailFetchJson("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

export function gmailGetHeader(message: GmailMessage, name: string): string | undefined {
    const headers = message.payload?.headers ?? [];
    const found = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return found?.value;
}

export function gmailExtractBodies(message: GmailMessage): { text?: string; html?: string } {
    const out: { text?: string; html?: string } = {};

    const walk = (node?: GmailPayload) => {
        if (!node) return;
        if (node.parts) {
            for (const p of node.parts) walk(p);
            return;
        }

        const data = node.body?.data;
        if (!data) return;

        if (node.mimeType === "text/plain" && !out.text) out.text = base64UrlDecodeToString(data);
        if (node.mimeType === "text/html" && !out.html) out.html = base64UrlDecodeToString(data);
    };

    walk(message.payload);
    return out;
}

export type AttachmentInfo = {
    filename: string;
    mimeType: string;
    size: number;
    attachmentId?: string;
};

export function gmailExtractAttachments(message: GmailMessage): AttachmentInfo[] {
    const attachments: AttachmentInfo[] = [];

    const walk = (node?: GmailPayload) => {
        if (!node) return;
        if (node.parts) {
            for (const p of node.parts) walk(p);
            return;
        }

        // Check if this part is an attachment (has filename and is not inline)
        if (node.filename && node.filename.length > 0) {
            attachments.push({
                filename: node.filename,
                mimeType: node.mimeType ?? "application/octet-stream",
                size: node.body?.size ?? 0,
                attachmentId: (node.body as any)?.attachmentId,
            });
        }
    };

    walk(message.payload);
    return attachments;
}

async function gmailFetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
    const token = await getGoogleAccessToken();
    let res: Response;
    try {
        res = await fetch(url, {
            ...init,
            headers: {
                authorization: `Bearer ${token}`,
                ...(init?.headers ?? {}),
                "content-type": "application/json",
            },
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        throw new Error(`Gmail API network error (${url}): ${message}`);
    }

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Gmail API error (${url}): ${res.status} ${text}`);
    }

    return (await res.json()) as T;
}
