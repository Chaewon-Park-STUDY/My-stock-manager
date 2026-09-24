"""내주식관리앱 백엔드 진입점.

실행:  uvicorn app.main:app --reload
문서:  http://localhost:8000/docs  (여기서 API를 바로 눌러볼 수 있음)
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import accounts, income, reports, trades
from .database import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # v0.1은 시작할 때 테이블을 자동 생성. 스키마가 자주 바뀌기 시작하면 Alembic으로 전환.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="내주식관리앱 API", version="0.1.0", lifespan=lifespan)

# 프론트엔드(Next.js, localhost:3000)에서 호출할 수 있도록 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (accounts.router, trades.router, income.router, reports.router):
    app.include_router(r)


@app.get("/health", tags=["상태"])
def health():
    return {"status": "ok"}
