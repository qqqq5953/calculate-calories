import { fmt } from "./format";

type Macros = { carbG: number; proteinG: number; fatG: number };

/** 三大營養素佔熱量比例：一條 100% 堆疊條，區段間 2px 間隔，下方文字標示 */
export function MacroBar({ m }: { m: Macros }) {
  const kcal = { carb: m.carbG * 4, protein: m.proteinG * 4, fat: m.fatG * 9 };
  const total = kcal.carb + kcal.protein + kcal.fat;
  const segs = [
    { key: "carb", label: "碳水", g: m.carbG, color: "var(--carb)" },
    { key: "protein", label: "蛋白質", g: m.proteinG, color: "var(--protein)" },
    { key: "fat", label: "脂肪", g: m.fatG, color: "var(--fat)" },
  ] as const;
  const pct = (k: keyof typeof kcal) => (total > 0 ? Math.round((kcal[k] / total) * 100) : 0);

  return (
    <div>
      <div
        role="img"
        aria-label={`碳水 ${pct("carb")}%，蛋白質 ${pct("protein")}%，脂肪 ${pct("fat")}%`}
        style={{ display: "flex", gap: total > 0 ? 2 : 0, height: 10, borderRadius: 5, overflow: "hidden", background: "var(--line)", margin: "10px 0 8px" }}
      >
        {total > 0 &&
          segs.map((s) => (
            <span key={s.key} style={{ width: `${pct(s.key)}%`, background: s.color }} />
          ))}
      </div>
      <div className="row" style={{ fontSize: 13 }}>
        {segs.map((s) => (
          <span key={s.key}>
            <span aria-hidden style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: s.color, marginRight: 4 }} />
            {s.label} <b>{pct(s.key)}%</b> <span className="muted">{fmt(s.g)}g</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function ProgressRow({ label, value, target, unit, color }: { label: string; value: number; target: number; unit: string; color: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(target, 1)) * 100));
  return (
    <div>
      <div className="row" style={{ fontSize: 14 }}>
        <span className="muted">{label}</span>
        <span>
          <b>{fmt(value)}</b> / {fmt(target)} {unit}
        </span>
      </div>
      <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <span style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
