import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import type { Count } from "@/components/dashboard/BarBreakdown";

export const CHART_COLORS = ["#0E7A3A", "#C8952A", "#2BB894", "#D98A4C", "#054A26", "#7FA688", "#B3392C", "#4B5B52"];

export function DonutLegendCard({ title, data }: { title: string; data: Count[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
      <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
      <p className="mb-2 text-xs text-slate">{total ? `${total} response${total === 1 ? "" : "s"}` : "No data yet"}</p>
      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate">No data yet.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="name"
                innerRadius={54}
                outerRadius={78}
                paddingAngle={3}
                stroke="none"
                isAnimationActive
                animationDuration={900}
                animationEasing="ease-out"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <ul className="mt-3 space-y-2">
            {data.map((d, i) => (
              <li key={d.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-ink">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="truncate">{d.name}</span>
                </span>
                <span className="shrink-0 text-slate">{total ? Math.round((d.count / total) * 100) : 0}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
