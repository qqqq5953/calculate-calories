"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { apiFetch, ApiError } from "@/components/client-api";
import { ErrorScreen, Loading } from "@/components/ErrorScreen";
import { fmt, MEAL_LABEL, shiftDate, shortDate, timeOf } from "@/components/format";
import { MacroBar, ProgressRow } from "@/components/MacroBar";
import { useApi } from "@/components/useApi";

type Nutr = { kcal: number; proteinG: number; carbG: number; fatG: number };
type Item = { id: string; name: string; portion: number; unit: string; kcal: number; confidence: string };
type Today = {
  date: string;
  totals: Nutr;
  targets: Nutr;
  meals: { id: string; mealType: string; eatenAt: string; totals: Nutr; items: Item[] }[];
};

const PRESETS: [number, string][] = [
  [0.33, "⅓"],
  [0.5, "½"],
  [0.67, "⅔"],
  [1, "1"],
  [1.5, "1½"],
  [2, "2"],
];

function portionLabel(p: number) {
  return PRESETS.find(([v]) => Math.abs(v - p) < 0.01)?.[1] ?? String(p);
}

export default function DashboardPage() {
  return (
    <AppShell>
      <TodayView />
    </AppShell>
  );
}

function TodayView() {
  const [date, setDate] = useState<string>();
  const { data, error, loading, reload } = useApi<Today>(`/api/today${date ? `?date=${date}` : ""}`);
  const [openItem, setOpenItem] = useState<string>();
  const [actionError, setActionError] = useState<ApiError>();

  if (error) return <ErrorScreen error={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const remaining = data.targets.kcal - data.totals.kcal;
  const current = data.date;

  async function mutate(url: string, init: RequestInit) {
    try {
      await apiFetch(url, init);
      setActionError(undefined);
      setOpenItem(undefined);
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e : new ApiError(0, "unknown"));
    }
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 8 }}>
        <button aria-label="前一天" onClick={() => setDate(shiftDate(current, -1))} style={navBtn}>
          ‹
        </button>
        <b>{shortDate(current)}{loading ? " …" : ""}</b>
        <button aria-label="後一天" onClick={() => setDate(shiftDate(current, 1))} style={navBtn}>
          ›
        </button>
      </div>

      {actionError && <ErrorScreen error={actionError} />}

      <section className="card">
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          {remaining >= 0 ? "還可以吃" : "已超過"}
        </p>
        <p className="big" style={{ margin: "4px 0 12px", color: remaining >= 0 ? "var(--primary)" : "var(--over)" }}>
          {fmt(Math.abs(remaining))} <span style={{ fontSize: 16, fontWeight: 400 }}>kcal</span>
        </p>
        <ProgressRow label="熱量" value={data.totals.kcal} target={data.targets.kcal} unit="kcal" color={remaining >= 0 ? "var(--primary)" : "var(--over)"} />
        <ProgressRow label="蛋白質" value={data.totals.proteinG} target={data.targets.proteinG} unit="g" color="var(--protein)" />
        <ProgressRow label="碳水" value={data.totals.carbG} target={data.targets.carbG} unit="g" color="var(--carb)" />
        <ProgressRow label="脂肪" value={data.totals.fatG} target={data.targets.fatG} unit="g" color="var(--fat)" />
        <h2 style={{ fontSize: 14, margin: "8px 0 0" }}>三大營養素比例</h2>
        <MacroBar m={data.totals} />
      </section>

      {data.meals.length === 0 && (
        <section className="card muted">這天還沒有紀錄。在 LINE 傳一張餐點照片就會出現在這裡。</section>
      )}

      {data.meals.map((meal) => (
        <section className="card" key={meal.id}>
          <div className="row">
            <h2 style={{ margin: 0 }}>
              {MEAL_LABEL[meal.mealType]} <span className="muted" style={{ fontWeight: 400 }}>{timeOf(meal.eatenAt)}</span>
            </h2>
            <b>{fmt(meal.totals.kcal)} kcal</b>
          </div>
          <div style={{ marginTop: 8 }}>
            {meal.items.map((item) => (
              <div key={item.id}>
                <button
                  className="item"
                  style={itemBtn}
                  aria-expanded={openItem === item.id}
                  onClick={() => setOpenItem(openItem === item.id ? undefined : item.id)}
                >
                  <span style={{ color: item.confidence === "low" ? "var(--warn)" : undefined }}>
                    {item.confidence === "low" ? "⚠️ " : ""}
                    {item.name}
                  </span>
                  <span className="muted">
                    {portionLabel(item.portion)} {item.unit} · {fmt(item.kcal)} ›
                  </span>
                </button>
                {openItem === item.id && (
                  <div className="chips" style={{ paddingBottom: 10 }}>
                    {PRESETS.map(([v, l]) => (
                      <button
                        key={v}
                        onClick={() => mutate(`/api/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ portion: v }) })}
                      >
                        {l} {item.unit}
                      </button>
                    ))}
                    <button className="danger" onClick={() => mutate(`/api/items/${item.id}`, { method: "DELETE" })}>
                      🗑 刪除
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="chips" style={{ justifyContent: "flex-end" }}>
            <button
              className="danger"
              onClick={() => {
                if (confirm("確定要刪除這餐嗎？")) void mutate(`/api/meals/${meal.id}`, { method: "DELETE" });
              }}
            >
              刪除這餐
            </button>
          </div>
        </section>
      ))}
    </>
  );
}

const navBtn: React.CSSProperties = {
  border: "1px solid var(--line)",
  background: "var(--card)",
  color: "var(--text)",
  borderRadius: 999,
  width: 40,
  height: 40,
  fontSize: 20,
};

const itemBtn: React.CSSProperties = {
  width: "100%",
  background: "none",
  border: 0,
  borderTop: "1px solid var(--line)",
  color: "var(--text)",
  textAlign: "left",
  font: "inherit",
};
