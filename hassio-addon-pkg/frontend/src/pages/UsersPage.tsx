import { useContext, useEffect, useState } from 'react'
import { UserContext } from '../App'
import { getUsers, createUser, deleteUser } from '../api/client'
import type { User } from '../types'

const EMOJIS = ['📚', '🎓', '🌟', '🦊', '🐧', '🌈', '🎯', '🚀']

export default function UsersPage() {
  const { user, setUser } = useContext(UserContext)
  const [users, setUsers] = useState<User[]>([])
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('📚')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

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

  const handleSelect = (u: User) => {
    setUser(u)
    localStorage.setItem('envo_user', JSON.stringify(u))
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24, fontSize: '1.6rem' }}>👤 사용자 관리</h1>

      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 16, fontSize: '1.1rem' }}>새 사용자 추가</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {EMOJIS.map(e => (
              <button
                key={e}
                onClick={() => setNewEmoji(e)}
                style={{
                  width: 36, height: 36, borderRadius: 8, fontSize: '1.2rem', cursor: 'pointer',
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
          <button className="btn btn-primary" onClick={handleCreateUser} disabled={!newName.trim()}>
            추가
          </button>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 16, fontSize: '1.1rem' }}>사용자 목록</h2>
        {loading ? (
          <div style={{ color: 'var(--text-muted)' }}>불러오는 중...</div>
        ) : users.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>등록된 사용자가 없습니다.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {users.map(u => (
              <div
                key={u.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 10,
                  background: user?.id === u.id ? '#eef0ff' : 'var(--bg)',
                  border: user?.id === u.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>{u.avatar_emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{u.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    가입: {new Date(u.created_at).toLocaleDateString('ko-KR')}
                  </div>
                </div>
                {user?.id !== u.id && (
                  <button className="btn btn-secondary btn-sm" onClick={() => handleSelect(u)}>
                    선택
                  </button>
                )}
                {user?.id === u.id && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>현재 사용자</span>
                )}
                <button
                  style={{ color: 'var(--text-muted)', background: 'none', fontSize: '1rem', cursor: 'pointer' }}
                  onClick={() => handleDeleteUser(u)}
                  title="삭제"
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
