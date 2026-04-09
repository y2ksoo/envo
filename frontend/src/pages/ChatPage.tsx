import { useContext, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { UserContext } from '../App'
import { getMessages, sendMessage } from '../api/client'
import type { Correction, Message } from '../types'
import './ChatPage.css'

export default function ChatPage() {
  const { user } = useContext(UserContext)
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const convId = Number(id)

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!user) return
    getMessages(user.id, convId)
      .then(setMessages)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user, convId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamText])

  const handleSend = async () => {
    if (!user || !input.trim() || streaming) return
    const text = input.trim()
    setInput('')

    const userMsg: Message = {
      id: Date.now(),
      conversation_id: convId,
      role: 'user',
      content: text,
      corrections: [],
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setStreaming(true)
    setStreamText('')

    try {
      for await (const data of sendMessage(user.id, convId, text)) {
        if (data.chunk) {
          setStreamText(prev => prev + data.chunk)
        }
        if (data.done && data.message) {
          setMessages(prev => [...prev.filter(m => m.id !== userMsg.id), userMsg, data.message])
          setStreamText('')
        }
        if (data.error) {
          setStreamText('')
          setMessages(prev => prev.filter(m => m.id !== userMsg.id))
          alert(`오류가 발생했습니다: ${data.error}`)
        }
      }
    } catch (e) {
      console.error(e)
      setStreamText('')
      setMessages(prev => prev.filter(m => m.id !== userMsg.id))
    } finally {
      setStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!user) return <div className="chat-empty">먼저 사용자를 선택해주세요.</div>
  if (loading) return <div className="chat-empty">불러오는 중...</div>

  return (
    <div className="chat-page">
      <div className="chat-header">
        <button className="back-btn" onClick={() => navigate('/conversation')}>← 뒤로</button>
        <h2>영어 대화 연습</h2>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && !streaming && (
          <div className="chat-welcome">
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>👋</div>
            <p>안녕하세요! 영어로 자유롭게 이야기해보세요.</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 6 }}>
              틀린 문법은 아래에 교정해드려요.
            </p>
          </div>
        )}

        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {streaming && streamText && (
          <div className="message assistant">
            <div className="bubble">
              <span>{streamText}</span>
              <span className="cursor" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          ref={textareaRef}
          className="chat-input"
          placeholder="영어로 메시지를 입력하세요... (Enter로 전송, Shift+Enter로 줄바꿈)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          disabled={streaming}
        />
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={!input.trim() || streaming}
        >
          {streaming ? '⏳' : '전송'}
        </button>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const [showCorrections, setShowCorrections] = useState(true)

  return (
    <div className={`message ${isUser ? 'user' : 'assistant'}`}>
      <div className="bubble">{message.content}</div>
      {!isUser && message.corrections.length > 0 && (
        <div className="corrections-block">
          <button
            className="corrections-toggle"
            onClick={() => setShowCorrections(v => !v)}
          >
            ✏️ 교정 {message.corrections.length}개 {showCorrections ? '▲' : '▼'}
          </button>
          {showCorrections && (
            <div className="corrections-list">
              {message.corrections.map((c: Correction, i: number) => (
                <div key={i} className="correction-item">
                  <span className="correction-original">"{c.original}"</span>
                  <span className="correction-arrow">→</span>
                  <span className="correction-fixed">"{c.corrected}"</span>
                  {c.explanation && <span className="correction-why">({c.explanation})</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {!isUser && message.corrections.length === 0 && message.content && (
        <div className="perfect-badge">✅ 완벽한 영어예요!</div>
      )}
    </div>
  )
}
