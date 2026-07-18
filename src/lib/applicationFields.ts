import type { ApplicationRecord } from "@/lib/types";
import { getGrantCategory } from "@/lib/grantCategories";

export type FieldDisplayType = "text" | "currency" | "boolean" | "link";

export interface FieldMeta {
  key: keyof ApplicationRecord;
  label: string;
  type?: FieldDisplayType;
}

export interface FieldGroup {
  title: string;
  fields: FieldMeta[];
}

const UNIVERSAL_FIELDS: FieldMeta[] = [
  { key: "applicantName", label: "Full name" },
  { key: "phone", label: "Phone number" },
  { key: "email", label: "Email address" },
  { key: "stateOfResidence", label: "State of residence" },
  { key: "businessName", label: "Business name" },
  { key: "grantNeedExplanation", label: "Why they need this grant" },
];

const TRADER_FIELDS: FieldMeta[] = [
  { key: "businessType", label: "Business type" },
  { key: "businessLocation", label: "Business location" },
  { key: "monthlyProductCost", label: "Approx. monthly product cost", type: "currency" },
];

const CAC_FIELDS: FieldMeta[] = [
  { key: "cacNumber", label: "BN / RC number" },
  { key: "businessDescription", label: "Business description" },
];

/** Builds the field groups for one application, tailored to its grant category's tier. */
export function getApplicationFieldGroups(record: ApplicationRecord): FieldGroup[] {
  const category = getGrantCategory(record.grantCategory);
  const tailored = category.tier === "trader" ? TRADER_FIELDS : CAC_FIELDS;
  return [
    { title: "Applicant", fields: UNIVERSAL_FIELDS },
    { title: category.tier === "trader" ? "Business Details" : "Business Registration", fields: tailored },
    { title: "Declaration", fields: [{ key: "declarationAgreed", label: "Declaration", type: "boolean" }] },
  ];
}

export function formatFieldValue(record: ApplicationRecord, field: FieldMeta): string {
  const raw = record[field.key];
  if (field.type === "currency") {
    const n = Number(raw);
    return n ? `₦${n.toLocaleString()}` : "—";
  }
  if (field.type === "boolean") {
    return raw ? "Agreed ✓" : "Not agreed";
  }
  if (field.type === "link") {
    return typeof raw === "string" && raw ? raw : "—";
  }
  const s = typeof raw === "string" ? raw.trim() : String(raw ?? "");
  return s || "—";
}
