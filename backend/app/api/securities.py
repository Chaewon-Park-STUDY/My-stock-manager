"""종목 검색 API — 종목명 일부만 입력해도 종목코드를 찾아준다."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.securities import Lister, ListingError, default_lister, ensure_listing, search, sync_listing

router = APIRouter(prefix="/securities", tags=["종목 검색"])


def get_lister() -> Lister:
    """테스트에서는 가짜 목록으로 바꿔 끼운다."""
    return default_lister


@router.get("/search")
def search_securities(
    q: str = Query(min_length=1, max_length=30, examples=["삼성"]),
    limit: int = Query(10, ge=1, le=30),
    db: Session = Depends(get_db),
    lister: Lister = Depends(get_lister),
):
    try:
        ensure_listing(db, lister)  # 처음 검색할 때 목록을 받아 DB에 저장 (약 2,800종목)
    except ListingError as e:
        raise HTTPException(503, str(e))
    return [{"ticker": s.ticker, "name": s.name, "market": s.market} for s in search(db, q, limit)]


@router.post("/sync")
def sync_securities(db: Session = Depends(get_db), lister: Lister = Depends(get_lister)):
    """상장 종목 목록을 지금 새로 받는다 (신규 상장 종목이 검색되지 않을 때)."""
    try:
        return {"count": sync_listing(db, lister)}
    except ListingError as e:
        raise HTTPException(503, str(e))
