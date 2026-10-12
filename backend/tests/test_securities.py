"""종목 검색 테스트 — 실제 KRX 목록 CSV 일부(40종목)를 고정 데이터로 쓴다."""
from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.securities import get_lister
from app.database import Base, get_db
from app.main import app
from app.services.securities import ListingError, ensure_listing, parse_listing_csv, search, sync_listing

SAMPLE = parse_listing_csv((Path(__file__).parent / "data" / "sample_krx_listing.csv").read_text(encoding="utf-8"))


def test_parse_sample():
    assert len(SAMPLE) == 40
    first = SAMPLE[0]
    assert first["ticker"] == "005930" and first["name"] == "삼성전자" and first["market"] == "KOSPI"
    assert first["marcap"] > 0


@pytest.fixture()
def Session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False)


def test_search_ranking(Session):
    with Session() as db:
        sync_listing(db, lambda: SAMPLE)
        names = [s.name for s in search(db, "삼성")]
        assert names[0] == "삼성전자"                      # 이름으로 시작 + 시가총액 1위
        assert all(n.startswith("삼성") for n in names[:3])
        assert search(db, "005930")[0].name == "삼성전자"   # 코드로 검색
        assert search(db, "하이닉")[0].ticker == "000660"   # 이름 중간 일부
        assert search(db, "없는종목") == []


def test_ensure_listing_refreshes_only_when_stale(Session):
    calls = []

    def lister():
        calls.append(1)
        return SAMPLE

    with Session() as db:
        ensure_listing(db, lister, today=date(2026, 10, 1))
        ensure_listing(db, lister, today=date(2026, 10, 5))   # 4일 → 그대로
        assert len(calls) == 1
        ensure_listing(db, lister, today=date(2026, 10, 9))   # 8일 → 새로 받음
        assert len(calls) == 2

        def broken():
            raise ListingError("offline")

        ensure_listing(db, broken, today=date(2026, 12, 1))   # 실패해도 예전 목록 유지
        assert search(db, "삼성")


def test_search_api(Session):
    def override():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override
    app.dependency_overrides[get_lister] = lambda: (lambda: SAMPLE)
    try:
        c = TestClient(app)
        r = c.get("/securities/search", params={"q": "현대"})
        assert r.status_code == 200
        assert r.json()[0] == {"ticker": "005380", "name": "현대차", "market": "KOSPI"}

        def broken():
            raise ListingError("상장 종목 목록을 받지 못했습니다")

        app.dependency_overrides[get_lister] = lambda: broken
        # 목록이 이미 있으면 실패해도 검색은 된다
        assert c.get("/securities/search", params={"q": "삼성"}).status_code == 200
    finally:
        app.dependency_overrides.clear()
