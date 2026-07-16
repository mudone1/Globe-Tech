"use server";

import { resolveSetupToken, setPasswordForStaff } from "@/lib/selfRegistration";

export async function checkSetupToken(token: string) {
  return resolveSetupToken(token);
}

export async function completeSetup(token: string, password: string) {
  return setPasswordForStaff(token, password);
}
