"use client";
import { useState } from "react";
import { Card, ErrorBox, Loading, PageHeader, Segmented, Table } from "@/components/ui";
import { api } from "@/lib/api";
import { ACCOUNT_TYPES, money, num } from "@/lib/format";
import { useApi } from "@/lib/useApi";

const TABS = [{ value: "", label: "전체" }, ...Object.entries(ACCOUNT_TYPES)
  .filter(([k]) => k !== "SAVINGS")
  .map(([value, label]) => ({ value, label }))];

export default function HoldingsPage() {
  const [type, setType] = useState("");
  const { data, error, loading } = useApi(
    () => Promise.all([api.holdings({ account_type: type }), api.accounts.list()]),
    [type],
  );
  const [holdings = [], accounts = []] = data || [];
  const acc = Object.fromEntries(accounts.map((a) => [a.id, a]));
  const total = holdings.reduce((s, h) => s + h.total_cost, 0);
  const rows = holdings.map((h) => ({ ...h, id: `${h.account_id}-${h.ticker}` }));

  return (
    <>
      <PageHeader title="보유 종목" desc="거래 기록으로 계산한 현재 보유 수량과 평균 매수단가" />
      <ErrorBox error={error} />
      <div className="mb-4 max-w-md">
        <Segmented value={type} onChange={setType} options={TABS} />
      </div>
      <Card title={`매입금액 합계 ${money(total)}`}>
        {loading ? <Loading /> : (
          <Table
            rows={rows}
            empty="이 분류에 보유 중인 종목이 없어요"
            columns={[
              { key: "name", label: "종목", render: (h) => (
                <div>
                  <p className="font-semibold">{h.name || h.ticker}</p>
                  <p className="text-[12px] text-ink-3">{h.ticker}</p>
                </div>
              ) },
              { key: "account", label: "계좌", render: (h) => (
                <span className="text-ink-2">{acc[h.account_id]?.name}
                  <span className="ml-1 text-ink-3">· {ACCOUNT_TYPES[acc[h.account_id]?.type]}</span>
                </span>
              ) },
              { key: "qty", label: "수량", align: "right", render: (h) => num(h.qty) + "주" },
              { key: "avg", label: "평균단가", align: "right", render: (h) => money(h.avg_price) },
              { key: "cost", label: "매입금액", align: "right", render: (h) => <span className="font-semibold">{money(h.total_cost)}</span> },
              { key: "w", label: "비중", align: "right", render: (h) => (total ? ((h.total_cost / total) * 100).toFixed(1) + "%" : "-") },
            ]}
          />
        )}
        <p className="mt-4 text-[12px] text-ink-3">평균단가는 매수 수수료를 포함한 금액입니다. 현재가·평가손익은 v0.2(시세 연동)에서 추가됩니다.</p>
      </Card>
    </>
  );
}
