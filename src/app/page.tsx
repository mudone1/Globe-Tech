import Link from "next/link";
import BrandMark from "@/components/BrandMark";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <BrandMark size="lg" withWordmark={false} href="" />
      <p className="mt-5 font-mono text-xs uppercase tracking-widest text-gold">Globe-Tech</p>
      <h1 className="mt-3 font-display text-3xl font-semibold text-ink">SME Grant Referral Platform</h1>
      <p className="mt-3 max-w-md text-slate">
        Applicants reach this platform through a staff member&rsquo;s personal referral link
        (grant.globaltech.com/apply/&hellip;). Staff and admins sign in below.
      </p>
      <Link href="/admin/login" className="btn-primary mt-6">
        Staff / Admin sign in
      </Link>
    </main>
  );
}
