import { resolveStaffIdFromToken } from "@/lib/referral";
import ApplicationForm from "@/components/ApplicationForm";

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Resolved entirely server-side. If it doesn't resolve, we still let the
  // applicant through and tag the application "unassigned" — per the build
  // plan's graceful-fallback requirement, a bad or missing link never blocks
  // someone from applying.
  const staffId = await resolveStaffIdFromToken(token);

  return <ApplicationForm token={token} referralResolved={Boolean(staffId)} />;
}
