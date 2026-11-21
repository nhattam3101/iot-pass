import { useState } from 'react'
import { Bookmark, CheckCircle2, ChevronDown, Play, X } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import type { Progress, Question } from '../types'
import { isPracticable, technicalTopics } from '../data'
import { mastery } from '../lib/stats'
import type { PracticeFilter } from '../lib/storage'
import { QuestionView } from '../components/QuestionView'
import { Button, EmptyState, IconButton, PageHeader, Panel, ProgressBar, Segmented, Select, cn, formatDate } from '../components/ui'

type Tab = 'missed' | 'bookmarked'

export function ReviewPage({ questions, progress, setProgress, onPractice }: { questions: Question[]; progress: Progress; setProgress: Dispatch<SetStateAction<Progress>>; onPractice: (filter: PracticeFilter) => void }) {
  const [tab, setTab] = useState<Tab>('missed')
  const [topic, setTopic] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const inTopic = (q: Question) => !topic || q.topicIds.includes(topic)
  const practicable = questions.filter(isPracticable)
  const missed = practicable
    .filter((q) => inTopic(q) && progress.answers[q.id] && !progress.answers[q.id].correct)
    .sort((a, b) => progress.answers[b.id].lastAnsweredAt.localeCompare(progress.answers[a.id].lastAnsweredAt))
  const bookmarked = questions.filter((q) => inTopic(q) && progress.starred.includes(q.id))
  const items = tab === 'missed' ? missed : bookmarked
  const m = mastery(practicable.filter(inTopic), progress)
  const everMissed = m.wrong + m.recovered
  const topicLabel = technicalTopics.find((t) => t.id === topic)?.name
  const removeBookmark = (id: string) => setProgress((current) => ({ ...current, starred: current.starred.filter((item) => item !== id) }))

  const practiceAll = () =>
    onPractice({ ids: items.map((q) => q.id), title: `${tab === 'missed' ? 'Missed' : 'Bookmarked'}${topicLabel ? ` · ${topicLabel}` : ''}` })

  return (
    <>
      <PageHeader title="Review" description="Questions you got wrong (latest answer) and ones you bookmarked. Practising a list brings each miss back until you get it right." />

      <Panel as="div" className="mb-5 grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[14px]">
            <span className="text-ink-2"><span className="font-semibold text-ok">{m.recovered}</span> of {everMissed} past misses recovered</span>
            <span className="text-ink-3">{m.wrong} still open</span>
          </div>
          <ProgressBar value={m.recovered} max={everMissed} tone="ok" label="Recovered misses" />
        </div>
        <Button variant="primary" icon={Play} disabled={!items.length} onClick={practiceAll}>
          Practice {items.length} {tab === 'missed' ? 'missed' : 'bookmarked'}
        </Button>
      </Panel>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <Segmented<Tab>
          label="Review list"
          value={tab}
          onChange={(value) => { setTab(value); setOpen(null) }}
          options={[
            { value: 'missed', label: `Missed ${missed.length}` },
            { value: 'bookmarked', label: `Bookmarked ${bookmarked.length}` },
          ]}
        />
        <Select label="Topic" hideLabel value={topic} onChange={setTopic} className="w-full sm:w-64">
          <option value="">All topics</option>
          {technicalTopics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </div>

      {items.length ? (
        <ul className="grid gap-2">
          {items.map((q) => {
            const record = progress.answers[q.id]
            const expanded = open === q.id
            return (
              <li key={q.id}>
                <div className={cn('flex items-start gap-2 rounded-card border border-line bg-surface pr-2', expanded && 'rounded-b-none')}>
                  <button type="button" onClick={() => setOpen(expanded ? null : q.id)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left">
                    <span className="mt-0.5 shrink-0 text-[13px] font-semibold text-ink-3">#{q.slideNumber}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] leading-snug text-ink">{q.question}</span>
                      {record && (
                        <span className="mt-1 block text-[13px] text-ink-3">
                          {record.correct ? 'Last answer correct' : `You chose ${record.selected}`} · {record.attempts} attempt{record.attempts > 1 ? 's' : ''} · {formatDate(record.lastAnsweredAt)}
                        </span>
                      )}
                    </span>
                    <ChevronDown size={18} className={cn('mt-0.5 shrink-0 text-ink-3 transition-transform', expanded && 'rotate-180')} aria-hidden />
                  </button>
                  {tab === 'bookmarked' && <IconButton icon={X} label="Remove bookmark" onClick={() => removeBookmark(q.id)} />}
                </div>
                {expanded && (
                  <div className="-mt-px">
                    <QuestionView
                      question={q}
                      mode="review"
                      selected={record?.selected ?? null}
                      revealed={Boolean(record) && Boolean(q.correctAnswer)}
                      label={<span className="font-semibold text-ink-2">Review</span>}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyState
          icon={tab === 'missed' ? CheckCircle2 : Bookmark}
          title={tab === 'missed' ? 'No open misses' : 'No bookmarks'}
          body={tab === 'missed' ? (topic ? 'Nothing wrong in this topic right now.' : 'Every question you answered is currently correct.') : 'Use the bookmark button (or B after answering) during practice.'}
        />
      )}
    </>
  )
}
