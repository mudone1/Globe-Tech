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
    name: "Idea Launch Grant",
    amount: 300_000,
    coversWho: "Individuals with a business idea or prototype who have not yet registered with CAC and need funding to launch",
    needed: "Business type · Business location · Approximate monthly product cost",
    tier: "trader",
  },
  {
    id: "development",
    name: "Startup Growth Grant",
    amount: 500_000,
    coversWho: "Early-stage businesses already operating but still validating their products or services. CAC registration is optional but encouraged",
    needed: "Business type · Business location · Approximate monthly product cost",
    tier: "trader",
  },
  {
    id: "expansion",
    name: "Scale-Up Grant",
    amount: 800_000,
    coversWho: "Businesses with consistent customers and revenue looking to increase production, hire staff, or expand operations",
    needed: "Business type · Business location · Approximate monthly product cost",
    tier: "trader",
  },
  {
    id: "growth",
    name: "Business Expansion Grant",
    amount: 1_000_000,
    coversWho: "Registered businesses planning to enter new markets, open new branches, purchase equipment, or significantly grow operations",
    needed: "CAC Business Name certificate",
    tier: "enterprise",
  },
  {
    id: "scaleup",
    name: "Enterprise Growth Grant",
    amount: 1_500_000,
    coversWho: "Established SMEs with CAC registration, a proven business model, and measurable business performance seeking major expansion",
    needed: "CAC Business Name certificate",
    tier: "enterprise",
  },
  {
    id: "impact",
    name: "Impact Enterprise Grant",
    amount: 2_000_000,
    coversWho: "Registered Limited Liability Companies (LLCs) creating significant economic or social impact and seeking large-scale growth",
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
