import { beforeEach, describe, expect, it } from 'vitest'
import questionsJson from '../data/questions.json'
import type { Question } from '../src/types'
import {
  emptyProgress,
  loadActiveExam,
  loadBankOverrides,
  loadProgress,
  parseProgress,
  sanitizeOverride,
  sanitizeOverrides,
  saveActiveExam,
  saveBankOverrides,
  saveProgress,
} from '../src/lib/storage'

const questions = questionsJson as Question[]

// Minimal in-memory LocalStorage so storage code runs in Node.
class MemoryStorage {
  private data = new Map<string, string>()
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, String(value)) }
  removeItem(key: string) { this.data.delete(key) }
  clear() { this.data.clear() }
}

beforeEach(() => {
  ;(globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage()
})

describe('progress persistence', () => {
  it('survives a save/load round trip (reload)', () => {
    const progress = {
      ...structuredClone(emptyProgress),
      answers: { 'iot102-011': { selected: 'A', correct: true, attempts: 2, correctCount: 1, lastAnsweredAt: '2026-01-01T00:00:00.000Z' } },
      starred: ['iot102-012'],
    }
    saveProgress(progress)
    expect(loadProgress()).toEqual(progress)
  })

  it('falls back to empty progress on corrupt storage', () => {
    localStorage.setItem('iot102-progress-v1', '{not json')
    expect(loadProgress()).toEqual(emptyProgress)
  })

  it('rejects files that are not progress exports', () => {
    expect(parseProgress(null)).toBeNull()
    expect(parseProgress({ version: 2, answers: {}, starred: [], examHistory: [] })).toBeNull()
    expect(parseProgress([1, 2, 3])).toBeNull()
  })

  it('drops malformed records from an import and clamps counts', () => {
    const parsed = parseProgress({
      version: 1,
      answers: { ok: { selected: 'A', correct: true, attempts: 1, correctCount: 9, lastAnsweredAt: 'x' }, bad: { selected: 3 } },
      starred: ['a', 5],
      examHistory: [{ nope: true }],
    })
    expect(Object.keys(parsed!.answers)).toEqual(['ok'])
    expect(parsed!.answers.ok.correctCount).toBe(1)
    expect(parsed!.starred).toEqual(['a'])
    expect(parsed!.examHistory).toEqual([])
  })

  it('round-trips an export through import unchanged', () => {
    const exported = {
      version: 1 as const,
      answers: { q: { selected: 'C', correct: false, attempts: 3, correctCount: 1, lastAnsweredAt: '2026-02-02T00:00:00.000Z' } },
      starred: ['q'],
      examHistory: [{ id: 'e', createdAt: '2026-02-02T00:00:00.000Z', durationSeconds: 10, total: 50, correct: 40, score: 8, questionIds: ['q'], answers: { q: 'C' } }],
    }
    expect(parseProgress(JSON.parse(JSON.stringify(exported)))).toEqual(exported)
  })
})

describe('bank overrides cannot corrupt source data', () => {
  const source = questions.find((q) => q.correctAnswer && Object.keys(q.options).length === 4)!

  it('keeps only editable fields that differ from the source', () => {
    const override = sanitizeOverride(source, { ...source, slideNumber: 999, imagePath: '/evil.png', question: 'Edited?' })
    expect(override).toEqual({ question: 'Edited?' })
  })

  it('ignores answers that are not one of the option keys and option keys that do not exist', () => {
    expect(sanitizeOverride(source, { correctAnswer: 'Z' })).toBeNull()
    expect(sanitizeOverride(source, { options: { ...source.options, Z: 'extra' } })).toBeNull()
  })

  it('an exported bank re-imported unchanged produces no overrides', () => {
    expect(sanitizeOverrides(questions, JSON.parse(JSON.stringify(questions)))).toEqual({})
  })

  it('drops overrides for unknown ids when loading', () => {
    saveBankOverrides({ 'not-a-question': { question: 'x' }, [source.id]: { question: 'changed' } })
    expect(loadBankOverrides(questions)).toEqual({ [source.id]: { question: 'changed' } })
  })
})

describe('active exam autosave', () => {
  it('restores an in-progress exam after reload', () => {
    const exam = { questionIds: ['a', 'b'], answers: { a: 'B' }, flags: ['b'], index: 1, startedAt: 1, deadline: 2 }
    saveActiveExam(exam)
    expect(loadActiveExam()).toEqual(exam)
    saveActiveExam(null)
    expect(loadActiveExam()).toBeNull()
  })
})
