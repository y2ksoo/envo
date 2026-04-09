import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import User, Conversation, Message, Word, UserCard
from schemas import (
    ConversationCreate, ConversationOut, MessageOut, ChatRequest, ChatResponse
)
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

    # Auto-title from focus words
    title = None
    if body.focus_word_ids:
        words = db.query(Word).filter(Word.id.in_(body.focus_word_ids)).all()
        if words:
            title = "Practice: " + ", ".join(w.word for w in words[:3])
            if len(words) > 3:
                title += f" +{len(words)-3} more"

    conv = Conversation(
        user_id=user_id,
        title=title,
        focus_words=focus_words_json,
    )
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

    msgs = db.query(Message).filter(Message.conversation_id == conv_id).order_by(Message.created_at).all()
    result = []
    for m in msgs:
        corrections = json.loads(m.corrections) if m.corrections else []
        result.append(MessageOut(
            id=m.id,
            conversation_id=m.conversation_id,
            role=m.role,
            content=m.content,
            corrections=corrections,
            created_at=m.created_at,
        ))
    return result


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

    # Save user message
    user_msg = Message(
        conversation_id=conv_id,
        role="user",
        content=body.content,
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # Load conversation history for Claude
    history = db.query(Message).filter(
        Message.conversation_id == conv_id
    ).order_by(Message.created_at).all()

    claude_messages = [
        {"role": m.role, "content": m.content}
        for m in history
    ]

    # Load focus words
    focus_word_ids = json.loads(conv.focus_words) if conv.focus_words else []
    focus_words = []
    if focus_word_ids:
        words = db.query(Word).filter(Word.id.in_(focus_word_ids)).all()
        focus_words = [{"word": w.word, "definition": w.definition} for w in words]

    # Stream response
    full_response = ""

    async def stream_and_collect():
        nonlocal full_response
        async for chunk in claude_client.stream_conversation_response(claude_messages, focus_words):
            full_response += chunk
            yield f"data: {json.dumps({'chunk': chunk})}\n\n"

        # Parse and save assistant message
        reply, corrections = claude_client.parse_corrections(full_response)
        corrections_json = json.dumps(corrections)

        assistant_msg = Message(
            conversation_id=conv_id,
            role="assistant",
            content=reply,
            corrections=corrections_json,
        )
        db.add(assistant_msg)
        conv.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(assistant_msg)

        # Send final structured data
        final_data = {
            "done": True,
            "message": {
                "id": assistant_msg.id,
                "role": "assistant",
                "content": reply,
                "corrections": corrections,
            }
        }
        yield f"data: {json.dumps(final_data)}\n\n"

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
