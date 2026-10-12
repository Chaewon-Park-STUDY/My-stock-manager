"""관심 종목, 시세 갱신, 박스권 API."""
from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Watch
from ..services.boxrange import BoxParams, current_status, detect_boxes
from ..services.market import Fetcher, PriceFetchError, fdr_fetcher, load_bars, refresh_prices

router = APIRouter(tags=["시세·박스권"])


def get_fetcher() -> Fetcher:
    """테스트에서는 가짜 시세로 바꿔 끼운다 (app.dependency_overrides)."""
    return fdr_fetcher


class WatchIn(BaseModel):
    ticker: str = Field(min_length=1, max_length=20, examples=["005930"])
    name: str | None = Field(default=None, examples=["삼성전자"])


def _params(window: int, max_width: float) -> BoxParams:
    return BoxParams(window=window, max_width=max_width)


def _summary(db: Session, w: Watch, p: BoxParams) -> dict:
    bars = load_bars(db, w.ticker)
    boxes = detect_boxes(bars, p)
    last = bars[-1] if bars else None
    prev = bars[-2] if len(bars) > 1 else None
    return {
        "ticker": w.ticker,
        "name": w.name,
        "last_date": last.date if last else None,
        "close": last.close if last else None,
        "change": round(last.close / prev.close - 1, 4) if last and prev else None,
        "status": current_status(bars, boxes, p),
        "box_count": len(boxes),
    }


@router.get("/watchlist")
def list_watch(
    window: int = Query(20, ge=10, le=120), max_width: float = Query(0.12, gt=0, le=0.5),
    db: Session = Depends(get_db),
):
    p = _params(window, max_width)
    rows = db.scalars(select(Watch).order_by(Watch.ticker)).all()
    return [_summary(db, w, p) for w in rows]


@router.post("/watchlist", status_code=201)
def add_watch(body: WatchIn, db: Session = Depends(get_db), fetcher: Fetcher = Depends(get_fetcher)):
    ticker = body.ticker.strip().upper()
    w = db.get(Watch, ticker)
    if w is None:
        w = Watch(ticker=ticker, name=(body.name or "").strip() or None)
        db.add(w)
        db.commit()
    elif body.name:
        w.name = body.name.strip()
        db.commit()
    try:
        fetched = refresh_prices(db, ticker, fetcher)
        error = None
    except PriceFetchError as e:
        fetched, error = 0, str(e)
    return {**_summary(db, w, BoxParams()), "fetched": fetched, "error": error}


@router.delete("/watchlist/{ticker}", status_code=204)
def remove_watch(ticker: str, db: Session = Depends(get_db)):
    w = db.get(Watch, ticker.upper())
    if w is None:
        raise HTTPException(404, f"관심 종목 {ticker}이(가) 없습니다")
    db.delete(w)
    db.commit()


@router.post("/prices/refresh")
def refresh_all(db: Session = Depends(get_db), fetcher: Fetcher = Depends(get_fetcher)):
    """모든 관심 종목의 시세를 최신으로 갱신. 실패한 종목은 errors에 담는다."""
    result = {"updated": {}, "errors": {}}
    for w in db.scalars(select(Watch)).all():
        try:
            result["updated"][w.ticker] = refresh_prices(db, w.ticker, fetcher)
        except PriceFetchError as e:
            result["errors"][w.ticker] = str(e)
    return result


@router.get("/boxes/{ticker}")
def get_boxes(
    ticker: str,
    days: int = Query(250, ge=20, le=2000, description="차트에 돌려줄 최근 거래일 수"),
    window: int = Query(20, ge=10, le=120),
    max_width: float = Query(0.12, gt=0, le=0.5),
    db: Session = Depends(get_db),
):
    """시세 + 박스 구간 + 현재 상태. 박스는 전체 기간으로 계산하고 표시 구간과 겹치는 것만 돌려준다."""
    ticker = ticker.upper()
    p = _params(window, max_width)
    bars = load_bars(db, ticker)
    if not bars:
        raise HTTPException(404, f"{ticker} 시세가 없습니다. 관심 종목에 먼저 추가하세요.")
    boxes = detect_boxes(bars, p)
    shown = bars[-days:]
    first = shown[0].date
    w = db.get(Watch, ticker)
    return {
        "ticker": ticker,
        "name": w.name if w else None,
        "params": asdict(p),
        "bars": [{"date": b.date, "open": b.open, "high": b.high, "low": b.low, "close": b.close} for b in shown],
        "boxes": [b.public() for b in boxes if b.end >= first],
        "status": current_status(bars, boxes, p),
    }
