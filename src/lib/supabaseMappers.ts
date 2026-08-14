/**
 * Converts between Postgres snake_case rows (supabase/migrations/0001_init_schema.sql)
 * and the app's existing camelCase record shapes (src/lib/types.ts). Keeping
 * types.ts as the canonical shape used throughout business logic means the
 * query-layer rewrite only touches fetch/write code, not the business logic
 * built on top of it.
 */
import type {
  StaffRecord,
  StaffSetupTokenRecord,
  LinkTokenRecord,
  ApplicationRecord,
  BankValidationBatchRecord,
  EmailLogRecord,
  VisitRecord,
  PayoutSettingsRecord,
  PayoutRecord,
  ReferralLinkSettingsRecord,
} from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export function rowToStaffRecord(r: Row): StaffRecord {
  return {
    staffId: r.staff_id,
    fullName: r.full_name,
    tier: r.tier,
    email: r.email,
    phone: r.phone,
    state: r.state,
    active: r.active,
    sourceRow: r.source_row,
    ...(r.reports_to_code ? { reportsToCode: r.reports_to_code } : {}),
    ...(r.reports_to_name ? { reportsToName: r.reports_to_name } : {}),
    ...(r.auth_user_id ? { authUid: r.auth_user_id } : {}),
    ...(r.registration_source ? { registrationSource: r.registration_source } : {}),
    ...(r.pending_approval !== null && r.pending_approval !== undefined ? { pendingApproval: r.pending_approval } : {}),
    ...(r.registered_at ? { registeredAt: r.registered_at } : {}),
    ...(r.staff_code_corrected !== null && r.staff_code_corrected !== undefined ? { staffCodeCorrected: r.staff_code_corrected } : {}),
    ...(r.staff_code_corrected_at ? { staffCodeCorrectedAt: r.staff_code_corrected_at } : {}),
    ...(r.original_staff_id ? { originalStaffId: r.original_staff_id } : {}),
    ...(r.middle_name ? { middleName: r.middle_name } : {}),
    ...(r.home_address ? { homeAddress: r.home_address } : {}),
    ...(r.social_media_platform ? { socialMediaPlatform: r.social_media_platform } : {}),
    ...(r.social_media_username ? { socialMediaUsername: r.social_media_username } : {}),
    ...(r.nin_number ? { ninNumber: r.nin_number } : {}),
    ...(r.mou_accepted !== null && r.mou_accepted !== undefined ? { mouAccepted: r.mou_accepted } : {}),
    ...(r.declaration_accepted !== null && r.declaration_accepted !== undefined ? { declarationAccepted: r.declaration_accepted } : {}),
    ...(r.state_to_coordinate ? { stateToCoordinate: r.state_to_coordinate } : {}),
    ...(r.role_specialization ? { roleSpecialization: r.role_specialization } : {}),
    ...(r.state_of_influence ? { stateOfInfluence: r.state_of_influence } : {}),
  };
}

export function staffRecordToRow(s: Partial<StaffRecord>): Row {
  const row: Row = {};
  if (s.staffId !== undefined) row.staff_id = s.staffId;
  if (s.fullName !== undefined) row.full_name = s.fullName;
  if (s.tier !== undefined) row.tier = s.tier;
  if (s.email !== undefined) row.email = s.email;
  if (s.phone !== undefined) row.phone = s.phone;
  if (s.state !== undefined) row.state = s.state;
  if (s.active !== undefined) row.active = s.active;
  if (s.sourceRow !== undefined) row.source_row = s.sourceRow;
  if (s.reportsToCode !== undefined) row.reports_to_code = s.reportsToCode;
  if (s.reportsToName !== undefined) row.reports_to_name = s.reportsToName;
  if (s.authUid !== undefined) row.auth_user_id = s.authUid;
  if (s.registrationSource !== undefined) row.registration_source = s.registrationSource;
  if (s.pendingApproval !== undefined) row.pending_approval = s.pendingApproval;
  if (s.registeredAt !== undefined) row.registered_at = s.registeredAt;
  if (s.staffCodeCorrected !== undefined) row.staff_code_corrected = s.staffCodeCorrected;
  if (s.staffCodeCorrectedAt !== undefined) row.staff_code_corrected_at = s.staffCodeCorrectedAt;
  if (s.originalStaffId !== undefined) row.original_staff_id = s.originalStaffId;
  if (s.middleName !== undefined) row.middle_name = s.middleName;
  if (s.homeAddress !== undefined) row.home_address = s.homeAddress;
  if (s.socialMediaPlatform !== undefined) row.social_media_platform = s.socialMediaPlatform;
  if (s.socialMediaUsername !== undefined) row.social_media_username = s.socialMediaUsername;
  if (s.ninNumber !== undefined) row.nin_number = s.ninNumber;
  if (s.mouAccepted !== undefined) row.mou_accepted = s.mouAccepted;
  if (s.declarationAccepted !== undefined) row.declaration_accepted = s.declarationAccepted;
  if (s.stateToCoordinate !== undefined) row.state_to_coordinate = s.stateToCoordinate;
  if (s.roleSpecialization !== undefined) row.role_specialization = s.roleSpecialization;
  if (s.stateOfInfluence !== undefined) row.state_of_influence = s.stateOfInfluence;
  return row;
}

export function rowToStaffSetupToken(r: Row): StaffSetupTokenRecord {
  return { token: r.token, staffId: r.staff_id, createdAt: r.created_at, expiresAt: r.expires_at, used: r.used };
}
export function staffSetupTokenToRow(t: StaffSetupTokenRecord): Row {
  return { token: t.token, staff_id: t.staffId, created_at: t.createdAt, expires_at: t.expiresAt, used: t.used };
}

export function rowToLinkToken(r: Row): LinkTokenRecord {
  return { token: r.token, staffId: r.staff_id, createdAt: r.created_at, ...(r.is_test ? { isTest: true } : {}) };
}
export function linkTokenToRow(t: LinkTokenRecord): Row {
  return { token: t.token, staff_id: t.staffId, created_at: t.createdAt, is_test: t.isTest ?? null };
}

export function rowToApplicationRecord(r: Row): ApplicationRecord {
  return {
    applicationId: r.application_id,
    referredBy: r.referred_by,
    ...(r.referral_token ? { referralToken: r.referral_token } : {}),
    ...(r.referral_resolution_failed ? { referralResolutionFailed: true } : {}),
    grantCategory: r.grant_category,
    grantAmount: r.grant_amount,
    applicantName: r.applicant_name,
    phone: r.phone,
    ...(r.phone_normalized ? { phoneNormalized: r.phone_normalized } : {}),
    email: r.email,
    stateOfResidence: r.state_of_residence,
    businessName: r.business_name,
    grantNeedExplanation: r.grant_need_explanation,
    ...(r.business_type ? { businessType: r.business_type } : {}),
    ...(r.business_location ? { businessLocation: r.business_location } : {}),
    ...(r.monthly_product_cost !== null && r.monthly_product_cost !== undefined ? { monthlyProductCost: r.monthly_product_cost } : {}),
    ...(r.cac_number ? { cacNumber: r.cac_number } : {}),
    ...(r.business_description ? { businessDescription: r.business_description } : {}),
    declarationAgreed: r.declaration_agreed,
    status: r.status,
    createdAt: r.created_at,
    phase1SubmittedAt: r.phase1_submitted_at,
    grantCode: r.grant_code,
    ...(r.is_test ? { isTest: true } : {}),
    ...(r.bank_account_number ? { bankAccountNumber: r.bank_account_number } : {}),
    ...(r.bank_account_name ? { bankAccountName: r.bank_account_name } : {}),
    ...(r.account_details_submitted_at ? { accountDetailsSubmittedAt: r.account_details_submitted_at } : {}),
    ...(r.phase2_verification_status ? { phase2VerificationStatus: r.phase2_verification_status } : {}),
    ...(r.phase2_verified_at ? { phase2VerifiedAt: r.phase2_verified_at } : {}),
    ...(r.phase2_verified_batch_id ? { phase2VerifiedBatchId: r.phase2_verified_batch_id } : {}),
    ...(r.phase2_admin_note ? { phase2AdminNote: r.phase2_admin_note } : {}),
  };
}

export function applicationRecordToRow(a: Partial<ApplicationRecord>): Row {
  const row: Row = {};
  if (a.applicationId !== undefined) row.application_id = a.applicationId;
  if (a.referredBy !== undefined) row.referred_by = a.referredBy;
  if (a.referralToken !== undefined) row.referral_token = a.referralToken;
  if (a.referralResolutionFailed !== undefined) row.referral_resolution_failed = a.referralResolutionFailed;
  if (a.grantCategory !== undefined) row.grant_category = a.grantCategory;
  if (a.grantAmount !== undefined) row.grant_amount = a.grantAmount;
  if (a.applicantName !== undefined) row.applicant_name = a.applicantName;
  if (a.phone !== undefined) row.phone = a.phone;
  if (a.phoneNormalized !== undefined) row.phone_normalized = a.phoneNormalized;
  if (a.email !== undefined) row.email = a.email;
  if (a.stateOfResidence !== undefined) row.state_of_residence = a.stateOfResidence;
  if (a.businessName !== undefined) row.business_name = a.businessName;
  if (a.grantNeedExplanation !== undefined) row.grant_need_explanation = a.grantNeedExplanation;
  if (a.businessType !== undefined) row.business_type = a.businessType;
  if (a.businessLocation !== undefined) row.business_location = a.businessLocation;
  if (a.monthlyProductCost !== undefined) row.monthly_product_cost = a.monthlyProductCost;
  if (a.cacNumber !== undefined) row.cac_number = a.cacNumber;
  if (a.businessDescription !== undefined) row.business_description = a.businessDescription;
  if (a.declarationAgreed !== undefined) row.declaration_agreed = a.declarationAgreed;
  if (a.status !== undefined) row.status = a.status;
  if (a.createdAt !== undefined) row.created_at = a.createdAt;
  if (a.phase1SubmittedAt !== undefined) row.phase1_submitted_at = a.phase1SubmittedAt;
  if (a.grantCode !== undefined) row.grant_code = a.grantCode;
  if (a.isTest !== undefined) row.is_test = a.isTest;
  if (a.bankAccountNumber !== undefined) row.bank_account_number = a.bankAccountNumber;
  if (a.bankAccountName !== undefined) row.bank_account_name = a.bankAccountName;
  if (a.accountDetailsSubmittedAt !== undefined) row.account_details_submitted_at = a.accountDetailsSubmittedAt;
  if (a.phase2VerificationStatus !== undefined) row.phase2_verification_status = a.phase2VerificationStatus;
  if (a.phase2VerifiedAt !== undefined) row.phase2_verified_at = a.phase2VerifiedAt;
  if (a.phase2VerifiedBatchId !== undefined) row.phase2_verified_batch_id = a.phase2VerifiedBatchId;
  if (a.phase2AdminNote !== undefined) row.phase2_admin_note = a.phase2AdminNote;
  return row;
}

export function rowToBankValidationBatch(r: Row): BankValidationBatchRecord {
  return {
    id: r.id,
    fileName: r.file_name,
    uploadedAt: r.uploaded_at,
    ...(r.uploaded_by ? { uploadedBy: r.uploaded_by } : {}),
    rows: r.rows ?? [],
    matchedCount: r.matched_count,
    partialCount: r.partial_count,
  };
}
export function bankValidationBatchToRow(b: BankValidationBatchRecord): Row {
  return {
    id: b.id,
    file_name: b.fileName,
    uploaded_at: b.uploadedAt,
    uploaded_by: b.uploadedBy ?? null,
    rows: b.rows,
    matched_count: b.matchedCount,
    partial_count: b.partialCount,
  };
}

export function rowToEmailLog(r: Row): EmailLogRecord {
  return {
    applicationId: r.application_id,
    type: r.type,
    sentAt: r.sent_at,
    opened: r.opened,
    clicked: r.clicked,
    ...(r.error ? { error: r.error } : {}),
  };
}
export function emailLogToRow(e: EmailLogRecord): Row {
  return { application_id: e.applicationId, type: e.type, sent_at: e.sentAt, opened: e.opened, clicked: e.clicked, error: e.error ?? null };
}

export function rowToVisit(r: Row): VisitRecord {
  return { token: r.token, staffId: r.staff_id, visitedAt: r.visited_at, ...(r.is_test ? { isTest: true } : {}) };
}
export function visitToRow(v: VisitRecord): Row {
  return { token: v.token, staff_id: v.staffId, visited_at: v.visitedAt, is_test: v.isTest ?? null };
}

export function rowToPayoutSettings(r: Row): PayoutSettingsRecord {
  return { perCompletionAmount: r.per_completion_amount, updatedAt: r.updated_at, ...(r.updated_by ? { updatedBy: r.updated_by } : {}) };
}
export function payoutSettingsToRow(id: string, p: PayoutSettingsRecord): Row {
  return { id, per_completion_amount: p.perCompletionAmount, updated_at: p.updatedAt, updated_by: p.updatedBy ?? null };
}

export function rowToPayoutRecord(r: Row): PayoutRecord {
  return { id: r.id, staffId: r.staff_id, amount: r.amount, ...(r.note ? { note: r.note } : {}), paidAt: r.paid_at, ...(r.recorded_by ? { recordedBy: r.recorded_by } : {}) };
}
export function payoutRecordToRow(p: PayoutRecord): Row {
  return { id: p.id, staff_id: p.staffId, amount: p.amount, note: p.note ?? null, paid_at: p.paidAt, recorded_by: p.recordedBy ?? null };
}

export function rowToReferralLinkSettings(r: Row): ReferralLinkSettingsRecord {
  return { linksHidden: r.links_hidden, updatedAt: r.updated_at, ...(r.updated_by ? { updatedBy: r.updated_by } : {}) };
}
export function referralLinkSettingsToRow(id: string, s: ReferralLinkSettingsRecord): Row {
  return { id, links_hidden: s.linksHidden, updated_at: s.updatedAt, updated_by: s.updatedBy ?? null };
}
