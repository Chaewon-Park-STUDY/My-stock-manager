"use client";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { monthLabel, money, signedMoney } from "@/lib/format";

// 계열은 항상 이 순서·이 색으로 고정 (필터가 바뀌어도 색이 바뀌지 않게)
export const SERIES = [
  { key: "trading", label: "단타 손익", color: "var(--series-1)" },
  { key: "dividend", label: "배당(세후)", color: "var(--series-2)" },
  { key: "interest", label: "이자(세후)", color: "var(--series-3)" },
];

const compact = (v) => {
  const a = Math.abs(v);
  if (a >= 1e8) return (v / 1e8).toFixed(1).replace(/\.0$/, "") + "억";
  if (a >= 1e4) return Math.round(v / 1e4) + "만";
  return String(v);
};

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const total = SERIES.reduce((s, x) => s + (row[x.key] || 0), 0);
  return (
    <div className="min-w-44 rounded-xl border border-line bg-surface px-4 py-3 text-[13px] shadow-lg">
      <p className="mb-2 font-semibold text-ink">{label.replace("-", "년 ")}월</p>
      {SERIES.map((s) => (
        <div key={s.key} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-ink-2">
            <i className="size-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
          <span className="font-medium text-ink">{signedMoney(row[s.key] || 0)}</span>
        </div>
      ))}
      <div className="mt-2 flex justify-between border-t border-line pt-2 font-semibold text-ink">
        <span>합계</span>
        <span>{signedMoney(total)}</span>
      </div>
    </div>
  );
}

export default function MonthlyChart({ data }) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2" aria-label="범례">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <i className="size-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <BarChart data={data} barGap={2} barCategoryGap="22%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false}
              tick={{ fill: "var(--ink-3)", fontSize: 12 }} interval="preserveStartEnd" />
            <YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={44}
              tick={{ fill: "var(--ink-3)", fontSize: 12 }} />
            <ReferenceLine y={0} stroke="var(--ink-3)" strokeOpacity={0.5} />
            <Tooltip content={<Tip />} cursor={{ fill: "var(--ink-3)", fillOpacity: 0.08 }} />
            {SERIES.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 4, 4]} maxBarSize={14} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="sr-only">
        {data.map((d) => `${d.month}: ${SERIES.map((s) => `${s.label} ${money(d[s.key] || 0)}`).join(", ")}`).join(". ")}
      </p>
    </div>
  );
}
