"""선입선출(FIFO) 기준 보유 종목·실현손익 계산.

DB와 무관한 순수 함수라서 단위 테스트가 쉽다.
- 매수 단가에는 매수 수수료를 포함한다 (취득원가).
- 매도 대금에서는 매도 수수료·거래세를 뺀다 (순매도금액).
- 실현손익 = 순매도금액 - 먼저 산 로트부터 소진한 취득원가
"""
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import date
from typing import Iterable, Protocol

EPS = 1e-9


class TradeLike(Protocol):
    id: int
    account_id: int
    ticker: str
    name: str | None
    side: str
    qty: float
    price: float
    fee: float
    tax: float
    traded_at: date


@dataclass
class Lot:
    qty: float
    unit_cost: float


@dataclass
class Realized:
    """매도 1건에서 확정된 손익."""
    trade_id: int
    account_id: int
    ticker: str
    sold_at: date
    qty: float
    proceeds: float
    cost: float

    @property
    def pnl(self) -> float:
        return self.proceeds - self.cost


class OversellError(ValueError):
    """보유 수량보다 많이 매도하려는 경우."""


def run_fifo(trades: Iterable[TradeLike]):
    """거래 목록을 시간순으로 재생해 (남은 로트, 이름, 실현손익 목록)을 돌려준다."""
    lots: dict[tuple[int, str], deque[Lot]] = defaultdict(deque)
    names: dict[tuple[int, str], str | None] = {}
    realized: list[Realized] = []

    for t in sorted(trades, key=lambda t: (t.traded_at, t.id or 0)):
        key = (t.account_id, t.ticker)
        if t.name:
            names[key] = t.name
        names.setdefault(key, None)

        if t.side == "BUY":
            total = t.qty * t.price + t.fee + t.tax
            lots[key].append(Lot(qty=t.qty, unit_cost=total / t.qty))
            continue

        held = sum(lot.qty for lot in lots[key])
        if t.qty > held + EPS:
            raise OversellError(
                f"{t.traded_at} {t.ticker} 매도 {t.qty:g}주 — 보유 수량 {held:g}주보다 많습니다"
            )

        remaining, cost = t.qty, 0.0
        queue = lots[key]
        while remaining > EPS:
            lot = queue[0]
            used = min(lot.qty, remaining)
            cost += used * lot.unit_cost
            lot.qty -= used
            remaining -= used
            if lot.qty <= EPS:
                queue.popleft()

        proceeds = t.qty * t.price - t.fee - t.tax
        realized.append(Realized(t.id, t.account_id, t.ticker, t.traded_at, t.qty, proceeds, cost))

    return lots, names, realized


def holdings(trades: Iterable[TradeLike]) -> list[dict]:
    """현재 보유 종목 (수량 > 0)과 평균 매수단가."""
    lots, names, _ = run_fifo(trades)
    result = []
    for (account_id, ticker), queue in lots.items():
        qty = sum(lot.qty for lot in queue)
        if qty <= EPS:
            continue
        total_cost = sum(lot.qty * lot.unit_cost for lot in queue)
        result.append({
            "account_id": account_id,
            "ticker": ticker,
            "name": names.get((account_id, ticker)),
            "qty": round(qty, 6),
            "avg_price": round(total_cost / qty, 2),
            "total_cost": round(total_cost, 2),
        })
    return sorted(result, key=lambda h: (h["account_id"], h["ticker"]))


def monthly_trading_report(trades: Iterable[TradeLike]) -> list[dict]:
    """매도일 기준 월별 실현손익과 승률·손익비."""
    _, _, realized = run_fifo(trades)
    by_month: dict[str, list[float]] = defaultdict(list)
    for r in realized:
        by_month[r.sold_at.strftime("%Y-%m")].append(r.pnl)

    report = []
    for month in sorted(by_month):
        pnls = by_month[month]
        wins = [p for p in pnls if p > 0]
        losses = [p for p in pnls if p < 0]
        decided = len(wins) + len(losses)
        report.append({
            "month": month,
            "realized_pnl": round(sum(pnls), 2),
            "sell_count": len(pnls),
            "wins": len(wins),
            "losses": len(losses),
            "win_rate": round(len(wins) / decided, 4) if decided else None,
            "avg_win": round(sum(wins) / len(wins), 2) if wins else None,
            "avg_loss": round(sum(losses) / len(losses), 2) if losses else None,
            "profit_factor": round(sum(wins) / -sum(losses), 4) if losses else None,
        })
    return report
