"""API 통합 테스트: 메모리 DB에 실제로 요청을 보내 확인한다."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine, autoflush=False)

    def override():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override
    yield TestClient(app)
    app.dependency_overrides.clear()


def make_account(client, type_="TRADING", name="단타계좌"):
    r = client.post("/accounts", json={"name": name, "broker": "키움증권", "type": type_})
    assert r.status_code == 201
    return r.json()["id"]


def trade(client, acc, side, qty, price, d, **kw):
    return client.post("/trades", json={
        "account_id": acc, "ticker": kw.pop("ticker", "005930"), "name": "삼성전자",
        "side": side, "qty": qty, "price": price, "traded_at": d, **kw,
    })


def test_trading_flow_holdings_and_monthly_report(client):
    acc = make_account(client)
    assert trade(client, acc, "BUY", 10, 70_000, "2026-09-01", fee=105).status_code == 201
    assert trade(client, acc, "SELL", 4, 72_000, "2026-09-10", fee=43, tax=518).status_code == 201

    [h] = client.get("/holdings").json()
    assert h["qty"] == 6 and h["name"] == "삼성전자"
    assert h["avg_price"] == pytest.approx(70_010.5)

    [m] = client.get("/reports/trading/monthly").json()
    # 매도대금 288,000 - 43 - 518 = 287,439 / 원가 4 × 70,010.5 = 280,042
    assert m["month"] == "2026-09"
    assert m["realized_pnl"] == pytest.approx(7_397)


def test_oversell_is_rejected_with_400(client):
    acc = make_account(client)
    trade(client, acc, "BUY", 5, 1000, "2026-09-01")
    r = trade(client, acc, "SELL", 6, 1000, "2026-09-02")
    assert r.status_code == 400
    assert "보유 수량" in r.json()["detail"]


def test_deleting_buy_that_later_sell_depends_on_is_rejected(client):
    acc = make_account(client)
    buy_id = trade(client, acc, "BUY", 5, 1000, "2026-09-01").json()["id"]
    trade(client, acc, "SELL", 5, 1100, "2026-09-02")
    assert client.delete(f"/trades/{buy_id}").status_code == 400


def test_long_term_account_excluded_from_default_trading_report(client):
    long_acc = make_account(client, "LONG_TERM", "장기계좌")
    trade(client, long_acc, "BUY", 1, 100, "2026-09-01")
    trade(client, long_acc, "SELL", 1, 200, "2026-09-02")
    assert client.get("/reports/trading/monthly").json() == []
    assert client.get(f"/reports/trading/monthly?account_id={long_acc}").json()[0]["realized_pnl"] == 100


def test_dividend_tax_and_monthly(client):
    acc = make_account(client, "DIVIDEND", "배당계좌")
    r = client.post("/dividends", json={
        "account_id": acc, "ticker": "005930", "pay_date": "2026-08-20", "dps": 361, "qty": 100,
    })
    assert r.status_code == 201
    d = r.json()
    assert (d["gross"], d["tax"], d["net"]) == (36_100, 5_559, 30_541)

    client.post("/dividends", json={
        "account_id": acc, "ticker": "SCHD", "pay_date": "2026-08-28", "dps": 0.25,
        "qty": 40, "currency": "USD", "tax_rate": 0.15,
    })
    [krw] = client.get("/reports/dividends/monthly").json()
    [usd] = client.get("/reports/dividends/monthly?currency=USD").json()
    assert krw["net"] == 30_541 and krw["count"] == 1
    assert usd["gross"] == 10.0 and usd["tax"] == 1.5


def test_interest_crud_and_monthly(client):
    r = client.post("/interest", json={
        "product_name": "파킹통장", "product_type": "PARKING", "pay_date": "2026-09-01", "gross": 12_345,
    })
    iid = r.json()["id"]
    assert r.json()["net"] == 10_444

    client.put(f"/interest/{iid}", json={
        "product_name": "파킹통장", "product_type": "PARKING", "pay_date": "2026-09-01",
        "gross": 10_000, "tax_rate": 0,
    })
    [m] = client.get("/reports/interest/monthly").json()
    assert m["net"] == 10_000 and m["tax"] == 0

    assert client.delete(f"/interest/{iid}").status_code == 204
    assert client.get("/interest").json() == []


def test_validation_errors(client):
    acc = make_account(client)
    assert trade(client, acc, "BUY", -1, 1000, "2026-09-01").status_code == 422
    assert trade(client, 999, "BUY", 1, 1000, "2026-09-01").status_code == 404
    assert client.post("/accounts", json={"name": "x", "type": "WRONG"}).status_code == 422
