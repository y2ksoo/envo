import React, { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, Link, useNavigate } from 'react-router-dom'
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

const ALL_MENU_ITEMS = [
  { to: '/',             end: true,  icon: '🏠', label: '홈' },
  { to: '/review',       end: false, icon: '🔁', label: '복습' },
  { to: '/vocabulary',   end: false, icon: '📋', label: '단어장' },
  { to: '/quiz',         end: false, icon: '📝', label: '퀴즈' },
  { to: '/conversation', end: false, icon: '💬', label: '영어 대화' },
  null, // divider
  { to: '/word-sets',    end: false, icon: '📂', label: '단어 세트' },
  { to: '/upload',       end: false, icon: '➕', label: '단어 추가' },
  { to: '/users',        end: false, icon: '👤', label: '사용자 관리' },
]

function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('envo_user')
    return saved ? JSON.parse(saved) : null
  })
  const [users, setUsers] = useState<User[]>([])
  const [showUserSelect, setShowUserSelect] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  useEffect(() => {
    getUsers().then(setUsers).catch(console.error)
  }, [])

  const handleUserSelect = (u: User) => {
    setUser(u)
    localStorage.setItem('envo_user', JSON.stringify(u))
    setShowUserSelect(false)
    setShowMobileMenu(false)
  }

  const closeMobileMenu = useCallback(() => setShowMobileMenu(false), [])

  return (
    <UserContext.Provider value={{ user, setUser }}>
      <BrowserRouter>
        <div className="app">
          {/* 상단 네비게이션 */}
          <nav className="navbar">
            <Link to="/" className="nav-brand" onClick={closeMobileMenu}>
              <img src="/favicon.png" alt="Envo" className="nav-logo" />
              Envo
            </Link>

            {/* 데스크톱 메뉴 */}
            <div className="nav-links">
              {NAV_ITEMS.map(item => (
                <NavLink key={item.to} to={item.to} end={item.end}>
                  {item.label}
                </NavLink>
              ))}
            </div>

            {/* 데스크톱: 사용자 버튼 */}
            <button className="user-btn desktop-only" onClick={() => setShowUserSelect(v => !v)}>
              {user ? `${user.avatar_emoji} ${user.name}` : '👤 선택'}
            </button>

            {/* 모바일: 햄버거 버튼 */}
            <button
              className="hamburger-btn mobile-only"
              onClick={() => { setShowMobileMenu(v => !v); setShowUserSelect(false) }}
              aria-label="전체 메뉴"
            >
              <span className={`hamburger-icon ${showMobileMenu ? 'open' : ''}`}>
                <span /><span /><span />
              </span>
            </button>
          </nav>

          {/* 데스크톱: 사용자 드롭다운 */}
          {showUserSelect && (
            <>
              <div className="dropdown-backdrop" onClick={() => setShowUserSelect(false)} />
              <div className="user-dropdown">
                {users.map(u => (
                  <button key={u.id} className="user-option" onClick={() => handleUserSelect(u)}>
                    {u.avatar_emoji} {u.name}
                    {user?.id === u.id && <span style={{ marginLeft: 'auto', color: 'var(--primary)', fontSize: '0.75rem' }}>현재</span>}
                  </button>
                ))}
                {users.length === 0 && (
                  <div className="user-option-empty">먼저 사용자를 추가하세요</div>
                )}
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4 }}>
                  <NavLink
                    to="/users"
                    style={{ display: 'block', padding: '10px 16px', fontSize: '0.85rem', color: 'var(--primary)' }}
                    onClick={() => setShowUserSelect(false)}
                  >
                    👤 사용자 관리
                  </NavLink>
                </div>
              </div>
            </>
          )}

          {/* 모바일: 전체 메뉴 드로어 */}
          {showMobileMenu && (
            <div className="mobile-menu-overlay" onClick={closeMobileMenu}>
              <div className="mobile-menu-drawer" onClick={e => e.stopPropagation()}>
                {/* 사용자 선택 섹션 */}
                <div className="mobile-menu-user-section">
                  <div className="mobile-menu-section-title">사용자</div>
                  {users.map(u => (
                    <button
                      key={u.id}
                      className={`mobile-menu-user-item ${user?.id === u.id ? 'active' : ''}`}
                      onClick={() => handleUserSelect(u)}
                    >
                      <span className="mobile-menu-user-emoji">{u.avatar_emoji}</span>
                      <span>{u.name}</span>
                      {user?.id === u.id && <span className="mobile-menu-user-current">현재</span>}
                    </button>
                  ))}
                  {users.length === 0 && (
                    <div style={{ padding: '8px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      등록된 사용자가 없습니다
                    </div>
                  )}
                </div>

                <div className="mobile-menu-divider" />

                {/* 전체 메뉴 */}
                <div className="mobile-menu-section-title">메뉴</div>
                <nav className="mobile-menu-nav">
                  {ALL_MENU_ITEMS.map((item, i) =>
                    item === null ? (
                      <div key={`divider-${i}`} className="mobile-menu-divider" />
                    ) : (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className="mobile-menu-item"
                        onClick={closeMobileMenu}
                      >
                        <span className="mobile-menu-icon">{item.icon}</span>
                        <span>{item.label}</span>
                      </NavLink>
                    )
                  )}
                </nav>
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
