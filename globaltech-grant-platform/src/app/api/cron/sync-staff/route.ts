import { NextResponse } from "next/server";
import { syncStaffFromSheet } from "@/lib/sheetsSync";

// Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is
// set as an env var — this rejects any other caller so the route can't be
// used to trigger syncs from the public internet. If CRON_SECRET isn't set,
// this check is skipped (fine for local testing, not recommended in prod).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await syncStaffFromSheet();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
