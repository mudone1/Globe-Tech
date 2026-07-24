"use server";

import {
  registerNewStaff,
  registerNewStaffSimplified,
  type RegisterNewStaffInput,
  type RegisterNewStaffSimplifiedInput,
  type RegisterNewStaffResult,
} from "@/lib/selfRegistration";

export async function submitStaffRegistration(input: RegisterNewStaffInput): Promise<RegisterNewStaffResult> {
  return registerNewStaff(input);
}

export async function submitStaffRegistrationSimplified(input: RegisterNewStaffSimplifiedInput): Promise<RegisterNewStaffResult> {
  return registerNewStaffSimplified(input);
}
