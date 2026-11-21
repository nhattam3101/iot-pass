import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, Clock3, Flag, GraduationCap, History, ListChecks, Send, Target, XCircle } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import type { ExamResult, Progress, Question } from '../types'
import { technicalTopics } from '../data'
import { eligibleQuestions, scoreExam, selectExamQuestions } from '../lib/exam'
import { loadActiveExam, saveActiveExam } from '../lib/storage'
import type { StoredExam } from '../lib/storage'
import { QuestionView } from '../components/QuestionView'
import { Badge, Button, EmptyState, MasteryBar, PageHeader, Panel, Segmented, SectionTitle, cn, formatDate, formatDuration, percent, useShortcuts } from '../components/ui'

export const EXAM_SIZE = 50

interface Props {
  questions: Question[]
  progress: Progress
  setProgress: Dispatch<SetStateAction<Progress>>
  onPracticeIds: (ids: string[], title: string) => void
}

type Finished = { questions: Question[]; result: ExamResult; flags: string[] }

export function ExamPage({ questions, progress, setProgress, onPracticeIds }: Props) {
  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions])
  const [exam, setExam] = useState<StoredExam | null>(() => loadActiveExam())
  const [finished, setFinished] = useState<Finished | null>(null)

  const examQuestions = useMemo(() => (exam ? exam.questionIds.map((id) => byId.get(id)).filter((q): q is Question => Boolean(q)) : []), [exam, byId])

  useEffect(() => saveActiveExam(exam), [exam])

  const submit = useCallback(() => {
    if (!exam) return
    const scored = scoreExam(examQuestions, exam.answers)
    const end = Math.min(Date.now(), exam.deadline)
    const result: ExamResult = {
      id: crypto.randomUUID(),
      createdAt: new Date(end).toISOString(),
      durationSeconds: Math.max(0, Math.round((end - exam.startedAt) / 1000)),
      total: examQuestions.length,
      correct: scored.correct,
      score: scored.score,
      questionIds: examQuestions.map((q) => q.id),
      answers: exam.answers,
    }
    setProgress((current) => ({ ...current, examHistory: [...current.examHistory, result] }))
    setFinished({ questions: examQuestions, result, flags: exam.flags })
    setExam(null)
    window.scrollTo({ top: 0 })
  }, [exam, examQuestions, setProgress])

  if (finished) {
    return <ExamResults {...finished} onNew={() => setFinished(null)} onPracticeIds={onPracticeIds} />
  }
  if (exam && examQuestions.length) {
    return <ExamRunner exam={exam} setExam={setExam} questions={examQuestions} onSubmit={submit} />
  }
  return (
    <ExamSetup
      questions={questions}
      history={progress.examHistory}
      onStart={(minutes) => {
        const selected = selectExamQuestions(questions, EXAM_SIZE)
        const startedAt = Date.now()
        setExam({ questionIds: selected.map((q) => q.id), answers: {}, flags: [], index: 0, startedAt, deadline: startedAt + minutes * 60_000 })
      }}
      onOpenResult={(result) => {
        const qs = result.questionIds.map((id) => byId.get(id)).filter((q): q is Question => Boolean(q))
        setFinished({ questions: qs, result, flags: [] })
      }}
    />
  )
}

function ExamSetup({ questions, history, onStart, onOpenResult }: { questions: Question[]; history: ExamResult[]; onStart: (minutes: number) => void; onOpenResult: (result: ExamResult) => void }) {
  const available = eligibleQuestions(questions).length
  const [minutes, setMinutes] = useState('60')
  const value = Number(minutes)
  const valid = Number.isInteger(value) && value >= 10 && value <= 180
  const recent = [...history].reverse().slice(0, 8)
  return (
    <div className="mx-auto max-w-[860px]">
      <PageHeader title="Mock exam" description={`${EXAM_SIZE} questions drawn at random from ${available} verified, de-duplicated questions. Answers stay hidden until you submit.`} />
      <Panel className="p-5 sm:p-7">
        <ul className="grid gap-3 text-[15px] text-ink-2 sm:grid-cols-3">
          <li className="flex gap-2.5"><ListChecks size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />Jump between questions and flag any to revisit.</li>
          <li className="flex gap-2.5"><Clock3 size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />Submits automatically when time runs out.</li>
          <li className="flex gap-2.5"><History size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />Answers autosave — a refresh won't lose them.</li>
        </ul>
        <form
          className="mt-6 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-end"
          onSubmit={(event) => { event.preventDefault(); if (valid) onStart(value) }}
        >
          <label className="grid gap-1.5 text-[13px] font-medium text-ink-2 sm:w-48">
            Time limit (minutes)
            <input type="number" inputMode="numeric" min={10} max={180} value={minutes} onChange={(event) => setMinutes(event.target.value)} className="field" aria-invalid={!valid} aria-describedby="minutes-hint" />
          </label>
          {available < EXAM_SIZE ? (
            <p role="alert" className="text-warn">Only {available} valid questions are available — {EXAM_SIZE} are required.</p>
          ) : (
            <Button type="submit" variant="primary" size="lg" icon={GraduationCap} disabled={!valid} className="sm:ml-auto">Start exam</Button>
          )}
        </form>
        <p id="minutes-hint" className={cn('mt-2 text-[13px]', valid ? 'text-ink-3' : 'text-bad')}>Between 10 and 180 minutes. The standard is 60.</p>
      </Panel>

      <section className="mt-8" aria-labelledby="history-title">
        <SectionTitle id="history-title">Past attempts</SectionTitle>
        {recent.length ? (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {recent.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => onOpenResult(item)} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-raised sm:px-5">
                  <span className="w-14 text-[20px] font-bold text-ink">{item.score}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] text-ink">{item.correct}/{item.total} correct</span>
                    <span className="block text-[13px] text-ink-3">{formatDate(item.createdAt)} · {formatDuration(item.durationSeconds)}</span>
                  </span>
                  <span className="text-[13px] text-accent">Review</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={History} title="No attempts yet" body="Your scores and full answer reviews will be kept here." />
        )}
      </section>
    </div>
  )
}

function ExamRunner({ exam, setExam, questions, onSubmit }: { exam: StoredExam; setExam: Dispatch<SetStateAction<StoredExam | null>>; questions: Question[]; onSubmit: () => void }) {
  const [now, setNow] = useState(Date.now())
  const [mapOpen, setMapOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const remaining = Math.max(0, Math.ceil((exam.deadline - now) / 1000))
  const index = Math.min(exam.index, questions.length - 1)
  const question = questions[index]
  const answeredCount = questions.filter((q) => exam.answers[q.id]).length
  const flagged = exam.flags.includes(question.id)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const submitted = useRef(false)
  useEffect(() => {
    if (remaining === 0 && !submitted.current) {
      submitted.current = true
      dialog.current?.close()
      onSubmit()
    }
  }, [remaining, onSubmit])

  const update = (patch: Partial<StoredExam>) => setExam((current) => (current ? { ...current, ...patch } : current))
  const goTo = (next: number) => {
    update({ index: Math.max(0, Math.min(questions.length - 1, next)) })
    setMapOpen(false)
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }))
  }
  const choose = (key: string) => setExam((current) => (current ? { ...current, answers: { ...current.answers, [question.id]: key } } : current))
  const toggleFlag = () => update({ flags: flagged ? exam.flags.filter((id) => id !== question.id) : [...exam.flags, question.id] })

  const onKey = useCallback(
    (pressed: string, event: KeyboardEvent) => {
      const keys = Object.keys(question.options)
      const upper = pressed.toUpperCase()
      const byNumber = /^[1-9]$/.test(pressed) ? keys[Number(pressed) - 1] : undefined
      if (keys.includes(upper) || byNumber) { event.preventDefault(); choose(byNumber ?? upper) }
      else if (pressed === 'ArrowRight') goTo(index + 1)
      else if (pressed === 'ArrowLeft') goTo(index - 1)
      else if (upper === 'F') toggleFlag()
    },
    [question, index, exam], // eslint-disable-line react-hooks/exhaustive-deps
  )
  useShortcuts(onKey)

  const low = remaining < 300
  const unanswered = questions.length - answeredCount

  const map = (
    <div>
      <div className="mb-3 flex items-center justify-between text-[13px]">
        <span className="font-semibold text-ink">Questions</span>
        <span className="text-ink-3">{answeredCount}/{questions.length} answered</span>
      </div>
      <ol className="grid grid-cols-10 gap-1.5 lg:grid-cols-5">
        {questions.map((item, i) => {
          const isAnswered = Boolean(exam.answers[item.id])
          const isFlagged = exam.flags.includes(item.id)
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-current={i === index ? 'step' : undefined}
                aria-label={`Question ${i + 1}${isAnswered ? ', answered' : ', not answered'}${isFlagged ? ', flagged' : ''}`}
                className={cn(
                  'relative grid aspect-square w-full min-w-0 place-items-center rounded-[8px] border text-[13px] font-semibold transition-colors',
                  i === index ? 'border-accent bg-accent text-accent-ink' : isAnswered ? 'border-accent/30 bg-accent/10 text-ink' : 'border-line bg-canvas text-ink-3 hover:border-line-strong hover:text-ink',
                )}
              >
                {i + 1}
                {isFlagged && <span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-warn" aria-hidden />}
              </button>
            </li>
          )
        })}
      </ol>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-3" aria-hidden>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm border border-accent/30 bg-accent/10" />Answered</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm border border-line bg-canvas" />Open</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-warn" />Flagged</span>
      </div>
    </div>
  )

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="sticky top-14 z-20 -mx-4 mb-5 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:-mx-7 sm:px-7 lg:top-0 lg:-mx-10 lg:px-10">
        <div className="mx-auto flex max-w-[1180px] items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-semibold text-ink">Mock exam · question {index + 1} of {questions.length}</h1>
            <p className="text-[12px] text-ink-3">{answeredCount} answered · saved on this device</p>
          </div>
          <div
            className={cn('inline-flex items-center gap-2 rounded-control border px-3 py-1.5 font-mono text-[17px] font-semibold tabular-nums', low ? 'border-bad/40 bg-bad/10 text-bad' : 'border-line bg-surface text-ink')}
            role="timer"
            aria-label={`Time remaining ${formatDuration(remaining)}`}
          >
            <Clock3 size={17} aria-hidden />
            {formatDuration(remaining)}
          </div>
          <span className="sr-only" aria-live="assertive">{remaining === 300 ? 'Five minutes remaining.' : remaining === 60 ? 'One minute remaining.' : ''}</span>
          <Button variant="primary" icon={Send} onClick={() => dialog.current?.showModal()} className="hidden sm:inline-flex">Submit</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          <div key={question.id} className="animate-enter">
            <QuestionView
              ref={headingRef}
              question={question}
              mode="exam"
              selected={exam.answers[question.id] ?? null}
              revealed={false}
              onAnswer={choose}
              showSlide={question.requiresImage}
              label={<span className="font-semibold text-ink-2">Q{index + 1}</span>}
              toolbar={
                <Button size="sm" variant={flagged ? 'secondary' : 'ghost'} icon={Flag} onClick={toggleFlag} aria-pressed={flagged} kbd="F" className={flagged ? 'text-warn' : undefined}>
                  {flagged ? 'Flagged' : 'Flag'}
                </Button>
              }
            />
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            <Button icon={ArrowLeft} onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous question">
              <span className="hidden sm:inline">Previous</span>
            </Button>
            <Button variant="ghost" className="lg:hidden" iconRight={ChevronDown} onClick={() => setMapOpen((v) => !v)} aria-expanded={mapOpen} aria-controls="exam-map-mobile">
              {answeredCount}/{questions.length}
            </Button>
            {index === questions.length - 1 ? (
              <Button variant="primary" icon={Send} onClick={() => dialog.current?.showModal()}>Review & submit</Button>
            ) : (
              <Button variant="primary" iconRight={ArrowRight} onClick={() => goTo(index + 1)}>Next</Button>
            )}
          </div>
          {mapOpen && <Panel as="div" className="mt-4 p-4 lg:hidden" id="exam-map-mobile">{map}</Panel>}
          <p className="mt-6 hidden text-[13px] text-ink-3 sm:block">Keys: A–D or 1–4 answer · ← → move · F flag</p>
        </div>

        <aside className="hidden lg:block" aria-label="Question navigator">
          <Panel as="div" className="sticky top-24 p-4">
            {map}
            <Button variant="secondary" icon={Send} className="mt-4 w-full" onClick={() => dialog.current?.showModal()}>Submit exam</Button>
          </Panel>
        </aside>
      </div>

      <dialog ref={dialog} aria-labelledby="submit-title" className="w-[min(440px,calc(100vw-32px))] rounded-card border border-line bg-surface p-0 shadow-pop">
        <div className="p-6">
          <h2 id="submit-title" className="text-[19px] font-bold text-ink">Submit your exam?</h2>
          <p className="mt-2 text-ink-2">You can't change answers after submitting.</p>
          <ul className="mt-4 grid gap-1.5 text-[15px]">
            <li className="flex justify-between"><span className="text-ink-2">Answered</span><span className="font-semibold">{answeredCount} / {questions.length}</span></li>
            <li className="flex justify-between"><span className="text-ink-2">Unanswered</span><span className={cn('font-semibold', unanswered > 0 && 'text-warn')}>{unanswered}</span></li>
            <li className="flex justify-between"><span className="text-ink-2">Flagged</span><span className="font-semibold">{exam.flags.length}</span></li>
            <li className="flex justify-between"><span className="text-ink-2">Time left</span><span className="font-mono font-semibold">{formatDuration(remaining)}</span></li>
          </ul>
          {unanswered > 0 && <p className="mt-4 rounded-control bg-warn/10 px-3 py-2 text-[14px] text-warn">Unanswered questions count as wrong.</p>}
        </div>
        <form method="dialog" className="flex justify-end gap-2 border-t border-line bg-canvas/40 px-6 py-4">
          <Button type="submit" autoFocus>Keep working</Button>
          <Button variant="primary" onClick={() => { submitted.current = true; dialog.current?.close(); onSubmit() }}>Submit now</Button>
        </form>
      </dialog>
    </div>
  )
}

type ReviewFilter = 'all' | 'wrong' | 'unanswered' | 'flagged'

function ExamResults({ questions, result, flags, onNew, onPracticeIds }: Finished & { onNew: () => void; onPracticeIds: (ids: string[], title: string) => void }) {
  const [filter, setFilter] = useState<ReviewFilter>(() =>
    questions.some((q) => result.answers[q.id] && result.answers[q.id] !== q.correctAnswer) ? 'wrong' : 'all',
  )
  const [open, setOpen] = useState<string | null>(null)
  const scored = scoreExam(questions, result.answers)
  const unanswered = questions.filter((q) => !result.answers[q.id]).length
  const wrongIds = questions.filter((q) => result.answers[q.id] !== q.correctAnswer).map((q) => q.id)
  const byTopic = technicalTopics
    .map((topic) => {
      const pool = questions.filter((q) => q.topicIds.includes(topic.id))
      const correct = pool.filter((q) => result.answers[q.id] === q.correctAnswer).length
      return { topic, total: pool.length, correct }
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => a.correct / a.total - b.correct / b.total)

  const shown = questions
    .map((q, index) => ({ q, index }))
    .filter(({ q }) =>
      filter === 'all' ? true : filter === 'wrong' ? Boolean(result.answers[q.id]) && result.answers[q.id] !== q.correctAnswer : filter === 'unanswered' ? !result.answers[q.id] : flags.includes(q.id),
    )

  return (
    <div className="mx-auto max-w-[960px]">
      <Panel className="animate-pop p-5 sm:p-8" aria-labelledby="score-title">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="sm:w-48">
            <p className="text-[13px] text-ink-2">Score</p>
            <h1 id="score-title" className="mt-1 text-[52px] font-bold leading-none tracking-[-0.03em] text-ink">
              {scored.score}<span className="text-[22px] font-semibold text-ink-3"> / 10</span>
            </h1>
          </div>
          <dl className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
            <div><dt className="text-[13px] text-ink-2">Correct</dt><dd className="mt-1 text-[22px] font-bold text-ok">{scored.correct}</dd></div>
            <div><dt className="text-[13px] text-ink-2">Wrong</dt><dd className="mt-1 text-[22px] font-bold text-bad">{scored.wrong - unanswered}</dd></div>
            <div><dt className="text-[13px] text-ink-2">Unanswered</dt><dd className="mt-1 text-[22px] font-bold text-ink">{unanswered}</dd></div>
            <div><dt className="text-[13px] text-ink-2">Time used</dt><dd className="mt-1 font-mono text-[22px] font-bold text-ink">{formatDuration(result.durationSeconds)}</dd></div>
          </dl>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
          {wrongIds.length > 0 && <Button variant="primary" icon={Target} onClick={() => onPracticeIds(wrongIds, 'Mistakes from mock exam')}>Practice the {wrongIds.length} missed</Button>}
          <Button icon={GraduationCap} onClick={onNew}>New exam</Button>
        </div>
      </Panel>

      <section className="mt-8" aria-labelledby="topics-title">
        <SectionTitle id="topics-title">By topic</SectionTitle>
        <Panel as="div" className="divide-y divide-line">
          {byTopic.map(({ topic, total, correct }) => (
            <div key={topic.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[220px_1fr_auto] sm:px-5">
              <span className="text-[15px] text-ink">{topic.name}</span>
              <span className="text-[14px] tabular-nums text-ink-2 sm:order-last">{correct}/{total} · {percent(correct, total)}%</span>
              <MasteryBar correct={correct} wrong={total - correct} total={total} className="col-span-2 sm:col-span-1" />
            </div>
          ))}
        </Panel>
        <p className="mt-2 text-[12px] text-ink-3">A question can belong to more than one topic.</p>
      </section>

      <section className="mt-8" aria-labelledby="review-title">
        <SectionTitle
          id="review-title"
          aside={
            <Segmented<ReviewFilter>
              label="Filter answers"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'wrong', label: `Wrong ${wrongIds.length - unanswered}` },
                { value: 'unanswered', label: `Blank ${unanswered}` },
                { value: 'flagged', label: `Flagged ${flags.length}` },
                { value: 'all', label: 'All' },
              ]}
            />
          }
        >
          Answer review
        </SectionTitle>
        {shown.length ? (
          <ul className="grid gap-2">
            {shown.map(({ q, index }) => {
              const selected = result.answers[q.id]
              const correct = selected === q.correctAnswer
              const expanded = open === q.id
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : q.id)}
                    aria-expanded={expanded}
                    className={cn('flex w-full items-start gap-3 rounded-card border border-line bg-surface px-4 py-3 text-left hover:border-line-strong', expanded && 'rounded-b-none')}
                  >
                    <span className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-[7px] text-[13px] font-bold', correct ? 'bg-ok/15 text-ok' : 'bg-bad/15 text-bad')}>{index + 1}</span>
                    <span className="min-w-0 flex-1 text-[15px] leading-snug text-ink">{q.question}</span>
                    <span className="hidden shrink-0 text-[13px] text-ink-3 sm:block">You {selected ?? '—'} · Answer {q.correctAnswer}</span>
                    {correct ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-ok" aria-label="Correct" /> : <XCircle size={18} className="mt-0.5 shrink-0 text-bad" aria-label="Wrong" />}
                  </button>
                  {expanded && (
                    <div className="-mt-px">
                      <QuestionView question={q} mode="review" selected={selected ?? null} revealed label={<Badge tone={correct ? 'ok' : 'bad'}>{selected ? (correct ? 'Correct' : 'Wrong') : 'Unanswered'}</Badge>} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState icon={CheckCircle2} title="Nothing here" body="No questions match this filter." />
        )}
      </section>
    </div>
  )
}
