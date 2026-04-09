import random
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import User, UserCard, ReviewLog
from schemas import CardOut, ReviewSubmit, ReviewResult
from sm2 import CardState, calculate_next_review
from config import settings

router = APIRouter(tags=["review"])


def _get_user_or_404(user_id: int, db: Session) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    return user


def _card_to_out(card: UserCard) -> CardOut:
    return CardOut(
        id=card.id,
        word_id=card.word_id,
        word=card.word.word,
        definition=card.word.definition,
        part_of_speech=card.word.part_of_speech,
        example_sentence=card.word.example_sentence,
        easiness_factor=card.easiness_factor,
        interval=card.interval,
        repetitions=card.repetitions,
        next_review=card.next_review,
        total_reviews=card.total_reviews,
        correct_reviews=card.correct_reviews,
    )


@router.get("/users/{user_id}/review/session", response_model=list[CardOut])
def get_review_session(user_id: int, db: Session = Depends(get_db)):
    """Return today's review queue (up to daily limit), shuffled."""
    _get_user_or_404(user_id, db)

    today = date.today()
    cards = (
        db.query(UserCard)
        .options(joinedload(UserCard.word))
        .filter(UserCard.user_id == user_id, UserCard.next_review <= today)
        .limit(settings.daily_review_limit)
        .all()
    )
    random.shuffle(cards)
    return [_card_to_out(c) for c in cards]


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

    log = ReviewLog(
        user_id=user_id,
        word_id=card.word_id,
        quality=body.quality,
        interval_before=interval_before,
        interval_after=new_state.interval,
        ef_before=ef_before,
        ef_after=new_state.easiness_factor,
    )
    db.add(log)
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
