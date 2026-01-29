import { env } from "$env/dynamic/private";
import { supabaseAdmin } from "$lib/server/supabaseAdmin";
import { requireEnv } from "./assertEnv";

let cachedToken: { accessToken: string; expiresAtMs: number } | undefined;
let cachedRefreshToken: string | undefined;

async function getGoogleRefreshToken(): Promise<string> {
    if (cachedRefreshToken) return cachedRefreshToken;

    if (env.GOOGLE_REFRESH_TOKEN) {
        cachedRefreshToken = env.GOOGLE_REFRESH_TOKEN;
        return cachedRefreshToken;
    }

    const row = await supabaseAdmin
        .from("mail_app_user")
        .select("gmail_refresh_token")
        .eq("singleton", true)
        .maybeSingle();

    if (row.error) {
        throw new Error(`Failed to load refresh token from DB: ${row.error.message}`);
    }

    cachedRefreshToken = requireEnv(row.data?.gmail_refresh_token ?? "", "mail_app_user.gmail_refresh_token");
    return cachedRefreshToken;
}

export async function getGoogleAccessToken(): Promise<string> {
    const now = Date.now();
    if (cachedToken && cachedToken.expiresAtMs - now > 30_000) {
        return cachedToken.accessToken;
    }

    const clientId = requireEnv(env.GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_ID");
    const clientSecret = requireEnv(env.GOOGLE_CLIENT_SECRET, "GOOGLE_CLIENT_SECRET");
    const refreshToken = await getGoogleRefreshToken();

    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
    });

    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Failed to refresh Google access token: ${res.status} ${text}`);
    }

    const json = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = { accessToken: json.access_token, expiresAtMs: now + json.expires_in * 1000 };
    return cachedToken.accessToken;
}
