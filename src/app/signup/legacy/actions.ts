"use server";

import { registerStaffAccount, type RegisterStaffInput, type RegisterStaffResult } from "@/lib/staffAuth";

export async function registerStaff(input: RegisterStaffInput): Promise<RegisterStaffResult> {
  return registerStaffAccount(input);
}
