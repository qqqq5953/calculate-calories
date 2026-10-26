"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { fmt, shortDate } from "./format";

export type TrendDay = {
  date: string;
  logged: boolean;
  kcal: number;
  diff: number;
  proteinG: number;
  proteinMet: boolean;
  carbPct: number;
  proteinPct: number;
  fatPct: number;
};

const AXIS = { fontSize: 11, fill: "var(--muted)" };

/** 長條圖的資料端圓角 4px、基線端直角；負值時圓角在下方 */
function RoundedEndBar(props: { x?: number; y?: number; width?: number; height?: number; fill?: string }) {
  const { x = 0, y = 0, width = 0, fill } = props;
  let { height = 0 } = props;
  if (!width || !height) return null;
  const negative = height < 0;
  const top = negative ? y + height : y;
  height = Math.abs(height);
  const r = Math.min(4, width / 2, height);
  const path = negative
    ? `M${x},${top} h${width} v${height - r} q0,${r} -${r},${r} h-${width - 2 * r} q-${r},0 -${r},-${r} Z`
    : `M${x},${top + height} v-${height - r} q0,-${r} ${r},-${r} h${width - 2 * r} q${r},0 ${r},${r} v${height - r} Z`;
  return <path d={path} fill={fill} />;
}

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
      <div className="muted" style={{ marginBottom: 4 }}>{title}</div>
      {rows.map((r) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {r.color && <span aria-hidden style={{ width: 12, height: 2, background: r.color }} />}
          <b>{r.value}</b>
          <span className="muted">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

const tickFormatter = (d: string) => shortDate(d);

/** 每日熱量差額：負值（赤字）藍色、正值（盈餘）紅色，0 為目標 */
export function DeficitChart({ days }: { days: TrendDay[] }) {
  const data = days.map((d) => ({ ...d, value: d.logged ? d.diff : null }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--grid)" strokeWidth={1} />
        <XAxis dataKey="date" tickFormatter={tickFormatter} tick={AXIS} axisLine={false} tickLine={false} minTickGap={12} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={40} />
        <ReferenceLine y={0} stroke="var(--muted)" />
        <Tooltip
          cursor={{ fill: "var(--line)", opacity: 0.5 }}
          content={(p: TooltipContentProps<ValueType, NameType>) => {
            const d = p.payload?.[0]?.payload as TrendDay | undefined;
            if (!p.active || !d) return null;
            if (!d.logged) return <TooltipBox title={shortDate(d.date)} rows={[{ label: "沒有紀錄", value: "—" }]} />;
            return (
              <TooltipBox
                title={shortDate(d.date)}
                rows={[
                  {
                    label: d.diff < 0 ? "赤字" : d.diff > 0 ? "盈餘" : "剛好",
                    value: `${d.diff > 0 ? "+" : ""}${fmt(d.diff)} kcal`,
                    color: d.diff < 0 ? "var(--deficit)" : "var(--surplus)",
                  },
                  { label: "攝取", value: `${fmt(d.kcal)} kcal` },
                ]}
              />
            );
          }}
        />
        <Bar dataKey="value" shape={RoundedEndBar} maxBarSize={28} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.date} fill={d.diff < 0 ? "var(--deficit)" : "var(--surplus)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** 每日蛋白質與目標線 */
export function ProteinChart({ days, target }: { days: TrendDay[]; target: number }) {
  const data = days.map((d) => ({ ...d, value: d.logged ? d.proteinG : null }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--grid)" strokeWidth={1} />
        <XAxis dataKey="date" tickFormatter={tickFormatter} tick={AXIS} axisLine={false} tickLine={false} minTickGap={12} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={40} />
        <ReferenceLine
          y={target}
          stroke="var(--text)"
          strokeDasharray="4 4"
          label={{ value: `目標 ${target}g`, position: "insideTopRight", fontSize: 11, fill: "var(--muted)" }}
        />
        <Tooltip
          cursor={{ fill: "var(--line)", opacity: 0.5 }}
          content={(p: TooltipContentProps<ValueType, NameType>) => {
            const d = p.payload?.[0]?.payload as TrendDay | undefined;
            if (!p.active || !d) return null;
            return (
              <TooltipBox
                title={shortDate(d.date)}
                rows={
                  d.logged
                    ? [{ label: d.proteinMet ? "已達標 ✓" : `目標 ${target}g`, value: `${fmt(d.proteinG)} g`, color: "var(--protein)" }]
                    : [{ label: "沒有紀錄", value: "—" }]
                }
              />
            );
          }}
        />
        <Bar dataKey="value" shape={RoundedEndBar} fill="var(--protein)" maxBarSize={28} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** 每日三大營養素熱量比例（100% 堆疊，區段間 2px 間隔） */
export function MacroChart({ days }: { days: TrendDay[] }) {
  const data = days.map((d) => ({
    date: d.date,
    logged: d.logged,
    carb: d.logged ? d.carbPct : null,
    protein: d.logged ? d.proteinPct : null,
    fat: d.logged ? d.fatPct : null,
  }));
  const SERIES = [
    { key: "carb", label: "碳水", color: "var(--carb)" },
    { key: "protein", label: "蛋白質", color: "var(--protein)" },
    { key: "fat", label: "脂肪", color: "var(--fat)" },
  ];
  return (
    <>
      <div className="row" style={{ justifyContent: "flex-start", gap: 12, fontSize: 12, marginBottom: 4 }}>
        {SERIES.map((s) => (
          <span key={s.key}>
            <span aria-hidden style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: s.color, marginRight: 4 }} />
            {s.label}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" strokeWidth={1} />
          <XAxis dataKey="date" tickFormatter={tickFormatter} tick={AXIS} axisLine={false} tickLine={false} minTickGap={12} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} width={40} domain={[0, 100]} unit="%" />
          <Tooltip
            cursor={{ fill: "var(--line)", opacity: 0.5 }}
            content={(p: TooltipContentProps<ValueType, NameType>) => {
              const d = p.payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!p.active || !d) return null;
              return (
                <TooltipBox
                  title={shortDate(d.date)}
                  rows={
                    d.logged
                      ? SERIES.map((s) => ({ label: s.label, value: `${d[s.key as "carb"]}%`, color: s.color }))
                      : [{ label: "沒有紀錄", value: "—" }]
                  }
                />
              );
            }}
          />
          {SERIES.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId="m"
              fill={s.color}
              stroke="var(--card)"
              strokeWidth={2}
              maxBarSize={28}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}
