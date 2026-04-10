from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from config import settings

# DB 파일이 있는 디렉터리 자동 생성
_db_url = settings.database_url
if _db_url.startswith("sqlite:///"):
    _db_path = _db_url.replace("sqlite:///", "")
    if _db_path:
        Path(_db_path).parent.mkdir(parents=True, exist_ok=True)

# 업로드 디렉터리 자동 생성
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
)


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    from models import User, Word, Upload, UserCard, ReviewLog, Conversation, Message, WordSet, WordSetCard  # noqa
    Base.metadata.create_all(bind=engine)
    _migrate()


def _migrate():
    """기존 DB에 새 컬럼이 없을 경우 추가 (SQLite ALTER TABLE)."""
    from sqlalchemy import text
    with engine.connect() as conn:
        word_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(words)")).fetchall()]
        if "synonyms" not in word_cols:
            conn.execute(text("ALTER TABLE words ADD COLUMN synonyms TEXT"))
        if "antonyms" not in word_cols:
            conn.execute(text("ALTER TABLE words ADD COLUMN antonyms TEXT"))
        conn.commit()
