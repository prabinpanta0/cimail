import { supabaseAdmin } from "$lib/server/supabaseAdmin";

const TRANSPARENT_1X1_PNG_BASE64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6q2XcAAAAASUVORK5CYII=";

function base64ToUint8Array(base64: string): Uint8Array {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

async function sha256Hex(input: string): Promise<string> {
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

export const GET = async ({ params, request }: { params: { trackingId: string }; request: Request }) => {
    const trackingId = params.trackingId;
    const userAgent = request.headers.get("user-agent") ?? undefined;
    const ip =
        request.headers.get("cf-connecting-ip") ??
        request.headers.get("x-forwarded-for") ??
        request.headers.get("x-real-ip") ??
        undefined;

    let ipHash: string | undefined;
    try {
        if (ip) ipHash = await sha256Hex(ip);
    } catch {
        // ignore hashing failures
    }

    // Best-effort logging: never break email rendering.
    try {
        await supabaseAdmin.from("mail_opens").insert({
            tracking_id: trackingId,
            user_agent: userAgent,
            ip_hash: ipHash,
        });
    } catch {
        // ignore logging failures
    }

    const bytes = base64ToUint8Array(TRANSPARENT_1X1_PNG_BASE64);
    return new Response(bytes as unknown as BodyInit, {
        headers: {
            "content-type": "image/png",
            "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            pragma: "no-cache",
            expires: "0",
        },
    });
};
