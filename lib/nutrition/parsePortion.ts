const FRACTION_CHARS: Record<string, number> = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅕": 0.2,
};

const CN_DIGITS: Record<string, number> = {
  零: 0, 〇: 0, 一: 1, 二: 2, 兩: 2, 两: 2, 三: 3, 四: 4,
  五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

const MAX_PORTION = 20;

function cnNumber(s: string): number | undefined {
  if (s.length === 0) return undefined;
  if (s === "十") return 10;
  if (s.length === 2 && s[0] === "十") return 10 + (CN_DIGITS[s[1]] ?? NaN);
  if (s.length === 2 && s[1] === "十") return (CN_DIGITS[s[0]] ?? NaN) * 10;
  if (s.length === 1) return CN_DIGITS[s];
  return undefined;
}

function toNumber(s: string): number | undefined {
  if (/^\d+(\.\d+)?$/.test(s) || /^\.\d+$/.test(s)) return Number(s);
  return cnNumber(s);
}

/**
 * 把使用者輸入的份量轉成數字，不用 AI。
 * 支援：0.7、.5、2/3、1 1/2、70%、⅔、1½、半、一碗半、三分之二、2碗
 * 無法解析或不合理（≤0 或 >20）時回傳 undefined。
 */
export function parsePortion(input: string): number | undefined {
  // 先處理 ½、1½ 這類字元：NFKC 會把 1½ 變成 11⁄2，必須在正規化之前拆開
  // 單位字可能出現在中間（一碗半）或結尾（2碗），全部移除
  const raw = input.replace(/湯匙|[碗份個塊支片杯盤顆條根匙口]/gu, "").trim();
  const fracMatch = raw.match(/^(\d*)\s*([¼½¾⅓⅔⅕])$/u);
  if (fracMatch) {
    return clamp((fracMatch[1] ? Number(fracMatch[1]) : 0) + FRACTION_CHARS[fracMatch[2]]);
  }

  const s = raw.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!s) return undefined;

  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*%$/))) return clamp(Number(m[1]) / 100);
  if ((m = s.match(/^(\d+) (\d+)\/(\d+)$/))) {
    return clamp(Number(m[1]) + Number(m[2]) / Number(m[3]));
  }
  if ((m = s.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/))) {
    return clamp(Number(m[1]) / Number(m[2]));
  }
  if ((m = s.match(/^(.+?)分之(.+)$/u))) {
    const den = toNumber(m[1]);
    const num = toNumber(m[2]);
    return den !== undefined && num !== undefined ? clamp(num / den) : undefined;
  }
  if (s === "半") return 0.5;
  if ((m = s.match(/^(.+?)半$/u))) {
    const whole = toNumber(m[1]);
    return whole !== undefined ? clamp(whole + 0.5) : undefined;
  }
  const n = toNumber(s);
  return n !== undefined ? clamp(n) : undefined;
}

function clamp(n: number): number | undefined {
  if (!Number.isFinite(n) || n <= 0 || n > MAX_PORTION) return undefined;
  return Math.round(n * 100) / 100;
}

/** 顯示用：0.5 → ½、0.67 → ⅔、1.5 → 1½ */
export function formatPortion(p: number): string {
  const whole = Math.floor(p + 1e-9);
  const frac = p - whole;
  const fracMap: [number, string][] = [
    [0.25, "¼"],
    [1 / 3, "⅓"],
    [0.5, "½"],
    [2 / 3, "⅔"],
    [0.75, "¾"],
  ];
  if (frac < 0.01) return String(whole);
  for (const [v, ch] of fracMap) {
    if (Math.abs(frac - v) < 0.01) return whole === 0 ? ch : `${whole}${ch}`;
  }
  return String(Math.round(p * 100) / 100);
}
