"""일봉 시세 수집과 DB 캐시.

- 국내: 종목코드 6자리 (예: 005930), 미국: 티커 (예: AAPL)
- FinanceDataReader를 사용 (국내 시세는 네이버 금융에서 가져옴)
- 이미 저장된 날짜 이후만 새로 받아온다 (마지막 5일은 정정 반영을 위해 다시 받음)
"""
from datetime import date, timedelta
from typing import Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Price

HISTORY_DAYS = 365 * 2  # 처음 추가할 때 받아올 기간
OVERLAP_DAYS = 5

# fetcher(ticker, start, end) -> [{"date","open","high","low","close","volume"}, ...]
Fetcher = Callable[[str, date, date], list[dict]]


class PriceFetchError(RuntimeError):
    pass


def fdr_fetcher(ticker: str, start: date, end: date) -> list[dict]:
    """FinanceDataReader로 일봉을 받아온다."""
    try:
        import FinanceDataReader as fdr  # 설치가 무거워 실제 호출할 때만 불러온다
    except ImportError as e:  # pragma: no cover
        raise PriceFetchError("finance-datareader 패키지가 없습니다: pip install finance-datareader") from e
    try:
        df = fdr.DataReader(ticker, start.isoformat(), end.isoformat())
    except Exception as e:  # 네트워크 오류, 잘못된 종목코드 등
        raise PriceFetchError(f"{ticker} 시세를 가져오지 못했습니다: {e}") from e
    if df is None or df.empty:
        raise PriceFetchError(f"{ticker} 시세가 비어 있습니다. 종목코드를 확인하세요.")
    rows = []
    for idx, r in df.iterrows():
        if any(r.get(k) != r.get(k) for k in ("High", "Low", "Close")):  # NaN 건너뛰기
            continue
        rows.append({
            "date": idx.date(),
            "open": float(r.get("Open", r["Close"])),
            "high": float(r["High"]),
            "low": float(r["Low"]),
            "close": float(r["Close"]),
            "volume": float(r.get("Volume", 0) or 0),
        })
    return rows


def refresh_prices(db: Session, ticker: str, fetcher: Fetcher, today: date | None = None) -> int:
    """새 시세를 받아 저장하고, 추가·갱신된 일수를 돌려준다."""
    today = today or date.today()
    last = db.scalar(select(Price.date).where(Price.ticker == ticker).order_by(Price.date.desc()).limit(1))
    start = (last - timedelta(days=OVERLAP_DAYS)) if last else today - timedelta(days=HISTORY_DAYS)

    rows = fetcher(ticker, start, today)
    existing = {
        p.date: p
        for p in db.scalars(select(Price).where(Price.ticker == ticker, Price.date >= start))
    }
    for r in rows:
        p = existing.get(r["date"])
        if p is None:
            db.add(Price(ticker=ticker, **r))
        else:
            for k, v in r.items():
                setattr(p, k, v)
    db.commit()
    return len(rows)


def load_bars(db: Session, ticker: str) -> list[Price]:
    return list(db.scalars(select(Price).where(Price.ticker == ticker).order_by(Price.date)))
