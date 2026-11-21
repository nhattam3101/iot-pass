import { forwardRef, useEffect, useState } from 'react'
import { Check, CheckCircle2, ImageIcon, RotateCcw, X, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Question } from '../types'
import { topicName } from '../data'
import { Badge, Button, cn } from './ui'

export type QuestionMode = 'practice' | 'exam' | 'review'

interface Props {
  question: Question
  selected: string | null
  /** Practice/review: show correctness. Never true in exam mode. */
  revealed: boolean
  mode: QuestionMode
  onAnswer?: (key: string) => void
  label?: ReactNode
  toolbar?: ReactNode
  /** Rendered between the question and the options (e.g. retry notice). */
  notice?: ReactNode
  showSlide?: boolean
  onToggleSlide?: () => void
}

const OPTION_KEYS = ['1', '2', '3', '4', '5', '6']

export const QuestionView = forwardRef<HTMLHeadingElement, Props>(function QuestionView(
  { question, selected, revealed, mode, onAnswer, label, toolbar, notice, showSlide, onToggleSlide },
  headingRef,
) {
  // Exam mode must never mark the source answer, whatever the caller passes.
  const feedback = mode !== 'exam' && revealed
  const entries = Object.entries(question.options)

  const stateFor = (key: string) => {
    if (!feedback) return selected === key ? 'selected' : 'idle'
    if (key === question.correctAnswer) return 'correct'
    if (key === selected) return 'wrong'
    return 'dimmed'
  }

  return (
    <article className="overflow-hidden rounded-card border border-line bg-surface shadow-raised" aria-labelledby={`q-${question.id}`}>
      <div className="px-4 pb-5 pt-4 sm:px-7 sm:pb-6 sm:pt-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[13px] text-ink-3">
            {label}
            <span>Slide {question.slideNumber}</span>
            {question.topicIds.slice(0, 2).map((id) => (
              <Badge key={id} tone="neutral" className="text-[12px]">{topicName(id)}</Badge>
            ))}
          </div>
          {toolbar && <div className="-my-1 -mr-2 flex items-center gap-1">{toolbar}</div>}
        </div>
        <h2 id={`q-${question.id}`} ref={headingRef} tabIndex={-1} className="text-pretty text-question text-ink outline-none sm:text-question-lg">
          {question.question}
        </h2>
        {question.code && (
          <pre tabIndex={0} aria-label="Code for this question" className="mt-4 max-h-[420px] overflow-auto rounded-control border border-line bg-canvas p-4 text-[13.5px] leading-6 text-ink sm:text-sm">
            <code>{question.code}</code>
          </pre>
        )}
        {showSlide && <SlideImage question={question} className="mt-4" />}
        {notice}
      </div>

      <div className="grid gap-2.5 border-t border-line bg-canvas/40 px-4 py-4 sm:px-7 sm:py-5" role="group" aria-label="Answer options">
        {entries.map(([key, text], index) => {
          const state = stateFor(key)
          return (
            <button
              key={key}
              type="button"
              className="option"
              data-state={state}
              disabled={!onAnswer || (mode !== 'exam' && revealed)}
              aria-pressed={selected === key}
              aria-keyshortcuts={`${key} ${OPTION_KEYS[index] ?? ''}`.trim()}
              onClick={() => onAnswer?.(key)}
            >
              <span className="key" aria-hidden>{key}</span>
              <span className="min-w-0 flex-1 whitespace-pre-line break-words pt-0.5">
                <span className="sr-only">Option {key}: </span>
                {text}
              </span>
              {state === 'correct' && <span className="mt-1 flex shrink-0 items-center gap-1 text-[13px] font-semibold text-ok"><Check size={17} aria-hidden />{selected === key ? 'Your answer' : 'Answer'}</span>}
              {state === 'wrong' && <span className="mt-1 flex shrink-0 items-center gap-1 text-[13px] font-semibold text-bad"><X size={17} aria-hidden />Your answer</span>}
            </button>
          )
        })}
      </div>

      {feedback && (
        <Feedback question={question} selected={selected} showSlide={showSlide} onToggleSlide={onToggleSlide} />
      )}
      {!feedback && onToggleSlide && !question.requiresImage && mode !== 'exam' && (
        <div className="border-t border-line px-4 py-2.5 sm:px-7">
          <button type="button" onClick={onToggleSlide} className="inline-flex min-h-9 items-center gap-2 text-[13px] text-ink-3 hover:text-ink">
            <ImageIcon size={15} aria-hidden /> {showSlide ? 'Hide original slide' : 'Show original slide'}
          </button>
        </div>
      )}
    </article>
  )
})

function Feedback({ question, selected, showSlide, onToggleSlide }: { question: Question; selected: string | null; showSlide?: boolean; onToggleSlide?: () => void }) {
  const correct = selected === question.correctAnswer
  return (
    <div className={cn('animate-enter border-t px-4 py-4 sm:px-7 sm:py-5', correct ? 'border-ok/25 bg-ok/[.06]' : 'border-bad/25 bg-bad/[.06]')} role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-[16px] font-semibold">
        {correct ? <CheckCircle2 className="text-ok" size={20} aria-hidden /> : <XCircle className="text-bad" size={20} aria-hidden />}
        <span className={correct ? 'text-ok' : 'text-bad'}>{correct ? 'Correct' : selected ? `Not quite — the answer is ${question.correctAnswer}` : `Not answered — the answer is ${question.correctAnswer}`}</span>
      </div>
      {question.explanation ? (
        <p className="mt-2 max-w-[70ch] leading-relaxed text-ink-2">{question.explanation}</p>
      ) : (
        <p className="mt-2 text-sm text-ink-3">No written explanation in the source deck for this one{onToggleSlide ? ' — the original slide may help.' : '.'}</p>
      )}
      {onToggleSlide && !question.requiresImage && (
        <Button size="sm" variant="ghost" icon={ImageIcon} onClick={onToggleSlide} className="-ml-3 mt-2" kbd="S">
          {showSlide ? 'Hide original slide' : 'View original slide'}
        </Button>
      )}
      <p className="mt-2 text-[12px] text-ink-3">Answer taken from the deck's Speaker Notes.</p>
    </div>
  )
}

export function SlideImage({ question, className }: { question: Question; className?: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [question.imagePath])
  if (failed) {
    return (
      <div className={cn('flex items-center gap-2 rounded-control border border-dashed border-line p-4 text-sm text-ink-3', className)}>
        <RotateCcw size={16} aria-hidden /> Slide image unavailable.
      </div>
    )
  }
  return (
    <a href={question.imagePath} target="_blank" rel="noreferrer" className={cn('block overflow-hidden rounded-control border border-line bg-white', className)} aria-label={`Open original slide ${question.slideNumber} in a new tab`}>
      <img
        src={question.imagePath}
        alt={`Original slide ${question.slideNumber}`}
        width={1600}
        height={900}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="block h-auto w-full"
      />
    </a>
  )
}
