import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export interface Count {
  name: string;
  count: number;
}

export function BarBreakdown({ title, data }: { title: string; data: Count[] }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
      <h3 className="mb-3 font-display text-base font-semibold text-ink">{title}</h3>
      {data.length === 0 ? (
        <p className="text-sm text-slate">No data yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(160, data.length * 34)}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <defs>
              <linearGradient id="barFill" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#0E7A3A" />
                <stop offset="100%" stopColor="#2FC7A3" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#DCE6DE" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#4B5B52" }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={150}
              tick={{ fontSize: 11, fill: "#0B2A18" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 22)}…` : v)}
            />
            <Tooltip />
            <Bar dataKey="count" name="Applications" fill="url(#barFill)" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={900} animationEasing="ease-out" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
