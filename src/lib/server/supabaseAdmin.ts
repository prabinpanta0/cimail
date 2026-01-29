import { env } from "$env/dynamic/private";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./assertEnv";

export const supabaseAdmin = createClient(
    requireEnv(env.SUPABASE_URL, "SUPABASE_URL"),
    requireEnv(env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY"),
    {
        auth: { persistSession: false, autoRefreshToken: false },
        realtime: { params: { eventsPerSecond: 5 } },
    },
);
