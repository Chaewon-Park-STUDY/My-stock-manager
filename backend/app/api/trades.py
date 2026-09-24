from datetime import date
from types import SimpleNamespace

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Trade
from ..schemas import TradeIn, TradeOut
from ..services.pnl import OversellError, run_fifo
from .accounts import get_account_or_404

router = APIRouter(prefix="/trades", tags=["거래"])


def _ensure_valid_history(db: Session, account_id: int, ticker: str, *, replace_id=None, add=None):
    """변경을 적용했을 때 어느 시점에도 보유 수량보다 많이 판 적이 없는지 확인한다.

    과거 날짜로 매도를 넣거나, 매수 기록을 지우는 경우에도 이후 매도가 깨지지 않게 막는다.
    """
    rows = db.scalars(
        select(Trade).where(Trade.account_id == account_id, Trade.ticker == ticker)
    ).all()
    history = [t for t in rows if t.id != replace_id]
    if add is not None:
        history.append(add)
    try:
        run_fifo(history)
    except OversellError as e:
        raise HTTPException(400, str(e))


@router.get("", response_model=list[TradeOut])
def list_trades(
    account_id: int | None = None,
    ticker: str | None = None,
    start: date | None = None,
    end: date | None = None,
    db: Session = Depends(get_db),
):
    q = select(Trade)
    if account_id is not None:
        q = q.where(Trade.account_id == account_id)
    if ticker:
        q = q.where(Trade.ticker == ticker)
    if start:
        q = q.where(Trade.traded_at >= start)
    if end:
        q = q.where(Trade.traded_at <= end)
    return db.scalars(q.order_by(Trade.traded_at, Trade.id)).all()


@router.post("", response_model=TradeOut, status_code=201)
def create_trade(body: TradeIn, db: Session = Depends(get_db)):
    get_account_or_404(db, body.account_id)
    data = body.model_dump(mode="python")
    data["side"] = body.side.value
    # id가 없는 새 거래는 같은 날짜 안에서 가장 마지막으로 처리되도록 큰 값을 준다
    _ensure_valid_history(db, body.account_id, body.ticker, add=SimpleNamespace(id=10**12, **data))
    trade = Trade(**data)
    db.add(trade)
    db.commit()
    db.refresh(trade)
    return trade


@router.put("/{trade_id}", response_model=TradeOut)
def update_trade(trade_id: int, body: TradeIn, db: Session = Depends(get_db)):
    trade = db.get(Trade, trade_id)
    if trade is None:
        raise HTTPException(404, f"거래 {trade_id}를 찾을 수 없습니다")
    get_account_or_404(db, body.account_id)
    data = body.model_dump(mode="python")
    data["side"] = body.side.value

    # 종목/계좌가 바뀌면 옛 이력(이 거래 제외)과 새 이력(이 거래 포함)을 모두 검사
    _ensure_valid_history(db, trade.account_id, trade.ticker, replace_id=trade_id)
    _ensure_valid_history(
        db, body.account_id, body.ticker, replace_id=trade_id, add=SimpleNamespace(id=trade_id, **data)
    )
    for k, v in data.items():
        setattr(trade, k, v)
    db.commit()
    db.refresh(trade)
    return trade


@router.delete("/{trade_id}", status_code=204)
def delete_trade(trade_id: int, db: Session = Depends(get_db)):
    trade = db.get(Trade, trade_id)
    if trade is None:
        raise HTTPException(404, f"거래 {trade_id}를 찾을 수 없습니다")
    _ensure_valid_history(db, trade.account_id, trade.ticker, replace_id=trade_id)
    db.delete(trade)
    db.commit()
