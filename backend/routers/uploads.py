import os
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, BackgroundTasks
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import Upload, Word, UserCard, User
from schemas import UploadOut, ExtractedWord
import claude_client

router = APIRouter(tags=["uploads"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _get_user_or_404(user_id: int, db: Session) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    return user


def _process_upload(upload_id: int, db_url: str):
    """Background task: run OCR and store extracted words."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        upload = db.query(Upload).filter(Upload.id == upload_id).first()
        if not upload:
            return

        upload.status = "processing"
        db.commit()

        words_data = claude_client.extract_words_from_image(upload.file_path)

        count = 0
        for wd in words_data:
            word_text = wd.get("word", "").strip().lower()
            if not word_text:
                continue
            existing = db.query(Word).filter(Word.word == word_text).first()
            if not existing:
                word = Word(
                    word=word_text,
                    part_of_speech=wd.get("part_of_speech"),
                    definition=wd.get("definition"),
                    example_sentence=wd.get("example_sentence"),
                    source_image_id=upload_id,
                )
                db.add(word)
                count += 1
        db.commit()

        upload.extracted_count = len(words_data)
        upload.status = "done"
        db.commit()
    except Exception as e:
        upload = db.query(Upload).filter(Upload.id == upload_id).first()
        if upload:
            upload.status = "error"
            db.commit()
        raise
    finally:
        db.close()


@router.post("/users/{user_id}/uploads", response_model=UploadOut, status_code=201)
async def upload_image(
    user_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    _get_user_or_404(user_id, db)

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"File type not allowed. Use JPEG, PNG, or WebP.")

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_path = upload_dir / f"user{user_id}_{file.filename}"
    with file_path.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    upload = Upload(
        user_id=user_id,
        filename=file.filename,
        file_path=str(file_path),
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)

    background_tasks.add_task(_process_upload, upload.id, settings.database_url)

    return upload


@router.get("/users/{user_id}/uploads/{upload_id}", response_model=UploadOut)
def get_upload_status(user_id: int, upload_id: int, db: Session = Depends(get_db)):
    upload = db.query(Upload).filter(Upload.id == upload_id, Upload.user_id == user_id).first()
    if not upload:
        raise HTTPException(404, "Upload not found")
    return upload


@router.get("/users/{user_id}/uploads/{upload_id}/words", response_model=list[ExtractedWord])
def get_extracted_words(user_id: int, upload_id: int, db: Session = Depends(get_db)):
    upload = db.query(Upload).filter(Upload.id == upload_id, Upload.user_id == user_id).first()
    if not upload:
        raise HTTPException(404, "Upload not found")
    if upload.status != "done":
        raise HTTPException(400, f"Upload is still {upload.status}")

    words = db.query(Word).filter(Word.source_image_id == upload_id).all()

    # Check which words are already in user's deck
    existing_word_ids = {
        c.word_id
        for c in db.query(UserCard).filter(UserCard.user_id == user_id).all()
    }

    return [
        ExtractedWord(
            word=w.word,
            part_of_speech=w.part_of_speech,
            definition=w.definition,
            example_sentence=w.example_sentence,
            already_in_deck=w.id in existing_word_ids,
        )
        for w in words
    ]


@router.post("/users/{user_id}/uploads/{upload_id}/confirm", status_code=200)
def confirm_words(
    user_id: int,
    upload_id: int,
    selected_words: list[str],
    db: Session = Depends(get_db),
):
    """Add selected words from an upload to the user's deck."""
    _get_user_or_404(user_id, db)

    added = 0
    for word_text in selected_words:
        word = db.query(Word).filter(Word.word == word_text.lower().strip()).first()
        if not word:
            continue
        existing = db.query(UserCard).filter(
            UserCard.user_id == user_id, UserCard.word_id == word.id
        ).first()
        if not existing:
            card = UserCard(user_id=user_id, word_id=word.id)
            db.add(card)
            added += 1

    db.commit()
    return {"added": added}
