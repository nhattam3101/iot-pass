import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { Lock, Pencil, RotateCcw, Search, X } from 'lucide-react'
import type { Progress, Question } from '../types'
import { baseQuestions, technicalTopics, topicName } from '../data'
import type { BankOverride } from '../lib/storage'
import { SlideImage } from '../components/QuestionView'
import { Badge, Button, EmptyState, IconButton, PageHeader, Panel, Select, cn } from '../components/ui'

type Status = 'all' | 'verified' | 'review' | 'missing' | 'duplicate' | 'edited' | 'lowocr' | 'bookmarked'
const PAGE = 40
const LOW_OCR = 75

interface Props {
  questions: Question[]
  progress: Progress
  overrides: Record<string, BankOverride>
  setOverride: (id: string, value: BankOverride | null) => void
}

export function BankPage({ questions, progress, overrides, setOverride }: Props) {
  const [search, setSearch] = useState('')
  const [topic, setTopic] = useState('')
  const [status, setStatus] = useState<Status>('all')
  const [limit, setLimit] = useState(PAGE)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const query = useDeferredValue(search.trim().toLowerCase())
  useEffect(() => setLimit(PAGE), [query, topic, status])

  const matches = (q: Question) => {
    if (topic && !q.topicIds.includes(topic)) return false
    if (status === 'verified' && q.needsReview) return false
    if (status === 'review' && !q.needsReview) return false
    if (status === 'missing' && q.correctAnswer) return false
    if (status === 'duplicate' && !q.duplicateOf) return false
    if (status === 'edited' && !overrides[q.id]) return false
    if (status === 'lowocr' && q.ocr.confidence >= LOW_OCR) return false
    if (status === 'bookmarked' && !progress.starred.includes(q.id)) return false
    if (!query) return true
    if (/^\d+$/.test(query)) return String(q.slideNumber) === query || q.question.toLowerCase().includes(query)
    return q.question.toLowerCase().includes(query) || Object.values(q.options).some((text) => text.toLowerCase().includes(query)) || q.id.includes(query)
  }
  const filtered = questions.filter(matches)
  const selected = questions.find((q) => q.id === selectedId) ?? null

  return (
    <>
      <PageHeader title="Question bank" description="Every extracted record with its source slide. Edits are saved only in this browser and never change the source files." />
      <Panel as="div" className="mb-4 grid gap-3 p-3 sm:p-4 md:grid-cols-[1fr_200px_200px]">
        <label className="relative">
          <span className="sr-only">Search questions</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" size={18} aria-hidden />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search text, options, or slide number" className="field pl-10" />
        </label>
        <Select label="Topic" hideLabel value={topic} onChange={setTopic}>
          <option value="">All topics</option>
          {technicalTopics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <Select label="Status" hideLabel value={status} onChange={(v) => setStatus(v as Status)}>
          <option value="all">All statuses</option>
          <option value="verified">Validated</option>
          <option value="review">Needs review</option>
          <option value="missing">Missing answer</option>
          <option value="duplicate">Duplicates</option>
          <option value="lowocr">Low OCR confidence (&lt;{LOW_OCR}%)</option>
          <option value="edited">Edited locally</option>
          <option value="bookmarked">Bookmarked</option>
        </Select>
      </Panel>
      <p className="mb-3 text-[13px] text-ink-3" aria-live="polite">{filtered.length} of {questions.length} records</p>

      {filtered.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {filtered.slice(0, limit).map((q) => (
            <li key={q.id}>
              <button type="button" onClick={() => setSelectedId(q.id)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-raised sm:px-5">
                <span className="mt-0.5 w-9 shrink-0 text-[13px] font-semibold tabular-nums text-ink-3">{q.slideNumber}</span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[15px] leading-snug text-ink">{q.question}</span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge tone={q.needsReview ? 'warn' : 'ok'}>{q.needsReview ? 'Needs review' : 'Validated'}</Badge>
                    <Badge>Answer {q.correctAnswer ?? '—'}</Badge>
                    {q.ocr.confidence < LOW_OCR && <Badge tone="warn">OCR {q.ocr.confidence}%</Badge>}
                    {q.duplicateOf && <Badge>Duplicate of {q.duplicateOf}</Badge>}
                    {overrides[q.id] && <Badge tone="accent">Edited locally</Badge>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Search} title="No records match" body="Try a different search or clear the filters." />
      )}
      {filtered.length > limit && (
        <div className="mt-4 flex justify-center">
          <Button onClick={() => setLimit((value) => value + PAGE)}>Show {Math.min(PAGE, filtered.length - limit)} more</Button>
        </div>
      )}

      {selected && (
        <RecordDialog
          key={selected.id}
          question={selected}
          source={baseQuestions.find((q) => q.id === selected.id)!}
          edited={Boolean(overrides[selected.id])}
          onClose={() => setSelectedId(null)}
          onSave={(value) => setOverride(selected.id, value)}
          onRevert={() => setOverride(selected.id, null)}
        />
      )}
    </>
  )
}

function RecordDialog({ question, source, edited, onClose, onSave, onRevert }: { question: Question; source: Question; edited: boolean; onClose: () => void; onSave: (value: BankOverride) => void; onRevert: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(question)
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  const dirty = JSON.stringify([draft.question, draft.options, draft.correctAnswer, draft.needsReview]) !== JSON.stringify([question.question, question.options, question.correctAnswer, question.needsReview])

  return (
    <dialog ref={dialog} onClose={onClose} aria-labelledby="record-title" className="m-auto max-h-[calc(100dvh-24px)] w-[min(1100px,calc(100vw-24px))] overflow-hidden rounded-card border border-line bg-surface p-0 shadow-pop">
      <div className="flex max-h-[calc(100dvh-24px)] flex-col">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 id="record-title" className="text-[17px] font-semibold text-ink">Slide {question.slideNumber}</h2>
            <p className="text-[12px] text-ink-3">{question.id} · OCR {question.ocr.confidence}% · {question.topicIds.map(topicName).join(', ')}</p>
          </div>
          <IconButton icon={X} label="Close" onClick={() => dialog.current?.close()} />
        </header>
        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-4 sm:p-6 lg:grid-cols-2">
          <div className="grid content-start gap-3">
            <SlideImage question={question} />
            <div>
              <p className="mb-1 text-[13px] font-medium text-ink-2">Speaker Notes (source answer)</p>
              <pre className="whitespace-pre-wrap rounded-control border border-line bg-canvas p-3 text-[13px] leading-6 text-ink-2">{question.speakerNotes || '—'}</pre>
            </div>
            {question.reviewReasons.length > 0 && (
              <div>
                <p className="mb-1 text-[13px] font-medium text-ink-2">Review reasons</p>
                <ul className="list-disc pl-5 text-[13px] text-warn">{question.reviewReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
              </div>
            )}
          </div>

          <form className="grid content-start gap-4" onSubmit={(event) => { event.preventDefault(); onSave({ question: draft.question, options: draft.options, correctAnswer: draft.correctAnswer, needsReview: draft.needsReview }); setEditing(false) }}>
            <div className={cn('flex items-center gap-2 rounded-control px-3 py-2 text-[13px]', editing ? 'bg-warn/10 text-warn' : 'bg-overlay text-ink-2')}>
              {editing ? <Pencil size={15} aria-hidden /> : <Lock size={15} aria-hidden />}
              <span className="flex-1">{editing ? 'Editing a local copy. The source record is unchanged.' : 'Read-only. Unlock to save a browser-local correction.'}</span>
              {!editing && <Button size="sm" onClick={() => setEditing(true)}>Edit locally</Button>}
            </div>
            <fieldset disabled={!editing} className="grid gap-4">
              <label className="grid gap-1.5 text-[13px] font-medium text-ink-2">
                Question
                <textarea value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} rows={3} className="field py-2 leading-relaxed" />
              </label>
              {Object.entries(draft.options).map(([key, value]) => (
                <label key={key} className="grid grid-cols-[28px_1fr] items-center gap-2 text-[13px] font-semibold text-ink-2">
                  <span className={cn('grid size-7 place-items-center rounded-[7px] border', key === draft.correctAnswer ? 'border-ok bg-ok/15 text-ok' : 'border-line')}>{key}</span>
                  <input value={value} onChange={(e) => setDraft({ ...draft, options: { ...draft.options, [key]: e.target.value } })} className="field font-normal" aria-label={`Option ${key}`} />
                </label>
              ))}
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="Correct answer" value={draft.correctAnswer ?? ''} onChange={(v) => setDraft({ ...draft, correctAnswer: v || null })}>
                  <option value="">Unknown</option>
                  {Object.keys(draft.options).map((key) => <option key={key} value={key}>{key}{key === source.correctAnswer ? ' (source)' : ''}</option>)}
                </Select>
                <Select label="Review state" value={String(draft.needsReview)} onChange={(v) => setDraft({ ...draft, needsReview: v === 'true' })}>
                  <option value="false">Validated</option>
                  <option value="true">Needs review</option>
                </Select>
              </div>
            </fieldset>
            {draft.correctAnswer !== source.correctAnswer && <p className="text-[13px] text-warn">Answer differs from the source ({source.correctAnswer ?? 'none'}).</p>}
            <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
              {edited && <Button variant="ghost" icon={RotateCcw} onClick={() => { onRevert(); setDraft(source); setEditing(false) }}>Revert to source</Button>}
              {editing && <Button onClick={() => { setDraft(question); setEditing(false) }}>Cancel</Button>}
              {editing && <Button type="submit" variant="primary" disabled={!dirty}>Save local correction</Button>}
            </div>
          </form>
        </div>
      </div>
    </dialog>
  )
}
