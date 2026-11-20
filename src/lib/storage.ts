import type { Progress, Question } from '../types'

const PROGRESS_KEY = 'iot102-progress-v1'
const BANK_OVERRIDES_KEY = 'iot102-bank-overrides-v1'

export const emptyProgress: Progress = { version: 1, answers: {}, starred: [], examHistory: [] }

export function loadProgress(): Progress {
  try {
    const value = localStorage.getItem(PROGRESS_KEY)
    if (!value) return structuredClone(emptyProgress)
    const parsed = JSON.parse(value) as Progress
    return parsed.version === 1 ? parsed : structuredClone(emptyProgress)
  } catch {
    return structuredClone(emptyProgress)
  }
}

export function saveProgress(progress: Progress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
}

export function loadBankOverrides(): Record<string, Partial<Question>> {
  try {
    return JSON.parse(localStorage.getItem(BANK_OVERRIDES_KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveBankOverrides(overrides: Record<string, Partial<Question>>) {
  localStorage.setItem(BANK_OVERRIDES_KEY, JSON.stringify(overrides))
}

export function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
