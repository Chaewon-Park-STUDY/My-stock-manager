"""FIFO 손익 계산 단위 테스트 (DB 없이 순수 계산만 검증)."""
from datetime import date
from types import SimpleNamespace

import pytest

from app.services.income import calc_tax
from app.services.pnl import OversellError, holdings, monthly_trading_report, run_fifo

_next_id = iter(range(1, 10_000))


def t(side, qty, price, d, fee=0, tax=0, ticker="005930", account_id=1):
    return SimpleNamespace(
        id=next(_next_id), account_id=account_id, ticker=ticker, name=None,
        side=side, qty=qty, price=price, fee=fee, tax=tax, traded_at=date.fromisoformat(d),
    )


def test_fifo_consumes_oldest_lot_first():
    trades = [
        t("BUY", 10, 1000, "2026-01-02"),
        t("BUY", 10, 2000, "2026-01-03"),
        t("SELL", 15, 3000, "2026-01-04"),
    ]
    _, _, realized = run_fifo(trades)
    # 원가: 10주×1000 + 5주×2000 = 20,000 / 매도대금 45,000
    assert realized[0].cost == 20_000
    assert realized[0].pnl == 25_000

    [h] = holdings(trades)
    assert h["qty"] == 5 and h["avg_price"] == 2000


def test_fees_and_taxes_are_included():
    trades = [
        t("BUY", 10, 10_000, "2026-02-02", fee=150),
        t("SELL", 10, 11_000, "2026-02-10", fee=165, tax=198),
    ]
    _, _, [r] = run_fifo(trades)
    assert r.cost == 100_150
    assert r.proceeds == 110_000 - 165 - 198
    assert r.pnl == pytest.approx(9_487)


def test_oversell_raises():
    with pytest.raises(OversellError):
        run_fifo([t("BUY", 5, 100, "2026-03-01"), t("SELL", 6, 100, "2026-03-02")])


def test_sell_before_buy_date_is_rejected_even_if_inserted_later():
    # 매수보다 날짜가 앞선 매도는 시간순 재생에서 걸러진다
    with pytest.raises(OversellError):
        run_fifo([t("BUY", 5, 100, "2026-03-05"), t("SELL", 5, 100, "2026-03-01")])


def test_monthly_report_groups_by_sell_month():
    trades = [
        t("BUY", 10, 100, "2026-04-01"),
        t("SELL", 5, 120, "2026-04-15"),   # +100
        t("SELL", 5, 90, "2026-05-02"),    # -50
        t("BUY", 1, 1000, "2026-05-03", ticker="000660"),
        t("SELL", 1, 1300, "2026-05-04", ticker="000660"),  # +300
    ]
    apr, may = monthly_trading_report(trades)
    assert apr["month"] == "2026-04" and apr["realized_pnl"] == 100 and apr["win_rate"] == 1
    assert may["realized_pnl"] == 250
    assert may["wins"] == 1 and may["losses"] == 1
    assert may["profit_factor"] == 6.0  # 300 / 50


def test_accounts_are_tracked_separately():
    trades = [
        t("BUY", 10, 100, "2026-06-01", account_id=1),
        t("BUY", 3, 200, "2026-06-01", account_id=2),
    ]
    with pytest.raises(OversellError):
        run_fifo(trades + [t("SELL", 5, 100, "2026-06-02", account_id=2)])


def test_tax_krw_truncates_won():
    tax, net = calc_tax(12_345, 0.154)       # 1,901.13 → 1,901
    assert (tax, net) == (1_901, 10_444)


def test_tax_override_and_usd_rounding():
    assert calc_tax(10_000, 0.154, tax=1_540) == (1_540, 8_460)
    assert calc_tax(12.34, 0.15, currency="USD") == (1.85, 10.49)
