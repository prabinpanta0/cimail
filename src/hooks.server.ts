import { verifySessionToken } from "$lib/server/session";
import type { Handle } from "@sveltejs/kit";
import { redirect } from "@sveltejs/kit";

const PUBLIC_PATH_PREFIXES = ["/auth/", "/login", "/track/"];

export const handle: Handle = async ({ event, resolve }) => {
    const pathname = event.url.pathname;

    const sessionCookie = event.cookies.get("session");
    if (sessionCookie) {
        const user = await verifySessionToken(sessionCookie);
        if (user) event.locals.user = user;
    }

    // Skip redirect-based auth gating for APIs; they can still read `event.locals.user`.
    if (pathname.startsWith("/api/")) {
        return resolve(event);
    }

    const isPublic = PUBLIC_PATH_PREFIXES.some(p => pathname === p || pathname.startsWith(p)) || pathname === "/";

    if (!event.locals.user && !isPublic) {
        throw redirect(302, "/login");
    }

    return resolve(event);
};
