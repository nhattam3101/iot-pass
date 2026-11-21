import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Bookmark, CheckCircle2, Keyboard, RotateCcw, SlidersHorizontal, Target, Undo2 } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import type { Progress, Question } from '../types'
import { isPracticable, technicalTopics } from '../data'
import { advance, applyAnswer, createSession, recordAnswer } from '../lib/practice'
import type { PracticeSession } from '../lib/practice'
import { loadPractice, savePractice } from '../lib/storage'
import type { PracticeFilter, PracticeRange } from '../lib/storage'
import { QuestionView } from '../components/QuestionView'
import { StreakMeter } from '../components/StreakMeter'
import { Badge, Button, EmptyState, IconButton, Kbd, ProgressBar, Select, cn, percent, useShortcuts } from '../components/ui'

interface Props {
  questions: Question[]
  progress: Progress
  setProgress: Dispatch<SetStateAction<Progress>>
  filter: PracticeFilter
  setFilter: (filter: PracticeFilter) => void
}

const sessionKey = (filter: PracticeFilter, range: PracticeRange | null, bookmarkedOnly: boolean, ids: string[]) =>
  JSON.stringify([filter.topicId ?? '', filter.ids?.length ?? 0, range, bookmarkedOnly, ids.length, ids[0] ?? '', ids[ids.length - 1] ?? ''])

export function PracticePage({ questions, progress, setProgress, filter, setFilter }: Props) {
  const stored = useMemo(() => loadPractice(), [])
  const restorable = stored && JSON.stringify(stored.filter) === JSON.stringify(filter) ? stored : null
  const [range, setRange] = useState<PracticeRange | null>(restorable?.range ?? null)
  const [bookmarkedOnly, setBookmarkedOnly] = useState(restorable?.bookmarkedOnly ?? false)
  const [showSettings, setShowSettings] = useState(false)
  const [showSlide, setShowSlide] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const byId = useMemo(() => new Map(questions.map((question) => [question.id, question])), [questions])
  const sourcePool = useMemo(
    () => questions.filter((q) => isPracticable(q) && (!filter.topicId || q.topicIds.includes(filter.topicId)) && (!filter.ids || filter.ids.includes(q.id))),
    [questions, filter],
  )
  // Bookmarks are read once per filter change so toggling a bookmark mid-session doesn't reshuffle it.
  const starredAtStart = useMemo(() => new Set(progress.starred), [filter, bookmarkedOnly]) // eslint-disable-line react-hooks/exhaustive-deps
  const pool = useMemo(() => {
    const ranged = range ? sourcePool.slice(range.start, range.end) : sourcePool
    return bookmarkedOnly ? ranged.filter((q) => starredAtStart.has(q.id)) : ranged
  }, [sourcePool, range, bookmarkedOnly, starredAtStart])
  const poolIds = useMemo(() => pool.map((q) => q.id), [pool])
  const key = sessionKey(filter, range, bookmarkedOnly, poolIds)

  const [session, setSession] = useState<PracticeSession>(() =>
    restorable && restorable.session.key === key ? restorable.session : createSession(key, poolIds),
  )
  useEffect(() => {
    if (session.key !== key) setSession(createSession(key, poolIds))
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => savePractice({ filter, range, bookmarkedOnly, session }), [filter, range, bookmarkedOnly, session])

  const question = session.currentId ? byId.get(session.currentId) : undefined
  const answered = session.last && session.last.id === session.currentId ? session.last : null
  const starred = question ? progress.starred.includes(question.id) : false

  const turn = `${session.currentId}-${session.cursor}-${session.currentIsRetry}`
  const focusOnTurn = useRef(false)
  useEffect(() => {
    setShowSlide(Boolean(question?.requiresImage))
    if (!focusOnTurn.current) return
    focusOnTurn.current = false
    const card = headingRef.current?.closest('article')
    headingRef.current?.focus({ preventScroll: true })
    const top = card?.getBoundingClientRect().top ?? 0
    if (top < 0 || top > window.innerHeight * 0.5) card?.scrollIntoView({ block: 'start' })
  }, [turn]) // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (choice: string) => {
    if (!question || answered) return
    const correct = choice === question.correctAnswer
    setSession((current) => recordAnswer(current, choice, correct))
    setProgress((current) => applyAnswer(current, question.id, choice, correct, session.currentIsRetry))
  }
  const next = () => {
    if (!answered) return
    focusOnTurn.current = true
    setSession(advance)
  }
  const toggleStar = () =>
    question && setProgress((current) => ({ ...current, starred: current.starred.includes(question.id) ? current.starred.filter((id) => id !== question.id) : [...current.starred, question.id] }))
  const restart = () => setSession(createSession(key, poolIds))

  const onKey = useCallback(
    (pressed: string, event: KeyboardEvent) => {
      if (!question) return
      const keys = Object.keys(question.options)
      const upper = pressed.toUpperCase()
      const byNumber = /^[1-9]$/.test(pressed) ? keys[Number(pressed) - 1] : undefined
      if (!answered && (keys.includes(upper) || byNumber)) {
        event.preventDefault()
        answer(byNumber ?? upper)
      } else if (answered && (pressed === 'Enter' || pressed === 'ArrowRight' || pressed === 'n' || pressed === 'N')) {
        if (pressed === 'Enter' && (event.target as HTMLElement)?.tagName === 'BUTTON') return
        event.preventDefault()
        next()
      } else if (upper === 'S' && !question.requiresImage) {
        setShowSlide((value) => !value)
      } else if (upper === 'B' || pressed === '*') {
        // Before answering, B is an answer key; afterwards it bookmarks.
        toggleStar()
      }
    },
    [question, answered, session], // eslint-disable-line react-hooks/exhaustive-deps
  )
  useShortcuts(onKey)

  const seen = Math.min(session.cursor, session.order.length)
  const accuracy = percent(session.firstCorrect, session.firstTotal)
  const complete = !question && session.order.length > 0

  return (
    <div className="mx-auto max-w-[860px]">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-bold tracking-[-0.02em] text-ink sm:text-[26px]">{filter.title}</h1>
          <p className="text-[13px] text-ink-3">
            {pool.length} questions{range ? ` · range ${range.start}–${range.end}` : ''}{bookmarkedOnly ? ' · bookmarked only' : ''}
          </p>
        </div>
        <Button size="sm" variant={showSettings ? 'secondary' : 'ghost'} icon={SlidersHorizontal} onClick={() => setShowSettings((value) => !value)} aria-expanded={showSettings} aria-controls="practice-settings">
          Filters
        </Button>
      </header>

      {showSettings && (
        <PracticeSettings
          sourceCount={sourcePool.length}
          filter={filter}
          setFilter={setFilter}
          range={range}
          setRange={setRange}
          bookmarkedOnly={bookmarkedOnly}
          setBookmarkedOnly={setBookmarkedOnly}
          bookmarkCount={sourcePool.filter((q) => progress.starred.includes(q.id)).length}
        />
      )}

      {session.order.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-card border border-line bg-surface px-4 py-3 sm:px-5">
          <div className="min-w-[180px] flex-1">
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-ink-2"><span className="font-semibold text-ink">{seen}</span> of {session.order.length}</span>
              <span className="flex gap-2 text-ink-3">
                {session.firstTotal >= 3 && <span>{accuracy}% first try</span>}
                {session.retry.length > 0 && <span className="text-warn">{session.retry.length} to retry</span>}
              </span>
            </div>
            <ProgressBar value={seen} max={session.order.length} label="Session progress" />
          </div>
          <StreakMeter streak={session.streak} best={session.bestStreak} />
        </div>
      )}

      {question ? (
        <div key={turn} className="animate-enter">
          <QuestionView
            ref={headingRef}
            question={question}
            mode="practice"
            selected={answered?.selected ?? null}
            revealed={Boolean(answered)}
            onAnswer={answer}
            showSlide={showSlide}
            onToggleSlide={question.requiresImage ? undefined : () => setShowSlide((value) => !value)}
            label={<span className="font-semibold text-ink-2">#{sourcePool.findIndex((q) => q.id === question.id) + 1}</span>}
            toolbar={<IconButton icon={Bookmark} label={starred ? 'Remove bookmark (B)' : 'Bookmark for review (B)'} active={starred} aria-pressed={starred} onClick={toggleStar} />}
            notice={
              session.currentIsRetry && (
                <p className="mt-4 flex items-center gap-2 rounded-control bg-warn/10 px-3 py-2 text-[14px] text-warn">
                  <Undo2 size={16} aria-hidden /> You missed this one earlier — second chance.
                </p>
              )
            }
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-ink-3" aria-live="polite">
              {answered ? encouragement(answered, session) : <span className="hidden sm:inline">Pick an answer — <Kbd>A</Kbd>–<Kbd>D</Kbd> or <Kbd>1</Kbd>–<Kbd>4</Kbd></span>}
            </p>
            <Button variant="primary" size="lg" iconRight={ArrowRight} onClick={next} disabled={!answered} kbd="↵" className="ml-auto">
              Next question
            </Button>
          </div>
        </div>
      ) : complete ? (
        <SessionSummary session={session} onRestart={restart} onPracticeMisses={() => setFilter({ ids: session.missedIds, title: 'Misses from last session' })} />
      ) : (
        <EmptyState
          icon={Target}
          title={bookmarkedOnly ? 'No bookmarked questions here' : 'No questions match'}
          body={bookmarkedOnly ? 'Bookmark questions while practising, then come back to drill them.' : 'Try another topic or widen the question range.'}
          action={<Button onClick={() => { setRange(null); setBookmarkedOnly(false); setFilter({ title: 'All questions' }) }}>Reset filters</Button>}
        />
      )}

      {question && (
        <details className="mt-8 hidden text-[13px] text-ink-3 sm:block">
          <summary className="inline-flex items-center gap-2 hover:text-ink-2"><Keyboard size={15} aria-hidden /> Keyboard shortcuts</summary>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt><Kbd>A</Kbd>–<Kbd>D</Kbd> / <Kbd>1</Kbd>–<Kbd>4</Kbd></dt><dd>Choose an answer</dd>
            <dt><Kbd>Enter</Kbd> / <Kbd>→</Kbd></dt><dd>Next question</dd>
            <dt><Kbd>S</Kbd></dt><dd>Show or hide the original slide</dd>
            <dt><Kbd>*</Kbd> / <Kbd>B</Kbd></dt><dd>Bookmark (<Kbd>B</Kbd> works after answering, since it is also an answer key)</dd>
          </dl>
        </details>
      )}
    </div>
  )
}

function encouragement(last: NonNullable<PracticeSession['last']>, session: PracticeSession) {
  if (!last.correct) return session.retry.some((entry) => entry.id === last.id) ? 'It will come back in a few questions.' : 'Added to your Review list.'
  if (last.wasRetry) return 'Recovered — that earlier miss is fixed.'
  if (session.streak >= 3) return `${session.streak} correct in a row.`
  return 'Nice.'
}

function SessionSummary({ session, onRestart, onPracticeMisses }: { session: PracticeSession; onRestart: () => void; onPracticeMisses: () => void }) {
  const stillMissed = session.missedIds.length - session.recovered
  return (
    <section className="animate-pop rounded-card border border-line bg-surface p-6 text-center shadow-raised sm:p-10" aria-labelledby="summary-title">
      <CheckCircle2 className="mx-auto text-ok" size={36} aria-hidden />
      <h2 id="summary-title" className="mt-3 text-[22px] font-bold text-ink">Set complete</h2>
      <p className="mx-auto mt-2 max-w-md text-ink-2">
        {session.firstTotal} questions · {percent(session.firstCorrect, session.firstTotal)}% right on the first try
        {session.recovered > 0 && ` · ${session.recovered} recovered on retry`} · best streak {session.bestStreak}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {session.missedIds.length > 0 && (
          <Button variant="primary" icon={Target} onClick={onPracticeMisses}>
            Drill the {session.missedIds.length} you missed
          </Button>
        )}
        <Button icon={RotateCcw} onClick={onRestart}>Start this set again</Button>
      </div>
      {stillMissed > 0 && <p className="mt-4 text-[13px] text-ink-3">{stillMissed} still wrong are kept in Review.</p>}
    </section>
  )
}

function PracticeSettings(props: {
  sourceCount: number
  filter: PracticeFilter
  setFilter: (filter: PracticeFilter) => void
  range: PracticeRange | null
  setRange: (range: PracticeRange | null) => void
  bookmarkedOnly: boolean
  setBookmarkedOnly: (value: boolean) => void
  bookmarkCount: number
}) {
  const { sourceCount, filter, setFilter, range, setRange, bookmarkedOnly, setBookmarkedOnly, bookmarkCount } = props
  const [draft, setDraft] = useState({ start: String(range?.start ?? 0), end: String(range?.end ?? sourceCount) })
  const [error, setError] = useState('')
  useEffect(() => setDraft({ start: String(range?.start ?? 0), end: String(range?.end ?? sourceCount) }), [range, sourceCount])

  const apply = () => {
    const start = Number(draft.start)
    const end = Number(draft.end)
    if (!Number.isInteger(start) || !Number.isInteger(end)) return setError('Start and end must be whole numbers.')
    if (start < 0 || end > sourceCount || start >= end) return setError(`Use 0–${sourceCount}, with start below end.`)
    setError('')
    setRange(start === 0 && end === sourceCount ? null : { start, end })
  }

  return (
    <section id="practice-settings" aria-label="Practice filters" className="animate-enter mb-4 grid gap-4 rounded-card border border-line bg-surface p-4 sm:p-5 md:grid-cols-[1fr_1.3fr]">
      <div className="grid content-start gap-3">
        <Select
          label="Topic"
          value={filter.ids ? '__ids' : filter.topicId ?? ''}
          onChange={(value) => { setRange(null); setFilter(value ? { topicId: value, title: technicalTopics.find((t) => t.id === value)?.name ?? value } : { title: 'All questions' }) }}
        >
          {filter.ids && <option value="__ids">{filter.title} ({filter.ids.length})</option>}
          <option value="">All topics</option>
          {technicalTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
        </Select>
        <label className="flex min-h-11 items-center gap-3 rounded-control border border-line bg-canvas px-3 text-[15px]">
          <input type="checkbox" checked={bookmarkedOnly} onChange={(event) => setBookmarkedOnly(event.target.checked)} className="size-4 accent-[rgb(var(--accent))]" />
          <span className="flex-1">Bookmarked only</span>
          <Badge>{bookmarkCount}</Badge>
        </label>
      </div>
      <form className="grid content-start gap-1.5" onSubmit={(event) => { event.preventDefault(); apply() }}>
        <span className="text-[13px] font-medium text-ink-2">Question range (source order, end excluded)</span>
        <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
          <input aria-label="Range start" type="number" inputMode="numeric" min={0} max={Math.max(0, sourceCount - 1)} value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} className="field" />
          <span className="text-ink-3" aria-hidden>–</span>
          <input aria-label="Range end" type="number" inputMode="numeric" min={1} max={sourceCount} value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} className="field" />
          <Button type="submit" disabled={!sourceCount}>Apply</Button>
        </div>
        {error ? (
          <p role="alert" className="text-[13px] text-bad">{error}</p>
        ) : (
          <p className="text-[13px] text-ink-3">
            e.g. 0–100 = first 100 of {sourceCount}.{' '}
            {range && <button type="button" className={cn('underline underline-offset-2 hover:text-ink')} onClick={() => setRange(null)}>Clear range</button>}
          </p>
        )}
      </form>
    </section>
  )
}
