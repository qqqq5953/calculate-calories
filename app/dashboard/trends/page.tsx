"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DeficitChart, MacroChart, ProteinChart, type TrendDay } from "@/components/charts";
import { ErrorScreen, Loading } from "@/components/ErrorScreen";
import { fmt, shortDate } from "@/components/format";
import { useApi } from "@/components/useApi";

type Trends = {
  range: number;
  target: { kcal: number; proteinG: number };
  days: TrendDay[];
  summary: {
    loggedDays: number;
    deficitDays: number;
    surplusDays: number;
    avgDiff: number;
    avgKcal: number;
    proteinMetDays: number;
    avgProteinG: number;
    macroPct: { carb: number; protein: number; fat: number };
  };
};

export default function TrendsPage() {
  return (
    <AppShell>
      <TrendsView />
    </AppShell>
  );
}

function TrendsView() {
  const [range, setRange] = useState<7 | 30>(7);
  const { data, error, reload } = useApi<Trends>(`/api/trends?days=${range}`);

  return (
    <>
      <div className="tabs" role="group" aria-label="期間">
        {([7, 30] as const).map((r) => (
          <button key={r} className={range === r ? "active" : undefined} aria-pressed={range === r} onClick={() => setRange(r)}>
            {r} 天
          </button>
        ))}
      </div>
      {error ? <ErrorScreen error={error} onRetry={reload} /> : !data ? <Loading /> : <TrendsBody data={data} />}
    </>
  );
}

function TrendsBody({ data }: { data: Trends }) {
  const s = data.summary;
  if (s.loggedDays === 0) {
    return <section className="card muted">這段期間還沒有紀錄。</section>;
  }
  return (
    <>
      <section className="card">
        <h2>熱量：赤字還是盈餘？</h2>
        <div className="stats">
          <div className="stat">
            <b style={{ color: "var(--deficit)" }}>{s.deficitDays}</b>
            <small>赤字天數</small>
          </div>
          <div className="stat">
            <b style={{ color: "var(--surplus)" }}>{s.surplusDays}</b>
            <small>盈餘天數</small>
          </div>
          <div className="stat">
            <b>
              {s.avgDiff > 0 ? "+" : ""}
              {fmt(s.avgDiff)}
            </b>
            <small>平均每日差額 kcal</small>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: "10px 0 4px" }}>
          有紀錄 {s.loggedDays} / {data.range} 天 · 目標 {fmt(data.target.kcal)} kcal · 平均攝取 {fmt(s.avgKcal)} kcal
        </p>
        <div className="row" style={{ justifyContent: "flex-start", gap: 12, fontSize: 12 }}>
          <span>
            <span aria-hidden style={{ ...swatch, background: "var(--deficit)" }} />
            赤字（低於目標）
          </span>
          <span>
            <span aria-hidden style={{ ...swatch, background: "var(--surplus)" }} />
            盈餘（高於目標）
          </span>
        </div>
        <DeficitChart days={data.days} />
      </section>

      <section className="card">
        <h2>蛋白質有吃夠嗎？</h2>
        <div className="stats" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="stat">
            <b>
              {s.proteinMetDays}
              <span style={{ fontSize: 14, fontWeight: 400 }}> / {s.loggedDays}</span>
            </b>
            <small>達標天數</small>
          </div>
          <div className="stat">
            <b>{fmt(s.avgProteinG)} g</b>
            <small>平均每日（目標 {data.target.proteinG} g）</small>
          </div>
        </div>
        <ProteinChart days={data.days} target={data.target.proteinG} />
      </section>

      <section className="card">
        <h2>三大營養素比例</h2>
        <p className="muted" style={{ fontSize: 13, margin: "0 0 8px" }}>
          期間平均：碳水 {s.macroPct.carb}% · 蛋白質 {s.macroPct.protein}% · 脂肪 {s.macroPct.fat}%
        </p>
        <MacroChart days={data.days} />
      </section>

      <details className="card">
        <summary>查看每日數字</summary>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", marginTop: 8 }}>
          <thead>
            <tr className="muted" style={{ textAlign: "right" }}>
              <th style={{ textAlign: "left" }}>日期</th>
              <th>熱量</th>
              <th>差額</th>
              <th>蛋白質</th>
            </tr>
          </thead>
          <tbody>
            {data.days
              .slice()
              .reverse()
              .map((d) => (
                <tr key={d.date} style={{ textAlign: "right", borderTop: "1px solid var(--line)" }}>
                  <td style={{ textAlign: "left", padding: "6px 0" }}>{shortDate(d.date)}</td>
                  <td>{d.logged ? fmt(d.kcal) : "—"}</td>
                  <td>{d.logged ? `${d.diff > 0 ? "+" : ""}${fmt(d.diff)}` : "—"}</td>
                  <td>{d.logged ? `${fmt(d.proteinG)}g${d.proteinMet ? " ✓" : ""}` : "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </>
  );
}

const swatch: React.CSSProperties = { display: "inline-block", width: 10, height: 10, borderRadius: 2, marginRight: 4 };
