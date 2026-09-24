"use client";
import { useState } from "react";
import { Card, DeleteButton, ErrorBox, Field, Flash, Loading, PageHeader, Segmented, Stat, Table } from "@/components/ui";
import { api } from "@/lib/api";
import { PRODUCT_TYPES, money, monthLabel, today } from "@/lib/format";
import { useApi, useFlash } from "@/lib/useApi";

const blank = () => ({ product_name: "", product_type: "PARKING", pay_date: today(), gross: "", taxMode: "normal", tax: "" });
const RATES = { normal: 0.154, free: 0 };

function preview(f) {
  const g = Number(f.gross) || 0;
  const tax = f.taxMode === "manual" ? Number(f.tax) || 0 : Math.floor(g * RATES[f.taxMode] + 1e-9);
  return { gross: g, tax, net: g - tax };
}

export default function InterestPage() {
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [flash, showFlash] = useFlash();
  const records = useApi(() => Promise.all([api.interest.list(), api.reports.interest()]), []);
  const [rows = [], monthly = []] = records.data || [];
  const year = String(new Date().getFullYear());
  const yearNet = monthly.filter((m) => m.month.startsWith(year)).reduce((s, m) => s + m.net, 0);
  const p = preview(form);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.interest.create({
        product_name: form.product_name.trim(),
        product_type: form.product_type,
        pay_date: form.pay_date,
        gross: Number(form.gross),
        tax_rate: form.taxMode === "free" ? 0 : 0.154,
        tax: form.taxMode === "manual" ? Number(form.tax) || 0 : null,
      });
      showFlash(`${form.product_name} 이자 ${money(p.net)} 기록 완료`);
      setForm((f) => ({ ...blank(), product_name: f.product_name, product_type: f.product_type, taxMode: f.taxMode }));
      records.reload();
    } catch (err) {
      showFlash(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(r) {
    if (!confirm(`${r.pay_date} ${r.product_name} 이자 기록을 삭제할까요?`)) return;
    await api.interest.remove(r.id).catch((err) => showFlash(err.message, "error"));
    records.reload();
  }

  return (
    <>
      <PageHeader title="이자" desc="예금·적금·CMA·파킹통장·채권 이자를 투자 수익과 따로 기록해요" />
      <ErrorBox error={records.error} />

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card title="이자 입력" className="lg:sticky lg:top-6 lg:self-start">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="상품명"><input className="input" value={form.product_name} onChange={set("product_name")} placeholder="토스뱅크 파킹통장" required /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="유형">
                <select className="input" value={form.product_type} onChange={set("product_type")}>
                  {Object.entries(PRODUCT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="지급일"><input className="input" type="date" value={form.pay_date} onChange={set("pay_date")} required /></Field>
            </div>
            <Field label="세전 이자(원)"><input className="input" type="number" step="any" min="0" inputMode="decimal" value={form.gross} onChange={set("gross")} required /></Field>
            <Field label="세금">
              <Segmented value={form.taxMode} onChange={(v) => setForm((f) => ({ ...f, taxMode: v }))} options={[
                { value: "normal", label: "15.4%" }, { value: "free", label: "비과세" }, { value: "manual", label: "직접 입력" },
              ]} />
            </Field>
            {form.taxMode === "manual" && (
              <Field label="실제 세액(원)"><input className="input" type="number" step="any" min="0" inputMode="decimal" value={form.tax} onChange={set("tax")} required /></Field>
            )}
            <dl className="grid gap-1.5 rounded-xl bg-surface-2 px-4 py-3 text-[14px]">
              <div className="flex justify-between"><dt className="text-ink-3">세금</dt><dd>-{money(p.tax)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>세후 입금액</dt><dd>{money(p.net)}</dd></div>
            </dl>
            <button className="btn btn-primary" disabled={saving}>{saving ? "저장 중…" : "이자 기록"}</button>
          </form>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat label={`${year}년 이자 (세후)`} value={money(yearNet)} />
            <Stat label="월평균" value={money(yearNet / (new Date().getMonth() + 1))} sub="올해 경과 월 기준" />
          </div>
          <Card title="월별 이자">
            {records.loading ? <Loading /> : (
              <Table rows={[...monthly].reverse().map((m) => ({ ...m, id: m.month }))} empty="이자 기록이 없어요"
                columns={[
                  { key: "m", label: "월", render: (m) => `${m.month.slice(0, 4)}년 ${monthLabel(m.month).replace(/^\d+년 /, "")}` },
                  { key: "c", label: "건수", align: "right", render: (m) => `${m.count}건` },
                  { key: "g", label: "세전", align: "right", render: (m) => money(m.gross) },
                  { key: "t", label: "세금", align: "right", render: (m) => <span className="text-ink-3">{money(m.tax)}</span> },
                  { key: "n", label: "세후", align: "right", render: (m) => <span className="font-semibold">{money(m.net)}</span> },
                ]} />
            )}
          </Card>
          <Card title="이자 내역">
            {records.loading ? <Loading /> : (
              <Table rows={[...rows].reverse()} limit={15} empty="이자 기록이 없어요"
                columns={[
                  { key: "d", label: "지급일", render: (r) => <span className="text-ink-2">{r.pay_date}</span> },
                  { key: "p", label: "상품", render: (r) => <span className="font-medium">{r.product_name}</span> },
                  { key: "t", label: "유형", render: (r) => <span className="text-ink-3">{PRODUCT_TYPES[r.product_type]}</span> },
                  { key: "n", label: "세후", align: "right", render: (r) => <span className="font-semibold">{money(r.net)}</span> },
                  { key: "x", label: "", align: "right", render: (r) => <DeleteButton onClick={() => remove(r)} /> },
                ]} />
            )}
          </Card>
        </div>
      </div>
      <Flash flash={flash} />
    </>
  );
}
