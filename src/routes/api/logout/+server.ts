import type { RequestEvent } from "@sveltejs/kit";
import { redirect } from "@sveltejs/kit";

export const POST = async ({ cookies }: RequestEvent) => {
    // Clear the session cookie
    cookies.delete("session", { path: "/" });

    return new Response(null, { status: 200 });
};

export const GET = async ({ cookies }: RequestEvent) => {
    // Clear the session cookie
    cookies.delete("session", { path: "/" });

    throw redirect(302, "/login");
};
