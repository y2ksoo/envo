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
  const [loading, setLoading] = useState(true)

  // 단어 추가 패널
  const [showAddWords, setShowAddWords] = useState(false)
  const [unassignedCards, setUnassignedCards] = useState<Card[]>([])
  const [addLoading, setAddLoading] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    Promise.all([
      getWordSets(user.id),
      getWordSetCards(user.id, setId),
    ]).then(([sets, cards]) => {
      setWordSet(sets.find(s => s.id === setId) ?? null)
      setSetCards(cards)
    }).catch(console.error)
      .finally(() => setLoading(false))
  }, [user, setId])

  // 어떤 세트에도 속하지 않은 단어만 로드
  const loadUnassigned = async () => {
    if (!user) return
    setAddLoading(true)
    try {
      const [allCards, allSets] = await Promise.all([
        getCards(user.id),
        getWordSets(user.id),
      ])
      // 모든 세트의 단어 id를 병렬로 가져와 합집합 구성
      const allSetCards = await Promise.all(
        allSets.map(ws => getWordSetCards(user.id, ws.id))
      )
      const assignedWordIds = new Set<number>(
        allSetCards.flat().map(c => c.word_id)
      )
      setUnassignedCards(allCards.filter(c => !assignedWordIds.has(c.word_id)))
      setSelected(new Set())
      setShowAddWords(true)
    } catch (e) {
      console.error(e)
    } finally {
      setAddLoading(false)
    }
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

  const allSelected = unassignedCards.length > 0 && selected.size === unassignedCards.length
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(unassignedCards.map(c => c.word_id)))
    }
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
          <button className="btn btn-primary" onClick={() => navigate(`/review?word_set_id=${setId}`)}>
            🔁 복습하기
          </button>
          <button className="btn btn-secondary" onClick={() => navigate(`/quiz?word_set_id=${setId}`)}>
            📝 퀴즈 시작
          </button>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.05rem', flex: 1 }}>단어 목록</h2>
          <button
            className="btn btn-secondary btn-sm"
            onClick={showAddWords ? () => { setShowAddWords(false); setSelected(new Set()) } : loadUnassigned}
            disabled={addLoading}
          >
            {addLoading ? '불러오는 중...' : showAddWords ? '취소' : '+ 단어 추가'}
          </button>
        </div>

        {showAddWords && (
          <div style={{ marginBottom: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 10 }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', flex: 1, margin: 0 }}>
                아직 세트에 배정되지 않은 단어 {unassignedCards.length}개
              </p>
              {unassignedCards.length > 0 && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={toggleSelectAll}
                >
                  {allSelected ? '전체 해제' : '전체 선택'}
                </button>
              )}
            </div>

            {unassignedCards.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', padding: '12px 0' }}>
                모든 단어가 이미 세트에 배정되어 있습니다.
              </div>
            ) : (
              <>
                <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
                  {unassignedCards.map(card => (
                    <label
                      key={card.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
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
                      <span style={{ fontWeight: 500, flexShrink: 0 }}>{card.word}</span>
                      {card.part_of_speech && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--primary)', background: '#eef0ff', padding: '1px 6px', borderRadius: 5, flexShrink: 0 }}>
                          {card.part_of_speech}
                        </span>
                      )}
                      {card.definition && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                          {card.definition}
                        </span>
                      )}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {setCards.map(card => (
              <div
                key={card.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '9px 12px', borderRadius: 8,
                  background: 'var(--bg)', border: '1px solid var(--border)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>{card.word}</span>
                  {card.part_of_speech && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--primary)', background: '#eef0ff', padding: '1px 6px', borderRadius: 5, marginLeft: 8 }}>
                      {card.part_of_speech}
                    </span>
                  )}
                  {card.definition && (
                    <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {card.definition}
                    </div>
                  )}
                </div>
                <button
                  style={{ color: 'var(--text-muted)', background: 'none', fontSize: '0.9rem', cursor: 'pointer', flexShrink: 0 }}
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
