from datetime import date, datetime
from sqlalchemy import (
    Column, Integer, String, Float, Text, ForeignKey,
    UniqueConstraint, Index, Date, DateTime,
)
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)
    avatar_emoji = Column(String, default="📚")
    created_at = Column(DateTime, default=datetime.utcnow)

    cards = relationship("UserCard", back_populates="user", cascade="all, delete-orphan")
    uploads = relationship("Upload", back_populates="user", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
    review_logs = relationship("ReviewLog", back_populates="user", cascade="all, delete-orphan")
    word_sets = relationship("WordSet", back_populates="user", cascade="all, delete-orphan")


class Word(Base):
    __tablename__ = "words"

    id = Column(Integer, primary_key=True, autoincrement=True)
    word = Column(String, nullable=False, unique=True)
    definition = Column(Text)
    part_of_speech = Column(String)
    example_sentence = Column(Text)
    synonyms = Column(Text)   # JSON: ["similar1", "similar2"]
    antonyms = Column(Text)   # JSON: ["opposite1", "opposite2"]
    source_image_id = Column(Integer, ForeignKey("uploads.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user_cards = relationship("UserCard", back_populates="word", cascade="all, delete-orphan")


class Upload(Base):
    __tablename__ = "uploads"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    status = Column(String, default="pending")
    extracted_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="uploads")


class UserCard(Base):
    __tablename__ = "user_cards"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    word_id = Column(Integer, ForeignKey("words.id"), nullable=False)
    easiness_factor = Column(Float, default=2.5)
    interval = Column(Integer, default=1)
    repetitions = Column(Integer, default=0)
    next_review = Column(Date, default=date.today)
    last_review = Column(Date, nullable=True)
    total_reviews = Column(Integer, default=0)
    correct_reviews = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="cards")
    word = relationship("Word", back_populates="user_cards")

    __table_args__ = (
        UniqueConstraint("user_id", "word_id"),
        Index("idx_user_cards_user_review", "user_id", "next_review"),
    )


class ReviewLog(Base):
    __tablename__ = "review_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    word_id = Column(Integer, ForeignKey("words.id"), nullable=False)
    quality = Column(Integer, nullable=False)
    interval_before = Column(Integer)
    interval_after = Column(Integer)
    ef_before = Column(Float)
    ef_after = Column(Float)
    reviewed_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="review_logs")


class WordSet(Base):
    __tablename__ = "word_sets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)      # e.g. "Week 1 (Jan 8)"
    week_start = Column(Date, nullable=True)   # 해당 주 시작일
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="word_sets")
    set_cards = relationship("WordSetCard", back_populates="word_set", cascade="all, delete-orphan")


class WordSetCard(Base):
    __tablename__ = "word_set_cards"

    id = Column(Integer, primary_key=True, autoincrement=True)
    word_set_id = Column(Integer, ForeignKey("word_sets.id"), nullable=False)
    word_id = Column(Integer, ForeignKey("words.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    word_set = relationship("WordSet", back_populates="set_cards")
    word = relationship("Word")

    __table_args__ = (UniqueConstraint("word_set_id", "word_id"),)


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String)
    focus_words = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan",
                            order_by="Message.created_at")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    corrections = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")

    __table_args__ = (
        Index("idx_messages_conversation", "conversation_id", "created_at"),
    )
