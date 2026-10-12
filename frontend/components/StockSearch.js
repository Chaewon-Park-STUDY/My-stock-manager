"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

/**
 * 종목명 또는 코드 일부로 상장 종목을 찾는 입력칸.
 * - ↑↓로 고르고 Enter, 또는 클릭하면 onSelect({ ticker, name, market })
 * - allowRaw: 목록에 없는 코드(ETF·미국 주식)를 그대로 Enter로 넘길 수 있게 함
 */
export default function StockSearch({ onSelect, placeholder = "종목명 또는 코드 (예: 삼성, 하이닉)", allowRaw = false, label = "종목 검색", hint }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const reqId = useRef(0);

  // 입력이 멈추고 0.2초 뒤에 검색 (글자마다 요청하지 않도록)
  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      setError(null);
      return;
    }
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await api.securities.search(term);
        if (id !== reqId.current) return; // 더 최신 검색이 있으면 버림
        setResults(rows);
        setActive(0);
        setError(null);
      } catch (e) {
        if (id === reqId.current) setError(e.message);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  function choose(item) {
    onSelect(item);
    setQ("");
    setResults([]);
    setOpen(false);
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault(); // 바깥 form이 제출되지 않게
      if (results[active]) choose(results[active]);
      else if (allowRaw && q.trim()) choose({ ticker: q.trim().toUpperCase(), name: null, market: null });
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && q.trim();

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      <div className="relative">
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input
          className="input pl-10"
          value={q}
          placeholder={placeholder}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={!!showList}
          aria-autocomplete="list"
        />
        {showList && (
          <ul role="listbox" className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-72 overflow-auto rounded-xl border border-line bg-surface py-1.5 shadow-lg">
            {loading && !results.length && <li className="px-4 py-2.5 text-[14px] text-ink-3">찾는 중… (처음엔 종목 목록을 받느라 몇 초 걸려요)</li>}
            {error && <li className="px-4 py-2.5 text-[13px] text-danger">{error}</li>}
            {!loading && !error && !results.length && (
              <li className="px-4 py-2.5 text-[14px] text-ink-3">
                검색 결과가 없어요{allowRaw && " · Enter를 누르면 입력한 코드 그대로 추가해요"}
              </li>
            )}
            {results.map((r, i) => (
              <li key={r.ticker} role="option" aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); choose(r); }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-[14px] ${i === active ? "bg-surface-2" : ""}`}>
                <span className="truncate font-medium text-ink">{r.name}</span>
                <span className="shrink-0 text-[12px] text-ink-3">{r.ticker} · {r.market}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </div>
  );
}
