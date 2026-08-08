/**
 * Loose "does this look like a person's name" check — used to catch
 * applicants who paste their account NUMBER into the account-holder NAME
 * field on the FirstBank details form. Deliberately permissive: allows
 * spaces, hyphens, apostrophes, periods (e.g. "Mrs. Ade-Okafor O'Brien"),
 * only rejects input that's mostly/entirely numeric.
 */
export function isLikelyPersonName(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  const digitCount = (trimmed.match(/\d/g) ?? []).length;
  if (digitCount / trimmed.length > 0.3) return false; // mostly numeric -> reject
  if (/^[\d\s+()-]+$/.test(trimmed)) return false; // pure numeric/phone-shaped -> reject

  return /[a-zA-Z]/.test(trimmed); // must contain at least one letter
}

export const ACCOUNT_NAME_ERROR = "Please enter the name on your bank account, not your account number.";
