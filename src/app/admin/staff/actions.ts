"use server";

import { syncStaffFromSheet, type SyncResult } from "@/lib/sheetsSync";

export async function runStaffSync(): Promise<SyncResult> {
  return syncStaffFromSheet();
}
