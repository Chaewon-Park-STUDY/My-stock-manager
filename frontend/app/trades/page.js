"use client";
import { useState } from "react";
import {
  Card, DeleteButton, Empty, ErrorBox, Field, Flash, Loading, PageHeader, Segmented, Table,
} from "@/components/ui";
import { api } from "@/lib/api";
import { ACCOUNT_TYPES, money, monthLabel, num, pct, pnlColor, signedMoney, today } from "@/lib/format";
import { useApi, useFlash } from "@/lib/useApi";

const blank = () => ({ side: "BUY", ticker: "", name: "", qty: "", price: "", fee: "", tax: "", traded_at: today() });

export default function TradesPage() {
  const [accountId, setAccountId] = useState(""); // 목록 필터
  const [formAccount, setFormAccount] = useState(""); // 입력할 계좌
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [flash, showFlash] = useFlash();

  const accounts = useApi(() => api.accounts.list(), []);
  const investAccounts = (accounts.data || []).filter((a) => a.type !== "SAVINGS");
  const defaultAccount = (investAccounts.find((a) => a.type === "TRADING") || investAccounts[0])?.id || "";
  const selected = formAccount || defaultAccount;

  const records = useApi(
    () => Promise.all([
      api.trades.list({ account_id: accountId }),
      api.reports.trading(accountId ? { account_id: accountId } : {}),
    ]),
    [accountId],
  );
  const [trades = [], monthly = []] = records.data || [];
  const accName = Object.fromEntries((accounts.data || []).map((a) => [a.id, a.name]));

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const amount = (Number(form.qty) || 0) * (Number(form.price) || 0);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.trades.create({
        account_id: Number(selected),
        ticker: form.ticker.trim(),
        name: form.name.trim() || null,
        side: form.side,
        qty: Number(form.qty),
        price: Number(form.price),
        fee: Number(form.fee) || 0,
        tax: Number(form.tax) || 0,
        traded_at: form.traded_at,
      });
      showFlash(`${form.name || form.ticker} ${form.side === "BUY" ? "매수" : "매도"} 기록 완료`);
      setForm((f) => ({ ...blank(), side: f.side, traded_at: f.traded_at }));
      records.reload();
    } catch (err) {
      showFlash(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(t) {
    if (!confirm(`${t.traded_at} ${t.name || t.ticker} 거래를 삭제할까요?`)) return;
    try {
      await api.trades.remove(t.id);
      records.reload();
    } catch (err) {
      showFlash(err.message, "error");
    }
  }

  if (accounts.loading) return (<><PageHeader title="거래" /><Loading /></>);
  if (!investAccounts.length && !accounts.error) {
    return (
      <>
        <PageHeader title="거래" />
        <Card><Empty href="/accounts" cta="계좌 만들기">거래를 기록하려면 투자 계좌가 먼저 필요해요</Empty></Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="거래" desc="매수·매도를 기록하면 보유 종목과 실현손익이 자동 계산돼요">
        <select className="input w-auto" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">전체 계좌</option>
          {investAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {ACCOUNT_TYPES[a.type]}</option>)}
        </select>
      </PageHeader>
      <ErrorBox error={accounts.error || records.error} />

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card title="거래 입력" className="lg:sticky lg:top-6 lg:self-start">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Segmented value={form.side} onChange={(v) => setForm((f) => ({ ...f, side: v }))} options={[
              { value: "BUY", label: "매수", activeClass: "text-up" },
              { value: "SELL", label: "매도", activeClass: "text-down" },
            ]} />
            <Field label="계좌">
              <select className="input" value={selected} onChange={(e) => setFormAccount(e.target.value)} required>
                {investAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {ACCOUNT_TYPES[a.type]}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="종목코드"><input className="input" value={form.ticker} onChange={set("ticker")} placeholder="005930" required /></Field>
              <Field label="종목명"><input className="input" value={form.name} onChange={set("name")} placeholder="삼성전자" /></Field>
              <Field label="수량"><input className="input" type="number" step="any" min="0" inputMode="decimal" value={form.qty} onChange={set("qty")} required /></Field>
              <Field label="단가(원)"><input className="input" type="number" step="any" min="0" inputMode="decimal" value={form.price} onChange={set("price")} required /></Field>
              <Field label="수수료"><input className="input" type="number" step="any" min="0" inputMode="decimal" value={form.fee} onChange={set("fee")} placeholder="0" /></Field>
              <Field label="거래세" hint={form.side === "BUY" ? "매도 시에만" : undefined}>
                <input className="input" type="number" step="any" min="0" inputMode="decimal" value={form.tax} onChange={set("tax")} placeholder="0" />
              </Field>
            </div>
            <Field label="거래일"><input className="input" type="date" value={form.traded_at} onChange={set("traded_at")} required /></Field>
            <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 text-[14px]">
              <span className="text-ink-3">거래금액</span>
              <span className="font-semibold">{money(amount)}</span>
            </div>
            <button className="btn btn-primary" disabled={saving}>
              {saving ? "저장 중…" : form.side === "BUY" ? "매수 기록" : "매도 기록"}
            </button>
          </form>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Card title="월별 실현손익" action={!accountId && <span className="text-[13px] text-ink-3">단타 계좌 기준</span>}>
            {records.loading ? <Loading /> : (
              <Table
                rows={[...monthly].reverse().map((m) => ({ ...m, id: m.month }))}
                empty="아직 매도 기록이 없어요"
                columns={[
                  { key: "month", label: "월", render: (m) => `${m.month.slice(0, 4)}년 ${monthLabel(m.month).replace(/^\d+년 /, "")}` },
                  { key: "pnl", label: "실현손익", align: "right", render: (m) => <span className={`font-semibold ${pnlColor(m.realized_pnl)}`}>{signedMoney(m.realized_pnl)}</span> },
                  { key: "cnt", label: "매도", align: "right", render: (m) => `${m.sell_count}건` },
                  { key: "wr", label: "승률", align: "right", render: (m) => pct(m.win_rate) },
                  { key: "avg", label: "평균 수익 / 손실", align: "right", render: (m) => (
                    <span><span className="text-up">{m.avg_win ? signedMoney(m.avg_win) : "-"}</span>
                      <span className="text-ink-3"> / </span>
                      <span className="text-down">{m.avg_loss ? signedMoney(m.avg_loss) : "-"}</span></span>
                  ) },
                  { key: "pf", label: "손익비", align: "right", render: (m) => (m.profit_factor ? m.profit_factor.toFixed(2) : "-") },
                ]}
              />
            )}
          </Card>

          <Card title="거래 내역">
            {records.loading ? <Loading /> : (
              <Table
                rows={[...trades].reverse()}
                limit={15}
                columns={[
                  { key: "date", label: "날짜", render: (t) => <span className="text-ink-2">{t.traded_at}</span> },
                  { key: "side", label: "구분", render: (t) => (
                    <span className={`rounded-md px-2 py-0.5 text-[12px] font-semibold ${t.side === "BUY" ? "bg-up/10 text-up" : "bg-down/10 text-down"}`}>
                      {t.side === "BUY" ? "매수" : "매도"}
                    </span>
                  ) },
                  { key: "name", label: "종목", render: (t) => <span className="font-medium">{t.name || t.ticker}</span> },
                  ...(accountId ? [] : [{ key: "acc", label: "계좌", render: (t) => <span className="text-ink-3">{accName[t.account_id]}</span> }]),
                  { key: "qty", label: "수량", align: "right", render: (t) => num(t.qty) },
                  { key: "price", label: "단가", align: "right", render: (t) => money(t.price) },
                  { key: "amt", label: "금액", align: "right", render: (t) => money(t.qty * t.price) },
                  { key: "del", label: "", align: "right", render: (t) => <DeleteButton onClick={() => remove(t)} /> },
                ]}
              />
            )}
          </Card>
        </div>
      </div>
      <Flash flash={flash} />
    </>
  );
}
