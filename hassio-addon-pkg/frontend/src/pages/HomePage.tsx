import { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../App'
import { getDeckStats } from '../api/client'
import type { DeckStats } from '../types'

export default function HomePage() {
  const { user } = useContext(UserContext)
  const navigate = useNavigate()
  const [stats, setStats] = useState<DeckStats | null>(null)

  useEffect(() => {
    if (user) {
      getDeckStats(user.id).then(setStats).catch(console.error)
    }
  }, [user])

  return (
    <div>
      <h1 style={{ marginBottom: 24, fontSize: '1.6rem' }}>📖 Envo 영단어 학습</h1>

      {user && stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.due_today}</div>
            <div className="stat-label">오늘 복습할 단어</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.total_words}</div>
            <div className="stat-label">전체 단어</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.mastered}</div>
            <div className="stat-label">마스터한 단어</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.new_cards}</div>
            <div className="stat-label">새 단어</div>
          </div>
        </div>
      )}

      {user && stats && stats.due_today > 0 && (
        <div className="card" style={{ marginBottom: 24, textAlign: 'center', background: '#eef0ff' }}>
          <p style={{ marginBottom: 12 }}>오늘 복습할 단어가 <strong>{stats.due_today}개</strong> 있어요!</p>
          <button className="btn btn-primary" onClick={() => navigate('/review')}>
            지금 복습하기 →
          </button>
        </div>
      )}

      <div className="card">
        <h2 style={{ marginBottom: 16, fontSize: '1.1rem' }}>빠른 메뉴</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/review')}>
            🔁 오늘의 복습
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/quiz')}>
            📝 스펠링 퀴즈
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/word-sets')}>
            📂 단어 세트 관리
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/upload')}>
            📷 단어 추가
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/conversation')}>
            💬 영어 대화 연습
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/users')}>
            👤 사용자 관리
          </button>
        </div>
      </div>
    </div>
  )
}
