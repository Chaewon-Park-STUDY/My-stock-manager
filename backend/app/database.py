"""DB 연결 설정. 기본값은 SQLite 파일(backend/stock.db), .env의 DATABASE_URL로 변경 가능."""
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()  # 프로젝트 루트의 .env를 읽는다 (없으면 기본값 사용)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./stock.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """요청마다 DB 세션을 열고, 끝나면 닫는다 (FastAPI Depends용)."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
