import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  Download,
  Eye,
  FileJson,
  Flag,
  Flame,
  GraduationCap,
  History,
  Home,
  Menu,
  Pencil,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  Star,
  Target,
  Upload,
  X,
  XCircle,
} from 'lucide-react'
import questionData from '../data/questions.json'
import topicData from '../data/topics.json'
import reportData from '../data/extraction_report.json'
import { eligibleQuestions, scoreExam, selectExamQuestions } from './lib/exam'
import {
  downloadJson,
  loadBankOverrides,
  loadProgress,
  saveBankOverrides,
  saveProgress,
} from './lib/storage'
import type { ExamResult, Progress, Question, Topic } from './types'

type View = 'dashboard' | 'topics' | 'practice' | 'exam' | 'review' | 'bank' | 'data'
type PracticeFilter = { topicId?: string; ids?: string[]; title: string }
type ActiveExam = {
  questions: Question[]
  answers: Record<string, string>
  flags: string[]
  index: number
  startedAt: number
  deadline: number
  result?: ExamResult
}

const baseQuestions = questionData as Question[]
const topics = topicData as Topic[]
const technicalTopics = topics.filter((topic) => topic.kind === 'technical')
const sourceSections = topics.filter((topic) => topic.kind === 'source_section')

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${minutes}:${remaining.toString().padStart(2, '0')}`
}

function App() {
  const [view, setView] = useState<View>('dashboard')
  const [mobileNav, setMobileNav] = useState(false)
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const [bankOverrides, setBankOverrides] = useState<Record<string, Partial<Question>>>(() =>
    loadBankOverrides(),
  )
  const [practiceFilter, setPracticeFilter] = useState<PracticeFilter>({ title: 'Verified questions' })

  const questions = useMemo(
    () => baseQuestions.map((question) => ({ ...question, ...(bankOverrides[question.id] || {}) })),
    [bankOverrides],
  )

  useEffect(() => saveProgress(progress), [progress])
  useEffect(() => saveBankOverrides(bankOverrides), [bankOverrides])

  const navigate = (next: View) => {
    setView(next)
    setMobileNav(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const startPractice = (filter: PracticeFilter) => {
    setPracticeFilter(filter)
    navigate('practice')
  }

  const nav = [
    { id: 'dashboard' as const, label: 'Overview', icon: Home },
    { id: 'topics' as const, label: 'Topics', icon: BookOpen },
    { id: 'practice' as const, label: 'Practice', icon: BrainCircuit },
    { id: 'exam' as const, label: 'Mock exam', icon: GraduationCap },
    { id: 'review' as const, label: 'Review', icon: RotateCcw },
    { id: 'bank' as const, label: 'Question bank', icon: Database },
    { id: 'data' as const, label: 'Data & backup', icon: FileJson },
  ]

  return (
    <div className="grid-texture min-h-screen bg-[#080d18] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#080d18]/90 backdrop-blur-xl lg:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <Brand compact />
          <button className="rounded-lg border border-slate-700 p-2" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation">
            {mobileNav ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {mobileNav && (
          <nav className="grid gap-1 border-t border-slate-800 px-3 py-3">
            {nav.map((item) => <NavButton key={item.id} item={item} active={view === item.id} onClick={() => navigate(item.id)} />)}
          </nav>
        )}
      </header>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-800/80 bg-[#0a101d]/95 px-4 py-6 backdrop-blur-xl lg:flex lg:flex-col">
        <Brand />
        <nav className="mt-9 grid gap-1.5">
          {nav.map((item) => <NavButton key={item.id} item={item} active={view === item.id} onClick={() => navigate(item.id)} />)}
        </nav>
        <div className="mt-auto rounded-2xl border border-emerald-400/15 bg-emerald-400/[.06] p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-300"><ShieldCheck size={17} /> Local only</div>
          <p className="text-sm leading-5 text-slate-400">Progress and edits stay in this browser. No cloud sync.</p>
        </div>
      </aside>

      <main className="min-h-screen px-4 py-7 sm:px-7 lg:ml-64 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-7xl">
          {view === 'dashboard' && <Dashboard questions={questions} progress={progress} onNavigate={navigate} onPractice={startPractice} />}
          {view === 'topics' && <TopicsPage questions={questions} progress={progress} onPractice={startPractice} />}
          {view === 'practice' && <PracticePage questions={questions} topics={topics} progress={progress} setProgress={setProgress} filter={practiceFilter} setFilter={setPracticeFilter} />}
          {view === 'exam' && <ExamPage questions={questions} progress={progress} setProgress={setProgress} onReviewWrong={(ids) => startPractice({ ids, title: 'Wrong answers from mock exam' })} />}
          {view === 'review' && <ReviewPage questions={questions} topics={topics} progress={progress} onPractice={startPractice} />}
          {view === 'bank' && <BankPage questions={questions} topics={topics} setOverride={(id, value) => setBankOverrides((current) => ({ ...current, [id]: value }))} />}
          {view === 'data' && <DataPage questions={questions} progress={progress} setProgress={setProgress} bankOverrides={bankOverrides} setBankOverrides={setBankOverrides} />}
        </div>
      </main>
    </div>
  )
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-300 to-cyan-500 text-[#06121a] shadow-lg shadow-emerald-950"><BrainCircuit size={23} strokeWidth={2.4} /></div>
      <div><div className="font-bold tracking-tight">IoT102 <span className="text-emerald-300">Exam Lab</span></div>{!compact && <div className="text-xs text-slate-500">Question bank · local-first</div>}</div>
    </div>
  )
}

function NavButton({ item, active, onClick }: { item: { label: string; icon: typeof Home }; active: boolean; onClick: () => void }) {
  const Icon = item.icon
  return <button onClick={onClick} className={cn('flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-left text-[15px] transition', active ? 'bg-emerald-400/10 font-semibold text-emerald-300 ring-1 ring-emerald-400/20' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100')}><Icon size={19} />{item.label}</button>
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-2 text-sm font-semibold uppercase tracking-[.18em] text-emerald-400">{eyebrow}</div><h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1><p className="mt-3 max-w-3xl text-base leading-7 text-slate-400">{description}</p></div>{action}</div>
}

function Dashboard({ questions, progress, onNavigate, onPractice }: { questions: Question[]; progress: Progress; onNavigate: (view: View) => void; onPractice: (filter: PracticeFilter) => void }) {
  const valid = eligibleQuestions(questions)
  const records = Object.values(progress.answers)
  const studied = records.length
  const correct = records.filter((record) => record.correct).length
  const wrong = records.filter((record) => !record.correct).length
  const recent = [...progress.examHistory].reverse().slice(0, 4)
  return <>
    <PageTitle eyebrow="Learning dashboard" title="Build confidence, one circuit at a time." description={`${valid.length} unique source-verified questions are ready for practice and 50-question mock exams.`} action={<button onClick={() => onPractice({ title: 'Verified questions' })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 font-semibold text-emerald-950 hover:bg-emerald-300"><Play size={18} fill="currentColor" /> Start practice</button>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Metric icon={Database} label="Valid questions" value={valid.length} tone="emerald" />
      <Metric icon={BookOpen} label="Studied" value={studied} tone="cyan" />
      <Metric icon={CheckCircle2} label="Currently correct" value={correct} tone="emerald" />
      <Metric icon={XCircle} label="Need work" value={wrong} tone="rose" />
      <Metric icon={Target} label="Accuracy" value={`${percent(correct, studied)}%`} tone="amber" />
    </div>
    <div className="mt-7 grid gap-6 xl:grid-cols-[1.35fr_.85fr]">
      <section className="panel rounded-2xl p-5 sm:p-6"><div className="mb-6 flex items-center justify-between"><div><h2 className="text-xl font-bold">Topic progress</h2><p className="mt-1 text-sm text-slate-500">Based on your latest answer per question</p></div><button onClick={() => onNavigate('topics')} className="rounded-lg px-3 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/10">View all</button></div><div className="grid gap-5">{technicalTopics.filter((t) => t.id !== 'uncategorized').slice(0, 6).map((topic) => { const pool = questions.filter((q) => q.topicIds.includes(topic.id)); const done = pool.filter((q) => progress.answers[q.id]).length; return <div key={topic.id}><div className="mb-2 flex justify-between gap-4 text-sm"><span className="font-medium text-slate-200">{topic.name}</span><span className="text-slate-500">{done}/{pool.length}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400" style={{ width: `${percent(done, pool.length)}%` }} /></div></div>})}</div></section>
      <section className="panel rounded-2xl p-5 sm:p-6"><div className="mb-5 flex items-center gap-2"><History size={19} className="text-cyan-300" /><h2 className="text-xl font-bold">Mock exam history</h2></div>{recent.length ? <div className="grid gap-3">{recent.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/45 p-4"><div><div className="font-semibold">{item.correct}/{item.total} correct</div><div className="mt-1 text-sm text-slate-500">{new Date(item.createdAt).toLocaleString()} · {formatDuration(item.durationSeconds)}</div></div><div className="text-2xl font-bold text-emerald-300">{item.score}</div></div>)}</div> : <Empty icon={History} title="No mock exams yet" body="Complete your first 50-question exam to see history here." />}</section>
    </div>
  </>
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Database; label: string; value: number | string; tone: 'emerald' | 'cyan' | 'rose' | 'amber' }) {
  const tones = { emerald: 'bg-emerald-400/10 text-emerald-300', cyan: 'bg-cyan-400/10 text-cyan-300', rose: 'bg-rose-400/10 text-rose-300', amber: 'bg-amber-400/10 text-amber-300' }
  return <div className="panel rounded-2xl p-5"><div className={cn('mb-5 grid size-10 place-items-center rounded-xl', tones[tone])}><Icon size={20} /></div><div className="text-3xl font-bold tracking-tight text-white">{value}</div><div className="mt-1 text-sm text-slate-500">{label}</div></div>
}

function TopicsPage({ questions, progress, onPractice }: { questions: Question[]; progress: Progress; onPractice: (filter: PracticeFilter) => void }) {
  return <><PageTitle eyebrow="Study paths" title="Practice by technical topic" description="Technical tags come from the extracted question content. Source sections preserve the deck's original boundaries." /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{technicalTopics.map((topic) => { const pool = questions.filter((q) => q.topicIds.includes(topic.id)); const studied = pool.filter((q) => progress.answers[q.id]).length; const wrong = pool.filter((q) => progress.answers[q.id] && !progress.answers[q.id].correct).length; const correct = pool.filter((q) => progress.answers[q.id]?.correct).length; return <article key={topic.id} className="panel rounded-2xl p-5"><div className="mb-5 flex items-start justify-between"><div className="grid size-11 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><BookOpen size={21} /></div><span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-400">{pool.length} questions</span></div><h2 className="text-lg font-bold">{topic.name}</h2><div className="mt-4 grid grid-cols-3 gap-3 text-sm"><Mini label="Studied" value={studied} /><Mini label="Unseen" value={pool.length - studied} /><Mini label="Wrong" value={wrong} /></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${percent(studied, pool.length)}%` }} /></div><div className="mt-2 text-xs text-slate-500">Accuracy {percent(correct, studied)}%</div><button onClick={() => onPractice({ topicId: topic.id, title: topic.name })} disabled={!pool.length} className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 font-semibold text-slate-200 hover:border-emerald-500/50 hover:text-emerald-300 disabled:opacity-40"><Play size={17} /> Practice topic</button></article>})}</div><section className="mt-8"><h2 className="mb-4 text-xl font-bold">Original deck sections</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{sourceSections.map((section) => <div key={section.id} className="rounded-xl border border-slate-800 bg-slate-900/55 p-4"><div className="font-semibold">{section.name}</div><div className="mt-1 text-sm text-slate-500">Slides {section.startSlide}–{section.endSlide} · {questions.filter((q) => q.sourceSectionId === section.id).length} questions</div>{section.needsReview && <div className="mt-2 text-xs font-semibold text-amber-300">Source title is blank; boundary retained as unresolved.</div>}</div>)}</div></section></>
}

function Mini({ label, value }: { label: string; value: number }) { return <div className="rounded-lg bg-slate-950/45 p-2.5"><div className="font-bold text-slate-200">{value}</div><div className="mt-0.5 text-xs text-slate-500">{label}</div></div> }

function PracticePage({ questions, topics, progress, setProgress, filter, setFilter }: { questions: Question[]; topics: Topic[]; progress: Progress; setProgress: React.Dispatch<React.SetStateAction<Progress>>; filter: PracticeFilter; setFilter: React.Dispatch<React.SetStateAction<PracticeFilter>> }) {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [retryQueue, setRetryQueue] = useState<Record<string, number>>({})
  const [answeredCount, setAnsweredCount] = useState(0)
  const [streak, setStreak] = useState(0)
  const [retryId, setRetryId] = useState<string | null>(null)
  const sourcePool = useMemo(() => questions.filter((q) => q.correctAnswer && !q.needsReview && (!filter.topicId || q.topicIds.includes(filter.topicId)) && (!filter.ids || filter.ids.includes(q.id))), [questions, filter])
  const [range, setRange] = useState(() => ({ start: 0, end: sourcePool.length }))
  const [rangeDraft, setRangeDraft] = useState(() => ({ start: '0', end: String(sourcePool.length) }))
  const [rangeError, setRangeError] = useState('')
  const pool = useMemo(() => sourcePool.slice(range.start, range.end), [sourcePool, range])
  useEffect(() => {
    const fullRange = { start: 0, end: sourcePool.length }
    setRange(fullRange)
    setRangeDraft({ start: '0', end: String(sourcePool.length) })
    setRangeError('')
  }, [filter, sourcePool.length])
  useEffect(() => { setIndex(0); setSelected(null); setRevealed(false); setRetryQueue({}); setAnsweredCount(0); setStreak(0); setRetryId(null) }, [filter, range])
  const question = retryId ? pool.find((item) => item.id === retryId) : pool[index]
  const applyRange = () => {
    const start = Number(rangeDraft.start)
    const end = Number(rangeDraft.end)
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      setRangeError('Start and end must be whole numbers.')
      return
    }
    if (start < 0 || end > sourcePool.length || start >= end) {
      setRangeError(`Use a range from 0 to ${sourcePool.length}, with start smaller than end.`)
      return
    }
    setRange({ start, end })
    setRangeError('')
  }
  const answer = (key: string) => {
    if (!question || revealed) return
    setSelected(key); setRevealed(true)
    const isCorrect = key === question.correctAnswer
    setStreak((current) => isCorrect ? current + 1 : 0)
    setAnsweredCount((current) => current + 1)
    setRetryQueue((current) => {
      const updated = { ...current }
      if (isCorrect) delete updated[question.id]
      else updated[question.id] = answeredCount + 1 + 2 + Math.floor(Math.random() * 4)
      return updated
    })
    setProgress((current) => { const prior = current.answers[question.id]; const isCorrect = key === question.correctAnswer; return { ...current, answers: { ...current.answers, [question.id]: { selected: key, correct: isCorrect, attempts: (prior?.attempts || 0) + 1, correctCount: (prior?.correctCount || 0) + Number(isCorrect), lastAnsweredAt: new Date().toISOString() } } } })
  }
  const next = () => {
    const due = Object.entries(retryQueue).filter(([id, count]) => count <= answeredCount && (id !== question?.id || pool.length === 1))
    if (due.length) {
      due.sort((a, b) => a[1] - b[1])
      setRetryId(due[0][0])
      if (!retryId) setIndex((index + 1) % pool.length)
    } else {
      let nextIndex = retryId ? index : (index + 1) % pool.length
      // Avoid showing a queued question early when another question is available.
      for (let step = 0; step < pool.length; step += 1) {
        if (!retryQueue[pool[nextIndex].id] && (pool[nextIndex].id !== question?.id || pool.length === 1)) break
        nextIndex = (nextIndex + 1) % pool.length
      }
      setIndex(nextIndex); setRetryId(null)
    }
    setSelected(null); setRevealed(false)
  }
  const toggleStar = () => question && setProgress((current) => ({ ...current, starred: current.starred.includes(question.id) ? current.starred.filter((id) => id !== question.id) : [...current.starred, question.id] }))
  return <><PageTitle eyebrow="Practice mode" title={filter.title} description="Answer first; feedback, source answer, explanation, and original slide appear only after your choice." action={<select value={filter.topicId || ''} onChange={(event) => setFilter({ topicId: event.target.value || undefined, title: topics.find((t) => t.id === event.target.value)?.name || 'Verified questions' })} className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm text-slate-200"><option value="">All topics</option>{technicalTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select>} /><div className="panel mx-auto mb-5 max-w-4xl rounded-2xl p-4 sm:p-5"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="font-semibold text-slate-200">Question range (source order)</div><p className="mt-1 text-sm text-slate-500">Start is included and end is excluded. For example, 0–100 selects the first 100 of {sourcePool.length} questions.</p></div><div className="grid grid-cols-[1fr_auto_1fr_auto] items-end gap-2"><label className="text-xs font-semibold text-slate-400">From<input type="number" min={0} max={Math.max(0, sourcePool.length - 1)} value={rangeDraft.start} onChange={(event) => setRangeDraft({ ...rangeDraft, start: event.target.value })} className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 text-base text-slate-100" /></label><span className="pb-3 text-slate-600">–</span><label className="text-xs font-semibold text-slate-400">To<input type="number" min={1} max={sourcePool.length} value={rangeDraft.end} onChange={(event) => setRangeDraft({ ...rangeDraft, end: event.target.value })} className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 text-base text-slate-100" /></label><button onClick={applyRange} disabled={!sourcePool.length} className="min-h-11 rounded-xl bg-cyan-400 px-4 font-bold text-cyan-950 disabled:cursor-not-allowed disabled:opacity-40">Apply</button></div></div>{rangeError && <div role="alert" className="mt-3 text-sm font-medium text-rose-300">{rangeError}</div>}{sourcePool.length > 0 && !rangeError && <div className="mt-3 text-xs text-emerald-300">Active range: {range.start}–{range.end} · {pool.length} questions</div>}</div>{question ? <div className="mx-auto max-w-4xl"><div className="mb-4 flex items-center justify-between text-sm text-slate-500"><div className="flex flex-wrap items-center gap-3"><span>Index {range.start + pool.findIndex((item) => item.id === question.id)} · Question {pool.findIndex((item) => item.id === question.id) + 1} of {pool.length}</span><span className="inline-flex items-center gap-1 font-semibold text-orange-300" title={`Every 5 correct answers earns one flame level`}><Flame size={Math.min(18 + Math.floor(streak / 5) * 3, 36)} fill={streak >= 5 ? "currentColor" : "none"} /> {streak} correct · Level {Math.floor(streak / 5)}</span></div><button onClick={toggleStar} className={cn('inline-flex items-center gap-2 rounded-lg px-3 py-2', progress.starred.includes(question.id) ? 'bg-amber-400/10 text-amber-300' : 'hover:bg-slate-800')}><Star size={17} fill={progress.starred.includes(question.id) ? 'currentColor' : 'none'} /> Review later</button></div>{(retryId || retryQueue[question.id] !== undefined) && <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-200">Câu bạn đã trả lời sai — hãy thử trả lời lại.</div>}<QuestionCard question={question} selected={selected} revealed={revealed} onAnswer={answer} /><div className="mt-5 flex justify-end"><button onClick={next} disabled={!revealed} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-400 px-5 font-semibold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-35">Next question <ChevronRight size={18} /></button></div></div> : <Empty icon={AlertTriangle} title="No eligible questions" body="This filter has no source-verified questions available for practice." />}</>
}

function QuestionCard({ question, selected, revealed, onAnswer, hideFeedback = false }: { question: Question; selected: string | null; revealed: boolean; onAnswer: (key: string) => void; hideFeedback?: boolean }) {
  const [showSlide, setShowSlide] = useState(question.requiresImage)
  useEffect(() => setShowSlide(question.requiresImage), [question.id, question.requiresImage])
  return <article className="panel overflow-hidden rounded-2xl"><div className="border-b border-slate-800 p-5 sm:p-7"><div className="mb-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-slate-800 px-2.5 py-1 text-slate-400">Slide {question.slideNumber}</span>{question.topicIds.slice(0, 3).map((id) => <span key={id} className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-cyan-300">{technicalTopics.find((t) => t.id === id)?.name || id}</span>)}</div><h2 className="text-lg font-semibold leading-8 text-white sm:text-xl">{question.question}</h2>{question.code && <pre className="mt-5 overflow-x-auto rounded-xl border border-slate-700 bg-[#070b13] p-4 text-sm leading-6 text-cyan-100"><code>{question.code}</code></pre>}{showSlide && <img src={question.imagePath} alt={`Original slide ${question.slideNumber}`} className="mt-5 w-full rounded-xl border border-slate-700 bg-white" />}</div><div className="grid gap-3 p-5 sm:p-7">{Object.entries(question.options).map(([key, value]) => { const correct = revealed && key === question.correctAnswer; const wrong = revealed && selected === key && key !== question.correctAnswer; return <button key={key} disabled={revealed} onClick={() => onAnswer(key)} className={cn('option-button', selected === key && 'selected', !hideFeedback && correct && 'correct', !hideFeedback && wrong && 'wrong')}><span className="grid size-7 shrink-0 place-items-center rounded-lg border border-slate-600 text-sm font-bold">{key}</span><span className="pt-0.5 leading-6">{value}</span>{!hideFeedback && correct && <Check className="ml-auto mt-1 shrink-0 text-emerald-300" size={19} />}{!hideFeedback && wrong && <X className="ml-auto mt-1 shrink-0 text-rose-300" size={19} />}</button>})}</div>{revealed && !hideFeedback && <div className={cn('border-t p-5 sm:p-7', selected === question.correctAnswer ? 'border-emerald-500/20 bg-emerald-500/[.06]' : 'border-rose-500/20 bg-rose-500/[.05]')}><div className="flex items-center gap-2 font-bold">{selected === question.correctAnswer ? <CheckCircle2 className="text-emerald-300" /> : <XCircle className="text-rose-300" />}{selected === question.correctAnswer ? 'Correct' : `Source answer: ${question.correctAnswer}`}</div>{question.explanation && <p className="mt-3 leading-7 text-slate-300">{question.explanation}</p>}<div className="mt-4 flex flex-wrap items-center gap-3"><button onClick={() => setShowSlide(!showSlide)} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"><Eye size={16} /> {showSlide ? 'Hide' : 'View'} original slide</button><span className="text-xs text-slate-500">Answer copied from Speaker Notes; subject accuracy is not independently certified.</span></div></div>}</article>
}

function ExamPage({ questions, progress, setProgress, onReviewWrong }: { questions: Question[]; progress: Progress; setProgress: React.Dispatch<React.SetStateAction<Progress>>; onReviewWrong: (ids: string[]) => void }) {
  const available = eligibleQuestions(questions)
  const [minutes, setMinutes] = useState(60)
  const [exam, setExam] = useState<ActiveExam | null>(null)
  const [now, setNow] = useState(Date.now())
  const submitting = useRef(false)
  useEffect(() => { if (!exam || exam.result) return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [exam])
  const submit = () => {
    if (!exam || exam.result || submitting.current) return
    submitting.current = true
    const scored = scoreExam(exam.questions, exam.answers)
    const result: ExamResult = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), durationSeconds: Math.min(Math.round((Date.now() - exam.startedAt) / 1000), Math.round((exam.deadline - exam.startedAt) / 1000)), total: exam.questions.length, correct: scored.correct, score: scored.score, questionIds: exam.questions.map((q) => q.id), answers: exam.answers }
    setExam({ ...exam, result }); setProgress((current) => ({ ...current, examHistory: [...current.examHistory, result] }))
  }
  const remaining = exam ? Math.max(0, Math.ceil((exam.deadline - now) / 1000)) : 0
  useEffect(() => { if (exam && !exam.result && remaining === 0) submit() }, [remaining])
  if (!exam) return <><PageTitle eyebrow="Mock exam" title="50 questions. One focused hour." description="Questions are randomly selected without duplicate question text. Answers stay hidden until submission." /><div className="panel mx-auto max-w-3xl rounded-2xl p-6 sm:p-8"><div className="grid gap-4 sm:grid-cols-3"><Mini label="Verified unique" value={available.length} /><Mini label="Questions" value={50} /><Mini label="Default minutes" value={60} /></div><label className="mt-7 block text-sm font-semibold text-slate-300">Time limit (minutes)<input type="number" min={10} max={180} value={minutes} onChange={(e) => setMinutes(Math.min(180, Math.max(10, Number(e.target.value))))} className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-4" /></label>{available.length < 50 ? <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/[.07] p-4 text-amber-200">Only {available.length} valid unique questions are available. A 50-question exam cannot be generated.</div> : <button onClick={() => { const selected = selectExamQuestions(questions, 50); const startedAt = Date.now(); setNow(startedAt); setExam({ questions: selected, answers: {}, flags: [], index: 0, startedAt, deadline: startedAt + minutes * 60_000 }) }} className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 font-bold text-emerald-950 hover:bg-emerald-300"><GraduationCap size={20} /> Generate exam</button>}</div></>
  if (exam.result) return <ExamResults exam={exam} onNew={() => { submitting.current = false; setExam(null) }} onReviewWrong={onReviewWrong} />
  const question = exam.questions[exam.index]
  return <><div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><div className="text-sm font-semibold uppercase tracking-[.18em] text-emerald-400">Mock exam in progress</div><h1 className="mt-1 text-2xl font-bold">Question {exam.index + 1} of 50</h1></div><div className={cn('inline-flex items-center gap-2 rounded-xl border px-4 py-2 font-mono text-lg font-bold', remaining < 300 ? 'border-rose-400/30 bg-rose-400/10 text-rose-300' : 'border-slate-700 bg-slate-900 text-cyan-300')}><Clock3 size={19} />{formatDuration(remaining)}</div></div><div className="grid gap-5 xl:grid-cols-[1fr_280px]"><div><QuestionCard question={question} selected={exam.answers[question.id] || null} revealed={false} hideFeedback onAnswer={(key) => setExam({ ...exam, answers: { ...exam.answers, [question.id]: key } })} /><div className="mt-4 flex items-center justify-between"><button onClick={() => setExam({ ...exam, flags: exam.flags.includes(question.id) ? exam.flags.filter((id) => id !== question.id) : [...exam.flags, question.id] })} className={cn('inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 font-semibold', exam.flags.includes(question.id) ? 'border-amber-400/30 bg-amber-400/10 text-amber-300' : 'border-slate-700 text-slate-300')}><Flag size={18} fill={exam.flags.includes(question.id) ? 'currentColor' : 'none'} /> Review</button><div className="flex gap-2"><button disabled={exam.index === 0} onClick={() => setExam({ ...exam, index: exam.index - 1 })} className="grid size-11 place-items-center rounded-xl border border-slate-700 disabled:opacity-30"><ChevronLeft /></button><button disabled={exam.index === 49} onClick={() => setExam({ ...exam, index: exam.index + 1 })} className="grid size-11 place-items-center rounded-xl bg-emerald-400 text-emerald-950 disabled:opacity-30"><ChevronRight /></button></div></div></div><aside className="panel h-fit rounded-2xl p-5"><div className="mb-4 flex justify-between text-sm"><span className="font-semibold">Question map</span><span className="text-slate-500">{Object.keys(exam.answers).length}/50 answered</span></div><div className="grid grid-cols-5 gap-2">{exam.questions.map((item, index) => <button key={item.id} onClick={() => setExam({ ...exam, index })} className={cn('relative grid aspect-square place-items-center rounded-lg border text-sm font-semibold', index === exam.index ? 'border-emerald-300 bg-emerald-400 text-emerald-950' : exam.answers[item.id] ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200' : 'border-slate-700 bg-slate-900 text-slate-400')}>{index + 1}{exam.flags.includes(item.id) && <Flag size={8} fill="currentColor" className="absolute right-1 top-1 text-amber-300" />}</button>)}</div><button onClick={submit} className="mt-5 min-h-11 w-full rounded-xl border border-rose-400/30 bg-rose-400/10 font-bold text-rose-200 hover:bg-rose-400/20">Submit exam</button></aside></div></>
}

function ExamResults({ exam, onNew, onReviewWrong }: { exam: ActiveExam; onNew: () => void; onReviewWrong: (ids: string[]) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const scored = scoreExam(exam.questions, exam.answers)
  const wrongIds = exam.questions.filter((q) => exam.answers[q.id] !== q.correctAnswer).map((q) => q.id)
  return <><PageTitle eyebrow="Exam complete" title={`${scored.score} / 10`} description={`${scored.correct} correct · ${scored.wrong} wrong · completed in ${formatDuration(exam.result?.durationSeconds ?? 0)}`} action={<div className="flex gap-2"><button onClick={() => onReviewWrong(wrongIds)} className="min-h-11 rounded-xl border border-slate-700 px-4 font-semibold">Practice wrong answers</button><button onClick={onNew} className="min-h-11 rounded-xl bg-emerald-400 px-4 font-semibold text-emerald-950">New exam</button></div>} /><div className="grid gap-3">{exam.questions.map((question, index) => { const selected = exam.answers[question.id]; const correct = selected === question.correctAnswer; return <article key={question.id} className="panel overflow-hidden rounded-xl"><button onClick={() => setExpanded(expanded === question.id ? null : question.id)} className="flex w-full items-center gap-4 p-4 text-left"><span className={cn('grid size-9 shrink-0 place-items-center rounded-lg font-bold', correct ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300')}>{index + 1}</span><span className="min-w-0 flex-1 truncate text-slate-200">{question.question}</span><span className="text-sm text-slate-500">Your {selected || '—'} · Source {question.correctAnswer}</span>{correct ? <CheckCircle2 className="text-emerald-300" /> : <XCircle className="text-rose-300" />}</button>{expanded === question.id && <div className="border-t border-slate-800 p-5"><p className="font-semibold leading-7">{question.question}</p><div className="mt-3 grid gap-2 text-sm">{Object.entries(question.options).map(([key, value]) => <div key={key} className={cn('rounded-lg border p-3', key === question.correctAnswer ? 'border-emerald-400/30 bg-emerald-400/[.07]' : key === selected ? 'border-rose-400/30 bg-rose-400/[.07]' : 'border-slate-800')}>{key}. {value}</div>)}</div>{question.explanation && <p className="mt-4 text-sm leading-6 text-slate-400">{question.explanation}</p>}</div>}</article>})}</div></>
}

function ReviewPage({ questions, topics, progress, onPractice }: { questions: Question[]; topics: Topic[]; progress: Progress; onPractice: (filter: PracticeFilter) => void }) {
  const [topic, setTopic] = useState('')
  const wrong = questions.filter((q) => progress.answers[q.id] && !progress.answers[q.id].correct && (!topic || q.topicIds.includes(topic)))
  const starred = questions.filter((q) => progress.starred.includes(q.id) && (!topic || q.topicIds.includes(topic)))
  return <><PageTitle eyebrow="Review queue" title="Turn misses into memory." description="Retry your latest wrong answers or questions you deliberately marked for review." action={<select value={topic} onChange={(e) => setTopic(e.target.value)} className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-4"><option value="">All topics</option>{topics.filter((t) => t.kind === 'technical').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>} /><div className="grid gap-6 lg:grid-cols-2"><ReviewCard title="Wrong answers" icon={XCircle} color="rose" items={wrong} action={() => onPractice({ ids: wrong.map((q) => q.id), title: 'Wrong answer review' })} /><ReviewCard title="Marked for review" icon={Star} color="amber" items={starred} action={() => onPractice({ ids: starred.map((q) => q.id), title: 'Marked questions' })} /></div></>
}

function ReviewCard({ title, icon: Icon, color, items, action }: { title: string; icon: typeof Star; color: 'rose' | 'amber'; items: Question[]; action: () => void }) {
  return <section className="panel rounded-2xl p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><div className="flex items-center gap-2"><Icon className={color === 'rose' ? 'text-rose-300' : 'text-amber-300'} size={20} /><h2 className="text-xl font-bold">{title}</h2></div><span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-400">{items.length}</span></div>{items.length ? <><div className="grid max-h-96 gap-2 overflow-y-auto pr-1">{items.slice(0, 30).map((q) => <div key={q.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm leading-5 text-slate-300"><span className="mr-2 text-slate-600">#{q.slideNumber}</span>{q.question}</div>)}</div><button onClick={action} className="mt-5 min-h-11 w-full rounded-xl bg-emerald-400 font-bold text-emerald-950">Practice this queue</button></> : <Empty icon={CheckCircle2} title="Queue is clear" body="Nothing to review under this filter." />}</section>
}

function BankPage({ questions, topics, setOverride }: { questions: Question[]; topics: Topic[]; setOverride: (id: string, value: Partial<Question>) => void }) {
  const [search, setSearch] = useState('')
  const [topic, setTopic] = useState('')
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState<Question | null>(null)
  const filtered = questions.filter((q) => q.question.toLowerCase().includes(search.toLowerCase()) && (!topic || q.topicIds.includes(topic)) && (status === 'all' || (status === 'review' ? q.needsReview : status === 'missing' ? !q.correctAnswer : !q.needsReview)))
  return <><PageTitle eyebrow="Question bank" title="Inspect every extracted record" description="Search, filter, compare with the original slide and Speaker Notes, or save a browser-local correction." /><div className="panel mb-5 grid gap-3 rounded-2xl p-4 md:grid-cols-[1fr_220px_190px]"><label className="relative"><Search className="absolute left-3 top-3 text-slate-500" size={19} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search question text…" className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-3" /></label><select value={topic} onChange={(e) => setTopic(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3"><option value="">All topics</option>{topics.filter((t) => t.kind === 'technical').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select><select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3"><option value="all">All statuses</option><option value="verified">No review flag</option><option value="review">Needs review</option><option value="missing">Missing answer</option></select></div><div className="mb-3 text-sm text-slate-500">{filtered.length} results</div><div className="grid gap-3">{filtered.slice(0, 150).map((q) => <button key={q.id} onClick={() => setSelected(q)} className="panel flex items-start gap-4 rounded-xl p-4 text-left hover:border-emerald-400/30"><span className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-400">{q.slideNumber}</span><div className="min-w-0 flex-1"><div className="line-clamp-2 font-medium leading-6 text-slate-200">{q.question}</div><div className="mt-2 flex flex-wrap gap-2 text-xs"><span className={cn('rounded-full px-2 py-1', q.needsReview ? 'bg-amber-400/10 text-amber-300' : 'bg-emerald-400/10 text-emerald-300')}>{q.needsReview ? 'Review' : 'Validated'}</span><span className="rounded-full bg-slate-800 px-2 py-1 text-slate-400">Answer {q.correctAnswer || '—'}</span>{q.duplicateOf && <span className="rounded-full bg-violet-400/10 px-2 py-1 text-violet-300">Duplicate of {q.duplicateOf}</span>}</div></div><Pencil size={17} className="mt-1 shrink-0 text-slate-600" /></button>)}</div>{selected && <QuestionEditor question={selected} onClose={() => setSelected(null)} onSave={(value) => { setOverride(selected.id, value); setSelected(null) }} />}</>
}

function QuestionEditor({ question, onClose, onSave }: { question: Question; onClose: () => void; onSave: (value: Partial<Question>) => void }) {
  const [draft, setDraft] = useState(question)
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"><div className="panel mx-auto my-6 max-w-4xl rounded-2xl p-5 sm:p-7"><div className="mb-6 flex items-center justify-between"><div><div className="text-sm text-slate-500">{question.id} · slide {question.slideNumber}</div><h2 className="text-2xl font-bold">Edit local app data</h2></div><button onClick={onClose} className="rounded-lg border border-slate-700 p-2"><X /></button></div><img src={question.imagePath} alt={`Slide ${question.slideNumber}`} className="mb-6 w-full rounded-xl border border-slate-700 bg-white" /><label className="block text-sm font-semibold">Question<textarea value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} rows={3} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-normal" /></label><div className="mt-4 grid gap-3">{Object.entries(draft.options).map(([key, value]) => <label key={key} className="grid grid-cols-[32px_1fr] items-center gap-2 text-sm font-bold"><span>{key}</span><input value={value} onChange={(e) => setDraft({ ...draft, options: { ...draft.options, [key]: e.target.value } })} className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 font-normal" /></label>)}</div><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Correct answer<select value={draft.correctAnswer || ''} onChange={(e) => setDraft({ ...draft, correctAnswer: e.target.value || null })} className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 font-normal"><option value="">Unknown</option>{Object.keys(draft.options).map((key) => <option key={key}>{key}</option>)}</select></label><label className="text-sm font-semibold">Review state<select value={String(draft.needsReview)} onChange={(e) => setDraft({ ...draft, needsReview: e.target.value === 'true' })} className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 font-normal"><option value="false">Validated</option><option value="true">Needs review</option></select></label></div><label className="mt-4 block text-sm font-semibold">Speaker Notes (read-only)<textarea value={draft.speakerNotes || ''} readOnly rows={4} className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/50 p-3 font-normal text-slate-500" /></label><div className="mt-6 flex justify-end gap-3"><button onClick={onClose} className="min-h-11 rounded-xl border border-slate-700 px-5">Cancel</button><button onClick={() => onSave({ question: draft.question, options: draft.options, correctAnswer: draft.correctAnswer, needsReview: draft.needsReview })} className="min-h-11 rounded-xl bg-emerald-400 px-5 font-bold text-emerald-950">Save local correction</button></div></div></div>
}

function DataPage({ questions, progress, setProgress, bankOverrides, setBankOverrides }: { questions: Question[]; progress: Progress; setProgress: React.Dispatch<React.SetStateAction<Progress>>; bankOverrides: Record<string, Partial<Question>>; setBankOverrides: React.Dispatch<React.SetStateAction<Record<string, Partial<Question>>>> }) {
  const progressInput = useRef<HTMLInputElement>(null)
  const bankInput = useRef<HTMLInputElement>(null)
  const importFile = <T,>(file: File | undefined, apply: (value: T) => void) => { if (!file) return; const reader = new FileReader(); reader.onload = () => { try { apply(JSON.parse(String(reader.result)) as T) } catch { alert('Invalid JSON file.') } }; reader.readAsText(file) }
  return <><PageTitle eyebrow="Data controls" title="Portable, private, recoverable." description="Export progress, exam history, and the question bank. Imports remain in LocalStorage and never change the original Google Slides or PNG files." /><div className="grid gap-5 lg:grid-cols-2"><DataCard icon={History} title="Learning progress" body={`${Object.keys(progress.answers).length} studied questions · ${progress.examHistory.length} mock exams`} actions={<><button onClick={() => downloadJson('iot102-progress.json', progress)} className="data-button"><Download size={18} /> Export progress</button><button onClick={() => progressInput.current?.click()} className="data-button"><Upload size={18} /> Import progress</button><input ref={progressInput} type="file" accept="application/json" hidden onChange={(e) => importFile<Progress>(e.target.files?.[0], (value) => value.version === 1 ? setProgress(value) : alert('Unsupported progress version.'))} /></>} /><DataCard icon={Database} title="Question bank" body={`${questions.length} extracted records · ${Object.keys(bankOverrides).length} browser-local edits`} actions={<><button onClick={() => downloadJson('iot102-question-bank.json', questions)} className="data-button"><Download size={18} /> Export bank</button><button onClick={() => bankInput.current?.click()} className="data-button"><Upload size={18} /> Import bank edits</button><input ref={bankInput} type="file" accept="application/json" hidden onChange={(e) => importFile<Question[]>(e.target.files?.[0], (value) => { if (!Array.isArray(value)) return alert('Expected an array of questions.'); const next: Record<string, Partial<Question>> = {}; value.forEach((item) => { if (item.id) next[item.id] = item }); setBankOverrides(next) })} /></>} /><DataCard icon={FileJson} title="Exam history backup" body="A focused export containing only mock exam attempts." actions={<button onClick={() => downloadJson('iot102-exam-history.json', progress.examHistory)} className="data-button"><Download size={18} /> Backup history</button>} /><DataCard icon={ShieldCheck} title="Extraction audit" body={`${reportData.sourceSlideCount} slides · ${reportData.extractedQuestions} questions · ${reportData.needsReview} review items`} actions={<button onClick={() => downloadJson('iot102-extraction-report.json', reportData)} className="data-button"><Download size={18} /> Export report</button>} /></div><div className="panel mt-7 rounded-2xl p-5 sm:p-6"><h2 className="text-xl font-bold">Source integrity</h2><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Mini label="PNG files" value={reportData.imageCount} /><Mini label="Corrupt" value={reportData.corruptImages.length} /><Mini label="Missing" value={reportData.missingImages.length} /><Mini label="Byte duplicates" value={reportData.byteIdenticalDuplicateGroups.length} /></div><p className="mt-5 text-sm leading-6 text-slate-500">OCR ran locally with {reportData.ocr.engine}. Mean engine confidence: {reportData.ocr.meanConfidence}%. No source file is modified by this application.</p></div></>
}

function DataCard({ icon: Icon, title, body, actions }: { icon: typeof Database; title: string; body: string; actions: React.ReactNode }) { return <section className="panel rounded-2xl p-6"><div className="grid size-11 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><Icon size={21} /></div><h2 className="mt-5 text-xl font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{body}</p><div className="mt-5 flex flex-wrap gap-2">{actions}</div></section> }

function Empty({ icon: Icon, title, body }: { icon: typeof History; title: string; body: string }) { return <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-slate-700 bg-slate-950/20 p-6 text-center"><div><Icon className="mx-auto text-slate-600" size={30} /><div className="mt-3 font-semibold text-slate-300">{title}</div><p className="mt-1 text-sm text-slate-500">{body}</p></div></div> }

export default App
