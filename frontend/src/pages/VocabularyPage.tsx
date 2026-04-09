import { useContext, useEffect, useState } from 'react'
import { UserContext } from '../App'
import { getCards, deleteCard } from '../api/client'
import type { Card } from '../types'
import './VocabularyPage.css'

export default function VocabularyPage() {
  const { user } = useContext(UserContext)
  const [cards, setCards] = useState<Card[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    getCards(user.id, search)
      .then(setCards)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user, search])

  const handleDelete = async (card: Card) => {
    if (!user || !confirm(`"${card.word}" 단어를 삭제할까요?`)) return
    await deleteCard(user.id, card.id)
    setCards(prev => prev.filter(c => c.id !== card.id))
  }

  const getMasteryLevel = (card: Card) => {
    if (card.repetitions >= 5) return { label: '마스터', color: '#28a745' }
    if (card.repetitions >= 3) return { label: '익숙함', color: '#17a2b8' }
    if (card.repetitions >= 1) return { label: '학습중', color: '#ffc107' }
    return { label: '새 단어', color: '#6c757d' }
  }

  if (!user) return <div className="vocab-empty">먼저 사용자를 선택해주세요.</div>

  return (
    <div className="vocab-page">
      <div className="vocab-header">
        <h1>📋 단어장</h1>
        <span className="vocab-count">{cards.length}개</span>
      </div>

      <input
        className="input"
        placeholder="단어 검색..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 16 }}
      />

      {loading ? (
        <div className="vocab-empty">불러오는 중...</div>
      ) : cards.length === 0 ? (
        <div className="vocab-empty">
          {search ? '검색 결과가 없습니다.' : '아직 단어가 없어요. 사진으로 단어를 추가해보세요!'}
        </div>
      ) : (
        <div className="vocab-list">
          {cards.map(card => {
            const mastery = getMasteryLevel(card)
            const isExpanded = expanded === card.id
            return (
              <div
                key={card.id}
                className={`vocab-item ${isExpanded ? 'expanded' : ''}`}
              >
                <div className="vocab-item-header" onClick={() => setExpanded(isExpanded ? null : card.id)}>
                  <div className="vocab-main">
                    <span className="vocab-word">{card.word}</span>
                    {card.part_of_speech && (
                      <span className="vocab-pos">{card.part_of_speech}</span>
                    )}
                    <span className="mastery-badge" style={{ background: mastery.color + '22', color: mastery.color }}>
                      {mastery.label}
                    </span>
                  </div>
                  <div className="vocab-meta">
                    <span className="vocab-next">
                      다음 복습: {new Date(card.next_review).toLocaleDateString('ko-KR')}
                    </span>
                    <span className="vocab-chevron">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="vocab-detail">
                    {card.definition && (
                      <div className="detail-row">
                        <span className="detail-label">정의</span>
                        <span>{card.definition}</span>
                      </div>
                    )}
                    {card.example_sentence && (
                      <div className="detail-row">
                        <span className="detail-label">예문</span>
                        <em>"{card.example_sentence}"</em>
                      </div>
                    )}
                    <div className="detail-row">
                      <span className="detail-label">통계</span>
                      <span>
                        복습 {card.total_reviews}회 · 정답률 {card.total_reviews > 0 ? Math.round((card.correct_reviews / card.total_reviews) * 100) : 0}% · 연속 {card.repetitions}회
                      </span>
                    </div>
                    <div className="detail-actions">
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(card)}>
                        삭제
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
