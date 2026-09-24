// 숫자·날짜 표시 형식

const nf = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });

export const ACCOUNT_TYPES = {
  LONG_TERM: "장기투자",
  TRADING: "단타",
  DIVIDEND: "배당",
  SAVINGS: "예적금",
};

export const PRODUCT_TYPES = {
  DEPOSIT: "예금",
  SAVINGS: "적금",
  CMA: "CMA",
  PARKING: "파킹통장",
  BOND: "채권",
  OTHER: "기타",
};

/** 1234567 → "1,234,567원" (USD는 "$12.34") */
export function money(n, currency = "KRW") {
  if (n === null || n === undefined) return "-";
  if (currency === "USD") return "$" + nf2.format(n);
  return nf.format(n) + "원";
}

/** 부호를 붙인 금액: +1,234원 / -1,234원 */
export function signedMoney(n, currency = "KRW") {
  if (n === null || n === undefined) return "-";
  const s = money(Math.abs(n), currency);
  return n > 0 ? "+" + s : n < 0 ? "-" + s : s;
}

/** 수익이면 빨강, 손실이면 파랑 (한국 증시 관례) */
export function pnlColor(n) {
  if (!n) return "text-ink";
  return n > 0 ? "text-up" : "text-down";
}

export const num = (n) => (n === null || n === undefined ? "-" : nf2.format(n));
export const pct = (r) => (r === null || r === undefined ? "-" : (r * 100).toFixed(1) + "%");

/** 오늘 날짜 "2026-09-24" (로컬 시간 기준) */
export function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** 이번 달부터 거슬러 올라간 n개월: ["2025-10", ..., "2026-09"] */
export function lastMonths(n = 12) {
  const d = new Date();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

/** "2026-09" → "9월" (1월이면 "26년 1월") */
export function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${String(y).slice(2)}년 1월` : `${m}월`;
}
