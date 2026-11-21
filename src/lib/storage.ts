import type { ExamResult, Progress, Question } from '../types'
import type { PracticeSession } from './practice'

const PROGRESS_KEY = 'iot102-progress-v1'
const BANK_OVERRIDES_KEY = 'iot102-bank-overrides-v1'
const PRACTICE_KEY = 'iot102-practice-session-v1'
const EXAM_KEY = 'iot102-active-exam-v1'

export const emptyProgress: Progress = { version: 1, answers: {}, starred: [], examHistory: [] }

/** Fields a learner may change locally. Everything else in the bank is source data. */
export const EDITABLE_FIELDS = ['question', 'options', 'correctAnswer', 'needsReview'] as const
export type BankOverride = Partial<Pick<Question, (typeof EDITABLE_FIELDS)[number]>>

export interface PracticeFilter {
  topicId?: string
  ids?: string[]
  title: string
}
export interface PracticeRange { start: number; end: number }
export interface StoredPractice {
  filter: PracticeFilter
  range: PracticeRange | null
  bookmarkedOnly: boolean
  session: PracticeSession
}

export interface StoredExam {
  questionIds: string[]
  answers: Record<string, string>
  flags: string[]
  index: number
  startedAt: number
  deadline: number
}

function read<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked: the app keeps working in memory.
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Validate untrusted progress JSON (LocalStorage or an imported file). Returns null when unusable. */
export function parseProgress(value: unknown): Progress | null {
  if (!isRecord(value) || value.version !== 1) return null
  if (!isRecord(value.answers) || !Array.isArray(value.starred) || !Array.isArray(value.examHistory)) return null
  const answers: Progress['answers'] = {}
  for (const [id, record] of Object.entries(value.answers)) {
    if (!isRecord(record) || typeof record.selected !== 'string' || typeof record.correct !== 'boolean') continue
    const attempts = Number.isFinite(record.attempts) ? Math.max(1, Number(record.attempts)) : 1
    answers[id] = {
      selected: record.selected,
      correct: record.correct,
      attempts,
      correctCount: Number.isFinite(record.correctCount) ? Math.min(attempts, Math.max(0, Number(record.correctCount))) : 0,
      lastAnsweredAt: typeof record.lastAnsweredAt === 'string' ? record.lastAnsweredAt : new Date(0).toISOString(),
    }
  }
  const examHistory = value.examHistory.filter(
    (item): item is ExamResult =>
      isRecord(item) && typeof item.id === 'string' && Array.isArray(item.questionIds) && typeof item.score === 'number' && isRecord(item.answers),
  )
  return { version: 1, answers, starred: value.starred.filter((id): id is string => typeof id === 'string'), examHistory }
}

export function loadProgress(): Progress {
  return parseProgress(read(PROGRESS_KEY)) ?? structuredClone(emptyProgress)
}

export function saveProgress(progress: Progress) {
  write(PROGRESS_KEY, progress)
}

/** Keep only editable fields that differ from the source record. */
export function sanitizeOverride(source: Question, value: unknown): BankOverride | null {
  if (!isRecord(value)) return null
  const next: BankOverride = {}
  if (typeof value.question === 'string' && value.question.trim() && value.question !== source.question) next.question = value.question
  const draft = value.options
  if (isRecord(draft)) {
    // Option keys are fixed by the source slide; only their text can change.
    const keys = Object.keys(source.options)
    const options = Object.fromEntries(keys.map((key) => [key, typeof draft[key] === 'string' ? String(draft[key]) : source.options[key]]))
    if (keys.some((key) => options[key] !== source.options[key])) next.options = options
  }
  if ((value.correctAnswer === null || (typeof value.correctAnswer === 'string' && value.correctAnswer in source.options)) && value.correctAnswer !== source.correctAnswer) {
    next.correctAnswer = value.correctAnswer as string | null
  }
  if (typeof value.needsReview === 'boolean' && value.needsReview !== source.needsReview) next.needsReview = value.needsReview
  return Object.keys(next).length ? next : null
}

export function sanitizeOverrides(sources: Question[], value: unknown): Record<string, BankOverride> {
  const byId = new Map(sources.map((question) => [question.id, question]))
  const entries: Array<[string, unknown]> = Array.isArray(value)
    ? value.filter(isRecord).map((item) => [String(item.id), item])
    : isRecord(value) ? Object.entries(value) : []
  const result: Record<string, BankOverride> = {}
  for (const [id, item] of entries) {
    const source = byId.get(id)
    const override = source && sanitizeOverride(source, item)
    if (override) result[id] = override
  }
  return result
}

export function loadBankOverrides(sources: Question[]): Record<string, BankOverride> {
  return sanitizeOverrides(sources, read(BANK_OVERRIDES_KEY))
}

export function saveBankOverrides(overrides: Record<string, BankOverride>) {
  write(BANK_OVERRIDES_KEY, overrides)
}

export const loadPractice = () => read<StoredPractice>(PRACTICE_KEY)
export const savePractice = (value: StoredPractice | null) => write(PRACTICE_KEY, value)

export function loadActiveExam(): StoredExam | null {
  const value = read<StoredExam>(EXAM_KEY)
  if (!value || !Array.isArray(value.questionIds) || !isRecord(value.answers) || typeof value.deadline !== 'number') return null
  return { ...value, flags: Array.isArray(value.flags) ? value.flags : [], index: Number(value.index) || 0 }
}
export const saveActiveExam = (value: StoredExam | null) => write(EXAM_KEY, value)

export function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
