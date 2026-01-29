import { EmailMessage } from "cloudflare:email";

export default {
  async fetch() {
    return new Response("ok", { status: 200 });
  },

  async email(message, env, ctx) {
    const toAddress = (message.to || "").toLowerCase();
    const meAddress = (env.MAIL_ME_ADDRESS || "").toLowerCase();
    const noreplyAddress = (env.MAIL_NOREPLY_ADDRESS || "").toLowerCase();

    console.log(`Receiving mail for: ${toAddress}`);

    const rawBytes = await new Response(message.raw).arrayBuffer();

    const deliverToApp = async (account) => {
      if (!env.APP_INGEST_URL || !env.APP_INGEST_SECRET) {
        console.error("App Ingest variables missing");
        return;
      }
      await globalThis.fetch(env.APP_INGEST_URL, {
        method: "POST",
        headers: {
          "content-type": "message/rfc822",
          "x-email-routing-secret": env.APP_INGEST_SECRET,
          "x-original-to": message.to,
          "x-mail-account": account,
        },
        body: rawBytes,
      });
    };

    const forwardToGmail = async () => {
      if (!env.GMAIL_FORWARD_TO) {
        console.error("Gmail forward address missing");
        return;
      }
      await (message).forward(env.GMAIL_FORWARD_TO);
    };

    if (toAddress === meAddress) {
      ctx.waitUntil(deliverToApp("me"));
      await forwardToGmail();
    } else if (toAddress === noreplyAddress) {
      await deliverToApp("noreply");
    } else {
      // Catch-all
      ctx.waitUntil(deliverToApp("me"));
      await forwardToGmail();
    }
  },
};