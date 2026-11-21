import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, BrainCircuit, Database, FileJson, GraduationCap, Home, Menu, RotateCcw, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { baseQuestions } from './data'
import { loadBankOverrides, loadPractice, loadProgress, sanitizeOverride, saveBankOverrides, saveProgress } from './lib/storage'
import type { BankOverride, PracticeFilter } from './lib/storage'
import type { Progress } from './types'
import { DashboardPage } from './pages/DashboardPage'
import { TopicsPage } from './pages/TopicsPage'
import { PracticePage } from './pages/PracticePage'
import { ExamPage } from './pages/ExamPage'
import { ReviewPage } from './pages/ReviewPage'
import { BankPage } from './pages/BankPage'
import { DataPage } from './pages/DataPage'
import { cn } from './components/ui'

export type View = 'dashboard' | 'topics' | 'practice' | 'exam' | 'review' | 'bank' | 'data'

const NAV: Array<{ id: View; label: string; icon: LucideIcon }> = [
  { id: 'dashboard', label: 'Overview', icon: Home },
  { id: 'practice', label: 'Practice', icon: BrainCircuit },
  { id: 'exam', label: 'Mock exam', icon: GraduationCap },
  { id: 'review', label: 'Review', icon: RotateCcw },
  { id: 'topics', label: 'Topics', icon: BookOpen },
  { id: 'bank', label: 'Question bank', icon: Database },
  { id: 'data', label: 'Data & backup', icon: FileJson },
]

const viewFromHash = (): View => {
  const id = window.location.hash.replace(/^#\/?/, '')
  return NAV.some((item) => item.id === id) ? (id as View) : 'dashboard'
}

function App() {
  const [view, setView] = useState<View>(viewFromHash)
  const [mobileNav, setMobileNav] = useState(false)
  const [progress, setProgress] = useState<Progress>(loadProgress)
  const [bankOverrides, setBankOverrides] = useState<Record<string, BankOverride>>(() => loadBankOverrides(baseQuestions))
  const [practiceFilter, setPracticeFilter] = useState<PracticeFilter>(() => loadPractice()?.filter ?? { title: 'All questions' })

  const questions = useMemo(() => baseQuestions.map((q) => (bankOverrides[q.id] ? { ...q, ...bankOverrides[q.id] } : q)), [bankOverrides])

  useEffect(() => saveProgress(progress), [progress])
  useEffect(() => saveBankOverrides(bankOverrides), [bankOverrides])
  useEffect(() => {
    const onHash = () => setView(viewFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => {
    const label = NAV.find((item) => item.id === view)?.label
    document.title = view === 'dashboard' ? 'IoT102 Exam Lab' : `${label} · IoT102 Exam Lab`
  }, [view])

  const navigate = useCallback((next: View) => {
    setMobileNav(false)
    if (viewFromHash() !== next) window.location.hash = `/${next}`
    setView(next)
    window.scrollTo({ top: 0 })
  }, [])
  const startPractice = useCallback((filter: PracticeFilter) => {
    setPracticeFilter(filter)
    navigate('practice')
  }, [navigate])
  const setOverride = (id: string, value: BankOverride | null) => {
    const source = baseQuestions.find((q) => q.id === id)
    const clean = source && value ? sanitizeOverride(source, value) : null
    setBankOverrides((current) => {
      const { [id]: _removed, ...rest } = current
      return clean ? { ...rest, [id]: clean } : rest
    })
  }

  const navList = (
    <ul className="grid gap-0.5">
      {NAV.map((item) => {
        const Icon = item.icon
        const active = view === item.id
        return (
          <li key={item.id}>
            <a
              href={`#/${item.id}`}
              onClick={(event) => { event.preventDefault(); navigate(item.id) }}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-control px-3 text-[15px] transition-colors',
                active ? 'bg-raised font-semibold text-ink' : 'text-ink-2 hover:bg-raised/60 hover:text-ink',
              )}
            >
              <Icon size={18} aria-hidden className={active ? 'text-accent' : undefined} />
              {item.label}
            </a>
          </li>
        )
      })}
    </ul>
  )

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a href="#main" className="sr-only z-50 rounded-control bg-accent px-4 py-2 font-semibold text-accent-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>

      <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Brand />
          <button type="button" className="grid size-11 place-items-center rounded-control text-ink-2 hover:bg-raised hover:text-ink" onClick={() => setMobileNav(!mobileNav)} aria-label={mobileNav ? 'Close menu' : 'Open menu'} aria-expanded={mobileNav} aria-controls="mobile-nav">
            {mobileNav ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
          </button>
        </div>
        {mobileNav && <nav id="mobile-nav" aria-label="Main" className="animate-enter border-t border-line px-3 py-3">{navList}</nav>}
      </header>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
        <div className="px-2"><Brand /></div>
        <nav aria-label="Main" className="mt-8">{navList}</nav>
        <p className="mt-auto px-3 text-[12px] leading-relaxed text-ink-3">Progress stays in this browser. Nothing is uploaded.</p>
      </aside>

      <main id="main" className="min-h-screen px-4 pb-16 pt-6 sm:px-7 lg:ml-60 lg:px-10 lg:pt-10">
        <div className="mx-auto max-w-[1180px]">
          {view === 'dashboard' && <DashboardPage questions={questions} progress={progress} onNavigate={navigate} onPractice={startPractice} />}
          {view === 'topics' && <TopicsPage questions={questions} progress={progress} onPractice={startPractice} />}
          {view === 'practice' && <PracticePage questions={questions} progress={progress} setProgress={setProgress} filter={practiceFilter} setFilter={setPracticeFilter} />}
          {view === 'exam' && <ExamPage questions={questions} progress={progress} setProgress={setProgress} onPracticeIds={(ids, title) => startPractice({ ids, title })} />}
          {view === 'review' && <ReviewPage questions={questions} progress={progress} setProgress={setProgress} onPractice={startPractice} />}
          {view === 'bank' && <BankPage questions={questions} progress={progress} overrides={bankOverrides} setOverride={setOverride} />}
          {view === 'data' && <DataPage questions={questions} progress={progress} setProgress={setProgress} bankOverrides={bankOverrides} setBankOverrides={setBankOverrides} />}
        </div>
      </main>
    </div>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-[10px] bg-accent text-accent-ink" aria-hidden><BrainCircuit size={20} strokeWidth={2.2} /></span>
      <span className="text-[16px] font-bold tracking-[-0.01em] text-ink">IoT102 <span className="text-accent">Exam Lab</span></span>
    </div>
  )
}

export default App
