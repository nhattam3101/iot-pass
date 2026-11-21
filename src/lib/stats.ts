import type { Progress, Question } from '../types'

export interface Mastery {
  total: number
  correct: number
  wrong: number
  studied: number
  /** Answered wrong at least once, now correct. */
  recovered: number
}

export function mastery(pool: Question[], progress: Progress): Mastery {
  let correct = 0
  let wrong = 0
  let recovered = 0
  for (const question of pool) {
    const record = progress.answers[question.id]
    if (!record) continue
    if (record.correct) correct += 1
    else wrong += 1
    if (record.correct && record.attempts > record.correctCount) recovered += 1
  }
  return { total: pool.length, correct, wrong, studied: correct + wrong, recovered }
}

/** Accuracy over answered questions, or null when there is too little data to mean anything. */
export function accuracy(m: Mastery, minimum = 1) {
  return m.studied >= minimum ? Math.round((m.correct / m.studied) * 100) : null
}
