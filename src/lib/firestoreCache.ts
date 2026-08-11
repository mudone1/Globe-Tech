"use client";

import { collection, getDocs, type DocumentData, type QueryDocumentSnapshot } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase-client";

/**
 * In-memory, module-scoped cache for full-collection admin reads. Several
 * admin pages (Applications, Dashboard, Payouts, Verification, Staff) each
 * independently fetched the entire `applications`/`staff` collections on
 * every page load — an admin clicking through 3-4 admin tabs in one session
 * re-read the same ~1000+ application docs and ~170 staff docs 3-4 times
 * over, multiplying Firestore read cost for no reason. This cache reuses the
 * result across pages/navigations for a short TTL instead.
 *
 * Deliberately NOT Firestore's own offline persistence: plain getDocs() calls
 * don't read from Firestore's local cache by default (that requires an
 * explicit getDocsFromCache() cache-first strategy), so persistence alone
 * wouldn't reduce reads here without a larger rework. A simple in-memory
 * cache achieves the same "don't refetch what we just fetched" goal with far
 * less risk of returning stale-but-silently-wrong data.
 *
 * TTL is short (60s) so admins editing data elsewhere still see reasonably
 * fresh results, and `invalidate`/`bust` let a page force a fresh read after
 * a write it knows changed the data.
 */

const TTL_MS = 60_000;

interface CacheEntry<T> {
  data: T[];
  fetchedAt: number;
  inFlight: Promise<T[]> | null;
}

const cache = new Map<string, CacheEntry<unknown>>();

function docsToData<T>(snap: { docs: QueryDocumentSnapshot<DocumentData>[] }): T[] {
  return snap.docs.map((d) => d.data() as T);
}

/**
 * Fetches an entire collection, reusing a cached result if it's under the
 * TTL. Concurrent callers for the same collection (e.g. two admin pages
 * mounting at once) share a single in-flight request instead of firing two.
 */
export async function getCollectionCached<T>(collectionName: string, opts?: { force?: boolean }): Promise<T[]> {
  const existing = cache.get(collectionName) as CacheEntry<T> | undefined;
  const now = Date.now();

  if (!opts?.force && existing) {
    if (existing.inFlight) return existing.inFlight;
    if (now - existing.fetchedAt < TTL_MS) return existing.data;
  }

  const promise = getDocs(collection(getFirebaseDb(), collectionName)).then((snap) => {
    const data = docsToData<T>(snap);
    cache.set(collectionName, { data, fetchedAt: Date.now(), inFlight: null });
    return data;
  });

  cache.set(collectionName, { data: existing?.data ?? [], fetchedAt: existing?.fetchedAt ?? 0, inFlight: promise });
  return promise;
}

/** Call after a write that changes a cached collection, so the next read is fresh. */
export function invalidateCollectionCache(collectionName: string): void {
  cache.delete(collectionName);
}
