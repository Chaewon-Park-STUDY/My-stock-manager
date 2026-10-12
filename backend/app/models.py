"""DB 테이블 정의 (SQLAlchemy ORM)."""
import datetime as dt
from datetime import date

from sqlalchemy import Date, Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Account(Base):
    """계좌. type으로 목적을 구분: LONG_TERM(장기) / TRADING(단타) / DIVIDEND(배당) / SAVINGS(예적금)."""

    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50))
    broker: Mapped[str | None] = mapped_column(String(50))
    type: Mapped[str] = mapped_column(String(20))

    trades: Mapped[list["Trade"]] = relationship(back_populates="account", cascade="all, delete-orphan")
    dividends: Mapped[list["Dividend"]] = relationship(back_populates="account", cascade="all, delete-orphan")


class Trade(Base):
    """매수/매도 거래 1건. fee=수수료, tax=거래세(매도 시)."""

    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"))
    ticker: Mapped[str] = mapped_column(String(20), index=True)
    name: Mapped[str | None] = mapped_column(String(50))
    side: Mapped[str] = mapped_column(String(4))  # BUY / SELL
    qty: Mapped[float] = mapped_column(Float)
    price: Mapped[float] = mapped_column(Float)
    fee: Mapped[float] = mapped_column(Float, default=0)
    tax: Mapped[float] = mapped_column(Float, default=0)
    traded_at: Mapped[date] = mapped_column(Date, index=True)

    account: Mapped[Account] = relationship(back_populates="trades")


class Dividend(Base):
    """배당 수령 1건. gross=세전, tax=원천징수세, net=세후."""

    __tablename__ = "dividends"

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"))
    ticker: Mapped[str] = mapped_column(String(20), index=True)
    name: Mapped[str | None] = mapped_column(String(50))
    pay_date: Mapped[date] = mapped_column(Date, index=True)
    dps: Mapped[float] = mapped_column(Float)
    qty: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(3), default="KRW")
    gross: Mapped[float] = mapped_column(Float)
    tax: Mapped[float] = mapped_column(Float)
    net: Mapped[float] = mapped_column(Float)

    account: Mapped[Account] = relationship(back_populates="dividends")


class Interest(Base):
    """이자 수령 1건 (예금·적금·CMA·파킹통장·채권). 투자 계좌와 분리해 기록."""

    __tablename__ = "interest"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_name: Mapped[str] = mapped_column(String(50))
    product_type: Mapped[str] = mapped_column(String(20))
    pay_date: Mapped[date] = mapped_column(Date, index=True)
    gross: Mapped[float] = mapped_column(Float)
    tax: Mapped[float] = mapped_column(Float)
    net: Mapped[float] = mapped_column(Float)


class Price(Base):
    """일봉 시세 캐시. 같은 (종목, 날짜)는 한 줄만."""

    __tablename__ = "prices"
    __table_args__ = (UniqueConstraint("ticker", "date", name="uq_price_ticker_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    ticker: Mapped[str] = mapped_column(String(20), index=True)
    date: Mapped[dt.date] = mapped_column(Date, index=True)
    open: Mapped[float] = mapped_column(Float)
    high: Mapped[float] = mapped_column(Float)
    low: Mapped[float] = mapped_column(Float)
    close: Mapped[float] = mapped_column(Float)
    volume: Mapped[float] = mapped_column(Float, default=0)


class Watch(Base):
    """박스권을 추적할 관심 종목."""

    __tablename__ = "watchlist"

    ticker: Mapped[str] = mapped_column(String(20), primary_key=True)
    name: Mapped[str | None] = mapped_column(String(50))


class Security(Base):
    """상장 종목 목록 (종목명 검색용). 하루 한 번 정도 새로 받아온다."""

    __tablename__ = "securities"

    ticker: Mapped[str] = mapped_column(String(20), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    market: Mapped[str] = mapped_column(String(20))
    marcap: Mapped[float] = mapped_column(Float, default=0)  # 시가총액 (검색 결과 정렬용)
    updated: Mapped[dt.date] = mapped_column(Date)
