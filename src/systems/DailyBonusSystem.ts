import { BALANCE } from '../data/balance'

export type BonusType = 'full_tank' | 'danger' | 'tier3' | 'high_hunger'

export interface DailyBonus {
  type: BonusType
  label: string       // 短いラベル (HUD / タイトル表示用)
  condition: string   // 条件の説明文
  multiplier: number
}

const BONUS_LIST: Omit<DailyBonus, 'multiplier'>[] = [
  {
    type: 'full_tank',
    label: 'FULL TANK',
    condition: 'Deliver at 100% blood',
  },
  {
    type: 'danger',
    label: 'DANGER RUSH',
    condition: 'Deliver at DANGER+ alert',
  },
  {
    type: 'tier3',
    label: 'GREEDY',
    condition: 'Deliver with 75%+ blood',
  },
  {
    type: 'high_hunger',
    label: 'STARVING',
    condition: 'Deliver when supply <20%',
  },
]

/**
 * DailyBonusSystem
 * 責務: 日替わりボーナス条件の管理と適用
 *
 * - 今日の日付をシードにしてボーナスタイプをランダム選択
 *   → 同じ日は常に同じボーナス、翌日に変わる
 * - applyBonus() でその納品にボーナスが適用されるか判定し
 *   倍率 (1.0 or DAILY_BONUS_MULT) を返す
 */
export class DailyBonusSystem {
  private readonly bonus: DailyBonus

  constructor() {
    const seed = DailyBonusSystem.dateSeed()
    const base = BONUS_LIST[seed % BONUS_LIST.length]
    this.bonus = { ...base, multiplier: BALANCE.DAILY_BONUS_MULT }
  }

  getBonus(): DailyBonus {
    return this.bonus
  }

  /**
   * 納品時に呼ぶ。ボーナス条件を満たしていれば DAILY_BONUS_MULT を返す。
   * @param bloodPercent   血液量パーセント (0〜1)
   * @param isFull         満タン納品かどうか
   * @param alertPercent   アラートパーセント (0〜1)
   * @param hungerPercent  空腹パーセント (0〜1)
   */
  applyBonus(
    bloodPercent: number,
    isFull: boolean,
    alertPercent: number,
    hungerPercent: number,
  ): number {
    const applies = (() => {
      switch (this.bonus.type) {
        case 'full_tank':   return isFull
        case 'danger':      return alertPercent >= 0.70
        case 'tier3':       return bloodPercent >= 0.75
        case 'high_hunger': return hungerPercent >= 0.80
      }
    })()
    return applies ? this.bonus.multiplier : 1.0
  }

  // --------------------------------------------------

  /** 今日の日付を整数シードに変換する (YYYYMMDD) */
  private static dateSeed(): number {
    const d = new Date()
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
  }
}
