import { useRef, useState } from 'react'
import { Database, Download, FileJson, History, ShieldCheck, Upload } from 'lucide-react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { Progress, Question } from '../types'
import reportData from '../../data/extraction_report.json'
import { baseQuestions } from '../data'
import { downloadJson, parseProgress, sanitizeOverrides } from '../lib/storage'
import type { BankOverride } from '../lib/storage'
import { Button, PageHeader, Panel, cn } from '../components/ui'

interface Props {
  questions: Question[]
  progress: Progress
  setProgress: Dispatch<SetStateAction<Progress>>
  bankOverrides: Record<string, BankOverride>
  setBankOverrides: Dispatch<SetStateAction<Record<string, BankOverride>>>
}

export function DataPage({ questions, progress, setProgress, bankOverrides, setBankOverrides }: Props) {
  const progressInput = useRef<HTMLInputElement>(null)
  const bankInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)

  const importFile = (file: File | undefined, apply: (value: unknown) => string) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        setMessage({ tone: 'ok', text: apply(JSON.parse(String(reader.result))) })
      } catch (error) {
        setMessage({ tone: 'bad', text: error instanceof SyntaxError ? `${file.name} is not valid JSON.` : String((error as Error).message) })
      }
    }
    reader.readAsText(file)
  }

  return (
    <>
      <PageHeader title="Data & backup" description="Everything lives in this browser's LocalStorage. Export to back up or move devices; imports are validated and never touch the source slides or question files." />
      {message && <p role="status" className={cn('mb-4 rounded-control px-4 py-3 text-[14px]', message.tone === 'ok' ? 'bg-ok/10 text-ok' : 'bg-bad/10 text-bad')}>{message.text}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <DataBlock icon={History} title="Learning progress" body={`${Object.keys(progress.answers).length} answered questions · ${progress.starred.length} bookmarks · ${progress.examHistory.length} mock exams`}>
          <Button icon={Download} onClick={() => downloadJson('iot102-progress.json', progress)}>Export progress</Button>
          <Button icon={Upload} onClick={() => progressInput.current?.click()}>Import progress</Button>
          <input
            ref={progressInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              importFile(e.target.files?.[0], (value) => {
                const parsed = parseProgress(value)
                if (!parsed) throw new Error('That file is not an IoT102 progress export (version 1).')
                setProgress(parsed)
                return `Imported ${Object.keys(parsed.answers).length} answers and ${parsed.examHistory.length} exams.`
              })
              e.target.value = ''
            }}
          />
        </DataBlock>
        <DataBlock icon={Database} title="Question bank" body={`${questions.length} records · ${Object.keys(bankOverrides).length} local edits`}>
          <Button icon={Download} onClick={() => downloadJson('iot102-question-bank.json', questions)}>Export bank</Button>
          <Button icon={Upload} onClick={() => bankInput.current?.click()}>Import bank edits</Button>
          <input
            ref={bankInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              importFile(e.target.files?.[0], (value) => {
                if (!Array.isArray(value) && (typeof value !== 'object' || value === null)) throw new Error('Expected an exported question bank (an array of questions).')
                const next = sanitizeOverrides(baseQuestions, value)
                setBankOverrides(next)
                return `${Object.keys(next).length} records differ from the source and were kept as local edits. Only question text, options, answer and review state are importable.`
              })
              e.target.value = ''
            }}
          />
        </DataBlock>
        <DataBlock icon={FileJson} title="Exam history" body="Only your mock exam attempts, with every answer.">
          <Button icon={Download} onClick={() => downloadJson('iot102-exam-history.json', progress.examHistory)}>Back up history</Button>
        </DataBlock>
        <DataBlock icon={ShieldCheck} title="Extraction audit" body={`${reportData.sourceSlideCount} slides · ${reportData.extractedQuestions} questions · ${reportData.needsReview} flagged for review`}>
          <Button icon={Download} onClick={() => downloadJson('iot102-extraction-report.json', reportData)}>Export report</Button>
        </DataBlock>
      </div>

      <Panel className="mt-6 p-5 sm:p-6" aria-labelledby="integrity-title">
        <h2 id="integrity-title" className="text-[17px] font-semibold text-ink">Source integrity</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ['Slide images', reportData.imageCount],
            ['Corrupt', reportData.corruptImages.length],
            ['Missing', reportData.missingImages.length],
            ['Byte duplicates', reportData.byteIdenticalDuplicateGroups.length],
          ].map(([label, value]) => (
            <div key={label}><dt className="text-[13px] text-ink-2">{label}</dt><dd className="mt-1 text-[22px] font-bold text-ink">{value}</dd></div>
          ))}
        </dl>
        <p className="mt-4 text-[13px] leading-relaxed text-ink-3">OCR ran locally with {reportData.ocr.engine}; mean engine confidence {reportData.ocr.meanConfidence}%. This app never modifies a source file.</p>
      </Panel>
    </>
  )
}

function DataBlock({ icon: Icon, title, body, children }: { icon: LucideIcon; title: string; body: string; children: ReactNode }) {
  return (
    <Panel className="flex flex-col p-5 sm:p-6" aria-label={title}>
      <div className="flex items-start gap-3">
        <Icon size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <div>
          <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{body}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">{children}</div>
    </Panel>
  )
}
