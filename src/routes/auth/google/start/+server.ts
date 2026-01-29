import { env } from "$env/dynamic/private";
import { requireEnv } from "$lib/server/assertEnv";
import { redirect, type RequestEvent } from "@sveltejs/kit";

export const GET = async ({ url, cookies }: RequestEvent) => {
    const clientId = requireEnv(env.GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_ID");
    const origin = url.origin;
    const redirectUri = `${origin}/auth/google/callback`;
    const secure = url.protocol === "https:";

    const state = crypto.randomUUID();
    cookies.set("oauth_state", state, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure,
        maxAge: 60 * 10,
    });

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify",
        include_granted_scopes: "true",
        access_type: "offline",
        prompt: "consent",
        state,
    });

    throw redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
};
