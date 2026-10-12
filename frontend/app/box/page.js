"use client";
import { useEffect, useState } from "react";
import BoxChart, { BOX_FILL } from "@/components/BoxChart";
import StockSearch from "@/components/StockSearch";
import { Card, DeleteButton, Empty, ErrorBox, Field, Flash, Loading, PageHeader, Segmented } from "@/components/ui";
import { api } from "@/lib/api";
import { useApi, useFlash } from "@/lib/useApi";

// 상태별 배지 색. 색만으로 구분하지 않도록 항상 글자(label)와 함께 표시
const BADGE = {
  BROKE_UP: "bg-up text-white",
  TESTING_UP: "bg-up/10 text-up",
  NEAR_UPPER: "bg-up/10 text-up",
  IN_BOX: "bg-surface-2 text-ink-2",
  NEAR_LOWER: "bg-down/10 text-down",
  TESTING_DOWN: "bg-down/10 text-down",
  BROKE_DOWN: "bg-down text-white",
  NO_BOX: "bg-surface-2 text-ink-3",
  NO_DATA: "bg-surface-2 text-ink-3",
};

const WINDOWS = [{ value: 20, label: "20일" }, { value: 40, label: "40일" }, { value: 60, label: "60일" }];
const WIDTHS = [{ value: 0.08, label: "8%" }, { value: 0.12, label: "12%" }, { value: 0.15, label: "15%" }];

const won = (v) => (v == null ? "-" : Math.round(v).toLocaleString("ko-KR") + "원");
const pctText = (r) => (r == null ? "" : `${r > 0 ? "+" : ""}${(r * 100).toFixed(2)}%`);

function Badge({ status }) {
  return (
    <span className={`whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] font-semibold ${BADGE[status.state] || BADGE.NO_BOX}`}>
      {status.label}
    </span>
  );
}

/** 박스 안에서 현재가 위치 (하단 0% ~ 상단 100%) */
function PositionBar({ status }) {
  if (status.position == null) return null;
  const p = Math.max(0, Math.min(1, status.position));
  return (
    <div className="mt-3">
      <div className="relative h-1.5 rounded-full bg-gradient-to-r from-down/30 via-line to-up/30">
        <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-ink shadow"
          style={{ left: `${p * 100}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-ink-3">
        <span>하단 {won(status.lower)}</span>
        <span>상단 {won(status.upper)}</span>
      </div>
    </div>
  );
}

export default function BoxPage() {
  const [params, setParams] = useState({ window: 20, max_width: 0.12 });
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [flash, showFlash] = useFlash();

  const watch = useApi(() => api.watchlist.list(params), [params.window, params.max_width]);
  const holdings = useApi(() => api.holdings(), []);
  const list = watch.data || [];
  const current = selected || list[0]?.ticker;
  const chart = useApi(
    () => (current ? api.boxes(current, { ...params, days: 250 }) : Promise.resolve(null)),
    [current, params.window, params.max_width, list.length],
  );

  // 보유 중인데 아직 관심 종목이 아닌 것 → 한 번에 추가 버튼
  const watched = new Set(list.map((w) => w.ticker));
  const suggestions = [...new Map((holdings.data || []).map((h) => [h.ticker, h])).values()]
    .filter((h) => !watched.has(h.ticker.toUpperCase()));

  useEffect(() => {
    if (selected && !list.some((w) => w.ticker === selected)) setSelected(null);
  }, [list, selected]);

  async function add(ticker, name) {
    setBusy(true);
    try {
      const r = await api.watchlist.add({ ticker, name: name || null });
      if (r.error) showFlash(r.error, "error");
      else showFlash(`${name || ticker} 추가 · 시세 ${r.fetched}일 받음`);
      setSelected(r.ticker);
      watch.reload();
    } catch (err) {
      showFlash(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    setBusy(true);
    try {
      const r = await api.refreshPrices();
      const errs = Object.keys(r.errors);
      showFlash(errs.length ? `일부 실패: ${errs.join(", ")}` : "시세를 최신으로 갱신했어요", errs.length ? "error" : "ok");
      watch.reload();
      chart.reload();
    } catch (err) {
      showFlash(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(w) {
    if (!confirm(`${w.name || w.ticker}을(를) 관심 종목에서 뺄까요?`)) return;
    await api.watchlist.remove(w.ticker).catch((err) => showFlash(err.message, "error"));
    watch.reload();
  }

  const c = chart.data;

  return (
    <>
      <PageHeader title="박스권 추적" desc="일정 범위 안에서 오르내리는 구간을 찾고, 지금 주가가 박스의 어디쯤인지 보여줘요">
        <button className="btn btn-ghost" onClick={refresh} disabled={busy || !list.length}>
          {busy ? "갱신 중…" : "시세 새로고침"}
        </button>
      </PageHeader>
      <ErrorBox error={watch.error} />

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="order-2 flex flex-col gap-4 lg:order-1 lg:sticky lg:top-6 lg:self-start">
          <Card title="종목 추가">
            <StockSearch allowRaw onSelect={(s) => add(s.ticker, s.name)}
              hint={busy ? "시세 받는 중…" : "고르면 바로 추가하고 2년치 시세를 받아요 · ETF·미국 주식은 코드 입력 후 Enter"} />
            {suggestions.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[13px] text-ink-3">보유 종목에서 추가</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((h) => (
                    <button key={h.ticker} type="button" disabled={busy} onClick={() => add(h.ticker, h.name)}
                      className="rounded-full border border-line px-3 py-1 text-[13px] text-ink-2 hover:border-brand hover:text-brand">
                      + {h.name || h.ticker}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card title="박스 기준">
            <div className="flex flex-col gap-3">
              <Field label="형성 기간" hint="이 기간 동안 좁은 범위에 머물렀는지 봐요">
                <Segmented value={params.window} onChange={(v) => setParams({ ...params, window: v })} options={WINDOWS} />
              </Field>
              <Field label="최대 폭" hint="상단과 하단 차이가 이 비율 이하일 때만 박스로 봐요">
                <Segmented value={params.max_width} onChange={(v) => setParams({ ...params, max_width: v })} options={WIDTHS} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="order-1 flex min-w-0 flex-col gap-4 lg:order-2">
          {watch.loading && !list.length ? <Loading /> : !list.length ? (
            <Card><Empty>관심 종목을 추가하면 박스권을 찾아드려요</Empty></Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((w) => (
                <button key={w.ticker} type="button" onClick={() => setSelected(w.ticker)}
                  className={`rounded-2xl bg-surface p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:ring-1 hover:ring-line ${
                    current === w.ticker ? "ring-2 ring-brand" : ""
                  }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{w.name || w.ticker}</p>
                      <p className="text-[12px] text-ink-3">{w.ticker}</p>
                    </div>
                    <Badge status={w.status} />
                  </div>
                  <p className="mt-3 text-[18px] font-bold tracking-tight">
                    {won(w.close)}
                    <span className={`ml-1.5 text-[13px] font-medium ${w.change > 0 ? "text-up" : w.change < 0 ? "text-down" : "text-ink-3"}`}>
                      {pctText(w.change)}
                    </span>
                  </p>
                  <PositionBar status={w.status} />
                </button>
              ))}
            </div>
          )}

          {current && (
            <Card
              title={c ? `${c.name || c.ticker} · 최근 ${c.bars.length}거래일` : "차트"}
              action={c && <Badge status={c.status} />}>
              {chart.loading && !c ? <Loading /> : chart.error ? (
                <p className="text-[14px] text-ink-3">{chart.error}</p>
              ) : c && (
                <>
                  <BoxChart bars={c.bars} boxes={c.boxes} status={c.status} />
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
                    <span className="flex items-center gap-1.5"><i className="h-2.5 w-4 rounded-sm" style={{ background: "var(--series-1)" }} />종가</span>
                    {[["ACTIVE", "진행 중인 박스"], ["UP", "상향 돌파로 끝난 박스"], ["DOWN", "하향 이탈로 끝난 박스"]].map(([k, l]) => (
                      <span key={k} className="flex items-center gap-1.5">
                        <i className="h-2.5 w-4 rounded-sm border border-dashed" style={{ borderColor: BOX_FILL[k], background: `color-mix(in srgb, ${BOX_FILL[k]} 15%, transparent)` }} />{l}
                      </span>
                    ))}
                  </div>
                  {c.boxes.length > 0 && (
                    <ul className="mt-5 divide-y divide-line/60 text-[14px]">
                      {[...c.boxes].reverse().map((b) => (
                        <li key={b.start} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                          <span className="text-ink-2">{b.start} ~ {b.end} <span className="text-ink-3">({b.days}거래일)</span></span>
                          <span>
                            {won(b.lower)} ~ {won(b.upper)}
                            <span className="ml-2 text-ink-3">폭 {(b.width * 100).toFixed(1)}%</span>
                            <span className={`ml-2 font-semibold ${b.breakout === "UP" ? "text-up" : b.breakout === "DOWN" ? "text-down" : "text-ink-3"}`}>
                              {b.breakout === "UP" ? "상향 돌파" : b.breakout === "DOWN" ? "하향 이탈" : "진행 중"}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <p className="text-[12px] text-ink-3">
                      과거 가격 흐름을 구간으로 요약한 것이며 매수·매도 신호가 아닙니다. 돌파는 종가가 경계를 1% 넘어 2일 연속 머물 때 확정해요.
                    </p>
                    <span className="shrink-0"><DeleteButton onClick={() => remove(list.find((w) => w.ticker === current))} /></span>
                  </div>
                </>
              )}
            </Card>
          )}
        </div>
      </div>
      <Flash flash={flash} />
    </>
  );
}
