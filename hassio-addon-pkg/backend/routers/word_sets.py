from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import User, UserCard, Word, WordSet, WordSetCard
from schemas import WordSetCreate, WordSetOut, CardOut
from routers.cards import card_to_out

router = APIRouter(tags=["word_sets"])


def _get_user_or_404(user_id: int, db: Session) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    return user


def _get_set_or_404(user_id: int, set_id: int, db: Session) -> WordSet:
    ws = db.query(WordSet).filter(WordSet.id == set_id, WordSet.user_id == user_id).first()
    if not ws:
        raise HTTPException(404, "Word set not found")
    return ws


def _set_to_out(ws: WordSet, db: Session) -> WordSetOut:
    count = db.query(WordSetCard).filter(WordSetCard.word_set_id == ws.id).count()
    return WordSetOut(
        id=ws.id,
        user_id=ws.user_id,
        name=ws.name,
        week_start=ws.week_start,
        created_at=ws.created_at,
        card_count=count,
    )


# --- Word Set CRUD ---

@router.get("/users/{user_id}/word-sets", response_model=list[WordSetOut])
def list_word_sets(user_id: int, db: Session = Depends(get_db)):
    _get_user_or_404(user_id, db)
    sets = (
        db.query(WordSet)
        .filter(WordSet.user_id == user_id)
        .order_by(WordSet.week_start.desc(), WordSet.created_at.desc())
        .all()
    )
    return [_set_to_out(ws, db) for ws in sets]


@router.post("/users/{user_id}/word-sets", response_model=WordSetOut, status_code=201)
def create_word_set(user_id: int, body: WordSetCreate, db: Session = Depends(get_db)):
    _get_user_or_404(user_id, db)
    ws = WordSet(user_id=user_id, name=body.name, week_start=body.week_start)
    db.add(ws)
    db.commit()
    db.refresh(ws)
    return _set_to_out(ws, db)


@router.delete("/users/{user_id}/word-sets/{set_id}", status_code=204)
def delete_word_set(user_id: int, set_id: int, db: Session = Depends(get_db)):
    ws = _get_set_or_404(user_id, set_id, db)
    db.delete(ws)
    db.commit()


# --- Word Set Cards ---

@router.get("/users/{user_id}/word-sets/{set_id}/cards", response_model=list[CardOut])
def get_set_cards(user_id: int, set_id: int, db: Session = Depends(get_db)):
    _get_set_or_404(user_id, set_id, db)
    set_card_word_ids = [
        sc.word_id for sc in
        db.query(WordSetCard).filter(WordSetCard.word_set_id == set_id).all()
    ]
    if not set_card_word_ids:
        return []

    cards = (
        db.query(UserCard)
        .options(joinedload(UserCard.word))
        .filter(UserCard.user_id == user_id, UserCard.word_id.in_(set_card_word_ids))
        .all()
    )
    return [card_to_out(c) for c in cards]


@router.post("/users/{user_id}/word-sets/{set_id}/cards", status_code=200)
def add_cards_to_set(
    user_id: int,
    set_id: int,
    word_ids: list[int],
    db: Session = Depends(get_db),
):
    _get_set_or_404(user_id, set_id, db)

    # word_id들이 사용자 덱에 있는지 확인
    valid_word_ids = {
        c.word_id for c in
        db.query(UserCard).filter(UserCard.user_id == user_id, UserCard.word_id.in_(word_ids)).all()
    }

    added = 0
    for word_id in valid_word_ids:
        existing = db.query(WordSetCard).filter(
            WordSetCard.word_set_id == set_id, WordSetCard.word_id == word_id
        ).first()
        if not existing:
            db.add(WordSetCard(word_set_id=set_id, word_id=word_id))
            added += 1

    db.commit()
    return {"added": added}


@router.delete("/users/{user_id}/word-sets/{set_id}/cards/{word_id}", status_code=204)
def remove_card_from_set(user_id: int, set_id: int, word_id: int, db: Session = Depends(get_db)):
    _get_set_or_404(user_id, set_id, db)
    sc = db.query(WordSetCard).filter(
        WordSetCard.word_set_id == set_id, WordSetCard.word_id == word_id
    ).first()
    if not sc:
        raise HTTPException(404, "Card not in set")
    db.delete(sc)
    db.commit()
