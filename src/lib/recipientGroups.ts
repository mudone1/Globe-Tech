export type RecipientGroupId =
  | "all_applicants"
  | "verified_completed"
  | "pending_verification"
  | "account_type_not_verified"
  | "verification_failed"
  | "invalid_account"
  | "account_not_opened"
  | "all_staff"
  | "staff_regional_coordinator"
  | "staff_state_coordinator"
  | "staff_marketing_officer";

export const RECIPIENT_GROUP_LABELS: Record<RecipientGroupId, string> = {
  all_applicants: "All Applicants",
  verified_completed: "Verified / Completed FirstBank Verification",
  pending_verification: "Pending FirstBank Verification",
  account_type_not_verified: "Account Type Not Yet Verified",
  verification_failed: "Verification Failed",
  invalid_account: "Invalid Account",
  account_not_opened: "Application Submitted — Account Not Yet Opened",
  all_staff: "All Staff",
  staff_regional_coordinator: "Staff — Regional Coordinator",
  staff_state_coordinator: "Staff — State Coordinator",
  staff_marketing_officer: "Staff — Marketing Officer",
};

export const RECIPIENT_GROUP_IDS = Object.keys(RECIPIENT_GROUP_LABELS) as RecipientGroupId[];
