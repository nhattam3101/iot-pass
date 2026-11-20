import { describe, expect, it } from 'vitest'
import questionsJson from '../data/questions.json'
import { eligibleQuestions, normalizeQuestion, scoreExam, selectExamQuestions } from '../src/lib/exam'
import type { Question } from '../src/types'

const questions = questionsJson as Question[]

describe('exam selection', () => {
  it('has at least 50 source-verified unique eligible questions', () => {
    expect(eligibleQuestions(questions).length).toBeGreaterThanOrEqual(50)
  })

  it('selects 50 without duplicate IDs or normalized question text', () => {
    let seed = 42
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
    const selected = selectExamQuestions(questions, 50, random)
    expect(selected).toHaveLength(50)
    expect(new Set(selected.map((item) => item.id)).size).toBe(50)
    expect(new Set(selected.map((item) => normalizeQuestion(item.question))).size).toBe(50)
    expect(selected.every((item) => item.correctAnswer && !item.needsReview)).toBe(true)
  })

  it('does not invent questions if the bank is too small', () => {
    expect(() => selectExamQuestions(questions.slice(0, 5), 50)).toThrow(/required/)
  })
})

describe('scoring', () => {
  it('scores on a ten-point scale', () => {
    const selected = eligibleQuestions(questions).slice(0, 10)
    const answers = Object.fromEntries(
      selected.map((question, index) => [question.id, index < 7 ? question.correctAnswer! : '__wrong__']),
    )
    expect(scoreExam(selected, answers)).toEqual({ correct: 7, wrong: 3, score: 7 })
  })
})
