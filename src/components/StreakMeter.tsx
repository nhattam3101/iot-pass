import { Flame } from 'lucide-react'
import { STREAK_STEP, streakLevel, streakProgress } from '../lib/practice'
import { cn } from './ui'

const levelColor = ['text-ink-3', 'text-fire/80', 'text-fire', 'text-fire', 'text-warn']

/** Compact streak indicator: flame grows one step per 5 correct answers in a row. */
export function StreakMeter({ streak, best }: { streak: number; best: number }) {
  const level = streakLevel(streak)
  const step = streakProgress(streak)
  const shown = Math.min(level, 4)
  const size = 18 + shown * 3
  return (
    <div className="flex items-center gap-2.5" title={`Every ${STREAK_STEP} correct in a row raises the fire level`}>
      <span className="grid size-9 place-items-center" aria-hidden>
        {/* key restarts the one-shot flare each time a new level is reached */}
        <Flame key={level} size={size} className={cn(levelColor[shown], level > 0 && 'animate-flare')} fill={level > 0 ? 'currentColor' : 'none'} fillOpacity={level > 0 ? 0.25 + shown * 0.15 : 0} strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5 text-sm">
          <span className="font-bold text-ink">{streak}</span>
          <span className="text-ink-2">in a row</span>
          {level > 0 && <span className="font-semibold text-fire">· Lv {level}</span>}
        </div>
        <div className="mt-1 flex gap-1" aria-hidden>
          {Array.from({ length: STREAK_STEP }, (_, index) => (
            <span key={index} className={cn('h-1 w-3.5 rounded-full transition-colors duration-200', index < step ? 'bg-fire' : 'bg-overlay')} />
          ))}
        </div>
      </div>
      <span className="sr-only" aria-live="polite">
        {level > 0 && step === 0 ? `Fire level ${level}: ${streak} correct in a row.` : ''}
      </span>
      {best > streak && best >= STREAK_STEP && <span className="hidden text-[12px] text-ink-3 md:inline">best {best}</span>}
    </div>
  )
}
