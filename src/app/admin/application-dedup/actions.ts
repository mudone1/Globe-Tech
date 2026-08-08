"use server";

import {
  previewApplicationDedup,
  executeApplicationDedup,
  type DedupPreviewResult,
  type DedupExecuteResult,
} from "@/lib/applicationDedup";

export async function previewDedup(): Promise<DedupPreviewResult> {
  return previewApplicationDedup();
}

export async function executeDedup(): Promise<DedupExecuteResult> {
  return executeApplicationDedup();
}
