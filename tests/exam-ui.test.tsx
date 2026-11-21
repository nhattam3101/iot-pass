import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import questionsJson from '../data/questions.json'
import { QuestionView } from '../src/components/QuestionView'
import { eligibleQuestions, scoreExam, selectExamQuestions } from '../src/lib/exam'
import type { Question } from '../src/types'

const questions = questionsJson as Question[]
const sample = eligibleQuestions(questions).slice(0, 25)

describe('no answer leakage before submission', () => {
  it.each(sample.map((q) => [q.id, q] as const))('exam view of %s marks no option as correct', (_id, question) => {
    // Even if a caller wrongly passes revealed=true, exam mode must not mark the source answer.
    for (const revealed of [false, true]) {
      const html = renderToStaticMarkup(<QuestionView question={question} mode="exam" selected={question.correctAnswer} revealed={revealed} onAnswer={() => {}} />)
      expect(html).not.toMatch(/data-state="(correct|wrong|dimmed)"/)
      expect(html).not.toContain('Speaker Notes')
      expect(html).not.toMatch(/the answer is/i)
      if (question.explanation) expect(html).not.toContain(question.explanation.slice(0, 40))
    }
  })

  it('practice view hides feedback until answered, then shows it', () => {
    const question = sample[0]
    const before = renderToStaticMarkup(<QuestionView question={question} mode="practice" selected={null} revealed={false} onAnswer={() => {}} />)
    expect(before).not.toMatch(/data-state="correct"/)
    const after = renderToStaticMarkup(<QuestionView question={question} mode="practice" selected={question.correctAnswer} revealed onAnswer={() => {}} />)
    expect(after).toMatch(/data-state="correct"/)
  })
})

describe('mock exam contract', () => {
  it('draws 50 unique eligible questions across many random seeds', () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      let state = seed
      const random = () => ((state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296)
      const exam = selectExamQuestions(questions, 50, random)
      expect(new Set(exam.map((q) => q.id)).size).toBe(50)
      expect(exam.every((q) => q.correctAnswer && !q.needsReview && !q.duplicateOf)).toBe(true)
    }
  })

  it('scores unanswered questions as wrong', () => {
    const exam = sample.slice(0, 10)
    const answers = Object.fromEntries(exam.slice(0, 4).map((q) => [q.id, q.correctAnswer!]))
    expect(scoreExam(exam, answers)).toEqual({ correct: 4, wrong: 6, score: 4 })
    expect(scoreExam(exam, {})).toEqual({ correct: 0, wrong: 10, score: 0 })
  })
})
