import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the SERVICE ROLE key — bypasses Row
 * Level Security entirely, same trust level as the Firebase Admin SDK it
 * replaces (see src/lib/firebase-admin.ts, kept alongside this during the
 * migration). Never import this file from a "use client" component; the
 * service role key must never reach the browser.
 *
 * Lazy singleton for the same reason firebase-admin.ts is lazy: avoids
 * throwing during `next build`'s page-data collection pass when env vars
 * aren't present yet (e.g. a fresh environment before secrets are added).
 */
let client: SupabaseClient | undefined;

export function getAdminSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. Add them to .env.local (see .env.local.example)."
    );
  }

  client = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
