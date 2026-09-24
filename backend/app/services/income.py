"""배당·이자 세금 계산과 월별 집계."""
import math
from collections import defaultdict
from datetime import date
from typing import Iterable, Protocol


def calc_tax(gross: float, rate: float, currency: str = "KRW", tax: float | None = None) -> tuple[float, float]:
    """(세액, 세후금액)을 돌려준다.

    tax를 직접 주면 그대로 쓴다 (증권사 명세와 1원 단위까지 맞추고 싶을 때).
    아니면 gross × rate로 계산하고, 원화는 원 미만 절사, 외화는 소수 둘째 자리 반올림.
    """
    if tax is None:
        raw = gross * rate
        tax = math.floor(raw + 1e-9) if currency == "KRW" else round(raw, 2)
    if tax > gross:
        raise ValueError("세액이 세전 금액보다 클 수 없습니다")
    net = gross - tax
    return tax, (round(net) if currency == "KRW" else round(net, 2))


class IncomeLike(Protocol):
    pay_date: date
    gross: float
    tax: float
    net: float


def monthly_income(rows: Iterable[IncomeLike]) -> list[dict]:
    """지급일 기준 월별 세전·세금·세후 합계."""
    acc: dict[str, dict] = defaultdict(lambda: {"gross": 0.0, "tax": 0.0, "net": 0.0, "count": 0})
    for r in rows:
        m = acc[r.pay_date.strftime("%Y-%m")]
        m["gross"] += r.gross
        m["tax"] += r.tax
        m["net"] += r.net
        m["count"] += 1
    return [
        {"month": k, **{f: round(v[f], 2) for f in ("gross", "tax", "net")}, "count": v["count"]}
        for k, v in sorted(acc.items())
    ]
