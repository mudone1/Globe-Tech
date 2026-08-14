"use client";

import { getSupabaseClient } from "@/lib/supabase-client";
import { selectAllRows } from "@/lib/supabasePaginate";

/**
 * Same purpose and shape as the Firestore-era src/lib/firestoreCache.ts
 * (kept alongside this during the migration): an in-memory, module-scoped
 * cache for full-table admin reads, so navigating between the 5 admin pages
 * within a session doesn't re-fetch the same ~1,000+ row `applications` /
 * ~180 row `staff` tables over and over. See firestoreCache.ts's doc
 * comment for the full rationale — unchanged by the backend swap.
 */

const TTL_MS = 60_000;

interface CacheEntry<T> {
  data: T[];
  fetchedAt: number;
  inFlight: Promise<T[]> | null;
}

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Fetches an entire table, reusing a cached result if it's under the TTL.
 * `mapRow` converts a raw snake_case Postgres row to the app's camelCase
 * record shape (see src/lib/supabaseMappers.ts) — callers pass e.g.
 * rowToStaffRecord so this stays type-safe without this module needing to
 * know about every table's mapper.
 */
export async function getTableCached<T>(
  table: string,
  mapRow: (row: Record<string, unknown>) => T,
  opts?: { force?: boolean }
): Promise<T[]> {
  const existing = cache.get(table) as CacheEntry<T> | undefined;
  const now = Date.now();

  if (!opts?.force && existing) {
    if (existing.inFlight) return existing.inFlight;
    if (now - existing.fetchedAt < TTL_MS) return existing.data;
  }

  const promise = (async () => {
    const allData = await selectAllRows<Record<string, unknown>>((from, to) =>
      getSupabaseClient().from(table).select("*").range(from, to)
    );
    const rows = allData.map(mapRow);
    cache.set(table, { data: rows, fetchedAt: Date.now(), inFlight: null });
    return rows;
  })();

  cache.set(table, { data: existing?.data ?? [], fetchedAt: existing?.fetchedAt ?? 0, inFlight: promise });
  return promise;
}

/** Call after a write that changes a cached table, so the next read is fresh. */
export function invalidateTableCache(table: string): void {
  cache.delete(table);
}
