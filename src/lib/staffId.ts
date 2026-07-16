/**
 * Staff IDs from the onboarding sheet can contain a "/" (e.g. "GBT01S/115545925"),
 * but Firestore document IDs can't — a "/" inside a path segment gets read as a
 * path separator, which turns "staff/GBT01S/115545925" into a 3-segment path
 * (pointing at a collection, not a document) and throws "documentPath must point
 * to a document". Every place that turns a staffId into a Firestore doc ID must
 * run it through this first. The original, unmodified staffId is still what gets
 * stored in the `staffId` field and shown in the UI — only the doc ID is affected.
 */
export function staffDocId(staffId: string): string {
  return staffId.trim().replace(/\//g, "_");
}
