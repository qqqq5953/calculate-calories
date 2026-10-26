"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { apiFetch, ApiError } from "@/components/client-api";
import { ErrorScreen, Loading } from "@/components/ErrorScreen";
import { fmt } from "@/components/format";
import { useApi } from "@/components/useApi";
import { computeTargets, type Profile as CalcProfile } from "@/lib/nutrition/targets";

type Targets = { kcal: number; proteinG: number; carbG: number; fatG: number };
type Me = {
  sex: "male" | "female" | null;
  birthYear: number | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: CalcProfile["activityLevel"] | null;
  goal: CalcProfile["goal"] | null;
  targets: Targets;
};

const ACTIVITY: [CalcProfile["activityLevel"], string][] = [
  ["sedentary", "久坐（幾乎不運動）"],
  ["light", "輕度（每週運動 1–3 天）"],
  ["moderate", "中度（每週運動 3–5 天）"],
  ["active", "高度（每週運動 6–7 天）"],
  ["very_active", "非常高（體力勞動或一天兩練）"],
];

const GOALS: [CalcProfile["goal"], string][] = [
  ["lose", "減脂"],
  ["maintain", "維持"],
  ["gain", "增肌"],
];

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsView />
    </AppShell>
  );
}

function SettingsView() {
  const { data, error, reload } = useApi<Me>("/api/me");
  if (error) return <ErrorScreen error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  return <SettingsForm initial={data} />;
}

function SettingsForm({ initial }: { initial: Me }) {
  const year = new Date().getFullYear();
  const [sex, setSex] = useState(initial.sex ?? "female");
  const [birthYear, setBirthYear] = useState(String(initial.birthYear ?? year - 30));
  const [heightCm, setHeightCm] = useState(String(initial.heightCm ?? ""));
  const [weightKg, setWeightKg] = useState(String(initial.weightKg ?? ""));
  const [activityLevel, setActivity] = useState(initial.activityLevel ?? "light");
  const [goal, setGoal] = useState(initial.goal ?? "maintain");
  // 已存的目標和自動計算結果不同，表示之前手動設定過：預設保留手動
  const [manual, setManual] = useState(() => {
    if (!initial.sex || !initial.birthYear || !initial.heightCm || !initial.weightKg || !initial.activityLevel || !initial.goal) {
      return false;
    }
    const auto = computeTargets({
      sex: initial.sex,
      age: year - initial.birthYear,
      heightCm: initial.heightCm,
      weightKg: initial.weightKg,
      activityLevel: initial.activityLevel,
      goal: initial.goal,
    });
    return auto.kcal !== initial.targets.kcal || auto.proteinG !== initial.targets.proteinG;
  });
  const [custom, setCustom] = useState<Targets>(initial.targets);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | ApiError>("idle");

  const computed = useMemo(() => {
    const h = Number(heightCm);
    const w = Number(weightKg);
    if (!h || !w) return undefined;
    return computeTargets({ sex, age: year - Number(birthYear), heightCm: h, weightKg: w, activityLevel, goal });
  }, [sex, birthYear, heightCm, weightKg, activityLevel, goal, year]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 欄位改變後清掉「已儲存」
    setStatus("idle");
  }, [sex, birthYear, heightCm, weightKg, activityLevel, goal, manual, custom]);

  const shown = manual ? custom : (computed ?? initial.targets);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      await apiFetch("/api/me", {
        method: "PUT",
        body: JSON.stringify({
          sex,
          birthYear: Number(birthYear),
          heightCm: Number(heightCm),
          weightKg: Number(weightKg),
          activityLevel,
          goal,
          targets: manual ? custom : null,
        }),
      });
      setStatus("saved");
    } catch (err) {
      setStatus(err instanceof ApiError ? err : new ApiError(0, "unknown"));
    }
  }

  return (
    <form className="card" onSubmit={save}>
      <h2>個人資料</h2>
      <div className="grid2">
        <div>
          <label htmlFor="sex">性別</label>
          <select id="sex" value={sex} onChange={(e) => setSex(e.target.value as "male" | "female")}>
            <option value="female">女</option>
            <option value="male">男</option>
          </select>
        </div>
        <div>
          <label htmlFor="birthYear">出生年</label>
          <select id="birthYear" value={birthYear} onChange={(e) => setBirthYear(e.target.value)}>
            {Array.from({ length: 90 }, (_, i) => year - 10 - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="height">身高（cm）</label>
          <input id="height" inputMode="decimal" required value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
        </div>
        <div>
          <label htmlFor="weight">體重（kg）</label>
          <input id="weight" inputMode="decimal" required value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
        </div>
      </div>
      <label htmlFor="activity">活動量</label>
      <select id="activity" value={activityLevel} onChange={(e) => setActivity(e.target.value as CalcProfile["activityLevel"])}>
        {ACTIVITY.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <label htmlFor="goal">目標</label>
      <select id="goal" value={goal} onChange={(e) => setGoal(e.target.value as CalcProfile["goal"])}>
        {GOALS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>

      <h2 style={{ marginTop: 24 }}>每日目標</h2>
      <div className="stats" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="stat">
          <b style={{ fontSize: 16 }}>{fmt(shown.kcal)}</b>
          <small>kcal</small>
        </div>
        <div className="stat">
          <b style={{ fontSize: 16 }}>{shown.proteinG}g</b>
          <small>蛋白質</small>
        </div>
        <div className="stat">
          <b style={{ fontSize: 16 }}>{shown.carbG}g</b>
          <small>碳水</small>
        </div>
        <div className="stat">
          <b style={{ fontSize: 16 }}>{shown.fatG}g</b>
          <small>脂肪</small>
        </div>
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" style={{ width: "auto" }} checked={manual} onChange={(e) => setManual(e.target.checked)} />
        手動設定目標（例如營養師給的建議）
      </label>
      {manual && (
        <div className="grid2">
          {(
            [
              ["kcal", "熱量（kcal）"],
              ["proteinG", "蛋白質（g）"],
              ["carbG", "碳水（g）"],
              ["fatG", "脂肪（g）"],
            ] as const
          ).map(([k, l]) => (
            <div key={k}>
              <label htmlFor={k}>{l}</label>
              <input
                id={k}
                inputMode="numeric"
                value={custom[k]}
                onChange={(e) => setCustom({ ...custom, [k]: Math.round(Number(e.target.value) || 0) })}
              />
            </div>
          ))}
        </div>
      )}

      <button className="btn" type="submit" disabled={status === "saving"}>
        {status === "saving" ? "儲存中…" : status === "saved" ? "已儲存 ✓" : "儲存"}
      </button>
      {status instanceof ApiError && <ErrorScreen error={status} />}
    </form>
  );
}
