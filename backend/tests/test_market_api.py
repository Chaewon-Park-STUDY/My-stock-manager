"""시세·박스권 API 테스트 — 네트워크 대신 가짜 시세(fetcher)를 끼워 넣는다."""
import math
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.market import get_fetcher
from app.database import Base, get_db
from app.main import app
from app.services.market import PriceFetchError, refresh_prices

TODAY = date(2026, 10, 12)


def fake_series(n=120):
    """n거래일: 80일 박스(100~110) 후 상승 돌파."""
    out, d = [], TODAY - timedelta(days=n - 1)
    for k in range(n):
        c = 105 + 5 * math.sin(2 * math.pi * k / 10) if k < 80 else 112 * 1.01 ** (k - 80)
        out.append({"date": d + timedelta(days=k), "open": c, "high": c * 1.005, "low": c * 0.995, "close": c, "volume": 1000})
    return out


SERIES = fake_series()


def fake_fetcher(ticker, start, end):
    if ticker == "BAD":
        raise PriceFetchError("BAD 시세를 가져오지 못했습니다")
    return [r for r in SERIES if start <= r["date"] <= end]


@pytest.fixture()
def ctx():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    S = sessionmaker(bind=engine, autoflush=False)

    def override():
        db = S()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override
    app.dependency_overrides[get_fetcher] = lambda: fake_fetcher
    yield TestClient(app), S
    app.dependency_overrides.clear()


def test_add_watch_fetches_and_reports_status(ctx):
    client, _ = ctx
    r = client.post("/watchlist", json={"ticker": "005930", "name": "삼성전자"})
    assert r.status_code == 201
    body = r.json()
    assert body["fetched"] == 120 and body["error"] is None
    assert body["status"]["state"] == "NO_BOX" or body["status"]["state"].startswith("BROKE")

    [w] = client.get("/watchlist").json()
    assert w["name"] == "삼성전자" and w["box_count"] >= 1


def test_boxes_endpoint(ctx):
    client, _ = ctx
    client.post("/watchlist", json={"ticker": "005930"})
    r = client.get("/boxes/005930?days=100").json()
    assert len(r["bars"]) == 100
    box = r["boxes"][0]
    assert box["breakout"] == "UP"
    assert 99 < box["lower"] < 101 and 109 < box["upper"] < 111


def test_fetch_error_keeps_watch_and_returns_message(ctx):
    client, _ = ctx
    r = client.post("/watchlist", json={"ticker": "bad"})
    assert r.status_code == 201 and "가져오지 못했습니다" in r.json()["error"]
    assert client.get("/boxes/BAD").status_code == 404
    assert client.delete("/watchlist/BAD").status_code == 204


def test_refresh_is_incremental_and_idempotent(ctx):
    _, S = ctx
    with S() as db:
        refresh_prices(db, "X", fake_fetcher, today=TODAY - timedelta(days=30))
        refresh_prices(db, "X", fake_fetcher, today=TODAY)
        refresh_prices(db, "X", fake_fetcher, today=TODAY)  # 다시 해도 중복 저장 없음
        from app.services.market import load_bars
        bars = load_bars(db, "X")
        assert len(bars) == 120
        assert len({b.date for b in bars}) == 120


def test_fdr_fetcher_parses_dataframe(monkeypatch):
    """FinanceDataReader가 돌려주는 DataFrame 형식(Open/High/Low/Close/Volume/Change)을 제대로 읽는지."""
    pd = pytest.importorskip("pandas")
    fdr = pytest.importorskip("FinanceDataReader")
    from app.services.market import fdr_fetcher

    df = pd.DataFrame(
        {"Open": [100, 101, None], "High": [102, 103, None], "Low": [99, 100, None],
         "Close": [101, 102, None], "Volume": [10, 20, None], "Change": [0.0, 0.0099, None]},
        index=pd.to_datetime(["2026-10-08", "2026-10-09", "2026-10-10"]),
    )
    monkeypatch.setattr(fdr, "DataReader", lambda *a, **k: df)
    rows = fdr_fetcher("005930", date(2026, 10, 1), TODAY)
    assert len(rows) == 2  # NaN 행은 건너뜀
    assert rows[1] == {"date": date(2026, 10, 9), "open": 101.0, "high": 103.0, "low": 100.0, "close": 102.0, "volume": 20.0}

    monkeypatch.setattr(fdr, "DataReader", lambda *a, **k: pd.DataFrame())
    with pytest.raises(PriceFetchError):
        fdr_fetcher("999999", date(2026, 10, 1), TODAY)
