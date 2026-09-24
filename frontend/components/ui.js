"use client";
// 여러 화면에서 같이 쓰는 작은 UI 조각들
import Link from "next/link";
import { useState } from "react";

export function PageHeader({ title, desc, children }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {desc && <p className="mt-1 text-[15px] text-ink-3">{desc}</p>}
      </div>
      {children}
    </header>
  );
}

export function Card({ title, action, className = "", children }) {
  return (
    <section className={`rounded-2xl bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] md:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-[17px] font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, valueClass = "" }) {
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <p className="text-sm text-ink-3">{label}</p>
      <p className={`mt-1.5 whitespace-nowrap text-[19px] font-bold tracking-tight md:text-[22px] ${valueClass}`}>{value}</p>
      {sub && <p className="mt-1 text-[13px] text-ink-3">{sub}</p>}
    </div>
  );
}

export function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

/** 두세 가지 중 하나를 고르는 버튼 묶음 (매수/매도 등) */
export function Segmented({ value, onChange, options }) {
  return (
    <div className="grid rounded-xl bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`rounded-lg py-2 text-[14px] font-semibold transition ${
            value === o.value ? `bg-surface shadow-sm ${o.activeClass || "text-ink"}` : "text-ink-3"
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Flash({ flash }) {
  if (!flash) return null;
  const ok = flash.kind === "ok";
  return (
    <div role="status" key={flash.id}
      className={`fixed bottom-20 left-1/2 z-30 -translate-x-1/2 rounded-full px-5 py-3 text-sm font-medium text-white shadow-lg md:bottom-8 ${
        ok ? "bg-[#191f28]" : "bg-danger"
      }`}>
      {flash.text}
    </div>
  );
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return (
    <div className="mb-6 rounded-2xl border border-danger/30 bg-danger/5 px-5 py-4 text-[15px] text-danger">
      {error}
    </div>
  );
}

export function Empty({ children, href, cta }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center text-[15px] text-ink-3">
      <p>{children}</p>
      {href && <Link href={href} className="btn btn-primary">{cta}</Link>}
    </div>
  );
}

export function Loading() {
  return <div className="h-24 animate-pulse rounded-xl bg-surface-2" />;
}

/** 표 공통 스타일. columns: [{key, label, align, render}], limit개까지 보여주고 "더 보기" */
export function Table({ columns, rows, rowKey = "id", empty = "기록이 없어요", limit }) {
  const [shown, setShown] = useState(limit || Infinity);
  if (!rows?.length) return <Empty>{empty}</Empty>;
  const visible = rows.slice(0, shown);
  return (
    <>
    <div className="-mx-5 overflow-x-auto md:-mx-6">
      <table className="w-full min-w-[520px] text-[14px]">
        <thead>
          <tr className="border-b border-line text-ink-3">
            {columns.map((c) => (
              <th key={c.key} className={`whitespace-nowrap px-3 py-2.5 font-medium first:pl-5 last:pr-5 md:first:pl-6 md:last:pr-6 ${c.align === "right" ? "text-right" : "text-left"}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr key={r[rowKey]} className="border-b border-line/60 last:border-0 hover:bg-surface-2">
              {columns.map((c) => (
                <td key={c.key} className={`whitespace-nowrap px-3 py-3 first:pl-5 last:pr-5 md:first:pl-6 md:last:pr-6 ${c.align === "right" ? "text-right" : ""}`}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {rows.length > shown && (
      <button type="button" onClick={() => setShown((n) => n + (limit || 20))}
        className="mt-3 w-full rounded-xl py-2.5 text-[14px] font-medium text-ink-2 hover:bg-surface-2">
        더 보기 ({rows.length - shown}건 남음)
      </button>
    )}
    </>
  );
}

export function DeleteButton({ onClick }) {
  return (
    <button type="button" onClick={onClick} className="rounded-lg px-2 py-1 text-[13px] text-ink-3 hover:bg-danger/10 hover:text-danger">
      삭제
    </button>
  );
}
