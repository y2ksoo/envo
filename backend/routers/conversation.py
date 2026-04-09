import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import get_db, SessionLocal
from models import User, Conversation, Message, Word
from schemas import ConversationCreate, ConversationOut, MessageOut, ChatRequest
import claude_client

router = APIRouter(tags=["conversation"])


def _get_user_or_404(user_id: int, db: Session) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    return user


def _conv_to_out(conv: Conversation, db: Session) -> ConversationOut:
    focus_ids = json.loads(conv.focus_words) if conv.focus_words else []
    msg_count = db.query(Message).filter(Message.conversation_id == conv.id).count()
    return ConversationOut(
        id=conv.id,
        user_id=conv.user_id,
        title=conv.title,
        focus_words=focus_ids,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        message_count=msg_count,
    )


@router.post("/users/{user_id}/conversations", response_model=ConversationOut, status_code=201)
def create_conversation(
    user_id: int,
    body: ConversationCreate,
    db: Session = Depends(get_db),
):
    _get_user_or_404(user_id, db)

    focus_words_json = json.dumps(body.focus_word_ids)

    title = None
    if body.focus_word_ids:
        words = db.query(Word).filter(Word.id.in_(body.focus_word_ids)).all()
        if words:
            title = "Practice: " + ", ".join(w.word for w in words[:3])
            if len(words) > 3:
                title += f" +{len(words)-3} more"

    conv = Conversation(user_id=user_id, title=title, focus_words=focus_words_json)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return _conv_to_out(conv, db)


@router.get("/users/{user_id}/conversations", response_model=list[ConversationOut])
def list_conversations(user_id: int, db: Session = Depends(get_db)):
    _get_user_or_404(user_id, db)
    convs = (
        db.query(Conversation)
        .filter(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.desc())
        .all()
    )
    return [_conv_to_out(c, db) for c in convs]


@router.get("/users/{user_id}/conversations/{conv_id}/messages", response_model=list[MessageOut])
def get_messages(user_id: int, conv_id: int, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(
        Conversation.id == conv_id, Conversation.user_id == user_id
    ).first()
    if not conv:
        raise HTTPException(404, "Conversation not found")

    msgs = (
        db.query(Message)
        .filter(Message.conversation_id == conv_id)
        .order_by(Message.created_at)
        .all()
    )
    return [
        MessageOut(
            id=m.id,
            conversation_id=m.conversation_id,
            role=m.role,
            content=m.content,
            corrections=json.loads(m.corrections) if m.corrections else [],
            created_at=m.created_at,
        )
        for m in msgs
    ]


@router.post("/users/{user_id}/conversations/{conv_id}/messages")
async def send_message(
    user_id: int,
    conv_id: int,
    body: ChatRequest,
    db: Session = Depends(get_db),
):
    conv = db.query(Conversation).filter(
        Conversation.id == conv_id, Conversation.user_id == user_id
    ).first()
    if not conv:
        raise HTTPException(404, "Conversation not found")

    # 1. 사용자 메시지 저장
    user_msg = Message(conversation_id=conv_id, role="user", content=body.content)
    db.add(user_msg)
    db.commit()

    # 2. 현재 메시지만 독립적으로 전송 (히스토리 미포함)
    claude_messages: list[dict] = [
        {"role": "user", "content": body.content}
    ]

    # 3. 포커스 단어 로드
    focus_word_ids: list[int] = json.loads(conv.focus_words) if conv.focus_words else []
    focus_words: list[dict] = []
    if focus_word_ids:
        words = db.query(Word).filter(Word.id.in_(focus_word_ids)).all()
        focus_words = [{"word": w.word, "definition": w.definition} for w in words]

    # FastAPI 관리 세션은 여기서 쿼리 완료. generator 안에서는 별도 세션 사용.

    async def stream_and_collect():
        full_response = ""

        # 4. Claude 스트리밍
        try:
            async for chunk in claude_client.stream_conversation_response(claude_messages, focus_words):
                full_response += chunk
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            return

        # 5. 응답 파싱
        reply, corrections = claude_client.parse_corrections(full_response)

        # 6. 별도 세션으로 assistant 메시지 저장 (세션 수명 문제 방지)
        save_db = SessionLocal()
        msg_id = None
        try:
            assistant_msg = Message(
                conversation_id=conv_id,
                role="assistant",
                content=reply,
                corrections=json.dumps(corrections),
            )
            save_db.add(assistant_msg)
            save_db.query(Conversation).filter(Conversation.id == conv_id).update(
                {"updated_at": datetime.utcnow()}
            )
            save_db.commit()
            save_db.refresh(assistant_msg)
            msg_id = assistant_msg.id
        except Exception:
            save_db.rollback()
        finally:
            save_db.close()

        # 7. done 이벤트 전송
        yield f"data: {json.dumps({'done': True, 'message': {'id': msg_id, 'role': 'assistant', 'content': reply, 'corrections': corrections}})}\n\n"

    return StreamingResponse(
        stream_and_collect(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.delete("/users/{user_id}/conversations/{conv_id}", status_code=204)
def delete_conversation(user_id: int, conv_id: int, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(
        Conversation.id == conv_id, Conversation.user_id == user_id
    ).first()
    if not conv:
        raise HTTPException(404, "Conversation not found")
    db.delete(conv)
    db.commit()
