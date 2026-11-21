import { describe, expect, it } from 'vitest'
import {
  MAX_SESSION_MISSES,
  RETRY_GAP_MAX,
  RETRY_GAP_MIN,
  advance,
  applyAnswer,
  createSession,
  recordAnswer,
  retryGap,
  streakLevel,
  streakProgress,
} from '../src/lib/practice'
import type { PracticeSession } from '../src/lib/practice'
import { emptyProgress } from '../src/lib/storage'

const ids = Array.from({ length: 20 }, (_, i) => `q${i}`)
const fixed = (value: number) => () => value

/** Answer the current question and move on; returns the id that was answered. */
function step(session: PracticeSession, correct: boolean, random = fixed(0)) {
  const id = session.currentId!
  const next = advance(recordAnswer(session, correct ? 'A' : 'B', correct, random))
  return { id, next }
}

describe('retry queue', () => {
  it('gaps stay within 2–5 questions', () => {
    const gaps = [0, 0.24, 0.5, 0.74, 0.99, 0.999999].map((v) => retryGap(fixed(v)))
    expect(Math.min(...gaps)).toBe(RETRY_GAP_MIN)
    expect(Math.max(...gaps)).toBe(RETRY_GAP_MAX)
  })

  it.each([0, 0.5, 0.99])('a wrong answer returns after 2–5 other questions (random=%s)', (r) => {
    let s = createSession('k', ids)
    const missed = s.currentId!
    s = step(s, false, fixed(r)).next
    let between = 0
    while (s.currentId !== missed) {
      between += 1
      s = step(s, true).next
    }
    expect(between).toBeGreaterThanOrEqual(RETRY_GAP_MIN)
    expect(between).toBeLessThanOrEqual(RETRY_GAP_MAX)
    expect(s.currentIsRetry).toBe(true)
  })

  it('never duplicates a question in the queue and clears it once answered correctly', () => {
    let s = createSession('k', ids)
    const missed = s.currentId!
    s = step(s, false).next
    expect(s.retry.filter((e) => e.id === missed)).toHaveLength(1)
    while (s.currentId !== missed) s = step(s, true).next
    s = step(s, true).next
    expect(s.retry).toHaveLength(0)
    expect(s.recovered).toBe(1)
  })

  it('drops a question after repeated misses so sessions always terminate', () => {
    let s = createSession('k', ['only'])
    let turns = 0
    while (s.currentId && turns < 50) {
      s = step(s, false).next
      turns += 1
    }
    expect(s.currentId).toBeNull()
    expect(turns).toBe(MAX_SESSION_MISSES)
  })

  it('a full session of misses ends, and every question is seen once fresh', () => {
    let s = createSession('k', ids)
    const fresh = new Set<string>()
    let turns = 0
    while (s.currentId && turns < 500) {
      if (!s.currentIsRetry) fresh.add(s.currentId)
      s = step(s, turns % 2 === 0).next
      turns += 1
    }
    expect(s.currentId).toBeNull()
    expect(fresh.size).toBe(ids.length)
    expect(s.firstTotal).toBe(ids.length)
  })

  it('does not serve the question that was just answered when others are available', () => {
    let s = createSession('k', ['a', 'b'])
    s = step(s, false).next // a missed → b
    expect(s.currentId).toBe('b')
    s = step(s, false).next // b missed → fresh exhausted → leftover a (not b)
    expect(s.currentId).toBe('a')
  })

  it('ignores a second answer to the same question', () => {
    const s = createSession('k', ids)
    const once = recordAnswer(s, 'A', true)
    expect(recordAnswer(once, 'B', false)).toBe(once)
  })

  it('retries do not count against first-try accuracy', () => {
    let s = createSession('k', ids)
    const missed = s.currentId!
    s = step(s, false).next
    while (s.currentId !== missed) s = step(s, true).next
    s = step(s, false).next
    expect(s.firstTotal).toBe(s.firstCorrect + 1)
  })
})

describe('streak', () => {
  it('increments on correct, resets on wrong, tracks best', () => {
    let s = createSession('k', ids)
    for (let i = 0; i < 7; i += 1) s = step(s, true).next
    expect(s.streak).toBe(7)
    s = step(s, false).next
    expect(s.streak).toBe(0)
    expect(s.bestStreak).toBe(7)
  })

  it('raises one fire level per five in a row', () => {
    expect([0, 4, 5, 9, 10, 14, 15].map(streakLevel)).toEqual([0, 0, 1, 1, 2, 2, 3])
    expect([0, 4, 5, 7].map(streakProgress)).toEqual([0, 4, 0, 2])
  })
})

describe('persisted answer records', () => {
  const at = new Date('2026-01-01T00:00:00Z')
  it('counts fresh attempts and latest result', () => {
    let p = applyAnswer(emptyProgress, 'q', 'B', false, false, at)
    p = applyAnswer(p, 'q', 'A', true, false, at)
    expect(p.answers.q).toMatchObject({ selected: 'A', correct: true, attempts: 2, correctCount: 1 })
  })

  it('a retry updates the result without adding an attempt', () => {
    let p = applyAnswer(emptyProgress, 'q', 'B', false, false, at)
    p = applyAnswer(p, 'q', 'A', true, true, at)
    expect(p.answers.q).toMatchObject({ correct: true, attempts: 1, correctCount: 1 })
    p = applyAnswer(p, 'q', 'B', false, true, at)
    expect(p.answers.q).toMatchObject({ correct: false, attempts: 1, correctCount: 1 })
  })

  it('does not mutate the previous progress object', () => {
    const before = structuredClone(emptyProgress)
    applyAnswer(before, 'q', 'A', true, false, at)
    expect(before.answers).toEqual({})
  })
})
