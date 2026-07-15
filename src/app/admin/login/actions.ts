"use server";

import { resolveLoginEmail } from "@/lib/staffAuth";

export async function resolveLogin(identifier: string) {
  return resolveLoginEmail(identifier);
}
