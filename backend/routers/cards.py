import json
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import User, Word, UserCard
from schemas import CardOut, DeckStats, WordCreate

router = APIRouter(tags=["cards"])


def _get_user_or_404(user_id: int, db: Session) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    return user


def _parse_json_list(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        return json.loads(value)
    except Exception:
        return []


def card_to_out(card: UserCard) -> CardOut:
    return CardOut(
        id=card.id,
        word_id=card.word_id,
        word=card.word.word,
        definition=card.word.definition,
        part_of_speech=card.word.part_of_speech,
        example_sentence=card.word.example_sentence,
        synonyms=_parse_json_list(card.word.synonyms),
        antonyms=_parse_json_list(card.word.antonyms),
        easiness_factor=card.easiness_factor,
        interval=card.interval,
        repetitions=card.repetitions,
        next_review=card.next_review,
        total_reviews=card.total_reviews,
        correct_reviews=card.correct_reviews,
    )


@router.get("/users/{user_id}/cards", response_model=list[CardOut])
def list_cards(user_id: int, search: str = "", db: Session = Depends(get_db)):
    _get_user_or_404(user_id, db)
    query = (
        db.query(UserCard)
        .options(joinedload(UserCard.word))
        .filter(UserCard.user_id == user_id)
    )
    if search:
        query = query.join(Word).filter(Word.word.ilike(f"%{search}%"))
    cards = query.order_by(UserCard.created_at.desc()).all()
    return [card_to_out(c) for c in cards]


@router.get("/users/{user_id}/cards/stats", response_model=DeckStats)
def get_stats(user_id: int, db: Session = Depends(get_db)):
    _get_user_or_404(user_id, db)
    cards = db.query(UserCard).filter(UserCard.user_id == user_id).all()
    today = date.today()
    return DeckStats(
        total_words=len(cards),
        due_today=sum(1 for c in cards if c.next_review <= today),
        mastered=sum(1 for c in cards if c.repetitions >= 5),
        new_cards=sum(1 for c in cards if c.repetitions == 0),
    )


@router.post("/users/{user_id}/cards", response_model=CardOut, status_code=201)
def add_word_to_deck(user_id: int, body: WordCreate, db: Session = Depends(get_db)):
    _get_user_or_404(user_id, db)

    word_text = body.word.strip().lower()
    word = db.query(Word).filter(Word.word == word_text).first()
    if not word:
        word = Word(
            word=word_text,
            definition=body.definition,
            part_of_speech=body.part_of_speech,
            example_sentence=body.example_sentence,
            synonyms=json.dumps(body.synonyms) if body.synonyms else None,
            antonyms=json.dumps(body.antonyms) if body.antonyms else None,
        )
        db.add(word)
        db.flush()
    else:
        # 기존 단어에 누락된 정보 보완
        if body.synonyms and not word.synonyms:
            word.synonyms = json.dumps(body.synonyms)
        if body.antonyms and not word.antonyms:
            word.antonyms = json.dumps(body.antonyms)

    existing = db.query(UserCard).filter(
        UserCard.user_id == user_id, UserCard.word_id == word.id
    ).first()
    if existing:
        raise HTTPException(400, "Word already in deck")

    card = UserCard(user_id=user_id, word_id=word.id)
    db.add(card)
    db.commit()
    db.refresh(card)
    return card_to_out(card)


@router.delete("/users/{user_id}/cards/{card_id}", status_code=204)
def remove_card(user_id: int, card_id: int, db: Session = Depends(get_db)):
    card = db.query(UserCard).filter(
        UserCard.id == card_id, UserCard.user_id == user_id
    ).first()
    if not card:
        raise HTTPException(404, "Card not found")
    db.delete(card)
    db.commit()
