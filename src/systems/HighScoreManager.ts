import { ScoreBreakdown } from './ScoreSystem'

const STORAGE_KEY = 'mosquito-panic-highscore'

export interface HighScoreRecord {
  total: number
  deliveryScore: number
  deliveryCount: number
  survivalSec: number
  date: string
}

export const HighScoreManager = {
  load(): HighScoreRecord | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      return JSON.parse(raw) as HighScoreRecord
    } catch {
      return null
    }
  },

  save(breakdown: ScoreBreakdown): boolean {
    const current = this.load()
    if (current && current.total >= breakdown.total) return false

    const record: HighScoreRecord = {
      total:         breakdown.total,
      deliveryScore: breakdown.deliveryScore,
      deliveryCount: breakdown.deliveryCount,
      survivalSec:   breakdown.survivalSec,
      date: new Date().toLocaleDateString('ja-JP'),
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
      return true
    } catch {
      return false
    }
  },

  clear(): void {
    localStorage.removeItem(STORAGE_KEY)
  },
}
