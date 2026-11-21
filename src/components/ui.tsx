import { forwardRef, useEffect } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export const percent = (value: number, total: number) => (total ? Math.round((value / total) * 100) : 0)

export function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = String(seconds % 60).padStart(2, '0')
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-strong font-semibold',
  secondary: 'border border-line-strong bg-raised text-ink hover:border-ink-3/60 hover:bg-overlay',
  ghost: 'text-ink-2 hover:bg-raised hover:text-ink',
  danger: 'border border-bad/40 bg-bad/10 text-bad hover:bg-bad/20',
}
const sizes: Record<Size, string> = {
  sm: 'min-h-9 px-3 text-sm gap-1.5',
  md: 'min-h-11 px-4 text-[15px] gap-2',
  lg: 'min-h-12 px-5 text-base gap-2',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: LucideIcon
  iconRight?: LucideIcon
  kbd?: string
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, iconRight: IconRight, kbd, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-control font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {Icon && <Icon size={size === 'sm' ? 16 : 18} aria-hidden />}
      {children}
      {IconRight && <IconRight size={size === 'sm' ? 16 : 18} aria-hidden />}
      {kbd && <Kbd className={cn('ml-1 hidden sm:inline-flex', variant === 'primary' && 'border-accent-ink/25 bg-accent-ink/10 text-accent-ink')}>{kbd}</Kbd>}
    </button>
  )
})

export function IconButton({ icon: Icon, label, className, active, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn('grid size-11 shrink-0 place-items-center rounded-control text-ink-2 transition-colors hover:bg-raised hover:text-ink disabled:opacity-40', active && 'text-warn', className)}
      {...rest}
    >
      <Icon size={19} aria-hidden fill={active ? 'currentColor' : 'none'} />
    </button>
  )
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line-strong bg-surface px-1 text-[11px] font-semibold leading-none text-ink-2', className)}>{children}</kbd>
}

type Tone = 'neutral' | 'accent' | 'ok' | 'bad' | 'warn' | 'fire'
const tones: Record<Tone, string> = {
  neutral: 'bg-overlay text-ink-2',
  accent: 'bg-accent/15 text-accent',
  ok: 'bg-ok/15 text-ok',
  bad: 'bg-bad/15 text-bad',
  warn: 'bg-warn/15 text-warn',
  fire: 'bg-fire/15 text-fire',
}

export function Badge({ tone = 'neutral', children, className, icon: Icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: LucideIcon }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-medium', tones[tone], className)}>
      {Icon && <Icon size={13} aria-hidden />}
      {children}
    </span>
  )
}

export function Panel({ as: Tag = 'section', className, children, ...rest }: { as?: 'section' | 'div' | 'article' | 'aside'; className?: string; children: ReactNode } & Record<string, unknown>) {
  return <Tag className={cn('rounded-card border border-line bg-surface shadow-raised', className)} {...rest}>{children}</Tag>
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-balance text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[32px]">{title}</h1>
        {description && <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export function SectionTitle({ children, aside, id }: { children: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 id={id} className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{children}</h2>
      {aside}
    </div>
  )
}

export function ProgressBar({ value, max, tone = 'accent', label, className }: { value: number; max: number; tone?: 'accent' | 'ok' | 'bad' | 'warn'; label: string; className?: string }) {
  const fill = { accent: 'bg-accent', ok: 'bg-ok', bad: 'bg-bad', warn: 'bg-warn' }[tone]
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className={cn('h-1.5 overflow-hidden rounded-full bg-overlay', className)}>
      <div className={cn('h-full rounded-full transition-[width] duration-500 ease-out', fill)} style={{ width: `${percent(value, max)}%` }} />
    </div>
  )
}

/** Correct / wrong / unseen split for a set of questions. Text alternative carries the numbers. */
export function MasteryBar({ correct, wrong, total, className }: { correct: number; wrong: number; total: number; className?: string }) {
  const unseen = Math.max(0, total - correct - wrong)
  return (
    <div className={cn('flex h-2 overflow-hidden rounded-full bg-overlay', className)} role="img" aria-label={`${correct} correct, ${wrong} need work, ${unseen} not yet answered`}>
      <div className="h-full bg-ok" style={{ width: `${percent(correct, total)}%` }} />
      <div className="h-full bg-bad/80" style={{ width: `${percent(wrong, total)}%` }} />
    </div>
  )
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-center rounded-card border border-dashed border-line px-6 py-12 text-center">
      <div className="max-w-sm">
        <Icon className="mx-auto text-ink-3" size={28} aria-hidden />
        <p className="mt-3 font-semibold text-ink">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">{body}</p>
        {action && <div className="mt-5 flex justify-center">{action}</div>}
      </div>
    </div>
  )
}

export function Select({ label, value, onChange, children, className, hideLabel }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode; className?: string; hideLabel?: boolean }) {
  return (
    <label className={cn('grid gap-1.5 text-[13px] font-medium text-ink-2', className)}>
      <span className={hideLabel ? 'sr-only' : undefined}>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="field pr-8">
        {children}
      </select>
    </label>
  )
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (value: T) => void; options: Array<{ value: T; label: ReactNode }>; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-control border border-line bg-canvas p-1">
      {options.map((option) => (
        <button
          key={option.value}
          role="tab"
          type="button"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn('min-h-9 rounded-[7px] px-3 text-sm font-medium transition-colors', value === option.value ? 'bg-raised text-ink shadow-raised' : 'text-ink-2 hover:text-ink')}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'ok' | 'bad' | 'accent' }) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] text-ink-2">{label}</div>
      <div className={cn('mt-1 text-[26px] font-bold leading-none tracking-[-0.02em]', tone === 'ok' ? 'text-ok' : tone === 'bad' ? 'text-bad' : tone === 'accent' ? 'text-accent' : 'text-ink')}>{value}</div>
      {hint && <div className="mt-1.5 text-[13px] text-ink-3">{hint}</div>}
    </div>
  )
}

/** Run `handler` for single-key shortcuts, ignoring typing contexts and modifier chords. */
export function useShortcuts(handler: (key: string, event: KeyboardEvent) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const listener = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return
      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      if (target?.closest('dialog[open]')) return
      handler(event.key, event)
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [handler, enabled])
}
