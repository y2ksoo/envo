"""
SM-2 Spaced Repetition Algorithm
Based on the original SuperMemo SM-2 algorithm.

Quality scores:
  0 = Again  (complete blackout)
  1 = Again  (incorrect, remembered on seeing)
  2 = Hard   (incorrect, easy to recall)
  3 = Hard   (correct with serious difficulty)
  4 = Good   (correct after hesitation)
  5 = Easy   (perfect response)

UI button mapping:
  "Again" → quality 0
  "Hard"  → quality 2
  "Good"  → quality 4
  "Easy"  → quality 5
"""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Tuple


QUALITY_AGAIN = 0
QUALITY_HARD = 2
QUALITY_GOOD = 4
QUALITY_EASY = 5

UI_BUTTONS = {
    "again": QUALITY_AGAIN,
    "hard": QUALITY_HARD,
    "good": QUALITY_GOOD,
    "easy": QUALITY_EASY,
}


@dataclass
class CardState:
    easiness_factor: float  # EF, starts at 2.5, floor 1.3
    interval: int           # days until next review
    repetitions: int        # consecutive correct streak


def calculate_next_review(card: CardState, quality: int) -> Tuple[CardState, date]:
    """
    Apply SM-2 algorithm to a card state given a quality rating.

    Returns updated CardState and the next review date.
    """
    if not (0 <= quality <= 5):
        raise ValueError("Quality must be 0-5")

    new_ef = card.easiness_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ef = max(1.3, new_ef)

    if quality < 3:
        # Failed: reset streak, review again tomorrow
        new_reps = 0
        new_interval = 1
    else:
        if card.repetitions == 0:
            new_interval = 1
        elif card.repetitions == 1:
            new_interval = 6
        else:
            new_interval = round(card.interval * card.easiness_factor)
        new_reps = card.repetitions + 1

    next_date = date.today() + timedelta(days=new_interval)
    updated = CardState(
        easiness_factor=new_ef,
        interval=new_interval,
        repetitions=new_reps,
    )
    return updated, next_date
