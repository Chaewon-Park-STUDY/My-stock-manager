"use client";
import { useState } from "react";
import { Card, DeleteButton, ErrorBox, Field, Flash, Loading, PageHeader, Table } from "@/components/ui";
import { api } from "@/lib/api";
import { ACCOUNT_TYPES } from "@/lib/format";
import { useApi, useFlash } from "@/lib/useApi";

const TYPE_DESC = {
  TRADING: "짧게 사고파는 계좌 — 월별 단타 손익에 집계",
  LONG_TERM: "오래 들고 갈 종목 — 평가금액 추적 (v0.2)",
  DIVIDEND: "배당을 받기 위한 종목",
  SAVINGS: "예금·적금 등 (이자는 이자 메뉴에서 기록)",
};

export default function AccountsPage() {
  const [form, setForm] = useState({ name: "", broker: "", type: "TRADING" });
  const [flash, showFlash] = useFlash();
  const { data, error, loading, reload } = useApi(() => api.accounts.list(), []);

  async function submit(e) {
    e.preventDefault();
    try {
      await api.accounts.create({ ...form, broker: form.broker || null });
      showFlash(`'${form.name}' 계좌를 만들었어요`);
      setForm((f) => ({ ...f, name: "", broker: "" }));
      reload();
    } catch (err) {
      showFlash(err.message, "error");
    }
  }

  async function remove(a) {
    if (!confirm(`'${a.name}' 계좌를 삭제할까요?\n이 계좌의 거래·배당 기록도 모두 삭제됩니다.`)) return;
    await api.accounts.remove(a.id).catch((err) => showFlash(err.message, "error"));
    reload();
  }

  return (
    <>
      <PageHeader title="계좌" desc="목적별로 계좌를 나누면 단타·장기·배당 수익이 따로 집계돼요" />
      <ErrorBox error={error} />
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card title="계좌 추가" className="lg:self-start">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="계좌 이름"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="키움 단타계좌" required /></Field>
            <Field label="증권사"><input className="input" value={form.broker} onChange={(e) => setForm({ ...form, broker: e.target.value })} placeholder="키움증권" /></Field>
            <Field label="용도">
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(ACCOUNT_TYPES).map(([k, v]) => (
                  <button key={k} type="button" onClick={() => setForm({ ...form, type: k })}
                    className={`rounded-xl border px-3 py-2.5 text-[14px] font-semibold transition ${
                      form.type === k ? "border-brand bg-brand-soft text-brand" : "border-line text-ink-2 hover:bg-surface-2"
                    }`}>
                    {v}
                  </button>
                ))}
              </div>
            </Field>
            <p className="-mt-2 text-[13px] text-ink-3">{TYPE_DESC[form.type]}</p>
            <button className="btn btn-primary">계좌 만들기</button>
          </form>
        </Card>
        <Card title="내 계좌">
          {loading ? <Loading /> : (
            <Table rows={data || []} empty="아직 계좌가 없어요. 왼쪽에서 만들어 보세요."
              columns={[
                { key: "name", label: "이름", render: (a) => <span className="font-semibold">{a.name}</span> },
                { key: "broker", label: "증권사", render: (a) => <span className="text-ink-2">{a.broker || "-"}</span> },
                { key: "type", label: "용도", render: (a) => (
                  <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[12px] font-semibold text-brand">{ACCOUNT_TYPES[a.type]}</span>
                ) },
                { key: "x", label: "", align: "right", render: (a) => <DeleteButton onClick={() => remove(a)} /> },
              ]} />
          )}
        </Card>
      </div>
      <Flash flash={flash} />
    </>
  );
}
