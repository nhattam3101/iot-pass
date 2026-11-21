import questionData from '../data/questions.json'
import topicData from '../data/topics.json'
import type { Question, Topic } from './types'

export const baseQuestions = questionData as Question[]
export const topics = topicData as Topic[]
export const technicalTopics = topics.filter((topic) => topic.kind === 'technical')
export const sourceSections = topics.filter((topic) => topic.kind === 'source_section')

const names = new Map(topics.map((topic) => [topic.id, topic.name]))
export const topicName = (id: string) => names.get(id) ?? id

/** Questions usable in practice: they have a source answer and no open review flag. */
export const isPracticable = (question: Question) =>
  Boolean(question.correctAnswer && !question.needsReview && question.options[question.correctAnswer])
