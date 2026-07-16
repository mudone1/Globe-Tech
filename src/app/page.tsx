import Link from "next/link";
import BrandMark from "@/components/BrandMark";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <BrandMark size="lg" withWordmark={false} href="" />
      <p className="mt-5 font-mono text-xs uppercase tracking-widest text-gold">Globe-Tech</p>
      <h1 className="mt-3 font-display text-3xl font-semibold text-ink">Globe-Tech SME Grant Portal</h1>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link href="/admin/login" className="btn-primary">
          Log in
        </Link>
        <Link href="/signup" className="btn-secondary">
          Sign up
        </Link>
      </div>
    </main>
  );
}
