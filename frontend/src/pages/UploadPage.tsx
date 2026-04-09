import { useContext, useRef, useState } from 'react'
import { UserContext } from '../App'
import { uploadImage, getUploadStatus, getExtractedWords, confirmWords } from '../api/client'
import type { ExtractedWord, Upload } from '../types'
import './UploadPage.css'

type Step = 'select' | 'uploading' | 'processing' | 'review' | 'done'

export default function UploadPage() {
  const { user } = useContext(UserContext)
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('select')
  const [preview, setPreview] = useState<string | null>(null)
  const [upload, setUpload] = useState<Upload | null>(null)
  const [extractedWords, setExtractedWords] = useState<ExtractedWord[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [addedCount, setAddedCount] = useState(0)
  const [error, setError] = useState('')

  const handleFileSelect = (file: File) => {
    const url = URL.createObjectURL(file)
    setPreview(url)
    handleUpload(file)
  }

  const handleUpload = async (file: File) => {
    if (!user) return
    setStep('uploading')
    setError('')
    try {
      const up = await uploadImage(user.id, file)
      setUpload(up)
      setStep('processing')
      await pollStatus(user.id, up.id)
    } catch (e: any) {
      setError(e.message)
      setStep('select')
    }
  }

  const pollStatus = async (userId: number, uploadId: number) => {
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const up = await getUploadStatus(userId, uploadId)
      setUpload(up)
      if (up.status === 'done') {
        const words = await getExtractedWords(userId, uploadId)
        setExtractedWords(words)
        const newWords = new Set(words.filter(w => !w.already_in_deck).map(w => w.word))
        setSelected(newWords)
        setStep('review')
        return
      }
      if (up.status === 'error') {
        setError('단어 추출 중 오류가 발생했습니다.')
        setStep('select')
        return
      }
    }
    setError('시간이 초과되었습니다.')
    setStep('select')
  }

  const toggleWord = (word: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(word) ? next.delete(word) : next.add(word)
      return next
    })
  }

  const handleConfirm = async () => {
    if (!user || !upload) return
    const result = await confirmWords(user.id, upload.id, Array.from(selected))
    setAddedCount(result.added)
    setStep('done')
  }

  const handleReset = () => {
    setStep('select')
    setPreview(null)
    setUpload(null)
    setExtractedWords([])
    setSelected(new Set())
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  if (!user) return <div className="upload-empty">먼저 사용자를 선택해주세요.</div>

  return (
    <div className="upload-page">
      <h1 style={{ marginBottom: 24, fontSize: '1.4rem' }}>📷 사진으로 단어 추가</h1>

      {error && (
        <div className="upload-error">{error}</div>
      )}

      {step === 'select' && (
        <div
          className="drop-zone"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file) handleFileSelect(file)
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) handleFileSelect(f)
            }}
          />
          <div className="drop-icon">📷</div>
          <div className="drop-text">책 페이지 사진을 클릭하거나 드래그하세요</div>
          <div className="drop-hint">JPG, PNG, WebP 지원</div>
        </div>
      )}

      {(step === 'uploading' || step === 'processing') && (
        <div className="upload-status">
          {preview && <img src={preview} alt="업로드된 이미지" className="upload-preview" />}
          <div className="status-badge">
            <span className="spinner" />
            {step === 'uploading' ? '업로드 중...' : 'Claude AI가 단어를 분석하는 중...'}
          </div>
          <p className="status-hint">책 페이지에서 영어 단어를 추출하고 있습니다. 잠시만 기다려주세요.</p>
        </div>
      )}

      {step === 'review' && (
        <div className="word-review">
          {preview && <img src={preview} alt="업로드된 이미지" className="upload-preview" />}
          <div className="word-review-header">
            <h2>{extractedWords.length}개 단어 발견</h2>
            <div className="word-review-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setSelected(new Set(extractedWords.map(w => w.word)))}>
                전체 선택
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelected(new Set())}>
                전체 해제
              </button>
            </div>
          </div>

          <div className="word-grid">
            {extractedWords.map(w => (
              <div
                key={w.word}
                className={`word-card ${selected.has(w.word) ? 'selected' : ''} ${w.already_in_deck ? 'in-deck' : ''}`}
                onClick={() => !w.already_in_deck && toggleWord(w.word)}
              >
                <div className="word-card-header">
                  <span className="word-text">{w.word}</span>
                  {w.part_of_speech && <span className="word-pos">{w.part_of_speech}</span>}
                  {w.already_in_deck && <span className="already-badge">이미 추가됨</span>}
                </div>
                {w.definition && <div className="word-def">{w.definition}</div>}
              </div>
            ))}
          </div>

          <div className="confirm-footer">
            <span>{selected.size}개 선택됨</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" onClick={handleReset}>취소</button>
              <button
                className="btn btn-primary"
                onClick={handleConfirm}
                disabled={selected.size === 0}
              >
                내 단어장에 추가 →
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="upload-done">
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>✅</div>
          <h2>{addedCount}개 단어가 추가되었습니다!</h2>
          <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={handleReset}>또 추가하기</button>
          </div>
        </div>
      )}
    </div>
  )
}
