import { useContext, useEffect, useState } from 'react'
import { UserContext } from '../App'
import { getReviewSession, submitReview } from '../api/client'
import type { Card, ReviewQuality } from '../types'
import { QUALITY_MAP } from '../types'
import './ReviewPage.css'

export default function ReviewPage() {
  const { user } = useContext(UserContext)
  const [queue, setQueue] = useState<Card[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sessionStats, setSessionStats] = useState({ again: 0, hard: 0, good: 0, easy: 0 })

  useEffect(() => {
    if (!user) return
    setLoading(true)
    getReviewSession(user.id)
      .then(cards => {
        setQueue(cards)
        setDone(cards.length === 0)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  const current = queue[index]

  const handleRate = async (rating: ReviewQuality) => {
    if (!user || !current || submitting) return
    setSubmitting(true)
    try {
      await submitReview(user.id, current.id, QUALITY_MAP[rating])
      setSessionStats(prev => ({ ...prev, [rating]: prev[rating] + 1 }))
      if (index + 1 >= queue.length) {
        setDone(true)
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
  if (loading) return <div className="review-empty">불러오는 중...</div>

  if (done) {
    const total = Object.values(sessionStats).reduce((a, b) => a + b, 0)
    return (
      <div className="review-complete">
        <div className="complete-icon">🎉</div>
        <h2>오늘 복습 완료!</h2>
        {total > 0 && (
          <div className="complete-stats">
            <span className="stat-again">다시: {sessionStats.again}</span>
            <span className="stat-hard">어려움: {sessionStats.hard}</span>
            <span className="stat-good">잘함: {sessionStats.good}</span>
            <span className="stat-easy">쉬움: {sessionStats.easy}</span>
          </div>
        )}
        {total === 0 && <p>오늘 복습할 단어가 없어요. 나중에 다시 확인하세요!</p>}
      </div>
    )
  }

  return (
    <div className="review-page">
      <div className="review-header">
        <span className="review-progress">{index + 1} / {queue.length}</span>
        <div className="review-progress-bar">
          <div
            className="review-progress-fill"
            style={{ width: `${((index) / queue.length) * 100}%` }}
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
    </div>
  )
}
