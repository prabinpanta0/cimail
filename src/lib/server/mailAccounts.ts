import { env } from "$env/dynamic/private";
import { requireEnv } from "./assertEnv";

export type MailAccount = "me" | "noreply";

export function getMailAddresses(): { me: string; noreply: string } {
    return {
        me: requireEnv(env.MAIL_ME_ADDRESS, "MAIL_ME_ADDRESS"),
        noreply: requireEnv(env.MAIL_NOREPLY_ADDRESS, "MAIL_NOREPLY_ADDRESS"),
    };
}

export function detectAccountByToHeader(toHeader: string | undefined): MailAccount {
    const { me, noreply } = getMailAddresses();
    const to = (toHeader ?? "").toLowerCase();
    if (to.includes(noreply.toLowerCase())) return "noreply";
    if (to.includes(me.toLowerCase())) return "me";
    return "me";
}
