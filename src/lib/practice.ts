import type { AnswerRecord, Progress } from '../types'

/** A wrong answer comes back after this many other answers (inclusive range). */
export const RETRY_GAP_MIN = 2
export const RETRY_GAP_MAX = 5
/** After this many misses in one session a question leaves the retry queue (it stays in Review). */
export const MAX_SESSION_MISSES = 3
export const STREAK_STEP = 5

export interface RetryEntry {
  id: string
  /** Serve once `answered` reaches this value. */
  dueAt: number
  misses: number
}

export interface PracticeSession {
  key: string
  order: string[]
  /** Index into `order` of the next unseen question. */
  cursor: number
  currentId: string | null
  currentIsRetry: boolean
  /** Total answers given in this session, retries included. */
  answered: number
  /** First-attempt answers only — retries never count against accuracy. */
  firstTotal: number
  firstCorrect: number
  recovered: number
  missedIds: string[]
  retry: RetryEntry[]
  streak: number
  bestStreak: number
  /** The answer shown for the current question, if it has been answered. */
  last: { id: string; selected: string; correct: boolean; wasRetry: boolean } | null
}

export function createSession(key: string, order: string[]): PracticeSession {
  return {
    key,
    order,
    cursor: order.length ? 1 : 0,
    currentId: order[0] ?? null,
    currentIsRetry: false,
    answered: 0,
    firstTotal: 0,
    firstCorrect: 0,
    recovered: 0,
    missedIds: [],
    retry: [],
    streak: 0,
    bestStreak: 0,
    last: null,
  }
}

export function retryGap(random: () => number = Math.random) {
  const span = RETRY_GAP_MAX - RETRY_GAP_MIN + 1
  return RETRY_GAP_MIN + Math.min(span - 1, Math.floor(random() * span))
}

export function recordAnswer(
  session: PracticeSession,
  selected: string,
  correct: boolean,
  random: () => number = Math.random,
): PracticeSession {
  const id = session.currentId
  if (!id || session.last?.id === id) return session
  const answered = session.answered + 1
  const isRetry = session.currentIsRetry
  const prior = session.retry.find((entry) => entry.id === id)
  let retry = session.retry.filter((entry) => entry.id !== id)
  if (!correct) {
    const misses = (prior?.misses ?? 0) + 1
    if (misses < MAX_SESSION_MISSES) retry = [...retry, { id, dueAt: answered + retryGap(random), misses }]
  }
  const streak = correct ? session.streak + 1 : 0
  return {
    ...session,
    answered,
    firstTotal: session.firstTotal + Number(!isRetry),
    firstCorrect: session.firstCorrect + Number(!isRetry && correct),
    recovered: session.recovered + Number(isRetry && correct),
    missedIds: !correct && !session.missedIds.includes(id) ? [...session.missedIds, id] : session.missedIds,
    retry,
    streak,
    bestStreak: Math.max(session.bestStreak, streak),
    last: { id, selected, correct, wasRetry: isRetry },
  }
}

/** Move to the next question: a due retry first, then the next unseen question, then any leftover retries. */
export function advance(session: PracticeSession): PracticeSession {
  const byDue = [...session.retry].sort((a, b) => a.dueAt - b.dueAt)
  const due = byDue.find((entry) => entry.dueAt <= session.answered && entry.id !== session.currentId)
  const base = { ...session, last: null }
  if (due) return { ...base, currentId: due.id, currentIsRetry: true }
  if (session.cursor < session.order.length) {
    return { ...base, currentId: session.order[session.cursor], cursor: session.cursor + 1, currentIsRetry: false }
  }
  // Unseen questions exhausted: drain the queue, avoiding an immediate repeat when possible.
  const leftover = byDue.find((entry) => entry.id !== session.currentId) ?? byDue[0]
  if (leftover) return { ...base, currentId: leftover.id, currentIsRetry: true }
  return { ...base, currentId: null, currentIsRetry: false }
}

export function sessionPosition(session: PracticeSession) {
  return { seen: session.cursor, total: session.order.length, pendingRetries: session.retry.length }
}

export function streakLevel(streak: number) {
  return Math.floor(streak / STREAK_STEP)
}

/** Answers toward the next fire level (0..STREAK_STEP-1). */
export function streakProgress(streak: number) {
  return streak % STREAK_STEP
}

/**
 * Persisted per-question record. A retry inside the same session updates the latest result
 * but does not count as a new attempt, so seeing a question again never adds a penalty.
 */
export function applyAnswer(
  progress: Progress,
  id: string,
  selected: string,
  correct: boolean,
  isRetry: boolean,
  now = new Date(),
): Progress {
  const prior = progress.answers[id]
  const attempts = (prior?.attempts ?? 0) + Number(!isRetry || !prior)
  const record: AnswerRecord = {
    selected,
    correct,
    attempts,
    correctCount: Math.min(attempts, (prior?.correctCount ?? 0) + Number(correct)),
    lastAnsweredAt: now.toISOString(),
  }
  return { ...progress, answers: { ...progress.answers, [id]: record } }
}
