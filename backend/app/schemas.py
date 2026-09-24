"""API 입출력 형식 (Pydantic). 입력값 검증도 여기서 한다."""
from datetime import date
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field

# 한국 배당·이자소득세: 소득세 14% + 지방소득세 1.4%
DEFAULT_TAX_RATE = 0.154


class AccountType(str, Enum):
    LONG_TERM = "LONG_TERM"
    TRADING = "TRADING"
    DIVIDEND = "DIVIDEND"
    SAVINGS = "SAVINGS"


class Side(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


class ProductType(str, Enum):
    DEPOSIT = "DEPOSIT"      # 예금
    SAVINGS = "SAVINGS"      # 적금
    CMA = "CMA"
    PARKING = "PARKING"      # 파킹통장
    BOND = "BOND"            # 채권
    OTHER = "OTHER"


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- 계좌 ----------
class AccountIn(BaseModel):
    name: str = Field(min_length=1, max_length=50, examples=["키움 단타계좌"])
    broker: str | None = Field(default=None, examples=["키움증권"])
    type: AccountType


class AccountOut(ORM, AccountIn):
    id: int


# ---------- 거래 ----------
class TradeIn(BaseModel):
    account_id: int
    ticker: str = Field(min_length=1, max_length=20, examples=["005930"])
    name: str | None = Field(default=None, examples=["삼성전자"])
    side: Side
    qty: float = Field(gt=0)
    price: float = Field(gt=0)
    fee: float = Field(default=0, ge=0)
    tax: float = Field(default=0, ge=0)
    traded_at: date


class TradeOut(ORM, TradeIn):
    id: int


# ---------- 배당 ----------
class DividendIn(BaseModel):
    account_id: int
    ticker: str = Field(min_length=1, max_length=20)
    name: str | None = None
    pay_date: date
    dps: float = Field(gt=0, description="주당 배당금")
    qty: float = Field(gt=0)
    currency: str = Field(default="KRW", min_length=3, max_length=3)
    tax_rate: float = Field(default=DEFAULT_TAX_RATE, ge=0, lt=1, description="원천징수세율 (미국주식은 0.15)")
    tax: float | None = Field(default=None, ge=0, description="증권사 명세의 실제 세액. 입력하면 tax_rate 대신 사용")


class DividendOut(ORM):
    id: int
    account_id: int
    ticker: str
    name: str | None
    pay_date: date
    dps: float
    qty: float
    currency: str
    gross: float
    tax: float
    net: float


# ---------- 이자 ----------
class InterestIn(BaseModel):
    product_name: str = Field(min_length=1, max_length=50, examples=["토스뱅크 파킹통장"])
    product_type: ProductType
    pay_date: date
    gross: float = Field(gt=0, description="세전 이자")
    tax_rate: float = Field(default=DEFAULT_TAX_RATE, ge=0, lt=1, description="비과세 상품은 0")
    tax: float | None = Field(default=None, ge=0, description="실제 세액. 입력하면 tax_rate 대신 사용")


class InterestOut(ORM):
    id: int
    product_name: str
    product_type: str
    pay_date: date
    gross: float
    tax: float
    net: float


# ---------- 리포트 ----------
class Holding(BaseModel):
    account_id: int
    ticker: str
    name: str | None
    qty: float
    avg_price: float = Field(description="수수료 포함 평균 매수단가")
    total_cost: float


class TradingMonth(BaseModel):
    month: str  # "2026-09"
    realized_pnl: float
    sell_count: int
    wins: int
    losses: int
    win_rate: float | None
    avg_win: float | None
    avg_loss: float | None
    profit_factor: float | None = Field(description="총이익 / 총손실. 손실이 없으면 null")


class IncomeMonth(BaseModel):
    month: str
    gross: float
    tax: float
    net: float
    count: int
