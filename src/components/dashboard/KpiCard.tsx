import { type CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import CountUp from "@/components/CountUp";

export const KPI_GRADIENTS = [
  "linear-gradient(135deg, #17B25C 0%, #075C31 100%)", // emerald
  "linear-gradient(135deg, #EBBD52 0%, #B3791E 100%)", // gold
  "linear-gradient(135deg, #2FC7A3 0%, #0E6B54 100%)", // teal
  "linear-gradient(135deg, #E0965A 0%, #954E1F 100%)", // bronze/terracotta
];

export function KpiCard({
  icon: Icon,
  gradient,
  label,
  prefix = "",
  numericValue,
  suffix = "",
  sub,
  index = 0,
}: {
  icon: LucideIcon;
  gradient: string;
  label: string;
  prefix?: string;
  numericValue: number;
  suffix?: string;
  sub?: string;
  index?: number;
}) {
  return (
    <div
      className="card-rise lift-hover relative overflow-hidden rounded-2xl p-5 shadow-lg"
      style={{ "--delay": `${index * 70}ms`, background: gradient } as CSSProperties}
    >
      <div
        className="pointer-events-none absolute -left-6 -top-10 h-32 w-32 rounded-full opacity-40"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.55), transparent 70%)" }}
      />
      <div
        className="pop-in relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm"
        style={{ "--delay": `${index * 70 + 120}ms` } as CSSProperties}
      >
        <Icon size={18} className="text-white" strokeWidth={2.25} />
      </div>
      <p className="relative mt-4 font-display text-2xl font-semibold text-white">
        {prefix}
        <CountUp value={numericValue} />
        {suffix}
      </p>
      <p className="relative mt-0.5 text-sm text-white/80">{label}</p>
      {sub && <p className="relative mt-1.5 text-xs text-white/60">{sub}</p>}
    </div>
  );
}
