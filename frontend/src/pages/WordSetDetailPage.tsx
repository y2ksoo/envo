import { useContext, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { UserContext } from '../App'
import {
  getWordSets, getWordSetCards, getCards, addCardsToSet, removeCardFromSet
} from '../api/client'
import type { Card, WordSet } from '../types'

export default function WordSetDetailPage() {
  const { user } = useContext(UserContext)
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const setId = Number(id)

  const [wordSet, setWordSet] = useState<WordSet | null>(null)
  const [setCards, setSetCards] = useState<Card[]>([])
  const [allCards, setAllCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddWords, setShowAddWords] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    Promise.all([
      getWordSets(user.id),
      getWordSetCards(user.id, setId),
    ]).then(([sets, cards]) => {
      const ws = sets.find(s => s.id === setId)
      setWordSet(ws ?? null)
      setSetCards(cards)
    }).catch(console.error)
      .finally(() => setLoading(false))
  }, [user, setId])

  const loadAllCards = async () => {
    if (!user) return
    const cards = await getCards(user.id)
    const setWordIds = new Set(setCards.map(c => c.word_id))
    setAllCards(cards.filter(c => !setWordIds.has(c.word_id)))
    setShowAddWords(true)
  }

  const handleAddCards = async () => {
    if (!user || selected.size === 0) return
    setAdding(true)
    try {
      await addCardsToSet(user.id, setId, Array.from(selected))
      const updated = await getWordSetCards(user.id, setId)
      setSetCards(updated)
      setSelected(new Set())
      setShowAddWords(false)
    } catch (e) {
      console.error(e)
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveCard = async (card: Card) => {
    if (!user || !confirm(`"${card.word}"을 세트에서 제거할까요?`)) return
    await removeCardFromSet(user.id, setId, card.word_id)
    setSetCards(prev => prev.filter(c => c.id !== card.id))
  }

  const toggleSelect = (wordId: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(wordId)) next.delete(wordId)
      else next.add(wordId)
      return next
    })
  }

  if (!user) return <div className="vocab-empty">먼저 사용자를 선택해주세요.</div>
  if (loading) return <div className="vocab-empty">불러오는 중...</div>
  if (!wordSet) return <div className="vocab-empty">세트를 찾을 수 없습니다.</div>

  return (
    <div>
      <button
        style={{ background: 'none', color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer', marginBottom: 12, padding: 0 }}
        onClick={() => navigate('/word-sets')}
      >
        ← 세트 목록
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: 4 }}>{wordSet.name}</h1>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {setCards.length}개 단어
            {wordSet.week_start && ` · ${new Date(wordSet.week_start + 'T00:00:00').toLocaleDateString('ko-KR')} 주차`}
          </div>
        </div>
      </div>

      {setCards.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/review?word_set_id=${setId}`)}
          >
            🔁 복습하기
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => navigate(`/quiz?word_set_id=${setId}`)}
          >
            📝 퀴즈 시작
          </button>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.05rem', flex: 1 }}>단어 목록</h2>
          <button
            className="btn btn-secondary btn-sm"
            onClick={showAddWords ? () => setShowAddWords(false) : loadAllCards}
          >
            {showAddWords ? '취소' : '+ 단어 추가'}
          </button>
        </div>

        {showAddWords && (
          <div style={{ marginBottom: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 10 }}>
              내 단어장에서 선택하여 이 세트에 추가하세요.
            </p>
            {allCards.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>추가할 수 있는 단어가 없습니다.</div>
            ) : (
              <>
                <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {allCards.map(card => (
                    <label
                      key={card.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                        borderRadius: 8, cursor: 'pointer',
                        background: selected.has(card.word_id) ? '#eef0ff' : 'var(--bg)',
                        border: selected.has(card.word_id) ? '1px solid var(--primary)' : '1px solid var(--border)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(card.word_id)}
                        onChange={() => toggleSelect(card.word_id)}
                      />
                      <span style={{ fontWeight: 500 }}>{card.word}</span>
                      {card.part_of_speech && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{card.part_of_speech}</span>}
                      {card.definition && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.definition}</span>}
                    </label>
                  ))}
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleAddCards}
                  disabled={selected.size === 0 || adding}
                >
                  {adding ? '추가 중...' : `선택한 ${selected.size}개 추가`}
                </button>
              </>
            )}
          </div>
        )}

        {setCards.length === 0 && !showAddWords ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
            아직 단어가 없습니다. 단어를 추가해보세요!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {setCards.map(card => (
              <div
                key={card.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', borderRadius: 8,
                  background: 'var(--bg)', border: '1px solid var(--border)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600 }}>{card.word}</span>
                  {card.part_of_speech && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 8 }}>{card.part_of_speech}</span>}
                  {card.definition && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>{card.definition}</div>}
                </div>
                <button
                  style={{ color: 'var(--text-muted)', background: 'none', fontSize: '0.9rem', cursor: 'pointer' }}
                  onClick={() => handleRemoveCard(card)}
                  title="세트에서 제거"
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
