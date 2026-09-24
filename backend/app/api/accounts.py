from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Account
from ..schemas import AccountIn, AccountOut

router = APIRouter(prefix="/accounts", tags=["계좌"])


def get_account_or_404(db: Session, account_id: int) -> Account:
    account = db.get(Account, account_id)
    if account is None:
        raise HTTPException(404, f"계좌 {account_id}를 찾을 수 없습니다")
    return account


@router.get("", response_model=list[AccountOut])
def list_accounts(db: Session = Depends(get_db)):
    return db.scalars(select(Account).order_by(Account.id)).all()


@router.post("", response_model=AccountOut, status_code=201)
def create_account(body: AccountIn, db: Session = Depends(get_db)):
    account = Account(**body.model_dump(mode="json"))
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.put("/{account_id}", response_model=AccountOut)
def update_account(account_id: int, body: AccountIn, db: Session = Depends(get_db)):
    account = get_account_or_404(db, account_id)
    for k, v in body.model_dump(mode="json").items():
        setattr(account, k, v)
    db.commit()
    db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=204)
def delete_account(account_id: int, db: Session = Depends(get_db)):
    """계좌를 지우면 그 계좌의 거래·배당 기록도 함께 삭제된다."""
    db.delete(get_account_or_404(db, account_id))
    db.commit()
