"use client";
import { useState } from "react";
import {
  Card, DeleteButton, Empty, ErrorBox, Field, Flash, Loading, PageHeader, Segmented, Stat, Table,
} from "@/components/ui";
import { api } from "@/lib/api";
import { money, monthLabel, num, today } from "@/lib/format";
import { useApi, useFlash } from "@/lib/useApi";

const RATE = { KRW: 0.154, USD: 0.15 }; // 국내 15.4%, 미국 원천징수 15%
const blank = (currency = "KRW") => ({ ticker: "", name: "", pay_date: today(), dps: "", qty: "", currency, tax: "" });

/** 백엔드와 같은 규칙으로 미리보기 계산 (원화는 원 미만 절사) */
function preview(f) {
  const krw = f.currency === "KRW";
  const gross = (Number(f.dps) || 0) * (Number(f.qty) || 0);
  const g = krw ? Math.round(gross) : Math.round(gross * 100) / 100;
  const tax = f.tax !== "" ? Number(f.tax) : krw ? Math.floor(g * RATE.KRW + 1e-9) : Math.round(g * RATE.USD * 100) / 100;
  return { gross: g, tax, net: g - tax };
}

export default function DividendsPage() {
  const [currency, setCurrency] = useState("KRW"); // 보기 통화
  const [form, setForm] = useState(() => blank());
  const [formAccount, setFormAccount] = useState("");
  const [saving, setSaving] = useState(false);
  const [flash, showFlash] = useFlash();

  const accounts = useApi(() => api.accounts.list(), []);
  const investAccounts = (accounts.data || []).filter((a) => a.type !== "SAVINGS");
  const selected = formAccount || (investAccounts.find((a) => a.type === "DIVIDEND") || investAccounts[0])?.id || "";

  const records = useApi(
    () => Promise.all([api.dividends.list(), api.reports.dividends({ currency })]),
    [currency],
  );
  const [rows = [], monthly = []] = records.data || [];
  const shown = rows.filter((r) => r.currency === currency).reverse();
  const year = String(new Date().getFullYear());
  const yearNet = monthly.filter((m) => m.month.startsWith(year)).reduce((s, m) => s + m.net, 0);
  const p = preview(form);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.dividends.create({
        account_id: Number(selected),
        ticker: form.ticker.trim(),
        name: form.name.trim() || null,
        pay_date: form.pay_date,
        dps: Number(form.dps),
        qty: Number(form.qty),
        currency: form.currency,
        tax_rate: RATE[form.currency],
        tax: form.tax === "" ? null : Number(form.tax),
      });
      showFlash(`${form.name || form.ticker} 배당 ${money(p.net, form.currency)} 기록 완료`);
      setCurrency(form.currency);
      setForm((f) => blank(f.currency));
      records.reload();
    } catch (err) {
      showFlash(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(d) {
    if (!confirm(`${d.pay_date} ${d.name || d.ticker} 배당 기록을 삭제할까요?`)) return;
    await api.dividends.remove(d.id).catch((err) => showFlash(err.message, "error"));
    records.reload();
  }

  if (accounts.loading) return (<><PageHeader title="배당" /><Loading /></>);
  if (!investAccounts.length && !accounts.error) {
    return (<><PageHeader title="배당" /><Card><Empty href="/accounts" cta="계좌 만들기">배당을 기록하려면 계좌가 먼저 필요해요</Empty></Card></>);
  }

  return (
    <>
      <PageHeader title="배당" desc="받은 배당금을 기록하면 세금과 세후 금액이 자동 계산돼요">
        <div className="w-44"><Segmented value={currency} onChange={setCurrency} options={[{ value: "KRW", label: "원화" }, { value: "USD", label: "달러" }]} /></div>
      </PageHeader>
      <ErrorBox error={accounts.error || records.error} />

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card title="배당 입력" className="lg:sticky lg:top-6 lg:self-start">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Segmented value={form.currency} onChange={(v) => setForm((f) => ({ ...f, currency: v }))}
              options={[{ value: "KRW", label: "국내 (15.4%)" }, { value: "USD", label: "미국 (15%)" }]} />
            <Field label="계좌">
              <select className="input" value={selected} onChange={(e) => setFormAccount(e.target.value)} required>
                {investAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="종목코드"><input className="input" value={form.ticker} onChange={set("ticker")} placeholder={form.currency === "KRW" ? "005930" : "SCHD"} required /></Field>
              <Field label="종목명"><input className="input" value={form.name} onChange={set("name")} placeholder={form.currency === "KRW" ? "삼성전자" : "슈왑 배당 ETF"} /></Field>
              <Field label={`주당 배당금(${form.currency === "KRW" ? "원" : "$"})`}><input className="input" type="number" step="any" min="0" inputMode="decimal" value={form.dps} onChange={set("dps")} required /></Field>
              <Field label="보유 수량"><input className="input" type="number" step="any" min="0" inputMode="decimal" value={form.qty} onChange={set("qty")} required /></Field>
            </div>
            <Field label="지급일"><input className="input" type="date" value={form.pay_date} onChange={set("pay_date")} required /></Field>
            <Field label="실제 세액 (선택)" hint="증권사 명세서 금액과 맞추고 싶을 때만 입력">
              <input className="input" type="number" step="any" min="0" inputMode="decimal" value={form.tax} onChange={set("tax")} placeholder="자동 계산" />
            </Field>
            <dl className="grid gap-1.5 rounded-xl bg-surface-2 px-4 py-3 text-[14px]">
              <div className="flex justify-between"><dt className="text-ink-3">세전</dt><dd>{money(p.gross, form.currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">세금</dt><dd>-{money(p.tax, form.currency)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>세후 입금액</dt><dd>{money(p.net, form.currency)}</dd></div>
            </dl>
            <button className="btn btn-primary" disabled={saving}>{saving ? "저장 중…" : "배당 기록"}</button>
          </form>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat label={`${year}년 배당 (세후)`} value={money(yearNet, currency)} />
            <Stat label="월평균" value={money(yearNet / (new Date().getMonth() + 1), currency)} sub="올해 경과 월 기준" />
          </div>
          <Card title="월별 배당">
            {records.loading ? <Loading /> : (
              <Table rows={[...monthly].reverse().map((m) => ({ ...m, id: m.month }))} empty="배당 기록이 없어요"
                columns={[
                  { key: "m", label: "월", render: (m) => `${m.month.slice(0, 4)}년 ${monthLabel(m.month).replace(/^\d+년 /, "")}` },
                  { key: "c", label: "건수", align: "right", render: (m) => `${m.count}건` },
                  { key: "g", label: "세전", align: "right", render: (m) => money(m.gross, currency) },
                  { key: "t", label: "세금", align: "right", render: (m) => <span className="text-ink-3">{money(m.tax, currency)}</span> },
                  { key: "n", label: "세후", align: "right", render: (m) => <span className="font-semibold">{money(m.net, currency)}</span> },
                ]} />
            )}
          </Card>
          <Card title="배당 내역">
            {records.loading ? <Loading /> : (
              <Table rows={shown} limit={15} empty="배당 기록이 없어요"
                columns={[
                  { key: "d", label: "지급일", render: (d) => <span className="text-ink-2">{d.pay_date}</span> },
                  { key: "n", label: "종목", render: (d) => <span className="font-medium">{d.name || d.ticker}</span> },
                  { key: "q", label: "주당 × 수량", align: "right", render: (d) => <span className="text-ink-2">{money(d.dps, d.currency)} × {num(d.qty)}</span> },
                  { key: "net", label: "세후", align: "right", render: (d) => <span className="font-semibold">{money(d.net, d.currency)}</span> },
                  { key: "x", label: "", align: "right", render: (d) => <DeleteButton onClick={() => remove(d)} /> },
                ]} />
            )}
          </Card>
        </div>
      </div>
      <Flash flash={flash} />
    </>
  );
}
