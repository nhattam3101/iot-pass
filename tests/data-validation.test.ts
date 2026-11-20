import { describe, expect, it } from 'vitest'
import questionsJson from '../data/questions.json'
import notesJson from '../data/speaker_notes.json'
import topicsJson from '../data/topics.json'
import reportJson from '../data/extraction_report.json'
import type { Question, Topic } from '../src/types'

const questions = questionsJson as Question[]
const topics = topicsJson as Topic[]

describe('question bank integrity', () => {
  it('maps every source slide and keeps IDs unique', () => {
    expect(notesJson.slides).toHaveLength(365)
    expect(notesJson.slides.map((item) => item.slide_number)).toEqual(
      Array.from({ length: 365 }, (_, index) => index + 1),
    )
    expect(new Set(questions.map((item) => item.id)).size).toBe(questions.length)
    expect(new Set(questions.map((item) => item.slideNumber)).size).toBe(questions.length)
  })

  it('never assigns an answer that is absent from its options', () => {
    for (const question of questions) {
      if (question.correctAnswer) expect(question.options[question.correctAnswer]).toBeTruthy()
    }
  })

  it('keeps source linkage and topic linkage on every question', () => {
    const topicIds = new Set(topics.map((topic) => topic.id))
    for (const question of questions) {
      expect(question.imagePath).toBe(`/slides/slide_${String(question.slideNumber).padStart(3, '0')}.png`)
      expect(topicIds.has(question.sourceSectionId)).toBe(true)
      expect(question.topicIds.length).toBeGreaterThan(0)
      expect(question.topicIds.every((id) => topicIds.has(id))).toBe(true)
    }
  })

  it('reports a clean 365-image source audit', () => {
    expect(reportJson.imageCount).toBe(365)
    expect(reportJson.missingImages).toEqual([])
    expect(reportJson.corruptImages).toEqual([])
    expect(reportJson.byteIdenticalDuplicateGroups).toEqual([])
  })
})
