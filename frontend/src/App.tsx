import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, Link } from 'react-router-dom'
import type { User } from './types'
import { getUsers } from './api/client'
import HomePage from './pages/HomePage'
import ReviewPage from './pages/ReviewPage'
import UploadPage from './pages/UploadPage'
import VocabularyPage from './pages/VocabularyPage'
import ConversationPage from './pages/ConversationPage'
import ChatPage from './pages/ChatPage'
import UsersPage from './pages/UsersPage'
import WordSetsPage from './pages/WordSetsPage'
import WordSetDetailPage from './pages/WordSetDetailPage'
import QuizPage from './pages/QuizPage'
import './App.css'

export const UserContext = React.createContext<{
  user: User | null
  setUser: (u: User | null) => void
}>({ user: null, setUser: () => {} })

const NAV_ITEMS = [
  { to: '/review',       end: false, icon: '🔁', label: '복습' },
  { to: '/vocabulary',   end: false, icon: '📋', label: '단어장' },
  { to: '/quiz',         end: false, icon: '📝', label: '퀴즈' },
  { to: '/conversation', end: false, icon: '💬', label: '대화' },
]

function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('envo_user')
    return saved ? JSON.parse(saved) : null
  })
  const [users, setUsers] = useState<User[]>([])
  const [showUserSelect, setShowUserSelect] = useState(false)

  useEffect(() => {
    getUsers().then(setUsers).catch(console.error)
  }, [])

  const handleUserSelect = (u: User) => {
    setUser(u)
    localStorage.setItem('envo_user', JSON.stringify(u))
    setShowUserSelect(false)
  }

  return (
    <UserContext.Provider value={{ user, setUser }}>
      <BrowserRouter>
        <div className="app">
          {/* 상단 네비게이션 */}
          <nav className="navbar">
            <Link to="/" className="nav-brand">📖 Envo</Link>

            {/* 데스크톱 메뉴 */}
            <div className="nav-links">
              {NAV_ITEMS.map(item => (
                <NavLink key={item.to} to={item.to} end={item.end}>
                  {item.label}
                </NavLink>
              ))}
            </div>

            <button className="user-btn" onClick={() => setShowUserSelect(v => !v)}>
              {user ? `${user.avatar_emoji} ${user.name}` : '👤 선택'}
            </button>
          </nav>

          {showUserSelect && (
            <div className="user-dropdown">
              {users.map(u => (
                <button key={u.id} className="user-option" onClick={() => handleUserSelect(u)}>
                  {u.avatar_emoji} {u.name}
                </button>
              ))}
              {users.length === 0 && (
                <div className="user-option-empty">먼저 사용자를 추가하세요</div>
              )}
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
                <NavLink
                  to="/users"
                  style={{ display: 'block', padding: '8px 12px', fontSize: '0.85rem', color: 'var(--primary)' }}
                  onClick={() => setShowUserSelect(false)}
                >
                  👤 사용자 관리
                </NavLink>
              </div>
            </div>
          )}

          <main className="main-content">
            {!user && (
              <div className="no-user-banner">
                사용자를 선택하거나 <NavLink to="/users">사용자 관리</NavLink>에서 새 사용자를 만들어주세요.
              </div>
            )}
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/review" element={<ReviewPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/vocabulary" element={<VocabularyPage />} />
              <Route path="/quiz" element={<QuizPage />} />
              <Route path="/conversation" element={<ConversationPage />} />
              <Route path="/conversation/:id" element={<ChatPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/word-sets" element={<WordSetsPage />} />
              <Route path="/word-sets/:id" element={<WordSetDetailPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          {/* 모바일 하단 탭바 */}
          <nav className="bottom-nav">
            {NAV_ITEMS.map(item => (
              <NavLink key={item.to} to={item.to} end={item.end} className="bottom-nav-item">
                <span className="bottom-nav-icon">{item.icon}</span>
                <span className="bottom-nav-label">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </BrowserRouter>
    </UserContext.Provider>
  )
}

export default App
