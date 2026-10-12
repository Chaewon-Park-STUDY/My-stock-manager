"""상장 종목 목록 받기와 종목명 검색.

목록 출처: FinanceDataReader가 매일 GitHub에 올리는 KRX 상장 종목 캐시 CSV
(코스피·코스닥·코넥스, 시가총액 포함). 받지 못하면 FinanceDataReader.StockListing('KRX')를 시도한다.
ETF·해외 종목은 목록에 없으므로 종목코드를 직접 입력한다.
"""
import csv
import io
import urllib.request
from datetime import date, timedelta
from typing import Callable

from sqlalchemy import case, delete, func, or_, select
from sqlalchemy.orm import Session

from ..models import Security

CACHE_URL = "https://raw.githubusercontent.com/FinanceData/fdr_krx_data_cache/refs/heads/master/data/listing/krx/{d}.csv"
STALE_DAYS = 7      # 이 기간보다 오래된 목록은 새로 받는다
LOOKBACK_DAYS = 10  # 주말·휴일이면 최근 파일을 찾아 거슬러 올라간다

# lister() -> [{"ticker","name","market","marcap"}, ...]
Lister = Callable[[], list[dict]]


class ListingError(RuntimeError):
    pass


def parse_listing_csv(text: str) -> list[dict]:
    """캐시 CSV(Code, Name, Market, Marcap 열)를 읽는다."""
    rows = []
    for r in csv.DictReader(io.StringIO(text.lstrip("﻿"))):
        code, name = (r.get("Code") or "").strip(), (r.get("Name") or "").strip()
        if not code or not name:
            continue
        try:
            marcap = float(r.get("Marcap") or 0)
        except ValueError:
            marcap = 0.0
        rows.append({"ticker": code, "name": name, "market": (r.get("Market") or "").strip(), "marcap": marcap})
    return rows


def default_lister(today: date | None = None) -> list[dict]:
    today = today or date.today()
    errors = []
    for k in range(LOOKBACK_DAYS):
        d = (today - timedelta(days=k)).isoformat()
        try:
            with urllib.request.urlopen(CACHE_URL.format(d=d), timeout=10) as res:
                rows = parse_listing_csv(res.read().decode("utf-8"))
            if rows:
                return rows
        except Exception as e:  # 해당 날짜 파일 없음(404) 등 → 하루 전으로
            errors.append(f"{d}: {e}")
    try:  # 마지막 수단
        import FinanceDataReader as fdr
        df = fdr.StockListing("KRX")
        return [
            {"ticker": str(r["Code"]), "name": str(r["Name"]), "market": str(r.get("Market", "")),
             "marcap": float(r.get("Marcap", 0) or 0)}
            for _, r in df.iterrows()
        ]
    except Exception as e:
        errors.append(f"StockListing: {e}")
    raise ListingError("상장 종목 목록을 받지 못했습니다. 인터넷 연결을 확인하세요. (" + errors[-1][:120] + ")")


def sync_listing(db: Session, lister: Lister, today: date | None = None) -> int:
    rows = lister()
    if not rows:
        raise ListingError("상장 종목 목록이 비어 있습니다")
    today = today or date.today()
    db.execute(delete(Security))
    db.add_all(Security(**r, updated=today) for r in rows)
    db.commit()
    return len(rows)


def ensure_listing(db: Session, lister: Lister, today: date | None = None) -> None:
    """목록이 없거나 오래됐으면 새로 받는다. 받기에 실패해도 예전 목록이 있으면 그대로 쓴다."""
    today = today or date.today()
    last = db.scalar(select(func.max(Security.updated)))
    if last is not None and (today - last).days < STALE_DAYS:
        return
    try:
        sync_listing(db, lister, today)
    except ListingError:
        if last is None:
            raise


def search(db: Session, q: str, limit: int = 10) -> list[Security]:
    """종목명 또는 코드로 검색. 정확한 코드 → 이름으로 시작 → 이름에 포함 순, 같은 순위면 시가총액 큰 순."""
    q = q.strip()
    if not q:
        return []
    like = f"%{q}%"
    rank = case(
        (Security.ticker == q.upper(), 0),
        (Security.name == q, 1),
        (Security.name.like(f"{q}%"), 2),
        (Security.ticker.like(f"{q}%"), 3),
        else_=4,
    )
    stmt = (
        select(Security)
        .where(or_(Security.name.like(like), Security.ticker.like(f"{q.upper()}%")))
        .order_by(rank, Security.marcap.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt))
