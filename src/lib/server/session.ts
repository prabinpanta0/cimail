import { env } from "$env/dynamic/private";
import { requireEnv } from "./assertEnv";
import { base64UrlDecodeToBytes, base64UrlDecodeToString, base64UrlEncode } from "./base64url";

export type SessionUser = {
    sub: string;
    email: string;
};

type SessionPayload = SessionUser & {
    iat: number;
    exp: number;
};

let cachedKey: CryptoKey | undefined;

async function getHmacKey(): Promise<CryptoKey> {
    if (cachedKey) return cachedKey;
    const secret = requireEnv(env.SESSION_SECRET, "SESSION_SECRET");
    const keyData = new TextEncoder().encode(secret);
    cachedKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, [
        "sign",
        "verify",
    ]);
    return cachedKey;
}

async function hmac(input: string): Promise<Uint8Array> {
    const key = await getHmacKey();
    const data = new TextEncoder().encode(input);
    const sig = await crypto.subtle.sign("HMAC", key, data);
    return new Uint8Array(sig);
}

function nowSeconds(): number {
    return Math.floor(Date.now() / 1000);
}

export async function createSessionToken(user: SessionUser, ttlSeconds = 60 * 60 * 24 * 14): Promise<string> {
    const iat = nowSeconds();
    const payload: SessionPayload = { ...user, iat, exp: iat + ttlSeconds };
    const payloadB64 = base64UrlEncode(JSON.stringify(payload));
    const sig = await hmac(payloadB64);
    const sigB64 = base64UrlEncode(sig);
    return `${payloadB64}.${sigB64}`;
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payloadB64, sigB64] = parts;

    try {
        const expectedSig = await hmac(payloadB64);
        const actualSig = base64UrlDecodeToBytes(sigB64);
        if (actualSig.length !== expectedSig.length) return null;
        let diff = 0;
        for (let i = 0; i < actualSig.length; i++) diff |= actualSig[i] ^ expectedSig[i];
        if (diff !== 0) return null;

        const payloadJson = base64UrlDecodeToString(payloadB64);
        const payload = JSON.parse(payloadJson) as SessionPayload;
        if (!payload?.sub || !payload?.email || !payload?.exp) return null;
        if (payload.exp <= nowSeconds()) return null;
        return { sub: payload.sub, email: payload.email };
    } catch {
        return null;
    }
}
