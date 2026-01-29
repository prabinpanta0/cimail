import { env } from "$env/dynamic/private";
import { requireEnv } from "$lib/server/assertEnv";
import { createSessionToken } from "$lib/server/session";
import { supabaseAdmin } from "$lib/server/supabaseAdmin";
import { redirect, type RequestEvent } from "@sveltejs/kit";

async function exchangeCodeForTokens(params: {
    code: string;
    redirectUri: string;
}): Promise<{ access_token: string; refresh_token?: string; id_token: string }> {
    const clientId = requireEnv(env.GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_ID");
    const clientSecret = requireEnv(env.GOOGLE_CLIENT_SECRET, "GOOGLE_CLIENT_SECRET");

    const body = new URLSearchParams({
        code: params.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: params.redirectUri,
        grant_type: "authorization_code",
    });

    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Token exchange failed: ${res.status} ${text}`);
    }

    return (await res.json()) as { access_token: string; refresh_token?: string; id_token: string };
}

function parseJwtPayload(idToken: string): { sub: string; email: string } {
    const parts = idToken.split(".");
    if (parts.length < 2) throw new Error("Invalid id_token");
    const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = payloadB64.length % 4 === 0 ? "" : "=".repeat(4 - (payloadB64.length % 4));
    const json = atob(payloadB64 + pad);
    const payload = JSON.parse(json) as any;
    if (!payload?.sub || !payload?.email) throw new Error("id_token missing sub/email");
    return { sub: payload.sub, email: payload.email };
}

export const GET = async ({ url, cookies }: RequestEvent) => {
    const state = url.searchParams.get("state") ?? "";
    const storedState = cookies.get("oauth_state") ?? "";
    cookies.delete("oauth_state", { path: "/" });
    if (!state || !storedState || state !== storedState) {
        return new Response("Invalid OAuth state", { status: 400 });
    }

    const code = url.searchParams.get("code");
    if (!code) {
        const err = url.searchParams.get("error") ?? "missing_code";
        return new Response(`OAuth error: ${err}`, { status: 400 });
    }

    const redirectUri = `${url.origin}/auth/google/callback`;
    const secure = url.protocol === "https:";
    const tokens = await exchangeCodeForTokens({ code, redirectUri });
    const user = parseJwtPayload(tokens.id_token);

    // Enforce single-user: if no owner exists, create it; else only allow the same sub.
    const existing = await supabaseAdmin
        .from("mail_app_user")
        .select("google_sub,email")
        .eq("singleton", true)
        .maybeSingle();
    if (existing.error) {
        return new Response(`DB error: ${existing.error.message}`, { status: 500 });
    }

    if (!existing.data) {
        const inserted = await supabaseAdmin
            .from("mail_app_user")
            .insert({ singleton: true, google_sub: user.sub, email: user.email });
        if (inserted.error) {
            return new Response(`Failed to create owner: ${inserted.error.message}`, { status: 500 });
        }
    } else if (existing.data.google_sub !== user.sub) {
        return new Response("This app is restricted to the owner account.", { status: 403 });
    }

    // Store refresh token if present (usually only on first consent).
    if (tokens.refresh_token) {
        const updated = await supabaseAdmin
            .from("mail_app_user")
            .update({ gmail_refresh_token: tokens.refresh_token })
            .eq("singleton", true);
        if (updated.error) {
            return new Response(`Failed to store refresh token: ${updated.error.message}`, { status: 500 });
        }
    }

    const session = await createSessionToken({ sub: user.sub, email: user.email });
    cookies.set("session", session, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure,
        maxAge: 60 * 60 * 24 * 14,
    });

    throw redirect(302, "/inbox");
};
