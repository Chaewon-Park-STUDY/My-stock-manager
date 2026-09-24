"use client";
import Link from "next/link";
import MonthlyChart from "@/components/MonthlyChart";
import { Card, Empty, ErrorBox, Loading, PageHeader, Stat } from "@/components/ui";
import { api } from "@/lib/api";
import { ACCOUNT_TYPES, lastMonths, money, pnlColor, signedMoney } from "@/lib/format";
import { useApi } from "@/lib/useApi";

async function loadDashboard() {
  const [accounts, holdings, trading, dividends, interest] = await Promise.all([
    api.accounts.list(),
    api.holdings(),
    api.reports.trading(),
    api.reports.dividends({ currency: "KRW" }),
    api.reports.interest(),
  ]);
  return { accounts, holdings, trading, dividends, interest };
}

export default function Dashboard() {
  const { data, error, loading } = useApi(loadDashboard, []);

  if (error) return (<><PageHeader title="대시보드" /><ErrorBox error={error} /></>);
  if (loading || !data) return (<><PageHeader title="대시보드" /><div className="grid gap-4"><Loading /><Loading /></div></>);

  const { accounts, holdings, trading, dividends, interest } = data;

  if (!accounts.length) {
    return (
      <>
        <PageHeader title="대시보드" desc="내 투자 기록을 한눈에" />
        <Card>
          <Empty href="/accounts" cta="첫 계좌 만들기">
            아직 계좌가 없어요. 계좌를 먼저 만들면 거래·배당을 기록할 수 있어요.
          </Empty>
        </Card>
      </>
    );
  }

  const months = lastMonths(12);
  const pick = (rows, m, field) => rows.find((r) => r.month === m)?.[field] ?? 0;
  const chart = months.map((m) => ({
    month: m,
    trading: pick(trading, m, "realized_pnl"),
    dividend: pick(dividends, m, "net"),
    interest: pick(interest, m, "net"),
  }));
  const now = chart.at(-1);
  const monthTotal = now.trading + now.dividend + now.interest;
  const yearTotal = chart.reduce((s, r) => s + r.trading + r.dividend + r.interest, 0);

  const totalCost = holdings.reduce((s, h) => s + h.total_cost, 0);
  const accountName = Object.fromEntries(accounts.map((a) => [a.id, a]));
  const top = [...holdings].sort((a, b) => b.total_cost - a.total_cost).slice(0, 6);
  const thisMonth = Number(months.at(-1).slice(5));

  return (
    <>
      <PageHeader title="대시보드" desc="내 투자 기록을 한눈에" />

      {/* 이번 달 요약 */}
      <section className="mb-4 rounded-2xl bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] md:p-7">
        <p className="text-[15px] text-ink-3">{thisMonth}월 확정 수익</p>
        <p className={`mt-1 text-[34px] font-bold tracking-tight ${pnlColor(monthTotal)}`}>{signedMoney(monthTotal)}</p>
        <p className="mt-1 text-[14px] text-ink-3">
          최근 12개월 누적 <span className={`font-semibold ${pnlColor(yearTotal)}`}>{signedMoney(yearTotal)}</span>
        </p>
      </section>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="단타 실현손익" value={signedMoney(now.trading)} valueClass={pnlColor(now.trading)} sub="이번 달 매도 기준" />
        <Stat label="배당금" value={money(now.dividend)} sub="이번 달 · 세후" />
        <Stat label="이자" value={money(now.interest)} sub="이번 달 · 세후" />
        <Stat label="총 매입금액" value={money(totalCost)} sub={`${holdings.length}개 종목 보유`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card title="월별 수익" className="lg:col-span-3">
          <MonthlyChart data={chart} />
        </Card>

        <Card title="보유 비중" className="lg:col-span-2"
          action={<Link href="/holdings" className="text-sm font-medium text-brand">전체 보기</Link>}>
          {!top.length ? (
            <Empty href="/trades" cta="거래 기록하기">보유 중인 종목이 없어요</Empty>
          ) : (
            <ul className="flex flex-col gap-4">
              {top.map((h) => {
                const w = totalCost ? h.total_cost / totalCost : 0;
                return (
                  <li key={`${h.account_id}-${h.ticker}`}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[14px]">
                      <span className="truncate font-semibold">
                        {h.name || h.ticker}
                        <span className="ml-1.5 text-[12px] font-normal text-ink-3">
                          {ACCOUNT_TYPES[accountName[h.account_id]?.type]}
                        </span>
                      </span>
                      <span className="shrink-0 text-ink-2">{(w * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${w * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-5 text-[12px] text-ink-3">매입금액 기준 · 현재가 반영은 v0.2에서</p>
        </Card>
      </div>
    </>
  );
}
