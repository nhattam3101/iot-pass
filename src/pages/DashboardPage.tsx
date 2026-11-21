import { useMemo } from 'react'
import { ArrowRight, BookOpen, CheckCircle2, GraduationCap, History, Play, RotateCcw, Target, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Progress, Question } from '../types'
import type { View } from '../App'
import { isPracticable, technicalTopics } from '../data'
import { eligibleQuestions } from '../lib/exam'
import { accuracy, mastery } from '../lib/stats'
import { loadActiveExam, loadPractice } from '../lib/storage'
import type { PracticeFilter } from '../lib/storage'
import { Button, EmptyState, MasteryBar, PageHeader, Panel, ProgressBar, SectionTitle, Stat, cn, formatDate, formatDuration, percent } from '../components/ui'

interface Props {
  questions: Question[]
  progress: Progress
  onNavigate: (view: View) => void
  onPractice: (filter: PracticeFilter) => void
}

interface NextAction {
  icon: LucideIcon
  title: string
  body: string
  cta: string
  run: () => void
}

export function DashboardPage({ questions, progress, onNavigate, onPractice }: Props) {
  const practicable = useMemo(() => questions.filter(isPracticable), [questions])
  const examPool = eligibleQuestions(questions).length
  const overall = mastery(practicable, progress)
  const overallAccuracy = accuracy(overall)
  const wrongIds = practicable.filter((q) => progress.answers[q.id] && !progress.answers[q.id].correct).map((q) => q.id)
  const exams = progress.examHistory
  const best = exams.length ? Math.max(...exams.map((e) => e.score)) : null

  const topicRows = technicalTopics
    .filter((topic) => topic.id !== 'uncategorized')
    .map((topic) => {
      const pool = practicable.filter((q) => q.topicIds.includes(topic.id))
      const m = mastery(pool, progress)
      return { topic, m, acc: accuracy(m, 3) }
    })
    .filter((row) => row.m.total > 0)

  const action = nextAction()
  function nextAction(): NextAction {
    const exam = loadActiveExam()
    if (exam && exam.deadline > Date.now()) {
      const answered = Object.keys(exam.answers).length
      return { icon: GraduationCap, title: 'Finish your mock exam', body: `${answered} of ${exam.questionIds.length} answered · ${formatDuration(Math.round((exam.deadline - Date.now()) / 1000))} left on the clock.`, cta: 'Resume exam', run: () => onNavigate('exam') }
    }
    const practice = loadPractice()
    if (practice && practice.session.currentId && practice.session.cursor > 1) {
      return { icon: Play, title: `Pick up where you left off`, body: `${practice.filter.title} — question ${practice.session.cursor} of ${practice.session.order.length}.`, cta: 'Resume practice', run: () => onPractice(practice.filter) }
    }
    if (wrongIds.length >= 5) {
      return { icon: RotateCcw, title: `Fix ${wrongIds.length} missed questions`, body: 'Misses are the fastest way to raise your score. They come back until you get them right.', cta: 'Review misses', run: () => onPractice({ ids: wrongIds, title: 'Missed questions' }) }
    }
    const weakest = topicRows.filter((row) => row.acc !== null).sort((a, b) => (a.acc ?? 0) - (b.acc ?? 0))[0]
    if (weakest && (weakest.acc ?? 100) < 70) {
      return { icon: Target, title: `Strengthen ${weakest.topic.name}`, body: `${weakest.acc}% accuracy so far — your weakest topic.`, cta: 'Practice topic', run: () => onPractice({ topicId: weakest.topic.id, title: weakest.topic.name }) }
    }
    const fresh = [...topicRows].sort((a, b) => a.m.studied / a.m.total - b.m.studied / b.m.total)[0]
    if (overall.studied === 0 || !fresh) {
      return { icon: Play, title: 'Start with the question bank', body: `${practicable.length} questions with source answers. Instant feedback after every answer.`, cta: 'Start practice', run: () => onPractice({ title: 'All questions' }) }
    }
    if (fresh.m.studied < fresh.m.total) {
      return { icon: BookOpen, title: `Cover ${fresh.topic.name}`, body: `${fresh.m.total - fresh.m.studied} questions you haven't seen yet.`, cta: 'Practice topic', run: () => onPractice({ topicId: fresh.topic.id, title: fresh.topic.name }) }
    }
    return { icon: GraduationCap, title: 'Test yourself under time', body: '50 random questions, 60 minutes, scored out of 10.', cta: 'Start mock exam', run: () => onNavigate('exam') }
  }

  const recent = Object.entries(progress.answers)
    .sort((a, b) => b[1].lastAnsweredAt.localeCompare(a[1].lastAnsweredAt))
    .slice(0, 6)
    .map(([id, record]) => ({ record, question: questions.find((q) => q.id === id) }))
    .filter((row): row is { record: typeof row.record; question: Question } => Boolean(row.question))

  const ActionIcon = action.icon
  return (
    <>
      <PageHeader title="Overview" description={`${practicable.length} practice questions · ${examPool} eligible for 50-question mock exams.`} />

      <Panel className="mb-6 overflow-hidden" aria-labelledby="next-title">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
          <span className="grid size-12 shrink-0 place-items-center rounded-card bg-accent/15 text-accent" aria-hidden><ActionIcon size={24} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-accent">Up next</p>
            <h2 id="next-title" className="mt-0.5 text-[20px] font-bold tracking-[-0.01em] text-ink">{action.title}</h2>
            <p className="mt-1 text-ink-2">{action.body}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="lg" iconRight={ArrowRight} onClick={action.run}>{action.cta}</Button>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line bg-canvas/40 px-5 py-5 sm:grid-cols-4 sm:px-6">
          <div>
            <Stat label="Coverage" value={`${percent(overall.studied, overall.total)}%`} hint={`${overall.studied} of ${overall.total} answered`} />
            <ProgressBar value={overall.studied} max={overall.total} label="Coverage" className="mt-2" />
          </div>
          <Stat label="Accuracy" value={overallAccuracy === null ? '—' : `${overallAccuracy}%`} hint="latest answer per question" />
          <Stat label="Need work" value={wrongIds.length} tone={wrongIds.length ? 'bad' : undefined} hint={overall.recovered ? `${overall.recovered} recovered so far` : 'currently wrong'} />
          <Stat label="Best exam" value={best === null ? '—' : best} hint={exams.length ? `${exams.length} attempt${exams.length > 1 ? 's' : ''}` : 'no attempts yet'} />
        </dl>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section aria-labelledby="mastery-title">
          <SectionTitle id="mastery-title" aside={<Button size="sm" variant="ghost" onClick={() => onNavigate('topics')}>All topics</Button>}>Topic mastery</SectionTitle>
          <Panel as="div" className="divide-y divide-line">
            {topicRows.map(({ topic, m, acc }) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => onPractice({ topicId: topic.id, title: topic.name })}
                className="group grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 text-left hover:bg-raised sm:px-5"
                aria-label={`Practice ${topic.name}: ${m.correct} correct, ${m.wrong} need work, ${m.total - m.studied} unseen`}
              >
                <span className="truncate text-[15px] font-medium text-ink">{topic.name}</span>
                <span className="text-[13px] tabular-nums text-ink-3">{acc === null ? `${m.studied}/${m.total}` : `${acc}% · ${m.studied}/${m.total}`}</span>
                <MasteryBar correct={m.correct} wrong={m.wrong} total={m.total} className="col-span-2" />
              </button>
            ))}
          </Panel>
          <div className="mt-2 flex gap-4 text-[12px] text-ink-3" aria-hidden>
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-ok" />Correct</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-bad/80" />Need work</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-overlay" />Unseen</span>
          </div>
        </section>

        <div className="grid content-start gap-6">
          <section aria-labelledby="exams-title">
            <SectionTitle id="exams-title" aside={<Button size="sm" variant="ghost" onClick={() => onNavigate('exam')}>Mock exam</Button>}>Exam history</SectionTitle>
            {exams.length ? (
              <Panel as="div" className="p-4 sm:p-5">
                <ExamTrend scores={exams.slice(-12).map((e) => e.score)} />
                <ul className="mt-4 divide-y divide-line border-t border-line">
                  {[...exams].reverse().slice(0, 4).map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-[14px]">
                      <span className="text-ink-2">{formatDate(e.createdAt)}</span>
                      <span className="text-ink-3">{e.correct}/{e.total} · {formatDuration(e.durationSeconds)}</span>
                      <span className="w-10 text-right font-bold text-ink">{e.score}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : (
              <EmptyState icon={History} title="No mock exams yet" body="Take one when you've covered a few topics — results and full reviews are kept here." />
            )}
          </section>

          <section aria-labelledby="recent-title">
            <SectionTitle id="recent-title">Recent answers</SectionTitle>
            {recent.length ? (
              <Panel as="div" className="divide-y divide-line">
                {recent.map(({ record, question }) => (
                  <div key={question.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                    {record.correct ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-ok" aria-label="Correct" /> : <XCircle size={17} className="mt-0.5 shrink-0 text-bad" aria-label="Wrong" />}
                    <span className="line-clamp-2 min-w-0 flex-1 text-[14px] leading-snug text-ink-2">{question.question}</span>
                  </div>
                ))}
              </Panel>
            ) : (
              <EmptyState icon={BookOpen} title="Nothing answered yet" body="Your latest answers show up here." />
            )}
          </section>
        </div>
      </div>
    </>
  )
}

/** Score per attempt, oldest → newest. Only rendered once there is history to compare. */
function ExamTrend({ scores }: { scores: number[] }) {
  if (scores.length < 2) return <p className="text-[14px] text-ink-2">Latest score <span className="font-bold text-ink">{scores[0]}</span> / 10. Take another to see your trend.</p>
  const last = scores[scores.length - 1]
  const delta = Math.round((last - scores[scores.length - 2]) * 100) / 100
  return (
    <figure>
      <figcaption className="mb-3 flex items-baseline justify-between text-[13px] text-ink-2">
        <span>Last {scores.length} scores</span>
        <span className={cn('font-semibold', delta > 0 ? 'text-ok' : delta < 0 ? 'text-bad' : 'text-ink-3')}>{delta > 0 ? '+' : ''}{delta} vs previous</span>
      </figcaption>
      <div className="flex h-20 items-end gap-1.5" role="img" aria-label={`Scores: ${scores.join(', ')} out of 10`}>
        {scores.map((score, index) => (
          <div key={index} className="flex h-full flex-1 flex-col justify-end">
            <div className={cn('rounded-t-[4px]', index === scores.length - 1 ? 'bg-accent' : 'bg-line-strong')} style={{ height: `${Math.max(4, score * 10)}%` }} />
          </div>
        ))}
      </div>
    </figure>
  )
}
