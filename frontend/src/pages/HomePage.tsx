import { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../App'
import { getDeckStats, getUsers, createUser, deleteUser } from '../api/client'
import type { DeckStats, User } from '../types'

export default function HomePage() {
  const { user, setUser } = useContext(UserContext)
  const navigate = useNavigate()
  const [stats, setStats] = useState<DeckStats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('📚')

  useEffect(() => {
    getUsers().then(setUsers).catch(console.error)
  }, [])

  useEffect(() => {
    if (user) {
      getDeckStats(user.id).then(setStats).catch(console.error)
    }
  }, [user])

  const handleCreateUser = async () => {
    if (!newName.trim()) return
    const u = await createUser(newName.trim(), newEmoji)
    setUsers(prev => [...prev, u])
    setUser(u)
    localStorage.setItem('envo_user', JSON.stringify(u))
    setNewName('')
  }

  const handleDeleteUser = async (u: User) => {
    if (!confirm(`"${u.name}" 사용자를 삭제할까요?`)) return
    await deleteUser(u.id)
    setUsers(prev => prev.filter(x => x.id !== u.id))
    if (user?.id === u.id) {
      setUser(null)
      localStorage.removeItem('envo_user')
    }
  }

  const EMOJIS = ['📚', '🎓', '🌟', '🦊', '🐧', '🌈', '🎯', '🚀']

  return (
    <div>
      <h1 style={{ marginBottom: 24, fontSize: '1.6rem' }}>📖 Envo 영어 학습</h1>

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

      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 16, fontSize: '1.1rem' }}>사용자 관리</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {EMOJIS.map(e => (
              <button
                key={e}
                onClick={() => setNewEmoji(e)}
                style={{
                  width: 36, height: 36, borderRadius: 8, fontSize: '1.2rem',
                  background: newEmoji === e ? '#eef0ff' : 'var(--bg)',
                  border: newEmoji === e ? '2px solid var(--primary)' : '1px solid var(--border)',
                }}
              >{e}</button>
            ))}
          </div>
          <input
            className="input"
            style={{ flex: 1, minWidth: 140 }}
            placeholder="이름 입력"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateUser()}
          />
          <button className="btn btn-primary" onClick={handleCreateUser}>추가</button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {users.map(u => (
            <div
              key={u.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 10,
                background: user?.id === u.id ? '#eef0ff' : 'var(--bg)',
                border: user?.id === u.id ? '2px solid var(--primary)' : '1px solid var(--border)',
              }}
            >
              <span>{u.avatar_emoji} {u.name}</span>
              <button
                style={{ color: 'var(--text-muted)', background: 'none', fontSize: '0.8rem' }}
                onClick={() => handleDeleteUser(u)}
              >✕</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 16, fontSize: '1.1rem' }}>빠른 메뉴</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => navigate('/upload')}>
            📷 단어 사진으로 추가
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/review')}>
            🔁 오늘의 복습
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/conversation')}>
            💬 영어 대화 연습
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/vocabulary')}>
            📋 단어장 보기
          </button>
        </div>
      </div>
    </div>
  )
}
