# 📈 내주식관리앱 (my-stock-manager)

> 배당금, 단타 수익, 장기투자 평가액, 이자 수익을 한 곳에서 관리하고
> 보유 종목 뉴스와 포트폴리오 적정성 진단까지 제공하는 개인용 자산관리 앱

![status](https://img.shields.io/badge/status-v0.1-blue)
![python](https://img.shields.io/badge/python-3.11+-blue)
![javascript](https://img.shields.io/badge/javascript-Next.js-yellow)
![css](https://img.shields.io/badge/css-Tailwind-purple)
![license](https://img.shields.io/badge/license-MIT-green)

---

## 목차
1. [프로젝트 개요](#1-프로젝트-개요)
2. [주요 기능](#2-주요-기능)
3. [기술 스택](#3-기술-스택)
4. [시스템 구조](#4-시스템-구조)
5. [데이터 모델](#5-데이터-모델)
6. [포트폴리오 적정성 진단 지표](#6-포트폴리오-적정성-진단-지표)
7. [뉴스 연동](#7-뉴스-연동)
8. [디렉토리 구조](#8-디렉토리-구조)
9. [설치 및 실행](#9-설치-및-실행)
10. [로드맵](#10-로드맵)
11. [주의사항](#11-주의사항)

---

## 1. 프로젝트 개요

증권사 앱마다 흩어져 있는 투자 기록을 **목적별(배당 / 단타 / 장기 / 이자)** 로 나눠 관리하기 위한 개인 프로젝트입니다.

| 문제 | 해결 |
|---|---|
| 배당금이 언제, 얼마 들어왔는지 한눈에 보기 어렵다 | 배당 캘린더 + 월별/연별 배당 집계 |
| 단타 수익이 월 단위로 얼마인지 모른다 | 매매 기록 기반 월별 실현손익 리포트 |
| 장기투자 종목의 현재 가치를 매번 계산해야 한다 | 실시간(일별) 시세 연동 평가금액·수익률 |
| 예금·CMA·채권 이자가 투자수익과 섞인다 | 이자 수익 별도 원장 |
| 보유 종목 뉴스를 따로 찾아봐야 한다 | 한국경제·매일경제 뉴스 자동 매칭 |
| 내 포트폴리오가 괜찮은 건지 판단 기준이 없다 | 분산도·변동성·집중도 기반 적정성 점수 |

---

## 2. 주요 기능

### 2.1 💰 배당금 관리
- 종목별 배당 수령 내역 기록 (지급일, 주당배당금, 수량, 세전/세후 금액)
- 배당소득세(15.4%) 자동 계산, 해외주식은 원천징수세율 별도 적용
- 월별·연별 배당 합계 차트, **배당 캘린더**
- 보유 수량 × 예상 DPS 기반 **연간 예상 배당금** 및 배당수익률(Yield on Cost)

### 2.2 ⚡ 단타(단기매매) 수익 정리
- 매수/매도 거래 입력 (또는 증권사 거래내역 CSV 업로드)
- 선입선출(FIFO) 기준 실현손익 계산, 수수료·거래세 반영
- **월별 실현손익 리포트**: 승률, 평균 수익/손실, 손익비, 최대 연속 손실
- 종목별·월별 히트맵

### 2.3 🏦 장기투자 자산 평가
- 장기 보유 종목을 별도 계좌(버킷)로 분리
- 일별 종가 연동으로 **현재 평가금액, 평가손익, 수익률** 자동 계산
- 평균 매수단가 추적 (추가매수 시 자동 갱신)
- 원화 환산 (해외주식은 환율 반영)
- 자산 추이 그래프 (일/주/월)

### 2.4 🏧 이자 수익 관리
- 예금, 적금, CMA, 파킹통장, 채권 이자를 **투자수익과 분리** 기록
- 이자소득세 자동 계산
- 월별 이자 수익 집계, 상품별 수익률 비교

### 2.5 📰 보유 종목 뉴스
- 한국경제·매일경제 RSS 피드 수집
- 보유 종목명·티커 기반 뉴스 자동 매칭
- 종목별 뉴스 타임라인, 대시보드에 최신 뉴스 요약
- 기사 원문은 **링크로 연결** (제목·요약만 표시)

### 2.6 📊 포트폴리오 적정성 진단
- 자산 배분 현황 (종목 / 섹터 / 국가 / 자산군)
- 분산도·집중도·변동성·위험조정수익률 지표 계산
- 목표 비중 대비 괴리 및 **리밸런싱 제안**
- 종합 적정성 점수 (0–100) + 항목별 코멘트
- 자세한 지표는 [6장](#6-포트폴리오-적정성-진단-지표) 참고

### 2.7 🖥️ 통합 대시보드
- 총자산, 이번 달 배당·단타·이자 수익 요약 카드
- 자산 구성 도넛 차트, 월별 수익 스택 바 차트
- 오늘의 보유 종목 뉴스

---

## 3. 기술 스택

| 구분 | 선택 | 비고 |
|---|---|---|
| Frontend | **Next.js (React) + JavaScript** | 반응형 웹, 추후 PWA로 모바일 설치 |
| UI / 차트 | Tailwind CSS, shadcn/ui, Recharts | |
| Backend | **FastAPI (Python)** | 포트폴리오 분석을 pandas/numpy로 처리 |
| DB | SQLite (개발) → PostgreSQL (배포) | ORM: SQLAlchemy + Alembic |
| 국내 시세 | `pykrx`, `FinanceDataReader` | KRX 종가·배당 정보 |
| 해외 시세 | `yfinance` | 미국 주식, 환율 |
| 뉴스 | `feedparser` (RSS) | 한국경제·매일경제 |
| 스케줄러 | APScheduler | 장 마감 후 시세·뉴스 갱신 |
| 인증 | JWT | 개인용이므로 단일 사용자로 시작 |
| 배포 | Vercel (FE) + Render/Fly.io (BE) | Docker Compose로 로컬 통합 실행 |

### 언어 역할 분담 (Python + JavaScript + CSS)

| 언어 | 담당 영역 | 이유 |
|---|---|---|
| **Python** | 백엔드 API, 시세·뉴스 수집, 손익 계산, 포트폴리오 분석 | 데이터 처리·통계 로직이 핵심이고 pandas/numpy 생태계 활용 |
| **JavaScript** | 화면 동작, 차트, 입력 폼, 백엔드 API 호출 | 브라우저에서 동작하는 언어라 웹 화면은 JS가 표준 |
| **CSS** | 레이아웃, 색상·폰트, 반응형(모바일) 디자인, 다크 모드 | 화면의 모양과 배치를 담당 (Tailwind CSS + 전역 스타일 `globals.css`) |

- 두 영역은 **REST API(JSON)** 로만 통신하므로, 계산 로직은 전부 Python에 두고 JS는 받아서 보여주기만 합니다.
- 바이브코딩 시 프롬프트도 `backend/`(Python)와 `frontend/`(JS)로 나눠 요청하면 컨텍스트가 섞이지 않습니다.
- 타입 안정성이 필요해지면 추후 TypeScript로 점진 전환 가능합니다.

---

## 4. 시스템 구조

```
┌──────────────────────┐        ┌───────────────────────────────┐
│   Next.js Frontend   │  REST  │        FastAPI Backend         │
│  - 대시보드           │◀──────▶│  /holdings  /trades  /dividends│
│  - 거래·배당·이자 입력 │        │  /interest  /news  /analysis   │
│  - 분석 리포트        │        └──────┬───────────┬────────────┘
└──────────────────────┘               │           │
                                       ▼           ▼
                              ┌──────────────┐ ┌──────────────────┐
                              │  PostgreSQL  │ │  Scheduler (APS) │
                              └──────────────┘ │ - 시세 수집       │
                                               │ - 배당 일정 수집  │
                                               │ - RSS 뉴스 수집   │
                                               └────────┬─────────┘
                                                        ▼
                                  pykrx / FinanceDataReader / yfinance / RSS
```

---

## 5. 데이터 모델

| 테이블 | 주요 컬럼 |
|---|---|
| `accounts` | id, name, broker, type (`LONG_TERM` / `TRADING` / `DIVIDEND` / `SAVINGS`) |
| `securities` | ticker, name, market (`KOSPI`/`KOSDAQ`/`NASDAQ`/…), sector, currency |
| `trades` | id, account_id, ticker, side (`BUY`/`SELL`), qty, price, fee, tax, traded_at |
| `holdings` | account_id, ticker, qty, avg_price *(trades로부터 파생 · 캐시)* |
| `dividends` | id, account_id, ticker, pay_date, dps, qty, gross, tax, net |
| `interest` | id, product_name, product_type, pay_date, gross, tax, net |
| `prices` | ticker, date, close *(일별 종가 캐시)* |
| `news` | id, source, title, url, published_at, summary |
| `news_securities` | news_id, ticker *(뉴스–종목 매칭)* |
| `target_allocations` | account_id, category, target_weight |

---

## 6. 포트폴리오 적정성 진단 지표

"적정한 포트폴리오"에 정답은 없으므로, **측정 가능한 지표 + 사용자가 정한 목표 비중**을 기준으로 진단합니다.

### 6.1 분산·집중도
- **종목 집중도 (HHI)**: $HHI = \sum_i w_i^2$ — 0에 가까울수록 분산, 1이면 단일 종목
- **유효 종목 수**: $N_{eff} = 1 / HHI$
- **최대 단일 종목 비중**, 섹터·국가별 비중

### 6.2 위험
- **연환산 변동성**: $\sigma_p = \sqrt{w^\top \Sigma w} \cdot \sqrt{252}$ (일별 수익률 기반)
- **최대 낙폭 (MDD)**
- **보유 종목 간 상관행렬** — 평균 상관이 높으면 분산 효과 낮음
- **베타**: KOSPI / S&P500 대비

### 6.3 성과
- 기간 수익률, 연환산 수익률 (CAGR)
- **샤프 비율**: $(R_p - R_f)/\sigma_p$, 무위험수익률은 국고채 3년 금리 사용
- 벤치마크 대비 초과수익

### 6.4 현금흐름
- 포트폴리오 배당수익률, 월평균 배당·이자 현금흐름

### 6.5 종합 점수 (초안)
| 항목 | 가중치 | 기준 |
|---|---|---|
| 분산도 | 30% | $N_{eff}$, 최대 비중 |
| 위험 | 25% | 변동성, MDD |
| 목표 비중 괴리 | 25% | $\sum_i \lvert w_i - w_i^{target} \rvert$ |
| 위험조정성과 | 20% | 샤프 비율 |

> 가중치와 기준값은 설정에서 조정 가능하도록 설계합니다.

---

## 7. 뉴스 연동

- **수집 방식**: 한국경제·매일경제에서 공개 제공하는 **RSS 피드**를 주기적으로 수집
- **매칭 방식**
  1. 1차: 기사 제목·요약에 종목명 / 약칭 / 티커 포함 여부 (사전 기반)
  2. 2차 (확장): 형태소 분석(Kiwi 등)으로 오탐 감소
- **표시 범위**: 제목, 발행시각, 출처, RSS에서 제공하는 요약까지만 저장·표시하고 **본문은 원문 링크로 이동**
- **확장 아이디어**: 기사 감성 점수(긍정/부정)를 종목별로 집계해 대시보드에 표시

---

## 8. 디렉토리 구조

```
my-stock-manager/
├── README.md
├── docker-compose.yml
├── .env.example
├── frontend/                 # Next.js
│   ├── app/
│   │   ├── dashboard/
│   │   ├── dividends/
│   │   ├── trading/
│   │   ├── long-term/
│   │   ├── interest/
│   │   ├── news/
│   │   └── analysis/
│   ├── components/
│   ├── styles/
│   │   └── globals.css       # 전역 스타일, 색상 변수, 다크 모드
│   └── lib/api.js            # 백엔드 호출 함수 모음
└── backend/                  # FastAPI
    ├── app/
    │   ├── main.py           # 앱 진입점, 라우터 등록, CORS
    │   ├── database.py       # DB 연결 (.env의 DATABASE_URL)
    │   ├── models.py         # SQLAlchemy 테이블
    │   ├── schemas.py        # Pydantic 입출력·검증
    │   ├── api/
    │   │   ├── accounts.py   # 계좌 CRUD
    │   │   ├── trades.py     # 거래 CRUD + 초과매도 검증
    │   │   ├── income.py     # 배당·이자 CRUD + 세금 계산
    │   │   └── reports.py    # 보유 종목, 월별 리포트
    │   └── services/
    │       ├── pnl.py        # FIFO 실현손익·보유 종목
    │       ├── income.py     # 세금 계산, 월별 집계
    │       ├── valuation.py  # (v0.2) 평가금액
    │       ├── analysis.py   # (v0.5) 포트폴리오 진단
    │       ├── market.py     # (v0.2) 시세 수집
    │       └── news.py       # (v0.4) RSS 수집·매칭
    ├── tests/                # pytest
    └── requirements.txt
```

---

## 9. 설치 및 실행

### 사전 요구사항
- Python 3.11+, Node.js 20+, (선택) Docker

### 환경 변수
```bash
cp .env.example .env
# DATABASE_URL, JWT_SECRET 등 설정
```

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload    # http://localhost:8000/docs
pytest                           # 테스트 실행
```
처음 실행하면 `backend/stock.db`(SQLite)가 자동 생성됩니다. 이 파일에 실제 거래 기록이 저장되며 `.gitignore`로 깃허브에는 올라가지 않습니다.

### API (v0.1)
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET/POST | `/accounts` | 계좌 목록 / 추가 (`PUT`, `DELETE /accounts/{id}`) |
| GET/POST | `/trades` | 거래 목록(계좌·종목·기간 필터) / 추가 — 보유보다 많이 팔면 400 |
| GET/POST | `/dividends` | 배당 목록 / 추가 — 세전·세금(기본 15.4%)·세후 자동 계산 |
| GET/POST | `/interest` | 이자 목록 / 추가 — 비과세는 `tax_rate: 0` |
| GET | `/holdings` | 거래 기록으로 계산한 현재 보유 수량·평균단가 |
| GET | `/reports/trading/monthly` | 월별 실현손익, 승률, 평균 수익/손실, 손익비 |
| GET | `/reports/dividends/monthly` | 월별 배당 합계 (`?currency=USD`로 통화별 조회) |
| GET | `/reports/interest/monthly` | 월별 이자 합계 |

`http://localhost:8000/docs`에서 모든 API를 브라우저로 직접 실행해 볼 수 있습니다.

### Frontend
```bash
cd frontend
npm install
npm run dev                      # http://localhost:3000
```

### Docker (통합 실행)
```bash
docker compose up --build
```

---

## 10. 로드맵

- [x] **v0.1 — 기록**: 계좌·거래·배당·이자 CRUD, 보유 종목 자동 계산, 월별 실현손익·배당·이자 API
- [ ] **v0.2 — 평가**: 일별 시세 연동, 장기투자 평가금액·수익률
- [ ] **v0.3 — 리포트**: 월별 단타 실현손익, 월별 배당·이자 집계, 대시보드
- [ ] **v0.4 — 뉴스**: 한국경제·매일경제 RSS 수집 및 종목 매칭
- [ ] **v0.5 — 진단**: 포트폴리오 적정성 지표·점수·리밸런싱 제안
- [ ] **v0.6 — 편의**: 증권사 CSV 가져오기, 배당 캘린더, PWA 모바일 설치
- [ ] **v1.0 — 확장**: 뉴스 감성 분석, 알림(배당 입금·급등락), 다중 사용자

---

## 11. 주의사항

- 본 앱은 **개인 기록·분석용**이며 투자 권유나 자문을 제공하지 않습니다.
- 시세 데이터는 무료 라이브러리 기반으로 지연·누락이 있을 수 있습니다.
- 뉴스는 각 언론사의 RSS 이용 조건을 따르며, 기사 저작권은 해당 언론사에 있습니다.
- 계좌 정보 등 민감 데이터는 `.env`와 DB에만 저장하고 저장소에 커밋하지 않습니다.

---

## License
MIT
