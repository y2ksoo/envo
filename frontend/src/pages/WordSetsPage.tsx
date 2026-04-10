import { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../App'
import { getWordSets, createWordSet, deleteWordSet } from '../api/client'
import type { WordSet } from '../types'

export default function WordSetsPage() {
  const { user } = useContext(UserContext)
  const navigate = useNavigate()
  const [sets, setSets] = useState<WordSet[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newWeek, setNewWeek] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    getWordSets(user.id)
      .then(setSets)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  const handleCreate = async () => {
    if (!user || !newName.trim()) return
    setSaving(true)
    try {
      const ws = await createWordSet(user.id, newName.trim(), newWeek || undefined)
      setSets(prev => [ws, ...prev])
      setNewName('')
      setNewWeek('')
      setShowForm(false)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (ws: WordSet) => {
    if (!user || !confirm(`"${ws.name}" 세트를 삭제할까요?`)) return
    await deleteWordSet(user.id, ws.id)
    setSets(prev => prev.filter(s => s.id !== ws.id))
  }

  if (!user) return <div className="vocab-empty">먼저 사용자를 선택해주세요.</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.6rem', flex: 1 }}>📂 단어 세트</h1>
        <button
          className={`btn ${showForm ? 'btn-secondary' : 'btn-primary'} btn-sm`}
          onClick={() => setShowForm(v => !v)}
        >
          {showForm ? '취소' : '+ 새 세트'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 14, fontSize: '1rem' }}>새 단어 세트 만들기</h3>
          <div className="form-group">
            <label>세트 이름 *</label>
            <input
              className="input"
              placeholder="예: 1주차 단어, Week 1..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>주차 시작일 (선택)</label>
            <input
              className="input"
              type="date"
              value={newWeek}
              onChange={e => setNewWeek(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button className="btn btn-secondary" onClick={() => { setShowForm(false); setNewName(''); setNewWeek('') }}>취소</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={!newName.trim() || saving}>
              {saving ? '저장 중...' : '만들기'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--text-muted)' }}>불러오는 중...</div>
      ) : sets.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>📂</div>
          <p>아직 단어 세트가 없습니다.</p>
          <p>주차별로 단어를 묶어 관리해보세요!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sets.map(ws => (
            <div
              key={ws.id}
              className="card"
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16 }}
              onClick={() => navigate(`/word-sets/${ws.id}`)}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: 4 }}>{ws.name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {ws.card_count}개 단어
                  {ws.week_start && ` · ${new Date(ws.week_start + 'T00:00:00').toLocaleDateString('ko-KR')} 주차`}
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={e => { e.stopPropagation(); navigate(`/word-sets/${ws.id}`) }}
              >
                보기
              </button>
              <button
                style={{ color: 'var(--text-muted)', background: 'none', fontSize: '1rem', cursor: 'pointer' }}
                onClick={e => { e.stopPropagation(); handleDelete(ws) }}
                title="삭제"
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
