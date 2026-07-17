import type { GrantCategoryId } from "@/lib/types";

export type GrantTier = "trader" | "enterprise" | "llc";

export interface GrantCategoryConfig {
  id: GrantCategoryId;
  name: string;
  amount: number;
  coversWho: string;
  needed: string; // short "what you need to apply" summary
  tier: GrantTier;
}

export const GRANT_CATEGORIES: GrantCategoryConfig[] = [
  {
    id: "emerging",
    name: "Emerging Business Grant",
    amount: 300_000,
    coversWho: "Petty traders operating on the street side",
    needed: "Business type · Business location · Approximate monthly product cost",
    tier: "trader",
  },
  {
    id: "development",
    name: "Business Development Grant",
    amount: 500_000,
    coversWho: "Petty traders operating in the marketplace",
    needed: "Business type · Business location · Approximate monthly product cost",
    tier: "trader",
  },
  {
    id: "expansion",
    name: "Expansion Grant",
    amount: 800_000,
    coversWho: "Traders operating from a shop or kiosk",
    needed: "Business type · Business location · Approximate monthly product cost",
    tier: "trader",
  },
  {
    id: "growth",
    name: "Enterprise Growth Grant",
    amount: 1_000_000,
    coversWho: "Business owners with a registered Business Name (Enterprise) with CAC",
    needed: "CAC Business Name certificate",
    tier: "enterprise",
  },
  {
    id: "scaleup",
    name: "Scale-Up Grant",
    amount: 1_500_000,
    coversWho: "Business owners with a registered Business Name (Enterprise) with CAC",
    needed: "CAC Business Name certificate",
    tier: "enterprise",
  },
  {
    id: "impact",
    name: "Impact Enterprise Grant",
    amount: 2_000_000,
    coversWho: "Fully registered Limited Liability Companies (LLC) with CAC",
    needed: "CAC full company registration documents",
    tier: "llc",
  },
];

export function getGrantCategory(id: GrantCategoryId): GrantCategoryConfig {
  const found = GRANT_CATEGORIES.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown grant category: ${id}`);
  return found;
}

export const DRAW_INFO = [
  "Applications are open year-round — you can apply at any time.",
  "Every three months, a random draw is conducted from all eligible applicants.",
  "All qualified applicants have an equal chance, regardless of business size or location.",
  "Selected recipients are contacted directly and grants are disbursed.",
  "Unsuccessful applicants remain in the pool for the next quarterly draw.",
];
