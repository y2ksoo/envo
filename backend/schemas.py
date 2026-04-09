from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


# --- Users ---

class UserCreate(BaseModel):
    name: str
    avatar_emoji: str = "📚"


class UserOut(BaseModel):
    id: int
    name: str
    avatar_emoji: str
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Words ---

class WordOut(BaseModel):
    id: int
    word: str
    definition: Optional[str]
    part_of_speech: Optional[str]
    example_sentence: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class WordCreate(BaseModel):
    word: str
    definition: Optional[str] = None
    part_of_speech: Optional[str] = None
    example_sentence: Optional[str] = None


# --- Uploads ---

class UploadOut(BaseModel):
    id: int
    user_id: int
    filename: str
    status: str
    extracted_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ExtractedWord(BaseModel):
    word: str
    part_of_speech: Optional[str]
    definition: Optional[str]
    example_sentence: Optional[str]
    already_in_deck: bool = False


# --- Cards / Review ---

class CardOut(BaseModel):
    id: int
    word_id: int
    word: str
    definition: Optional[str]
    part_of_speech: Optional[str]
    example_sentence: Optional[str]
    easiness_factor: float
    interval: int
    repetitions: int
    next_review: date
    total_reviews: int
    correct_reviews: int

    model_config = {"from_attributes": True}


class ReviewSubmit(BaseModel):
    quality: int  # 0-5


class ReviewResult(BaseModel):
    card_id: int
    word: str
    quality: int
    interval_before: int
    interval_after: int
    ef_before: float
    ef_after: float
    next_review: date


class DeckStats(BaseModel):
    total_words: int
    due_today: int
    mastered: int  # repetitions >= 5
    new_cards: int  # repetitions == 0


# --- Conversations ---

class ConversationCreate(BaseModel):
    focus_word_ids: list[int] = []


class ConversationOut(BaseModel):
    id: int
    user_id: int
    title: Optional[str]
    focus_words: list[int] = []
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: int
    conversation_id: int
    role: str
    content: str
    corrections: list[dict] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatRequest(BaseModel):
    content: str


class ChatResponse(BaseModel):
    message: MessageOut
    corrections: list[dict] = []
