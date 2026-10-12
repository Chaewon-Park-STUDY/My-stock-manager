"""박스권(횡보 구간) 탐지.

정의 (모든 기준은 파라미터로 조정 가능):
1. 형성: 최근 W거래일의 상단 U·하단 L을 고가·저가의 분위수로 잡는다.
   - U = 고가의 q_hi 분위수, L = 저가의 q_lo 분위수 (꼬리 한 번에 박스가 넓어지지 않게)
   - 폭 (U - L) / 중간값 ≤ max_width
   - 상단 근처(U의 touch_tol 이내)와 하단 근처에 각각 min_touches번 이상 "따로" 닿아야 함
     (연속된 날은 1번으로 센다 → 꾸준히 오르기만 하는 추세는 박스로 잡히지 않음)
2. 유지: 형성 이후 종가가 [L(1-ε), U(1+ε)] 안에 있으면 박스가 계속된다.
3. 종료: 종가가 경계 밖에서 confirm_days일 연속 머물면 돌파(UP) 또는 이탈(DOWN)로 확정.

투자 판단용 신호가 아니라, 가격 흐름을 구간으로 요약해 보여주는 기술적 묘사입니다.
"""
from dataclasses import asdict, dataclass, field
from datetime import date
from typing import Protocol, Sequence


class Bar(Protocol):
    date: date
    high: float
    low: float
    close: float


@dataclass(frozen=True)
class BoxParams:
    window: int = 20            # 형성 판단 기간 (거래일)
    max_width: float = 0.12     # 박스 폭 상한 (중간값 대비 12%)
    touch_tol: float = 0.02     # 경계 2% 이내면 "닿았다"
    min_touches: int = 2        # 상단·하단 각각 최소 접촉 횟수
    breakout_eps: float = 0.01  # 경계를 1% 넘어야 밖으로 본다
    confirm_days: int = 2       # 연속 이 일수만큼 밖에 있으면 돌파 확정
    q_hi: float = 0.95
    q_lo: float = 0.05
    recent_days: int = 10       # 돌파 후 이 기간 안이면 "최근 돌파"로 표시


@dataclass
class Box:
    start: date
    end: date                   # 박스 안에 있던 마지막 날
    upper: float
    lower: float
    width: float
    touches_upper: int
    touches_lower: int
    days: int
    breakout: str | None = None         # "UP" / "DOWN" / None(진행 중)
    breakout_date: date | None = None
    _end_idx: int = field(default=0, repr=False)
    _breakout_idx: int | None = field(default=None, repr=False)

    def public(self) -> dict:
        d = asdict(self)
        d.pop("_end_idx")
        d.pop("_breakout_idx")
        return d


def quantile(values: Sequence[float], q: float) -> float:
    """선형 보간 분위수 (numpy의 기본 방식과 동일)."""
    xs = sorted(values)
    pos = (len(xs) - 1) * q
    lo = int(pos)
    hi = min(lo + 1, len(xs) - 1)
    return xs[lo] + (xs[hi] - xs[lo]) * (pos - lo)


def count_episodes(flags: Sequence[bool]) -> int:
    """True가 연속된 구간의 개수. [T,T,F,T] → 2"""
    n, prev = 0, False
    for f in flags:
        if f and not prev:
            n += 1
        prev = f
    return n


def _try_form(bars: Sequence[Bar], i: int, p: BoxParams):
    win = bars[i : i + p.window]
    upper = quantile([b.high for b in win], p.q_hi)
    lower = quantile([b.low for b in win], p.q_lo)
    if upper <= lower:
        return None
    width = (upper - lower) / ((upper + lower) / 2)
    if width > p.max_width:
        return None
    tu = count_episodes([b.high >= upper * (1 - p.touch_tol) for b in win])
    tl = count_episodes([b.low <= lower * (1 + p.touch_tol) for b in win])
    if tu < p.min_touches or tl < p.min_touches:
        return None
    return upper, lower, width, tu, tl


def detect_boxes(bars: Sequence[Bar], p: BoxParams = BoxParams()) -> list[Box]:
    """날짜순으로 정렬된 일봉에서 겹치지 않는 박스 구간들을 찾는다."""
    boxes: list[Box] = []
    n, i = len(bars), 0
    while i + p.window <= n:
        formed = _try_form(bars, i, p)
        if formed is None:
            i += 1
            continue
        upper, lower, width, tu, tl = formed
        hi_line, lo_line = upper * (1 + p.breakout_eps), lower * (1 - p.breakout_eps)

        j, outside, side = i + p.window, 0, None
        breakout_idx = None
        while j < n:
            c = bars[j].close
            now = "UP" if c > hi_line else "DOWN" if c < lo_line else None
            if now is None:
                outside, side = 0, None
            else:
                outside = outside + 1 if now == side else 1
                side = now
                if outside >= p.confirm_days:
                    breakout_idx = j - p.confirm_days + 1  # 처음 밖으로 나간 날
                    break
            j += 1

        end_idx = (breakout_idx - 1) if breakout_idx is not None else n - 1
        # 진행 중인 박스의 마지막 며칠이 "돌파 시도" 중이면 end는 마지막 날로 둔다 (status에서 표시)
        boxes.append(Box(
            start=bars[i].date, end=bars[end_idx].date,
            upper=round(upper, 2), lower=round(lower, 2), width=round(width, 4),
            touches_upper=tu, touches_lower=tl, days=end_idx - i + 1,
            breakout=side if breakout_idx is not None else None,
            breakout_date=bars[breakout_idx].date if breakout_idx is not None else None,
            _end_idx=end_idx, _breakout_idx=breakout_idx,
        ))
        if breakout_idx is None:
            break
        i = breakout_idx  # 돌파한 날부터 다시 새 박스를 찾는다
    return boxes


def current_status(bars: Sequence[Bar], boxes: list[Box], p: BoxParams = BoxParams()) -> dict:
    """가장 최근 종가가 박스 기준으로 어디에 있는지."""
    if not bars:
        return {"state": "NO_DATA", "label": "데이터 없음"}
    last_idx = len(bars) - 1
    close = bars[-1].close
    box = boxes[-1] if boxes else None

    if box is None:
        return {"state": "NO_BOX", "label": "박스권 없음 (추세 구간)", "close": close}

    base = {"close": close, "upper": box.upper, "lower": box.lower, "box_start": box.start}

    if box.breakout is not None:
        since = last_idx - box._breakout_idx
        if since <= p.recent_days:
            up = box.breakout == "UP"
            return {**base, "state": "BROKE_UP" if up else "BROKE_DOWN",
                    "label": f"{'상향 돌파' if up else '하향 이탈'} {since}일째",
                    "days_since": since}
        return {"state": "NO_BOX", "label": "박스권 없음 (추세 구간)", "close": close}

    position = (close - box.lower) / (box.upper - box.lower)
    base["position"] = round(position, 4)
    if close > box.upper * (1 + p.breakout_eps):
        return {**base, "state": "TESTING_UP", "label": "상단 돌파 시도 중"}
    if close < box.lower * (1 - p.breakout_eps):
        return {**base, "state": "TESTING_DOWN", "label": "하단 이탈 시도 중"}
    if position >= 0.8:
        return {**base, "state": "NEAR_UPPER", "label": "박스 상단 근접"}
    if position <= 0.2:
        return {**base, "state": "NEAR_LOWER", "label": "박스 하단 근접"}
    return {**base, "state": "IN_BOX", "label": "박스 중간"}
