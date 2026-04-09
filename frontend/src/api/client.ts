import type {
  Card, Conversation, DeckStats, ExtractedWord,
  Message, Upload, User
} from '../types'

const BASE = '/api'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// --- Users ---
export const getUsers = () => req<User[]>('/users')
export const createUser = (name: string, avatar_emoji = '📚') =>
  req<User>('/users', { method: 'POST', body: JSON.stringify({ name, avatar_emoji }) })
export const deleteUser = (id: number) =>
  req<void>(`/users/${id}`, { method: 'DELETE' })

// --- Cards ---
export const getCards = (userId: number, search = '') =>
  req<Card[]>(`/users/${userId}/cards${search ? `?search=${encodeURIComponent(search)}` : ''}`)
export const getDeckStats = (userId: number) =>
  req<DeckStats>(`/users/${userId}/cards/stats`)
export const addCard = (userId: number, word: string, definition?: string, partOfSpeech?: string, exampleSentence?: string) =>
  req<Card>(`/users/${userId}/cards`, {
    method: 'POST',
    body: JSON.stringify({ word, definition, part_of_speech: partOfSpeech, example_sentence: exampleSentence }),
  })
export const deleteCard = (userId: number, cardId: number) =>
  req<void>(`/users/${userId}/cards/${cardId}`, { method: 'DELETE' })

// --- Review ---
export const getReviewSession = (userId: number) =>
  req<Card[]>(`/users/${userId}/review/session`)
export const submitReview = (userId: number, cardId: number, quality: number) =>
  req(`/users/${userId}/review/${cardId}`, {
    method: 'POST',
    body: JSON.stringify({ quality }),
  })

// --- Uploads ---
export const uploadImage = (userId: number, file: File): Promise<Upload> => {
  const form = new FormData()
  form.append('file', file)
  return fetch(`${BASE}/users/${userId}/uploads`, { method: 'POST', body: form })
    .then(r => r.json())
}
export const getUploadStatus = (userId: number, uploadId: number) =>
  req<Upload>(`/users/${userId}/uploads/${uploadId}`)
export const getExtractedWords = (userId: number, uploadId: number) =>
  req<ExtractedWord[]>(`/users/${userId}/uploads/${uploadId}/words`)
export const confirmWords = (userId: number, uploadId: number, words: string[]) =>
  req<{ added: number }>(`/users/${userId}/uploads/${uploadId}/confirm`, {
    method: 'POST',
    body: JSON.stringify(words),
  })

// --- Conversations ---
export const getConversations = (userId: number) =>
  req<Conversation[]>(`/users/${userId}/conversations`)
export const createConversation = (userId: number, focusWordIds: number[] = []) =>
  req<Conversation>(`/users/${userId}/conversations`, {
    method: 'POST',
    body: JSON.stringify({ focus_word_ids: focusWordIds }),
  })
export const getMessages = (userId: number, convId: number) =>
  req<Message[]>(`/users/${userId}/conversations/${convId}/messages`)
export const deleteConversation = (userId: number, convId: number) =>
  req<void>(`/users/${userId}/conversations/${convId}`, { method: 'DELETE' })

// --- Streaming chat ---
export async function* sendMessage(
  userId: number,
  convId: number,
  content: string
): AsyncGenerator<{ chunk?: string; done?: boolean; message?: Message; error?: string }> {
  const res = await fetch(`${BASE}/users/${userId}/conversations/${convId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })

  if (!res.ok || !res.body) throw new Error('Failed to send message')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = JSON.parse(line.slice(6))
      yield data
    }
  }
}
