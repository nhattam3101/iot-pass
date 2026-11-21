import { Play, RotateCcw } from 'lucide-react'
import type { Progress, Question } from '../types'
import { isPracticable, sourceSections, technicalTopics } from '../data'
import { accuracy, mastery } from '../lib/stats'
import type { PracticeFilter } from '../lib/storage'
import { Badge, Button, MasteryBar, PageHeader, Panel, SectionTitle } from '../components/ui'

export function TopicsPage({ questions, progress, onPractice }: { questions: Question[]; progress: Progress; onPractice: (filter: PracticeFilter) => void }) {
  const practicable = questions.filter(isPracticable)
  return (
    <>
      <PageHeader title="Topics" description="Technical topics are tagged from each question's content; a question can sit in several. The original deck sections are listed below." />
      <ul className="grid gap-3 md:grid-cols-2">
        {technicalTopics.map((topic) => {
          const pool = practicable.filter((q) => q.topicIds.includes(topic.id))
          const m = mastery(pool, progress)
          const acc = accuracy(m, 3)
          const wrongIds = pool.filter((q) => progress.answers[q.id] && !progress.answers[q.id].correct).map((q) => q.id)
          return (
            <li key={topic.id}>
              <Panel as="article" className="flex h-full flex-col p-4 sm:p-5" aria-labelledby={`topic-${topic.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <h2 id={`topic-${topic.id}`} className="text-[17px] font-semibold text-ink">{topic.name}</h2>
                  <span className="shrink-0 text-[13px] text-ink-3">{pool.length} questions</span>
                </div>
                <MasteryBar correct={m.correct} wrong={m.wrong} total={m.total} className="mt-4" />
                <p className="mt-2 text-[13px] text-ink-2">
                  {m.studied === 0 ? 'Not started' : `${m.studied} answered · ${m.correct} correct · ${m.wrong} need work`}
                  {acc !== null && <> · <span className="text-ink">{acc}%</span></>}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="primary" icon={Play} disabled={!pool.length} onClick={() => onPractice({ topicId: topic.id, title: topic.name })}>Practice</Button>
                  {wrongIds.length > 0 && (
                    <Button size="sm" icon={RotateCcw} onClick={() => onPractice({ ids: wrongIds, title: `${topic.name} — misses` })}>
                      Misses <Badge tone="bad" className="ml-0.5">{wrongIds.length}</Badge>
                    </Button>
                  )}
                </div>
              </Panel>
            </li>
          )
        })}
      </ul>

      <section className="mt-10" aria-labelledby="sections-title">
        <SectionTitle id="sections-title">Original deck sections</SectionTitle>
        <Panel as="div" className="divide-y divide-line">
          {sourceSections.map((section) => {
            const count = questions.filter((q) => q.sourceSectionId === section.id).length
            return (
              <div key={section.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
                <span className="text-[15px] text-ink">{section.name}</span>
                <span className="text-[13px] text-ink-3">
                  Slides {section.startSlide}–{section.endSlide} · {count} questions
                  {section.needsReview && <Badge tone="warn" className="ml-2">untitled in source</Badge>}
                </span>
              </div>
            )
          })}
        </Panel>
      </section>
    </>
  )
}
