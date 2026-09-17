import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env/browser";
import { getServerEnv } from "@/lib/env/server";

export function createAdminClient() {
  const publicEnv = getPublicEnv();
  const serverEnv = getServerEnv();
  const secretKey = serverEnv.SUPABASE_SECRET_KEY;

  return createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    secretKey,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}
