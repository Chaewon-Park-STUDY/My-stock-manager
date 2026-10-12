"use client";
import {
  CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

// 박스가 어떻게 끝났는지에 따라 칠하는 색 (한국 관례: 상승 빨강, 하락 파랑)
export const BOX_FILL = {
  UP: "var(--up)",
  DOWN: "var(--down)",
  ACTIVE: "var(--ink-3)",
};

const won = (v) => Math.round(v).toLocaleString("ko-KR");

/** 눈금이 1·2·5×10^k 단위로 떨어지도록 축 범위와 눈금을 정한다 */
function niceScale(min, max, count = 5) {
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return { domain: [lo, hi], ticks };
}

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const b = payload[0].payload;
  return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] shadow-lg">
      <p className="mb-1 font-semibold text-ink">{label}</p>
      <p className="text-ink-2">종가 <span className="font-semibold text-ink">{won(b.close)}</span></p>
      <p className="text-ink-3">고가 {won(b.high)} · 저가 {won(b.low)}</p>
    </div>
  );
}

export default function BoxChart({ bars, boxes, status }) {
  const first = bars[0]?.date;
  const lows = bars.map((b) => b.low);
  const highs = bars.map((b) => b.high);
  const { domain, ticks } = niceScale(Math.min(...lows), Math.max(...highs));
  const live = status && status.upper && ["IN_BOX", "NEAR_UPPER", "NEAR_LOWER", "TESTING_UP", "TESTING_DOWN"].includes(status.state);

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <LineChart data={bars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="date" tickFormatter={(d) => d.slice(2, 7).replace("-", ".")} tickLine={false} axisLine={false}
            tick={{ fill: "var(--ink-3)", fontSize: 12 }} minTickGap={40} />
          <YAxis domain={domain} ticks={ticks} tickFormatter={won} tickLine={false} axisLine={false} width={64}
            tick={{ fill: "var(--ink-3)", fontSize: 12 }} />
          {boxes.map((b) => (
            <ReferenceArea key={b.start} x1={b.start < first ? first : b.start} x2={b.end}
              y1={b.lower} y2={b.upper} fill={BOX_FILL[b.breakout || "ACTIVE"]} fillOpacity={0.12}
              stroke={BOX_FILL[b.breakout || "ACTIVE"]} strokeOpacity={0.5} strokeDasharray="3 3" ifOverflow="hidden" />
          ))}
          {live && <ReferenceLine y={status.upper} stroke="var(--up)" strokeDasharray="4 4" strokeOpacity={0.7}
            label={{ value: "상단", position: "insideTopRight", fill: "var(--ink-3)", fontSize: 11 }} />}
          {live && <ReferenceLine y={status.lower} stroke="var(--down)" strokeDasharray="4 4" strokeOpacity={0.7}
            label={{ value: "하단", position: "insideBottomRight", fill: "var(--ink-3)", fontSize: 11 }} />}
          <Tooltip content={<Tip />} cursor={{ stroke: "var(--ink-3)", strokeOpacity: 0.4 }} />
          <Line type="monotone" dataKey="close" stroke="var(--series-1)" strokeWidth={2} dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
