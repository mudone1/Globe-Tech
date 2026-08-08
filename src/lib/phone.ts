/**
 * Canonicalizes Nigerian phone numbers to an 11-digit local format
 * ("0XXXXXXXXXX") for COMPARISON purposes only (duplicate detection,
 * existence checks) — never used to overwrite what an applicant actually
 * typed. Returns null if the input doesn't look like a valid Nigerian
 * number at all, so callers can fall back to their own format-only
 * validation instead of silently accepting garbage.
 */
export function normalizeNigerianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("0")) return digits;
  if (digits.length === 10) return "0" + digits;
  if (digits.length === 13 && digits.startsWith("234")) return "0" + digits.slice(3);
  if (digits.length === 14 && digits.startsWith("0234")) return "0" + digits.slice(4);

  return null;
}
