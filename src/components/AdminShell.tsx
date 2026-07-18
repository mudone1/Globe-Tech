"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { LayoutDashboard, FileText, Users, Wallet, Settings, ShieldCheck, LogOut } from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase-client";

const LINKS = [
  { href: "/admin/dashboard", label: "Analytics", icon: LayoutDashboard },
  { href: "/admin/applications", label: "Applications", icon: FileText },
  { href: "/admin/verification", label: "Verification", icon: ShieldCheck },
  { href: "/admin/staff", label: "Staff", icon: Users },
  { href: "/admin/payouts", label: "Payouts", icon: Wallet },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await signOut(getFirebaseAuth());
    router.push("/admin/login");
  }

  return (
    <div className="min-h-screen bg-paper lg:flex">
      <aside className="flex shrink-0 flex-col justify-between border-b border-line bg-brandDeep px-4 py-5 lg:h-screen lg:w-60 lg:sticky lg:top-0 lg:border-b-0 lg:border-r lg:border-brandDark lg:py-6">
        <div>
          <div className="flex items-center gap-2.5 px-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10">
              <Image src="/logo.png" alt="Globe-Tech" width={26} height={26} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">Globe-Tech</p>
              <p className="truncate text-xs text-white/50">Admin console</p>
            </div>
          </div>

          <nav className="mt-8 flex gap-1 overflow-x-auto lg:mt-8 lg:flex-col lg:overflow-visible">
            {LINKS.map((l) => {
              const isActive = pathname === l.href || pathname.startsWith(`${l.href}/`);
              const Icon = l.icon;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    isActive ? "bg-brand text-white shadow-sm" : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={17} strokeWidth={2} />
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <button
          onClick={handleSignOut}
          className="mt-6 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/50 transition hover:bg-white/5 hover:text-white lg:mt-0"
        >
          <LogOut size={17} strokeWidth={2} />
          Sign out
        </button>
      </aside>

      <div className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:py-10">{children}</div>
    </div>
  );
}
