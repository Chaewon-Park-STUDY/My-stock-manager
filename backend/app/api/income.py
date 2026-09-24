"""배당금·이자 기록 API."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Dividend, Interest
from ..schemas import DividendIn, DividendOut, InterestIn, InterestOut
from ..services.income import calc_tax
from .accounts import get_account_or_404

router = APIRouter(tags=["배당·이자"])


def _dividend_fields(body: DividendIn) -> dict:
    currency = body.currency.upper()
    gross = body.dps * body.qty
    gross = round(gross) if currency == "KRW" else round(gross, 2)
    try:
        tax, net = calc_tax(gross, body.tax_rate, currency, body.tax)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {
        "account_id": body.account_id, "ticker": body.ticker, "name": body.name,
        "pay_date": body.pay_date, "dps": body.dps, "qty": body.qty,
        "currency": currency, "gross": gross, "tax": tax, "net": net,
    }


def _interest_fields(body: InterestIn) -> dict:
    try:
        tax, net = calc_tax(body.gross, body.tax_rate, "KRW", body.tax)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {
        "product_name": body.product_name, "product_type": body.product_type.value,
        "pay_date": body.pay_date, "gross": body.gross, "tax": tax, "net": net,
    }


# ---------- 배당 ----------
@router.get("/dividends", response_model=list[DividendOut])
def list_dividends(
    account_id: int | None = None, ticker: str | None = None,
    start: date | None = None, end: date | None = None, db: Session = Depends(get_db),
):
    q = select(Dividend)
    if account_id is not None:
        q = q.where(Dividend.account_id == account_id)
    if ticker:
        q = q.where(Dividend.ticker == ticker)
    if start:
        q = q.where(Dividend.pay_date >= start)
    if end:
        q = q.where(Dividend.pay_date <= end)
    return db.scalars(q.order_by(Dividend.pay_date, Dividend.id)).all()


@router.post("/dividends", response_model=DividendOut, status_code=201)
def create_dividend(body: DividendIn, db: Session = Depends(get_db)):
    get_account_or_404(db, body.account_id)
    row = Dividend(**_dividend_fields(body))
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/dividends/{dividend_id}", response_model=DividendOut)
def update_dividend(dividend_id: int, body: DividendIn, db: Session = Depends(get_db)):
    row = db.get(Dividend, dividend_id)
    if row is None:
        raise HTTPException(404, f"배당 기록 {dividend_id}를 찾을 수 없습니다")
    get_account_or_404(db, body.account_id)
    for k, v in _dividend_fields(body).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/dividends/{dividend_id}", status_code=204)
def delete_dividend(dividend_id: int, db: Session = Depends(get_db)):
    row = db.get(Dividend, dividend_id)
    if row is None:
        raise HTTPException(404, f"배당 기록 {dividend_id}를 찾을 수 없습니다")
    db.delete(row)
    db.commit()


# ---------- 이자 ----------
@router.get("/interest", response_model=list[InterestOut])
def list_interest(
    product_type: str | None = None, start: date | None = None, end: date | None = None,
    db: Session = Depends(get_db),
):
    q = select(Interest)
    if product_type:
        q = q.where(Interest.product_type == product_type)
    if start:
        q = q.where(Interest.pay_date >= start)
    if end:
        q = q.where(Interest.pay_date <= end)
    return db.scalars(q.order_by(Interest.pay_date, Interest.id)).all()


@router.post("/interest", response_model=InterestOut, status_code=201)
def create_interest(body: InterestIn, db: Session = Depends(get_db)):
    row = Interest(**_interest_fields(body))
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/interest/{interest_id}", response_model=InterestOut)
def update_interest(interest_id: int, body: InterestIn, db: Session = Depends(get_db)):
    row = db.get(Interest, interest_id)
    if row is None:
        raise HTTPException(404, f"이자 기록 {interest_id}를 찾을 수 없습니다")
    for k, v in _interest_fields(body).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/interest/{interest_id}", status_code=204)
def delete_interest(interest_id: int, db: Session = Depends(get_db)):
    row = db.get(Interest, interest_id)
    if row is None:
        raise HTTPException(404, f"이자 기록 {interest_id}를 찾을 수 없습니다")
    db.delete(row)
    db.commit()
