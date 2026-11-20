import type { Question } from '../types'

export function normalizeQuestion(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function eligibleQuestions(questions: Question[]): Question[] {
  const seen = new Set<string>()
  return questions.filter((question) => {
    if (!question.correctAnswer || question.needsReview || question.duplicateOf) return false
    if (!question.options[question.correctAnswer]) return false
    const key = normalizeQuestion(question.question)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function selectExamQuestions(
  questions: Question[],
  count = 50,
  random: () => number = Math.random,
): Question[] {
  const pool = eligibleQuestions(questions)
  if (pool.length < count) {
    throw new Error(`Only ${pool.length} verified unique questions are available; ${count} required.`)
  }
  const copy = [...pool]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
  }
  return copy.slice(0, count)
}

export function scoreExam(questions: Question[], answers: Record<string, string>) {
  const correct = questions.reduce(
    (sum, question) => sum + Number(answers[question.id] === question.correctAnswer),
    0,
  )
  return {
    correct,
    wrong: questions.length - correct,
    score: questions.length ? Number(((correct / questions.length) * 10).toFixed(2)) : 0,
  }
}
