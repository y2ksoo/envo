export interface User {
  id: number
  name: string
  avatar_emoji: string
  created_at: string
}

export interface Card {
  id: number
  word_id: number
  word: string
  definition: string | null
  part_of_speech: string | null
  example_sentence: string | null
  synonyms: string[]
  antonyms: string[]
  easiness_factor: number
  interval: number
  repetitions: number
  next_review: string
  total_reviews: number
  correct_reviews: number
}

export interface DeckStats {
  total_words: number
  due_today: number
  mastered: number
  new_cards: number
}

export interface Upload {
  id: number
  user_id: number
  filename: string
  status: 'pending' | 'processing' | 'done' | 'error'
  extracted_count: number
  created_at: string
}

export interface ExtractedWord {
  word: string
  part_of_speech: string | null
  definition: string | null
  example_sentence: string | null
  already_in_deck: boolean
}

export interface WordSet {
  id: number
  user_id: number
  name: string
  week_start: string | null
  created_at: string
  card_count: number
}

export interface Conversation {
  id: number
  user_id: number
  title: string | null
  focus_words: number[]
  created_at: string
  updated_at: string
  message_count: number
}

export interface Message {
  id: number
  conversation_id: number
  role: 'user' | 'assistant'
  content: string
  corrections: Correction[]
  created_at: string
}

export interface Correction {
  original: string
  corrected: string
  explanation: string
}

export type ReviewQuality = 'again' | 'hard' | 'good' | 'easy'

export const QUALITY_MAP: Record<ReviewQuality, number> = {
  again: 0,
  hard: 2,
  good: 4,
  easy: 5,
}

export interface QuizQuestion {
  card: Card
  userAnswer: string
  isCorrect: boolean | null  // null = 아직 답 안함
}
