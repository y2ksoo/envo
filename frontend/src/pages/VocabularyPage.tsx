import { useContext, useEffect, useState } from 'react'
import { UserContext } from '../App'
import { getCards, deleteCard, addCard } from '../api/client'
import type { Card } from '../types'
import './VocabularyPage.css'

const POS_OPTIONS = ['', 'noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'pronoun', 'interjection', 'phrase']

const EMPTY_FORM = { word: '', part_of_speech: '', definition: '', example_sentence: '' }

export default function VocabularyPage() {
  const { user } = useContext(UserContext)
  const [cards, setCards] = useState<Card[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

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

  const handleSave = async () => {
    if (!user || !form.word.trim()) return
    setSaving(true)
    setSaveError('')
    try {
      const card = await addCard(
        user.id,
        form.word.trim(),
        form.definition.trim() || undefined,
        form.part_of_speech || undefined,
        form.example_sentence.trim() || undefined,
      )
      setCards(prev => [card, ...prev])
      setForm(EMPTY_FORM)
      setShowForm(false)
    } catch (e: any) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
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
        <button
          className={`btn ${showForm ? 'btn-secondary' : 'btn-primary'} btn-sm`}
          style={{ marginLeft: 'auto' }}
          onClick={() => { setShowForm(v => !v); setSaveError('') }}
        >
          {showForm ? '취소' : '✏️ 직접 입력'}
        </button>
      </div>

      {showForm && (
        <div className="manual-form card">
          <h3 style={{ marginBottom: 14, fontSize: '1rem' }}>단어 직접 입력</h3>
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>단어 *</label>
              <input
                className="input"
                placeholder="예: ephemeral"
                value={form.word}
                onChange={e => setForm(f => ({ ...f, word: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                autoFocus
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>품사</label>
              <select
                className="input"
                value={form.part_of_speech}
                onChange={e => setForm(f => ({ ...f, part_of_speech: e.target.value }))}
              >
                {POS_OPTIONS.map(p => (
                  <option key={p} value={p}>{p || '선택 안함'}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>정의 (선택)</label>
            <input
              className="input"
              placeholder="예: lasting for only a short time"
              value={form.definition}
              onChange={e => setForm(f => ({ ...f, definition: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>예문 (선택)</label>
            <input
              className="input"
              placeholder="예: Fame is ephemeral, but great work endures."
              value={form.example_sentence}
              onChange={e => setForm(f => ({ ...f, example_sentence: e.target.value }))}
            />
          </div>
          {saveError && <div className="form-error">{saveError}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button className="btn btn-secondary" onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}>취소</button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={!form.word.trim() || saving}
            >
              {saving ? '저장 중...' : '단어장에 추가'}
            </button>
          </div>
        </div>
      )}

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
          {search
            ? '검색 결과가 없습니다.'
            : '아직 단어가 없어요. 사진으로 추가하거나 직접 입력해보세요!'}
        </div>
      ) : (
        <div className="vocab-list">
          {cards.map(card => {
            const mastery = getMasteryLevel(card)
            const isExpanded = expanded === card.id
            return (
              <div key={card.id} className={`vocab-item ${isExpanded ? 'expanded' : ''}`}>
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
