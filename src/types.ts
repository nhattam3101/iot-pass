export type AnswerKey = string

export interface Question {
  id: string
  slideNumber: number
  question: string
  options: Record<AnswerKey, string>
  code: string | null
  explanation: string | null
  correctAnswer: AnswerKey | null
  answerSource: string | null
  speakerNotes: string | null
  imagePath: string
  requiresImage: boolean
  sourceSectionId: string
  topicIds: string[]
  status: 'verified_from_source' | 'review_required'
  needsReview: boolean
  reviewReasons: string[]
  ocr: { confidence: number; engine: string; manuallyInspected: boolean }
  duplicateOf: string | null
}

export interface Topic {
  id: string
  name: string
  kind: 'source_section' | 'technical'
  startSlide?: number
  endSlide?: number
  needsReview?: boolean
}

export interface AnswerRecord {
  selected: string
  correct: boolean
  attempts: number
  correctCount: number
  lastAnsweredAt: string
}

export interface ExamResult {
  id: string
  createdAt: string
  durationSeconds: number
  total: number
  correct: number
  score: number
  questionIds: string[]
  answers: Record<string, string>
}

export interface Progress {
  version: 1
  answers: Record<string, AnswerRecord>
  starred: string[]
  examHistory: ExamResult[]
}
