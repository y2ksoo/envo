import { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../App'
import { getCards, deleteCard, addCard, getWordSets, getWordSetCards, addCardsToSet } from '../api/client'
import type { Card, WordSet } from '../types'
import './VocabularyPage.css'

const POS_OPTIONS = ['', 'noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'pronoun', 'interjection', 'phrase']

const EMPTY_FORM = {
  word: '', part_of_speech: '', definition: '', example_sentence: '',
  synonyms: '', antonyms: '',
}

export default function VocabularyPage() {
  const { user } = useContext(UserContext)
  const navigate = useNavigate()

  const [allCards, setAllCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)

  const [wordSets, setWordSets] = useState<WordSet[]>([])
  const [filterSetId, setFilterSetId] = useState<number | null>(null)
  // cache: setId → Set of word_ids in that set
  const [setWordIdCache, setSetWordIdCache] = useState<Map<number, Set<number>>>(new Map())
  const [setFetching, setSetFetching] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [addingToSet, setAddingToSet] = useState<{ cardWordId: number } | null>(null)
  const [addTargetSetId, setAddTargetSetId] = useState<number | null>(null)

  // Load all cards once
  useEffect(() => {
    if (!user) return
    setLoading(true)
    getCards(user.id)
      .then(setAllCards)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  // Load word sets
  useEffect(() => {
    if (!user) return
    getWordSets(user.id).then(setWordSets).catch(console.error)
  }, [user])

  // Load set word ids when filter changes
  useEffect(() => {
    if (!user || filterSetId === null) return
    if (setWordIdCache.has(filterSetId)) return  // already cached
    setSetFetching(true)
    getWordSetCards(user.id, filterSetId)
      .then(cards => {
        const ids = new Set(cards.map(c => c.word_id))
        setSetWordIdCache(prev => new Map(prev).set(filterSetId, ids))
      })
      .catch(console.error)
      .finally(() => setSetFetching(false))
  }, [user, filterSetId])

  // Derive displayed cards
  const activeSetWordIds = filterSetId !== null ? setWordIdCache.get(filterSetId) : undefined
  const displayCards = allCards.filter(card => {
    if (filterSetId !== null && activeSetWordIds && !activeSetWordIds.has(card.word_id)) return false
    if (search) {
      const q = search.toLowerCase()
      return card.word.toLowerCase().includes(q) || card.definition?.toLowerCase().includes(q)
    }
    return true
  })

  const handleDelete = async (card: Card) => {
    if (!user || !confirm(`"${card.word}" 단어를 삭제할까요?`)) return
    await deleteCard(user.id, card.id)
    setAllCards(prev => prev.filter(c => c.id !== card.id))
    // invalidate set cache so counts refresh
    setSetWordIdCache(new Map())
  }

  const handleSave = async () => {
    if (!user || !form.word.trim()) return
    setSaving(true)
    setSaveError('')
    try {
      const synonymsList = form.synonyms.split(',').map(s => s.trim()).filter(Boolean)
      const antonymsList = form.antonyms.split(',').map(s => s.trim()).filter(Boolean)
      const card = await addCard(
        user.id, form.word.trim(),
        form.definition.trim() || undefined,
        form.part_of_speech || undefined,
        form.example_sentence.trim() || undefined,
        synonymsList, antonymsList,
      )
      setAllCards(prev => [card, ...prev])
      setForm(EMPTY_FORM)
      setShowForm(false)
    } catch (e: any) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAddToSet = async () => {
    if (!user || !addingToSet || !addTargetSetId) return
    try {
      await addCardsToSet(user.id, addTargetSetId, [addingToSet.cardWordId])
      // invalidate cache for that set so it reloads
      setSetWordIdCache(prev => {
        const next = new Map(prev)
        next.delete(addTargetSetId)
        return next
      })
      // refresh word set card counts
      getWordSets(user.id).then(setWordSets).catch(console.error)
      setAddingToSet(null)
      setAddTargetSetId(null)
    } catch (e) {
      console.error(e)
    }
  }

  const getMasteryLevel = (card: Card) => {
    if (card.repetitions >= 5) return { label: '마스터', color: '#28a745' }
    if (card.repetitions >= 3) return { label: '익숙함', color: '#17a2b8' }
    if (card.repetitions >= 1) return { label: '학습중', color: '#ffc107' }
    return { label: '새 단어', color: '#6c757d' }
  }

  if (!user) return <div className="vocab-empty">먼저 사용자를 선택해주세요.</div>

  const isFilterLoading = filterSetId !== null && setFetching && !setWordIdCache.has(filterSetId)

  return (
    <div className="vocab-page">
      <div className="vocab-header">
        <h1>📋 단어장</h1>
        <span className="vocab-count">{loading ? '…' : `${displayCards.length}개`}</span>
        <button
          className={`btn ${showForm ? 'btn-secondary' : 'btn-primary'} btn-sm`}
          style={{ marginLeft: 'auto' }}
          onClick={() => { setShowForm(v => !v); setSaveError('') }}
        >
          {showForm ? '취소' : '✏️ 직접 입력'}
        </button>
      </div>

      {/* Manual add form */}
      {showForm && (
        <div className="manual-form card">
          <h3 style={{ marginBottom: 14, fontSize: '1rem' }}>단어 직접 입력</h3>
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>단어 *</label>
              <input className="input" placeholder="예: ephemeral" value={form.word}
                onChange={e => setForm(f => ({ ...f, word: e.target.value }))} autoFocus />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>품사</label>
              <select className="input" value={form.part_of_speech}
                onChange={e => setForm(f => ({ ...f, part_of_speech: e.target.value }))}>
                {POS_OPTIONS.map(p => <option key={p} value={p}>{p || '선택 안함'}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>정의 (선택)</label>
            <input className="input" placeholder="예: lasting for only a short time" value={form.definition}
              onChange={e => setForm(f => ({ ...f, definition: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>예문 (선택)</label>
            <input className="input" placeholder="예: Fame is ephemeral, but great work endures." value={form.example_sentence}
              onChange={e => setForm(f => ({ ...f, example_sentence: e.target.value }))} />
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>유사어 (쉼표로 구분)</label>
              <input className="input" placeholder="예: transient, fleeting" value={form.synonyms}
                onChange={e => setForm(f => ({ ...f, synonyms: e.target.value }))} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>반의어 (쉼표로 구분)</label>
              <input className="input" placeholder="예: permanent, lasting" value={form.antonyms}
                onChange={e => setForm(f => ({ ...f, antonyms: e.target.value }))} />
            </div>
          </div>
          {saveError && <div className="form-error">{saveError}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button className="btn btn-secondary" onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}>취소</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={!form.word.trim() || saving}>
              {saving ? '저장 중...' : '단어장에 추가'}
            </button>
          </div>
        </div>
      )}

      {/* Word set filter tabs */}
      {wordSets.length > 0 && (
        <div className="set-filter-tabs">
          <button
            className={`set-tab ${filterSetId === null ? 'active' : ''}`}
            onClick={() => setFilterSetId(null)}
          >
            전체
          </button>
          {wordSets.map(ws => (
            <button
              key={ws.id}
              className={`set-tab ${filterSetId === ws.id ? 'active' : ''}`}
              onClick={() => setFilterSetId(ws.id)}
            >
              {ws.name}
              <span className="set-tab-count">{ws.card_count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <input
        className="input"
        placeholder="단어 검색..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      {/* List */}
      {loading || isFilterLoading ? (
        <div className="vocab-empty">불러오는 중...</div>
      ) : displayCards.length === 0 ? (
        <div className="vocab-empty">
          {search ? '검색 결과가 없습니다.'
            : filterSetId ? '이 세트에 단어가 없습니다.'
            : '아직 단어가 없어요. 직접 입력하거나 사진으로 추가해보세요!'}
        </div>
      ) : (
        <div className="vocab-list">
          {displayCards.map(card => {
            const mastery = getMasteryLevel(card)
            const isExpanded = expanded === card.id
            return (
              <div key={card.id} className={`vocab-item ${isExpanded ? 'expanded' : ''}`}>
                {/* Compact one-line header */}
                <div className="vocab-item-header" onClick={() => setExpanded(isExpanded ? null : card.id)}>
                  <span className="vocab-word">{card.word}</span>
                  {card.part_of_speech && <span className="vocab-pos">{card.part_of_speech}</span>}
                  {card.definition && (
                    <span className="vocab-def-preview">{card.definition}</span>
                  )}
                  <span className="mastery-badge" style={{ background: mastery.color + '22', color: mastery.color, flexShrink: 0 }}>
                    {mastery.label}
                  </span>
                  <span className="vocab-chevron">{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Expanded detail */}
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
                    {card.synonyms && card.synonyms.length > 0 && (
                      <div className="detail-row">
                        <span className="detail-label">유사어</span>
                        <span style={{ color: '#17a2b8' }}>{card.synonyms.join(', ')}</span>
                      </div>
                    )}
                    {card.antonyms && card.antonyms.length > 0 && (
                      <div className="detail-row">
                        <span className="detail-label">반의어</span>
                        <span style={{ color: '#dc3545' }}>{card.antonyms.join(', ')}</span>
                      </div>
                    )}
                    <div className="detail-row">
                      <span className="detail-label">통계</span>
                      <span>
                        복습 {card.total_reviews}회 · 정답률 {card.total_reviews > 0 ? Math.round((card.correct_reviews / card.total_reviews) * 100) : 0}% · 연속 {card.repetitions}회
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">예정</span>
                      <span>{new Date(card.next_review).toLocaleDateString('ko-KR')}</span>
                    </div>
                    <div className="detail-actions">
                      {addingToSet?.cardWordId === card.word_id ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <select
                            className="input"
                            style={{ flex: 1, minWidth: 160 }}
                            value={addTargetSetId ?? ''}
                            onChange={e => setAddTargetSetId(Number(e.target.value))}
                          >
                            <option value="">세트 선택...</option>
                            {wordSets.map(ws => (
                              <option key={ws.id} value={ws.id}>{ws.name}</option>
                            ))}
                          </select>
                          <button className="btn btn-primary btn-sm" onClick={handleAddToSet} disabled={!addTargetSetId}>추가</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => { setAddingToSet(null); setAddTargetSetId(null) }}>취소</button>
                          {wordSets.length === 0 && (
                            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/word-sets')}>+ 세트 만들기</button>
                          )}
                        </div>
                      ) : (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => { setAddingToSet({ cardWordId: card.word_id }); setAddTargetSetId(null) }}
                        >
                          📂 세트에 추가
                        </button>
                      )}
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(card)}>삭제</button>
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
