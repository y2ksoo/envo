import { useContext, useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../App'
import { getWordSetCards, getCards, getWordSets } from '../api/client'
import type { Card, WordSet } from '../types'

const QUIZ_SIZE = 20

type QuizState = 'setup' | 'running' | 'result'

interface QuizItem {
  card: Card
  userAnswer: string
  isCorrect: boolean | null
}

interface HistoryRecord {
  date: string          // ISO date string
  scopeLabel: string
  total: number
  correctCount: number
  results: { cardId: number; word: string; definition: string; isCorrect: boolean; userAnswer: string }[]
}

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z\s'-]/g, '')
}

function historyKey(userId: number, wordSetId: number | undefined) {
  return `envo_quiz_${userId}_${wordSetId ?? 'all'}`
}

function saveHistory(userId: number, wordSetId: number | undefined, questions: QuizItem[], scopeLabel: string) {
  const record: HistoryRecord = {
    date: new Date().toISOString(),
    scopeLabel,
    total: questions.length,
    correctCount: questions.filter(q => q.isCorrect).length,
    results: questions.map(q => ({
      cardId: q.card.id,
      word: q.card.word,
      definition: q.card.definition ?? '',
      isCorrect: q.isCorrect ?? false,
      userAnswer: q.userAnswer,
    })),
  }
  localStorage.setItem(historyKey(userId, wordSetId), JSON.stringify(record))
}

function loadHistory(userId: number, wordSetId: number | undefined): HistoryRecord | null {
  try {
    const raw = localStorage.getItem(historyKey(userId, wordSetId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function QuizPage() {
  const { user } = useContext(UserContext)
  const navigate = useNavigate()

  const [wordSets, setWordSets] = useState<WordSet[]>([])
  const [selectedSetId, setSelectedSetId] = useState<number | undefined>(undefined)
  const [allCards, setAllCards] = useState<Card[]>([])
  const [cardsLoading, setCardsLoading] = useState(false)

  const [state, setState] = useState<QuizState>('setup')
  const [questions, setQuestions] = useState<QuizItem[]>([])
  const [current, setCurrent] = useState(0)
  const [input, setInput] = useState('')
  const [showHint, setShowHint] = useState(false)
  const [checked, setChecked] = useState(false)
  const [history, setHistory] = useState<HistoryRecord | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  // Load word sets
  useEffect(() => {
    if (!user) return
    getWordSets(user.id).then(setWordSets).catch(console.error)
  }, [user])

  // Load cards + history whenever scope changes
  useEffect(() => {
    if (!user) return
    setCardsLoading(true)
    const load = selectedSetId
      ? getWordSetCards(user.id, selectedSetId)
      : getCards(user.id)

    load.then(cards => {
      setAllCards(cards.filter(c => c.definition))
    }).catch(console.error)
      .finally(() => setCardsLoading(false))

    setHistory(loadHistory(user.id, selectedSetId))
    setState('setup')
  }, [user, selectedSetId])

  const scopeLabel = selectedSetId
    ? (wordSets.find(ws => ws.id === selectedSetId)?.name ?? '세트')
    : '전체'

  const buildQuestions = (cards: Card[]): QuizItem[] => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, QUIZ_SIZE).map(card => ({ card, userAnswer: '', isCorrect: null }))
  }

  const startNew = () => {
    const qs = buildQuestions(allCards)
    setQuestions(qs)
    setCurrent(0)
    setInput('')
    setShowHint(false)
    setChecked(false)
    setState('running')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const retryWrong = (wrongCards: { cardId: number; word: string; definition: string }[]) => {
    // Find matching Card objects from allCards; fall back to stub
    const cardMap = new Map(allCards.map(c => [c.id, c]))
    const items: QuizItem[] = wrongCards
      .map(w => {
        const card = cardMap.get(w.cardId)
        if (!card) return null
        return { card, userAnswer: '', isCorrect: null as boolean | null }
      })
      .filter(Boolean) as QuizItem[]

    if (items.length === 0) {
      // cards might have been deleted — just start fresh
      startNew()
      return
    }

    const shuffled = [...items].sort(() => Math.random() - 0.5)
    setQuestions(shuffled)
    setCurrent(0)
    setInput('')
    setShowHint(false)
    setChecked(false)
    setState('running')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const checkAnswer = () => {
    if (!input.trim()) return
    const correct = normalize(input) === normalize(questions[current].card.word)
    setQuestions(prev => prev.map((q, i) =>
      i === current ? { ...q, userAnswer: input, isCorrect: correct } : q
    ))
    setChecked(true)
  }

  const nextQuestion = (updatedQuestions: QuizItem[]) => {
    if (current + 1 >= updatedQuestions.length) {
      if (user) saveHistory(user.id, selectedSetId, updatedQuestions, scopeLabel)
      setHistory(loadHistory(user!.id, selectedSetId))
      setState('result')
    } else {
      setCurrent(prev => prev + 1)
      setInput('')
      setShowHint(false)
      setChecked(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    if (!checked) {
      checkAnswer()
    } else {
      nextQuestion(questions)
    }
  }

  // Sync questions state before calling nextQuestion
  const handleNext = () => nextQuestion(questions)

  if (!user) return <div className="vocab-empty">먼저 사용자를 선택해주세요.</div>

  /* ── Setup screen ─────────────────────────────────────────── */
  if (state === 'setup') {
    const wrongFromHistory = history?.results.filter(r => !r.isCorrect) ?? []

    return (
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.6rem', marginBottom: 20 }}>📝 스펠링 퀴즈</h1>

        {/* Scope selector */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>퀴즈 범위</div>
          <select
            className="input"
            value={selectedSetId ?? ''}
            onChange={e => setSelectedSetId(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">전체 단어</option>
            {wordSets.map(ws => (
              <option key={ws.id} value={ws.id}>{ws.name}</option>
            ))}
          </select>
          {!cardsLoading && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 8 }}>
              {allCards.length > 0
                ? `출제 가능: ${allCards.length}개 단어 (최대 ${QUIZ_SIZE}문제)`
                : '정의가 있는 단어가 없습니다.'}
            </div>
          )}
        </div>

        {/* Previous history */}
        {history && (
          <div className="card" style={{ marginBottom: 20, background: '#f8f9ff', border: '1px solid #d0d5ff' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>
              이전 기록 · {new Date(history.date).toLocaleDateString('ko-KR')} · {history.scopeLabel}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: history.correctCount / history.total >= 0.7 ? '#28a745' : '#dc3545' }}>
                {Math.round((history.correctCount / history.total) * 100)}점
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {history.total}문제 중 {history.correctCount}개 정답
                {wrongFromHistory.length > 0 && (
                  <span style={{ color: '#dc3545', fontWeight: 600 }}> · 틀린 단어 {wrongFromHistory.length}개</span>
                )}
              </div>
            </div>
            {wrongFromHistory.length > 0 && (
              <button
                className="btn btn-secondary"
                style={{ borderColor: '#dc3545', color: '#dc3545', marginRight: 8 }}
                onClick={() => retryWrong(wrongFromHistory)}
                disabled={cardsLoading || allCards.length === 0}
              >
                ❌ 틀린 단어만 다시 풀기 ({wrongFromHistory.length}개)
              </button>
            )}
          </div>
        )}

        <button
          className="btn btn-primary"
          style={{ width: '100%', fontSize: '1.05rem', padding: '12px' }}
          onClick={startNew}
          disabled={cardsLoading || allCards.length === 0}
        >
          {cardsLoading ? '불러오는 중...' : `새 퀴즈 시작 (${Math.min(allCards.length, QUIZ_SIZE)}문제)`}
        </button>
      </div>
    )
  }

  /* ── Result screen ────────────────────────────────────────── */
  if (state === 'result') {
    const correctCount = questions.filter(q => q.isCorrect).length
    const pct = Math.round((correctCount / questions.length) * 100)
    const grade = pct >= 90 ? '🏆 훌륭해요!' : pct >= 70 ? '😊 잘했어요!' : pct >= 50 ? '🙂 괜찮아요!' : '💪 다시 도전!'
    const wrongQuestions = questions.filter(q => q.isCorrect === false)

    return (
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 28, padding: '28px 0' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>{grade}</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: pct >= 70 ? '#28a745' : pct >= 50 ? '#ffc107' : '#dc3545', marginBottom: 6 }}>
            {pct}점
          </div>
          <div style={{ color: 'var(--text-muted)' }}>{questions.length}문제 중 {correctCount}개 정답</div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={startNew}>새로 시작</button>
          {wrongQuestions.length > 0 && (
            <button
              className="btn btn-secondary"
              style={{ borderColor: '#dc3545', color: '#dc3545' }}
              onClick={() => retryWrong(wrongQuestions.map(q => ({
                cardId: q.card.id,
                word: q.card.word,
                definition: q.card.definition ?? '',
              })))}
            >
              ❌ 틀린 단어만 다시 풀기 ({wrongQuestions.length}개)
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => setState('setup')}>범위 변경</button>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: '1rem' }}>결과 상세</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {questions.map(q => (
              <div
                key={q.card.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                  borderRadius: 8, background: q.isCorrect ? '#d4edda' : '#f8d7da',
                  border: `1px solid ${q.isCorrect ? '#c3e6cb' : '#f5c6cb'}`,
                }}
              >
                <span style={{ fontSize: '1.1rem', marginTop: 1 }}>{q.isCorrect ? '✅' : '❌'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{q.card.word}</div>
                  {!q.isCorrect && (
                    <div style={{ fontSize: '0.85rem', color: '#721c24', marginTop: 2 }}>
                      내 답: {q.userAnswer || '(미입력)'}
                    </div>
                  )}
                  <div style={{ fontSize: '0.82rem', color: '#555', marginTop: 2 }}>{q.card.definition}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* ── Running quiz ─────────────────────────────────────────── */
  const q = questions[current]
  const card = q.card
  const hint = card.word[0] + '_'.repeat(Math.max(0, card.word.length - 1))

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 4 }}>
            {current + 1} / {questions.length}
            <span style={{ marginLeft: 12, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              {scopeLabel}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%', borderRadius: 3, background: 'var(--primary)',
                width: `${(current / questions.length) * 100}%`,
                transition: 'width 0.3s',
              }}
            />
          </div>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          ✅ {questions.slice(0, current).filter(q => q.isCorrect).length}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20, minHeight: 160 }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          정의
        </div>
        <div style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: 12 }}>
          {card.definition}
        </div>
        {card.part_of_speech && (
          <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {card.part_of_speech}
          </div>
        )}
        {card.example_sentence && (
          <div style={{ marginTop: 12, fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            "{card.example_sentence.replace(new RegExp(card.word, 'gi'), '___')}"
          </div>
        )}
        {showHint && (
          <div style={{ marginTop: 12, fontSize: '0.95rem', color: 'var(--primary)', fontFamily: 'monospace', letterSpacing: '0.1em' }}>
            힌트: {hint}
          </div>
        )}
      </div>

      {!checked ? (
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <input
            ref={inputRef}
            className="input"
            style={{ flex: 1, fontSize: '1.1rem' }}
            placeholder="단어를 입력하세요..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          <button className="btn btn-primary" onClick={checkAnswer} disabled={!input.trim()}>
            확인
          </button>
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              padding: '14px 16px', borderRadius: 10, marginBottom: 12,
              background: q.isCorrect ? '#d4edda' : '#f8d7da',
              border: `1px solid ${q.isCorrect ? '#c3e6cb' : '#f5c6cb'}`,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {q.isCorrect ? '✅ 정답!' : '❌ 틀렸어요'}
            </div>
            {!q.isCorrect && (
              <div style={{ fontSize: '0.9rem', color: '#721c24' }}>
                정답: <strong>{card.word}</strong>
                {q.userAnswer && ` (내 답: ${q.userAnswer})`}
              </div>
            )}
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={handleNext}
            autoFocus
          >
            {current + 1 >= questions.length ? '결과 보기' : '다음 문제 →'}
          </button>
        </div>
      )}

      {!checked && !showHint && (
        <button
          style={{ background: 'none', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}
          onClick={() => setShowHint(true)}
        >
          💡 힌트 보기
        </button>
      )}
    </div>
  )
}
