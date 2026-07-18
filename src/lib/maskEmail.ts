/**
 * Masks an email for display when telling an applicant "you already applied,
 * check this inbox" — shows enough to recognize which address it is without
 * fully exposing it. Domain is shown in full (that's the "suffix" that helps
 * them know which account to check); only the local part is partially masked.
 *
 * "john@gmail.com"   -> "jo*@gmail.com"
 * "adaeze@outlook.com" -> "ad****@outlook.com"
 * "em@yahoo.com"     -> "e*@yahoo.com"
 */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length - 1 || 1));
  const maskLen = Math.max(local.length - visible.length, 1);
  return `${visible}${"*".repeat(maskLen)}@${domain}`;
}
