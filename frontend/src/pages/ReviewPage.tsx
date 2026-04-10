import { useContext, useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { UserContext } from '../App'
import { getReviewSession, submitReview, getWordSets } from '../api/client'
import type { Card, ReviewQuality, WordSet } from '../types'
import { QUALITY_MAP } from '../types'
import './ReviewPage.css'

type ReviewMode = 'scheduled' | 'all' | 'hard'

const MODE_OPTIONS: { value: ReviewMode; label: string; desc: string }[] = [
  { value: 'scheduled', label: '오늘 예정', desc: '오늘 복습 예정된 단어' },
  { value: 'all',       label: '전체 복습', desc: '모든 단어 다시 복습' },
  { value: 'hard',      label: '핵심 복습', desc: '마지막에 틀렸거나 어려웠던 단어' },
]

export default function ReviewPage() {
  const { user } = useContext(UserContext)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [wordSets, setWordSets] = useState<WordSet[]>([])
  const [selectedSetId, setSelectedSetId] = useState<number | undefined>(
    searchParams.get('word_set_id') ? Number(searchParams.get('word_set_id')) : undefined
  )
  const [mode, setMode] = useState<ReviewMode>('scheduled')

  const [queue, setQueue] = useState<Card[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [started, setStarted] = useState(false)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sessionStats, setSessionStats] = useState({ again: 0, hard: 0, good: 0, easy: 0 })

  useEffect(() => {
    if (!user) return
    getWordSets(user.id).then(setWordSets).catch(console.error)
  }, [user])

  const loadSession = async (setId?: number, reviewMode: ReviewMode = mode) => {
    if (!user) return
    setLoading(true)
    setStarted(false)
    setDone(false)
    setIndex(0)
    setFlipped(false)
    setSessionStats({ again: 0, hard: 0, good: 0, easy: 0 })
    try {
      const cards = await getReviewSession(user.id, setId, reviewMode)
      setQueue(cards)
      if (cards.length > 0) setStarted(true)
      else setDone(true)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSession(selectedSetId, mode)
  }, [user])

  const handleApply = () => loadSession(selectedSetId, mode)

  const current = queue[index]

  const handleRate = async (rating: ReviewQuality) => {
    if (!user || !current || submitting) return
    setSubmitting(true)
    try {
      await submitReview(user.id, current.id, QUALITY_MAP[rating])
      setSessionStats(prev => ({ ...prev, [rating]: prev[rating] + 1 }))
      if (index + 1 >= queue.length) {
        setDone(true)
        setStarted(false)
      } else {
        setIndex(prev => prev + 1)
        setFlipped(false)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) return <div className="review-empty">먼저 사용자를 선택해주세요.</div>

  return (
    <div className="review-page">
      {/* Controls */}
      {!started && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Mode selector */}
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>복습 방식</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {MODE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setMode(opt.value)}
                    style={{
                      padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: '0.9rem',
                      background: mode === opt.value ? 'var(--primary)' : 'var(--bg)',
                      color: mode === opt.value ? '#fff' : 'var(--text)',
                      border: mode === opt.value ? '2px solid var(--primary)' : '1px solid var(--border)',
                      fontWeight: mode === opt.value ? 600 : 400,
                    }}
                    title={opt.desc}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 6 }}>
                {MODE_OPTIONS.find(o => o.value === mode)?.desc}
              </div>
            </div>

            {/* Word set selector */}
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>복습 범위</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  className="input"
                  style={{ flex: 1, minWidth: 160, maxWidth: 280 }}
                  value={selectedSetId ?? ''}
                  onChange={e => setSelectedSetId(e.target.value ? Number(e.target.value) : undefined)}
                >
                  <option value="">전체 단어</option>
                  {wordSets.map(ws => (
                    <option key={ws.id} value={ws.id}>{ws.name}</option>
                  ))}
                </select>
                {wordSets.length === 0 && (
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate('/word-sets')}>
                    + 세트 만들기
                  </button>
                )}
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleApply} disabled={loading}>
              {loading ? '불러오는 중...' : '복습 시작'}
            </button>
          </div>
        </div>
      )}

      {loading && started && <div className="review-empty">불러오는 중...</div>}

      {done && (
        <div className="review-complete">
          {(() => {
            const total = Object.values(sessionStats).reduce((a, b) => a + b, 0)
            const hardCount = sessionStats.again + sessionStats.hard

            if (total === 0) {
              // No cards were reviewed — session was empty
              return (
                <>
                  <div className="complete-icon">📭</div>
                  <h2>복습할 단어 없음</h2>
                  <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
                    {mode === 'hard'
                      ? '핵심 복습할 단어가 없어요.'
                      : mode === 'all'
                      ? '단어가 없어요.'
                      : selectedSetId
                      ? '이 세트에 오늘 복습할 단어가 없어요.'
                      : '오늘 복습할 단어가 없어요.'}
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {mode === 'scheduled' ? '다른 복습 방식을 시도해보세요.' : ''}
                  </p>
                </>
              )
            }

            return (
              <>
                <div className="complete-icon">🎉</div>
                <h2>복습 완료!</h2>
                <div className="complete-stats">
                  <span className="stat-again">다시: {sessionStats.again}</span>
                  <span className="stat-hard">어려움: {sessionStats.hard}</span>
                  <span className="stat-good">잘함: {sessionStats.good}</span>
                  <span className="stat-easy">쉬움: {sessionStats.easy}</span>
                </div>

                {hardCount > 0 && (
                  <div style={{
                    marginTop: 20, padding: '16px 20px', borderRadius: 12,
                    background: '#fff3cd', border: '1px solid #ffc107',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 6, color: '#856404' }}>
                      🔥 아직 어려운 단어가 {hardCount}개 있어요
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#856404', marginBottom: 12 }}>
                      다시({sessionStats.again}개) + 어려움({sessionStats.hard}개) — 지금 바로 핵심 복습을 해보세요!
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={() => loadSession(selectedSetId, 'hard')}
                    >
                      핵심 복습 시작 ({hardCount}개)
                    </button>
                  </div>
                )}
              </>
            )
          })()}
          <button
            className="btn btn-secondary"
            style={{ marginTop: 16 }}
            onClick={() => { setDone(false); setStarted(false) }}
          >
            다시 설정하기
          </button>
        </div>
      )}

      {started && !done && current && (
        <>
          <div className="review-header">
            <span className="review-progress">{index + 1} / {queue.length}</span>
            <div className="review-progress-bar">
              <div
                className="review-progress-fill"
                style={{ width: `${(index / queue.length) * 100}%` }}
              />
            </div>
          </div>

          <div
            className={`flashcard ${flipped ? 'flipped' : ''}`}
            onClick={() => !flipped && setFlipped(true)}
          >
            <div className="flashcard-inner">
              <div className="flashcard-front">
                <div className="card-word">{current.word}</div>
                {current.part_of_speech && (
                  <div className="card-pos">{current.part_of_speech}</div>
                )}
                <div className="tap-hint">탭하여 정답 확인</div>
              </div>
              <div className="flashcard-back">
                <div className="card-word">{current.word}</div>
                {current.part_of_speech && (
                  <div className="card-pos">{current.part_of_speech}</div>
                )}
                <div className="card-definition">{current.definition || '정의 없음'}</div>
                {current.example_sentence && (
                  <div className="card-example">"{current.example_sentence}"</div>
                )}
                {current.synonyms && current.synonyms.length > 0 && (
                  <div style={{ fontSize: '0.85rem', marginTop: 8, color: '#17a2b8' }}>
                    유사어: {current.synonyms.join(', ')}
                  </div>
                )}
                {current.antonyms && current.antonyms.length > 0 && (
                  <div style={{ fontSize: '0.85rem', marginTop: 4, color: '#dc3545' }}>
                    반의어: {current.antonyms.join(', ')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {flipped && (
            <div className="rating-buttons">
              <button className="btn-rate again" onClick={() => handleRate('again')} disabled={submitting}>
                <span className="rate-label">다시</span>
                <span className="rate-interval">&lt;1일</span>
              </button>
              <button className="btn-rate hard" onClick={() => handleRate('hard')} disabled={submitting}>
                <span className="rate-label">어려움</span>
                <span className="rate-interval">~1일</span>
              </button>
              <button className="btn-rate good" onClick={() => handleRate('good')} disabled={submitting}>
                <span className="rate-label">잘함</span>
                <span className="rate-interval">{current.repetitions < 2 ? '~6일' : `~${Math.round(current.interval * current.easiness_factor)}일`}</span>
              </button>
              <button className="btn-rate easy" onClick={() => handleRate('easy')} disabled={submitting}>
                <span className="rate-label">쉬움</span>
                <span className="rate-interval">{current.repetitions < 2 ? '~6일+' : `~${Math.round(current.interval * current.easiness_factor * 1.3)}일`}</span>
              </button>
            </div>
          )}

          {!flipped && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              카드를 클릭하여 뒤집으세요
            </div>
          )}
        </>
      )}
    </div>
  )
}
