"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  pie: "M12 3v9h9A9 9 0 1 1 12 3zm3-.5A9 9 0 0 1 21.5 9H15z",
  swap: "M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4m4 4H7",
  coin: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-13v8m-3-5.5c0-1 1.3-1.5 3-1.5s3 .7 3 1.7-1.3 1.3-3 1.3-3 .5-3 1.5 1.3 1.5 3 1.5 3-.5 3-1.5",
  bank: "M3 9 12 4l9 5M5 9v8m4.5-8v8m5-8v8M19 9v8M3 20h18",
  wallet: "M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zm13 7h.01",
};

const ITEMS = [
  { href: "/", label: "대시보드", icon: "home" },
  { href: "/holdings", label: "보유종목", icon: "pie" },
  { href: "/trades", label: "거래", icon: "swap" },
  { href: "/dividends", label: "배당", icon: "coin" },
  { href: "/interest", label: "이자", icon: "bank" },
  { href: "/accounts", label: "계좌", icon: "wallet" },
];

function Icon({ name, className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}

export default function Nav() {
  const path = usePathname();
  const active = (href) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <>
      {/* 데스크톱: 왼쪽 사이드바 */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface px-4 py-6 md:flex">
        <Link href="/" className="mb-8 flex items-center gap-2 px-3">
          <span className="grid size-8 place-items-center rounded-lg bg-brand text-sm font-bold text-white">내</span>
          <span className="text-[17px] font-bold">내주식관리앱</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {ITEMS.map((it) => (
            <Link key={it.href} href={it.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition ${
                active(it.href) ? "bg-brand-soft text-brand" : "text-ink-2 hover:bg-surface-2"
              }`}>
              <Icon name={it.icon} className="size-5" />
              {it.label}
            </Link>
          ))}
        </nav>
        <p className="mt-auto px-3 text-xs text-ink-3">v0.1 · 개인 기록용</p>
      </aside>

      {/* 모바일: 하단 탭바 */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {ITEMS.map((it) => (
          <Link key={it.href} href={it.href}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
              active(it.href) ? "text-brand" : "text-ink-3"
            }`}>
            <Icon name={it.icon} className="size-5" />
            {it.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
