import random
from datetime import date
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import User, UserCard, ReviewLog, WordSetCard
from schemas import CardOut, ReviewSubmit, ReviewResult
from sm2 import CardState, calculate_next_review
from routers.cards import card_to_out
from config import settings

router = APIRouter(tags=["review"])


def _get_user_or_404(user_id: int, db: Session) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    return user


def _get_hard_word_ids(user_id: int, db: Session) -> list[int]:
    """가장 최근 복습에서 quality < 3 (again/hard)이었던 단어들의 word_id 반환."""
    subq = (
        db.query(ReviewLog.word_id, func.max(ReviewLog.reviewed_at).label("max_at"))
        .filter(ReviewLog.user_id == user_id)
        .group_by(ReviewLog.word_id)
        .subquery()
    )
    rows = (
        db.query(ReviewLog.word_id)
        .join(subq, (ReviewLog.word_id == subq.c.word_id) &
              (ReviewLog.reviewed_at == subq.c.max_at))
        .filter(ReviewLog.user_id == user_id, ReviewLog.quality < 3)
        .all()
    )
    return [r.word_id for r in rows]


@router.get("/users/{user_id}/review/session", response_model=list[CardOut])
def get_review_session(
    user_id: int,
    word_set_id: Optional[int] = None,
    mode: str = "scheduled",
    db: Session = Depends(get_db),
):
    """
    복습 카드 반환.
    mode=scheduled: 오늘 예정된 카드만 (기본)
    mode=all: 전체 단어 복습 (날짜 무관)
    mode=hard: 마지막 복습에서 again/hard였던 단어만
    word_set_id 지정 시 해당 세트 단어만.
    """
    _get_user_or_404(user_id, db)
    today = date.today()

    query = (
        db.query(UserCard)
        .options(joinedload(UserCard.word))
        .filter(UserCard.user_id == user_id)
    )

    if mode == "scheduled":
        query = query.filter(UserCard.next_review <= today)
    elif mode == "hard":
        hard_ids = _get_hard_word_ids(user_id, db)
        if not hard_ids:
            return []
        query = query.filter(UserCard.word_id.in_(hard_ids))
    # mode == "all": no date filter

    if word_set_id is not None:
        set_word_ids = [
            sc.word_id for sc in
            db.query(WordSetCard).filter(WordSetCard.word_set_id == word_set_id).all()
        ]
        if not set_word_ids:
            return []
        query = query.filter(UserCard.word_id.in_(set_word_ids))

    cards = query.limit(settings.daily_review_limit).all()
    random.shuffle(cards)
    return [card_to_out(c) for c in cards]


@router.post("/users/{user_id}/review/{card_id}", response_model=ReviewResult)
def submit_review(
    user_id: int,
    card_id: int,
    body: ReviewSubmit,
    db: Session = Depends(get_db),
):
    if not (0 <= body.quality <= 5):
        raise HTTPException(400, "Quality must be 0-5")

    card = (
        db.query(UserCard)
        .options(joinedload(UserCard.word))
        .filter(UserCard.id == card_id, UserCard.user_id == user_id)
        .first()
    )
    if not card:
        raise HTTPException(404, "Card not found")

    state = CardState(
        easiness_factor=card.easiness_factor,
        interval=card.interval,
        repetitions=card.repetitions,
    )
    ef_before = card.easiness_factor
    interval_before = card.interval

    new_state, next_review = calculate_next_review(state, body.quality)

    card.easiness_factor = new_state.easiness_factor
    card.interval = new_state.interval
    card.repetitions = new_state.repetitions
    card.next_review = next_review
    card.last_review = date.today()
    card.total_reviews += 1
    if body.quality >= 3:
        card.correct_reviews += 1

    db.add(ReviewLog(
        user_id=user_id,
        word_id=card.word_id,
        quality=body.quality,
        interval_before=interval_before,
        interval_after=new_state.interval,
        ef_before=ef_before,
        ef_after=new_state.easiness_factor,
    ))
    db.commit()

    return ReviewResult(
        card_id=card.id,
        word=card.word.word,
        quality=body.quality,
        interval_before=interval_before,
        interval_after=new_state.interval,
        ef_before=ef_before,
        ef_after=new_state.easiness_factor,
        next_review=next_review,
    )
