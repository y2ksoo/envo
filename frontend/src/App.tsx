import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import type { User } from './types'
import { getUsers } from './api/client'
import HomePage from './pages/HomePage'
import ReviewPage from './pages/ReviewPage'
import UploadPage from './pages/UploadPage'
import VocabularyPage from './pages/VocabularyPage'
import ConversationPage from './pages/ConversationPage'
import ChatPage from './pages/ChatPage'
import './App.css'

export const UserContext = React.createContext<{
  user: User | null
  setUser: (u: User | null) => void
}>({ user: null, setUser: () => {} })

const NAV_ITEMS = [
  { to: '/',            end: true,  icon: '🏠', label: '홈' },
  { to: '/review',      end: false, icon: '🔁', label: '복습' },
  { to: '/upload',      end: false, icon: '➕', label: '추가' },
  { to: '/vocabulary',  end: false, icon: '📋', label: '단어장' },
  { to: '/conversation',end: false, icon: '💬', label: '대화' },
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
            <div className="nav-brand">📖 Envo</div>

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
                <div className="user-option-empty">먼저 홈에서 사용자를 추가하세요</div>
              )}
            </div>
          )}

          <main className="main-content">
            {!user && (
              <div className="no-user-banner">
                사용자를 선택하거나 홈에서 새 사용자를 만들어주세요.
              </div>
            )}
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/review" element={<ReviewPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/vocabulary" element={<VocabularyPage />} />
              <Route path="/conversation" element={<ConversationPage />} />
              <Route path="/conversation/:id" element={<ChatPage />} />
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
