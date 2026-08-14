"use server";

import * as XLSX from "xlsx";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { runVerificationBatch } from "@/lib/phase2Verification";
import { bankValidationBatchToRow } from "@/lib/supabaseMappers";
import type { BankValidationRow, BankValidationBatchRecord } from "@/lib/types";

function findColumn(headers: string[], candidates: string[]): number {
  const normalized = headers.map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const candidate of candidates) {
    const target = candidate.toLowerCase().replace(/[^a-z0-9]/g, "");
    const idx = normalized.findIndex((h) => h === target || h.includes(target));
    if (idx !== -1) return idx;
  }
  return -1;
}

export type UploadBankValidationResult =
  | { ok: true; batchId: string; rowCount: number; matchedCount: number; partialCount: number }
  | { ok: false; error: string };

export async function uploadBankValidationFile(formData: FormData, adminUid?: string): Promise<UploadBankValidationResult> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "Choose a file first." };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "That file is too large — max 10MB." };

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]!];
    if (!sheet) return { ok: false, error: "Couldn't find any data in that file." };

    const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
    if (raw.length < 2) return { ok: false, error: "That file doesn't have any data rows." };

    const headers = (raw[0] as unknown[]).map((h) => String(h ?? ""));
    const accountNumberCol = findColumn(headers, ["account number", "accountnumber", "acct no", "acctno", "account no"]);
    const accountNameCol = findColumn(headers, ["account name", "accountname", "name"]);
    const referenceCol = findColumn(headers, ["reference", "bank reference", "ref"]);

    if (accountNumberCol === -1 || accountNameCol === -1) {
      return {
        ok: false,
        error: 'Couldn\'t find "Account Number" and "Account Name" columns in that file. Check the column headers match.',
      };
    }

    const rows: BankValidationRow[] = [];
    for (let i = 1; i < raw.length; i++) {
      const row = raw[i] as unknown[];
      const accountNumber = String(row[accountNumberCol] ?? "").trim();
      const accountName = String(row[accountNameCol] ?? "").trim();
      if (!accountNumber || !accountName) continue;
      const bankReference = referenceCol !== -1 ? String(row[referenceCol] ?? "").trim() : undefined;
      rows.push({ accountNumber, accountName, ...(bankReference ? { bankReference } : {}) });
    }

    if (rows.length === 0) {
      return { ok: false, error: "No valid rows found — check the Account Number and Account Name columns have data." };
    }

    const db = getAdminSupabase();
    const batchId = crypto.randomUUID();
    const { matchedCount, partialCount } = await runVerificationBatch(rows, batchId);

    const record: BankValidationBatchRecord = {
      id: batchId,
      fileName: file.name,
      uploadedAt: new Date().toISOString(),
      ...(adminUid ? { uploadedBy: adminUid } : {}),
      rows,
      matchedCount,
      partialCount,
    };
    const { error: insertErr } = await db.from("bank_validation_batches").insert(bankValidationBatchToRow(record));
    if (insertErr) throw new Error(insertErr.message);

    return { ok: true, batchId, rowCount: rows.length, matchedCount, partialCount };
  } catch (err) {
    console.error("uploadBankValidationFile failed:", err);
    return { ok: false, error: "Couldn't read that file. Make sure it's a valid CSV or Excel file." };
  }
}

export interface BankValidationBatchSummary {
  id: string;
  fileName: string;
  uploadedAt: string;
  rowCount: number;
  matchedCount: number;
  partialCount: number;
}

export async function listBankValidationBatches(): Promise<BankValidationBatchSummary[]> {
  const { data, error } = await getAdminSupabase()
    .from("bank_validation_batches")
    .select("*")
    .order("uploaded_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    fileName: row.file_name,
    uploadedAt: row.uploaded_at,
    rowCount: row.rows?.length ?? 0,
    matchedCount: row.matched_count,
    partialCount: row.partial_count,
  }));
}
