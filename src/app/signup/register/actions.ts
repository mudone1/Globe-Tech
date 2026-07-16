"use server";

import { registerNewStaff, type RegisterNewStaffInput, type RegisterNewStaffResult } from "@/lib/selfRegistration";

export async function submitStaffRegistration(input: RegisterNewStaffInput): Promise<RegisterNewStaffResult> {
  return registerNewStaff(input);
}
