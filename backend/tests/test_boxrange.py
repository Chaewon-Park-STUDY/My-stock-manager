"""박스권 탐지 테스트 — 결과를 미리 아는 합성 주가로 검증한다."""
import math
from datetime import date, timedelta
from types import SimpleNamespace

from app.services.boxrange import (
    BoxParams, count_episodes, current_status, detect_boxes, quantile,
)

START = date(2026, 1, 1)


def bars_from_closes(closes, spread=0.005):
    """종가 목록 → 일봉 (고가·저가는 종가 ±0.5%)."""
    return [
        SimpleNamespace(date=START + timedelta(days=k), close=c, high=c * (1 + spread), low=c * (1 - spread))
        for k, c in enumerate(closes)
    ]


def oscillate(n, lo=100, hi=110, period=10):
    """lo~hi 사이를 주기적으로 오르내리는 가격 (박스권)."""
    mid, amp = (lo + hi) / 2, (hi - lo) / 2
    return [mid + amp * math.sin(2 * math.pi * k / period) for k in range(n)]


def trend(n, start, daily):
    return [start * (1 + daily) ** k for k in range(n)]


def test_helpers():
    assert quantile([1, 2, 3, 4, 5], 0.5) == 3
    assert quantile([0, 10], 0.25) == 2.5
    assert count_episodes([True, True, False, True, False, False, True]) == 3


def test_detects_box_then_upward_breakout():
    closes = oscillate(60) + trend(20, 112, 0.01)  # 60일 횡보 후 상승
    boxes = detect_boxes(bars_from_closes(closes))
    assert len(boxes) == 1
    b = boxes[0]
    assert b.start == START
    assert 98 < b.lower < 101 and 109 < b.upper < 112
    assert b.breakout == "UP"
    assert b.breakout_date == START + timedelta(days=60)
    assert b.touches_upper >= 2 and b.touches_lower >= 2


def test_steady_uptrend_is_not_a_box():
    # 20일에 +10% 정도 오르는 추세: 폭은 좁아도 상·하단을 번갈아 닿지 않으므로 박스가 아니다
    assert detect_boxes(bars_from_closes(trend(80, 100, 0.005))) == []


def test_wide_range_is_not_a_box():
    assert detect_boxes(bars_from_closes(oscillate(60, lo=80, hi=120))) == []


def test_single_day_spike_does_not_break_box():
    closes = oscillate(60)
    closes[45] = 116  # 하루만 튐 → confirm_days=2라 돌파 아님
    [b] = detect_boxes(bars_from_closes(closes))
    assert b.breakout is None


def test_downward_breakout_and_status():
    closes = oscillate(40) + trend(5, 97, -0.01)
    bars = bars_from_closes(closes)
    boxes = detect_boxes(bars)
    assert boxes[-1].breakout == "DOWN"
    st = current_status(bars, boxes)
    assert st["state"] == "BROKE_DOWN"
    assert st["days_since"] == 4


def test_status_near_upper_and_lower_and_testing():
    base = oscillate(40)
    bars = bars_from_closes(base + [109.5])
    assert current_status(bars, detect_boxes(bars))["state"] == "NEAR_UPPER"
    bars = bars_from_closes(base + [100.5])
    assert current_status(bars, detect_boxes(bars))["state"] == "NEAR_LOWER"
    bars = bars_from_closes(base + [116])  # 하루 밖 → 아직 확정 아님
    st = current_status(bars, detect_boxes(bars))
    assert st["state"] == "TESTING_UP"


def test_two_boxes_in_sequence():
    closes = oscillate(40, 100, 110) + trend(10, 112, 0.012) + oscillate(40, 125, 135)
    boxes = detect_boxes(bars_from_closes(closes))
    assert len(boxes) == 2
    assert boxes[0].breakout == "UP"
    assert boxes[1].breakout is None and boxes[1].lower > boxes[0].upper


def test_params_are_respected():
    closes = oscillate(60, 100, 116)  # 폭 약 15%
    assert detect_boxes(bars_from_closes(closes)) == []
    assert len(detect_boxes(bars_from_closes(closes), BoxParams(max_width=0.2))) == 1
