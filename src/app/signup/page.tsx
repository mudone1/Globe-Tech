import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import { ROLE_CONFIGS, ROLE_ORDER } from "@/lib/staffRoles";

export default function SignupRolePage() {
  return (
    <main className="min-h-screen bg-paper px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <BrandMark size="sm" />

        <header className="mt-8 max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-widest text-gold">Join Globe-Tech</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
            Which role are you signing up for?
          </h1>
        </header>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {ROLE_ORDER.map((role) => {
            const config = ROLE_CONFIGS[role];
            return (
              <div key={role} className="flex flex-col rounded-card border border-line bg-white p-6 shadow-sm">
                <p className="font-mono text-xs uppercase tracking-widest text-gold">{config.tier}</p>
                <h2 className="mt-1.5 font-display text-xl font-semibold text-ink">{config.title}</h2>
                <p className="mt-1.5 text-sm text-slate">{config.tagline}</p>

                <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate">Reports to</p>
                <p className="text-sm text-ink">{config.reportsTo}</p>

                <ul className="mt-4 flex-1 space-y-2.5">
                  {config.responsibilities.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-sm text-slate">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>

                {config.referrerTier && (
                  <p className="mt-5 rounded-md bg-paper px-3 py-2 text-xs text-slate">
                    Needs a staff code from an active {config.referrerTier}.
                  </p>
                )}

                <Link
                  href={`/signup/register?role=${role}`}
                  className="btn-primary mt-5 w-full text-center"
                >
                  Continue as {config.title}
                </Link>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-slate">
          Already have an account? <Link href="/admin/login" className="font-medium text-brand hover:underline">Log in</Link>
          {" · "}
          Have an existing Staff ID from before?{" "}
          <Link href="/signup/legacy" className="font-medium text-brand hover:underline">
            Use it here
          </Link>
        </p>
      </div>
    </main>
  );
}
