import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client using the anon/public key — Row Level Security
 * (supabase/migrations/0001_init_schema.sql) is what actually enforces who
 * can read/write which tables from here, exactly like firestore.rules did
 * for the Firebase client SDK it replaces (src/lib/firebase-client.ts, kept
 * alongside this during the migration).
 *
 * Unlike Firebase's separate getAuth()/getFirestore(), one Supabase client
 * carries both `.auth` (sign in/out, session) and `.from(table)` (data) —
 * call sites use client.auth.* where they used to call getFirebaseAuth(),
 * and client.from("table") where they used to call
 * getFirebaseDb() + collection(...).
 *
 * Lazy singleton for the same build-time-safety reason firebase-client.ts
 * is lazy — deferred until first real use in the browser.
 */
let client: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. Add them to .env.local."
    );
  }

  client = createClient(url, anonKey);
  return client;
}
