import { resolveStaffIdFromToken } from "@/lib/referral";
import ApplicationForm from "@/components/ApplicationForm";
import BrandMark from "@/components/BrandMark";

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

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-2xl px-6 py-14 sm:py-20">
        <header className="mb-10">
          <BrandMark size="sm" />
          <p className="mt-6 font-mono text-xs uppercase tracking-widest text-gold">
            Globe-Tech &middot; SME Grant Referral
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-ink sm:text-4xl">
            Apply for the FirstBank SME Grant
          </h1>
          <p className="mt-3 text-slate">
            This link tags your application to the Globe-Tech staff member who referred you, so
            fill it out here rather than searching for the form elsewhere.
          </p>
        </header>

        <ApplicationForm token={token} referralResolved={Boolean(staffId)} />
      </div>
    </main>
  );
}
