import { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../App'
import { getConversations, createConversation, deleteConversation, getCards } from '../api/client'
import type { Card, Conversation } from '../types'
import './ConversationPage.css'

export default function ConversationPage() {
  const { user } = useContext(UserContext)
  const navigate = useNavigate()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [selectedWords, setSelectedWords] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [showNewForm, setShowNewForm] = useState(false)

  useEffect(() => {
    if (!user) return
    Promise.all([
      getConversations(user.id),
      getCards(user.id),
    ]).then(([convs, c]) => {
      setConversations(convs)
      setCards(c)
    }).catch(console.error)
    .finally(() => setLoading(false))
  }, [user])

  const handleCreate = async () => {
    if (!user) return
    const conv = await createConversation(user.id, Array.from(selectedWords))
    navigate(`/conversation/${conv.id}`)
  }

  const handleDelete = async (conv: Conversation) => {
    if (!user || !confirm('대화를 삭제할까요?')) return
    await deleteConversation(user.id, conv.id)
    setConversations(prev => prev.filter(c => c.id !== conv.id))
  }

  const toggleWord = (id: number) => {
    setSelectedWords(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (!user) return <div className="conv-empty">먼저 사용자를 선택해주세요.</div>
  if (loading) return <div className="conv-empty">불러오는 중...</div>

  return (
    <div className="conv-page">
      <div className="conv-page-header">
        <h1>💬 영어 대화 연습</h1>
        <button className="btn btn-primary" onClick={() => setShowNewForm(v => !v)}>
          + 새 대화
        </button>
      </div>

      {showNewForm && (
        <div className="card new-conv-form">
          <h3 style={{ marginBottom: 12 }}>연습할 단어 선택 (선택사항)</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 14 }}>
            선택한 단어를 대화에서 자연스럽게 사용해드려요.
          </p>
          {cards.length > 0 ? (
            <div className="word-select-grid">
              {cards.slice(0, 30).map(card => (
                <button
                  key={card.id}
                  className={`word-chip ${selectedWords.has(card.id) ? 'selected' : ''}`}
                  onClick={() => toggleWord(card.id)}
                >
                  {card.word}
                </button>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>단어장이 비어있어요.</p>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setShowNewForm(false)}>취소</button>
            <button className="btn btn-primary" onClick={handleCreate}>
              대화 시작 →
            </button>
          </div>
        </div>
      )}

      <div className="conv-list">
        {conversations.length === 0 ? (
          <div className="conv-empty">아직 대화가 없어요. 새 대화를 시작해보세요!</div>
        ) : (
          conversations.map(conv => (
            <div key={conv.id} className="conv-item" onClick={() => navigate(`/conversation/${conv.id}`)}>
              <div className="conv-item-icon">💬</div>
              <div className="conv-item-body">
                <div className="conv-item-title">{conv.title || '대화 연습'}</div>
                <div className="conv-item-meta">
                  메시지 {conv.message_count}개 · {new Date(conv.updated_at).toLocaleDateString('ko-KR')}
                </div>
              </div>
              <button
                className="conv-delete-btn"
                onClick={e => { e.stopPropagation(); handleDelete(conv) }}
              >✕</button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
