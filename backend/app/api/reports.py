"""보유 종목과 월별 리포트 API."""
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Account, Dividend, Interest, Trade
from ..schemas import AccountType, Holding, IncomeMonth, TradingMonth
from ..services.income import monthly_income
from ..services.pnl import holdings, monthly_trading_report

router = APIRouter(tags=["리포트"])


def _trades(db: Session, account_id: int | None, account_type: AccountType | None):
    q = select(Trade)
    if account_id is not None:
        q = q.where(Trade.account_id == account_id)
    if account_type is not None:
        q = q.join(Account).where(Account.type == account_type.value)
    return db.scalars(q).all()


@router.get("/holdings", response_model=list[Holding])
def get_holdings(
    account_id: int | None = None, account_type: AccountType | None = None,
    db: Session = Depends(get_db),
):
    """거래 기록으로 계산한 현재 보유 종목. (현재가·평가금액은 v0.2에서 추가)"""
    return holdings(_trades(db, account_id, account_type))


@router.get("/reports/trading/monthly", response_model=list[TradingMonth])
def trading_monthly(
    account_id: int | None = None,
    account_type: AccountType | None = None,
    db: Session = Depends(get_db),
):
    """월별 실현손익. 계좌를 지정하지 않으면 TRADING(단타) 계좌만 집계."""
    if account_id is None and account_type is None:
        account_type = AccountType.TRADING
    return monthly_trading_report(_trades(db, account_id, account_type))


@router.get("/reports/dividends/monthly", response_model=list[IncomeMonth])
def dividends_monthly(
    currency: str = "KRW", account_id: int | None = None,
    start: date | None = None, end: date | None = None, db: Session = Depends(get_db),
):
    """월별 배당 합계. 원화·달러가 섞이지 않도록 통화별로 조회."""
    q = select(Dividend).where(Dividend.currency == currency.upper())
    if account_id is not None:
        q = q.where(Dividend.account_id == account_id)
    if start:
        q = q.where(Dividend.pay_date >= start)
    if end:
        q = q.where(Dividend.pay_date <= end)
    return monthly_income(db.scalars(q).all())


@router.get("/reports/interest/monthly", response_model=list[IncomeMonth])
def interest_monthly(
    start: date | None = None, end: date | None = None, db: Session = Depends(get_db),
):
    q = select(Interest)
    if start:
        q = q.where(Interest.pay_date >= start)
    if end:
        q = q.where(Interest.pay_date <= end)
    return monthly_income(db.scalars(q).all())
