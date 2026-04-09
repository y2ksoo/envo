import { useContext, useRef, useState } from 'react'
import { UserContext } from '../App'
import { uploadImage, getUploadStatus, getExtractedWords, confirmWords, addCard } from '../api/client'
import type { ExtractedWord, Upload } from '../types'
import './UploadPage.css'

type PhotoStep = 'select' | 'uploading' | 'processing' | 'review' | 'done'
type Tab = 'photo' | 'json'

interface JsonWord {
  word: string
  part_of_speech?: string
  definition?: string
  example_sentence?: string
  already_in_deck: boolean
}

function parseJsonFile(text: string): JsonWord[] {
  const raw = JSON.parse(text)
  if (!Array.isArray(raw)) throw new Error('JSON은 배열 형식이어야 합니다.')

  return raw.map((item: any) => {
    if (typeof item === 'string') {
      return { word: item.trim().toLowerCase(), already_in_deck: false }
    }
    if (typeof item === 'object' && item.word) {
      return {
        word: String(item.word).trim().toLowerCase(),
        part_of_speech: item.part_of_speech || item.pos || undefined,
        definition: item.definition || item.meaning || item.desc || undefined,
        example_sentence: item.example_sentence || item.example || undefined,
        already_in_deck: false,
      }
    }
    throw new Error('각 항목은 문자열 또는 {word, ...} 객체여야 합니다.')
  }).filter(w => w.word)
}

export default function UploadPage() {
  const { user } = useContext(UserContext)
  const [tab, setTab] = useState<Tab>('photo')

  // --- 사진 탭 state ---
  const photoFileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<PhotoStep>('select')
  const [preview, setPreview] = useState<string | null>(null)
  const [upload, setUpload] = useState<Upload | null>(null)
  const [extractedWords, setExtractedWords] = useState<ExtractedWord[]>([])
  const [photoSelected, setPhotoSelected] = useState<Set<string>>(new Set())
  const [photoAddedCount, setPhotoAddedCount] = useState(0)
  const [photoError, setPhotoError] = useState('')

  // --- JSON 탭 state ---
  const jsonFileRef = useRef<HTMLInputElement>(null)
  const [jsonWords, setJsonWords] = useState<JsonWord[]>([])
  const [jsonSelected, setJsonSelected] = useState<Set<string>>(new Set())
  const [jsonStep, setJsonStep] = useState<'select' | 'review' | 'done'>('select')
  const [jsonAddedCount, setJsonAddedCount] = useState(0)
  const [jsonError, setJsonError] = useState('')
  const [jsonSaving, setJsonSaving] = useState(false)

  // =============== 사진 탭 handlers ===============
  const handlePhotoSelect = (file: File) => {
    setPreview(URL.createObjectURL(file))
    handlePhotoUpload(file)
  }

  const handlePhotoUpload = async (file: File) => {
    if (!user) return
    setStep('uploading')
    setPhotoError('')
    try {
      const up = await uploadImage(user.id, file)
      setUpload(up)
      setStep('processing')
      await pollStatus(user.id, up.id)
    } catch (e: any) {
      setPhotoError(e.message)
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
        setPhotoSelected(new Set(words.filter(w => !w.already_in_deck).map(w => w.word)))
        setStep('review')
        return
      }
      if (up.status === 'error') {
        setPhotoError('단어 추출 중 오류가 발생했습니다.')
        setStep('select')
        return
      }
    }
    setPhotoError('시간이 초과되었습니다.')
    setStep('select')
  }

  const handlePhotoConfirm = async () => {
    if (!user || !upload) return
    const result = await confirmWords(user.id, upload.id, Array.from(photoSelected))
    setPhotoAddedCount(result.added)
    setStep('done')
  }

  const resetPhoto = () => {
    setStep('select'); setPreview(null); setUpload(null)
    setExtractedWords([]); setPhotoSelected(new Set()); setPhotoError('')
    if (photoFileRef.current) photoFileRef.current.value = ''
  }

  // =============== JSON 탭 handlers ===============
  const handleJsonFile = async (file: File) => {
    setJsonError('')
    try {
      const text = await file.text()
      const words = parseJsonFile(text)
      if (words.length === 0) throw new Error('단어가 없습니다.')
      setJsonWords(words)
      setJsonSelected(new Set(words.map(w => w.word)))
      setJsonStep('review')
    } catch (e: any) {
      setJsonError(`파일 파싱 오류: ${e.message}`)
    }
  }

  const handleJsonConfirm = async () => {
    if (!user) return
    setJsonSaving(true)
    setJsonError('')
    let added = 0
    for (const w of jsonWords) {
      if (!jsonSelected.has(w.word)) continue
      try {
        await addCard(user.id, w.word, w.definition, w.part_of_speech, w.example_sentence)
        added++
      } catch {
        // 이미 있는 단어는 skip
      }
    }
    setJsonAddedCount(added)
    setJsonSaving(false)
    setJsonStep('done')
  }

  const resetJson = () => {
    setJsonWords([]); setJsonSelected(new Set())
    setJsonStep('select'); setJsonError('')
    if (jsonFileRef.current) jsonFileRef.current.value = ''
  }

  const toggleJsonWord = (word: string) =>
    setJsonSelected(prev => { const n = new Set(prev); n.has(word) ? n.delete(word) : n.add(word); return n })

  if (!user) return <div className="upload-empty">먼저 사용자를 선택해주세요.</div>

  return (
    <div className="upload-page">
      <h1 style={{ marginBottom: 20, fontSize: '1.4rem' }}>단어 추가</h1>

      <div className="upload-tabs">
        <button className={`upload-tab ${tab === 'photo' ? 'active' : ''}`} onClick={() => setTab('photo')}>
          📷 사진으로 추가
        </button>
        <button className={`upload-tab ${tab === 'json' ? 'active' : ''}`} onClick={() => setTab('json')}>
          📁 JSON 파일
        </button>
      </div>

      {/* ===== 사진 탭 ===== */}
      {tab === 'photo' && (
        <>
          {photoError && <div className="upload-error">{photoError}</div>}

          {step === 'select' && (
            <div
              className="drop-zone"
              onClick={() => photoFileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handlePhotoSelect(f) }}
            >
              <input ref={photoFileRef} type="file" accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoSelect(f) }}
              />
              <div className="drop-icon">📷</div>
              <div className="drop-text">책 페이지 사진을 클릭하거나 드래그하세요</div>
              <div className="drop-hint">JPG, PNG, WebP 지원 · Claude AI가 단어를 자동 추출합니다</div>
            </div>
          )}

          {(step === 'uploading' || step === 'processing') && (
            <div className="upload-status">
              {preview && <img src={preview} alt="업로드" className="upload-preview" />}
              <div className="status-badge">
                <span className="spinner" />
                {step === 'uploading' ? '업로드 중...' : 'Claude AI가 단어를 분석하는 중...'}
              </div>
              <p className="status-hint">책 페이지에서 영어 단어를 추출하고 있습니다.</p>
            </div>
          )}

          {step === 'review' && (
            <WordReviewPanel
              words={extractedWords.map(w => ({ ...w, already_in_deck: w.already_in_deck }))}
              selected={photoSelected}
              onToggle={word => setPhotoSelected(prev => { const n = new Set(prev); n.has(word) ? n.delete(word) : n.add(word); return n })}
              onSelectAll={() => setPhotoSelected(new Set(extractedWords.map(w => w.word)))}
              onDeselectAll={() => setPhotoSelected(new Set())}
              onConfirm={handlePhotoConfirm}
              onCancel={resetPhoto}
              preview={preview}
            />
          )}

          {step === 'done' && (
            <DonePanel count={photoAddedCount} onReset={resetPhoto} />
          )}
        </>
      )}

      {/* ===== JSON 탭 ===== */}
      {tab === 'json' && (
        <>
          {jsonError && <div className="upload-error">{jsonError}</div>}

          {jsonStep === 'select' && (
            <>
              <div
                className="drop-zone"
                onClick={() => jsonFileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleJsonFile(f) }}
              >
                <input ref={jsonFileRef} type="file" accept=".json"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleJsonFile(f) }}
                />
                <div className="drop-icon">📁</div>
                <div className="drop-text">JSON 파일을 클릭하거나 드래그하세요</div>
                <div className="drop-hint">단어 목록 JSON 파일 · API 비용 없음</div>
              </div>

              <div className="json-format-guide card">
                <div className="guide-title">📋 JSON 형식 안내</div>
                <div className="guide-formats">
                  <div className="guide-format">
                    <div className="guide-format-label">간단 형식 (단어만)</div>
                    <pre>{`["ephemeral", "resilient", "ambiguous"]`}</pre>
                  </div>
                  <div className="guide-format">
                    <div className="guide-format-label">상세 형식 (정의 포함)</div>
                    <pre>{`[
  {
    "word": "ephemeral",
    "part_of_speech": "adjective",
    "definition": "lasting a very short time",
    "example_sentence": "Fame is ephemeral."
  }
]`}</pre>
                  </div>
                </div>
              </div>
            </>
          )}

          {jsonStep === 'review' && (
            <WordReviewPanel
              words={jsonWords}
              selected={jsonSelected}
              onToggle={toggleJsonWord}
              onSelectAll={() => setJsonSelected(new Set(jsonWords.map(w => w.word)))}
              onDeselectAll={() => setJsonSelected(new Set())}
              onConfirm={handleJsonConfirm}
              onCancel={resetJson}
              confirmLabel={jsonSaving ? '추가 중...' : undefined}
              confirmDisabled={jsonSaving}
            />
          )}

          {jsonStep === 'done' && (
            <DonePanel count={jsonAddedCount} onReset={resetJson} />
          )}
        </>
      )}
    </div>
  )
}

// ===== 공용 컴포넌트 =====

interface WordReviewPanelProps {
  words: { word: string; part_of_speech?: string | null; definition?: string | null; already_in_deck?: boolean }[]
  selected: Set<string>
  onToggle: (word: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  onConfirm: () => void
  onCancel: () => void
  preview?: string | null
  confirmLabel?: string
  confirmDisabled?: boolean
}

function WordReviewPanel({ words, selected, onToggle, onSelectAll, onDeselectAll, onConfirm, onCancel, preview, confirmLabel, confirmDisabled }: WordReviewPanelProps) {
  return (
    <div className="word-review">
      {preview && <img src={preview} alt="업로드" className="upload-preview" />}
      <div className="word-review-header">
        <h2>{words.length}개 단어 발견</h2>
        <div className="word-review-actions">
          <button className="btn btn-secondary btn-sm" onClick={onSelectAll}>전체 선택</button>
          <button className="btn btn-secondary btn-sm" onClick={onDeselectAll}>전체 해제</button>
        </div>
      </div>
      <div className="word-grid">
        {words.map(w => (
          <div
            key={w.word}
            className={`word-card ${selected.has(w.word) ? 'selected' : ''} ${w.already_in_deck ? 'in-deck' : ''}`}
            onClick={() => !w.already_in_deck && onToggle(w.word)}
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
          <button className="btn btn-secondary" onClick={onCancel}>취소</button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={selected.size === 0 || confirmDisabled}>
            {confirmLabel ?? '내 단어장에 추가 →'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DonePanel({ count, onReset }: { count: number; onReset: () => void }) {
  return (
    <div className="upload-done">
      <div style={{ fontSize: '3rem', marginBottom: 12 }}>✅</div>
      <h2>{count}개 단어가 추가되었습니다!</h2>
      <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'center' }}>
        <button className="btn btn-primary" onClick={onReset}>또 추가하기</button>
      </div>
    </div>
  )
}
