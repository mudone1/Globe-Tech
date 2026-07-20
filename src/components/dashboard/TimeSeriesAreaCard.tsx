import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export interface TimeSeriesPoint {
  date: string;
  count: number;
}

export function TimeSeriesAreaCard({ title, data }: { title: string; data: TimeSeriesPoint[] }) {
  return (
    <div className="card-rise lift-hover rounded-2xl border border-line bg-white p-6 shadow-sm">
      <h2 className="mb-4 font-display text-base font-semibold text-ink">{title}</h2>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="appFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#17B25C" stopOpacity={0.45} />
                <stop offset="60%" stopColor="#17B25C" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#17B25C" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="appStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#0E7A3A" />
                <stop offset="100%" stopColor="#C8952A" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#DCE6DE" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#4B5B52" }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#4B5B52" }} axisLine={false} tickLine={false} width={28} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="count"
              name="Applications"
              stroke="url(#appStroke)"
              strokeWidth={3}
              fill="url(#appFill)"
              isAnimationActive
              animationDuration={1100}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <p className="py-10 text-center text-sm text-slate">No applications yet.</p>
      )}
    </div>
  );
}
