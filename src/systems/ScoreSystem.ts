import { BALANCE } from '../data/balance'
import { uiController } from '../ui/uiController'

/**
 * スコア内訳 — ResultScene へ渡すデータ型
 */
export interface ScoreBreakdown {
  deliveryScore: number
  deliveryCount: number
  total: number
  survivalSec: number
}

/**
 * ScoreSystem
 * 責務: スコアの計算・チェイン管理・ティアコンボ管理・UI通知
 *
 * ★ スコアは「納品」でのみ増える。
 *
 * 納品スコア計算式 (全倍率は乗算):
 *   base         = 保有血液量 × SCORE_PER_BLOOD_DELIVERED
 *   highVolume   = 血液90%以上 → × DELIVERY_HIGH_VOLUME_BONUS
 *   fullBonus    = 血液100%   → × DELIVERY_FULL_BONUS
 *   dangerBonus  = alert50%以上 → ×1.2 / alert80%以上 → ×1.5
 *   chainMult    = チェイン数に応じた倍率 (DELIVERY_CHAIN_MULT テーブル)
 *   tierMult     = 同一ティア連続納品倍率 (TIER_COMBO_MULT テーブル)
 *   hungerBonus  = 空腹度に応じたボーナス (1.0〜2.0)
 *   得点         = base × highVolume × fullBonus × dangerBonus × chainMult × tierMult × hungerBonus
 *
 * チェイン:
 *   DELIVERY_CHAIN_TIMEOUT_SEC 秒以内に次の納品で chain++。
 *   時間切れでリセット。
 *
 * ティアコンボ:
 *   Tier0: 0〜25%  Tier1: 25〜50%  Tier2: 50〜75%  Tier3: 75〜100%
 *   同一ティア連続納品でティアコンボ++。異なるティアでリセット。
 */
export class ScoreSystem {
  private deliveryScore: number = 0
  private deliveryCount: number = 0
  private survivalSec: number = 0

  /** 連続納品チェインカウント (1から始まる) */
  private chain: number = 1

  /** 最後に納品してからの経過秒数 */
  private timeSinceLastDelivery: number = Infinity

  /** ティアコンボカウント (1から始まる) */
  private tierCombo: number = 1

  /** 最後に納品した血液ティア (null = まだ納品なし) */
  private lastTier: number | null = null

  constructor() {
    uiController.updateScore(0)
    uiController.updateDeliveryCombo(0, 0, 1.0)
  }

  // --------------------------------------------------
  // Public API
  // --------------------------------------------------

  update(dt: number): void {
    this.survivalSec += dt
    if (this.timeSinceLastDelivery < Infinity) {
      this.timeSinceLastDelivery += dt
    }

    // チェインタイムアウト
    if (
      this.chain > 1 &&
      this.timeSinceLastDelivery >= BALANCE.DELIVERY_CHAIN_TIMEOUT_SEC
    ) {
      this.chain = 1
      const tierMult = BALANCE.TIER_COMBO_MULT[Math.min(this.tierCombo, BALANCE.TIER_COMBO_MULT.length - 1)]
      uiController.updateDeliveryCombo(this.chain, this.tierCombo, tierMult)
    }
  }

  /**
   * 納品処理
   * @param bloodAmount  納品時の血液量 (0〜MAX_BLOOD)
   * @param isFull       満タン (= MAX_BLOOD) で納品したか
   * @param alertPercent 納品時のアラート (0〜1)
   * @param hungerBonus  空腹ボーナス倍率 (1.0〜2.0)
   * @param stageMult    エリア報酬倍率 (StageSystem から)
   * @param dailyMult    日替わりボーナス倍率 (DailyBonusSystem から)
   */
  deliver(
    bloodAmount: number,
    isFull: boolean,
    alertPercent: number,
    hungerBonus: number = 1.0,
    stageMult: number = 1.0,
    dailyMult: number = 1.0,
    lastSecondMult: number = 1.0,
  ): number {
    // チェイン更新
    if (this.timeSinceLastDelivery < BALANCE.DELIVERY_CHAIN_TIMEOUT_SEC) {
      this.chain = Math.min(this.chain + 1, BALANCE.DELIVERY_CHAIN_MULT.length - 1)
    }
    this.timeSinceLastDelivery = 0
    this.deliveryCount++

    // ティアコンボ更新
    const currentTier = ScoreSystem.bloodTier(bloodAmount / BALANCE.MAX_BLOOD)
    if (this.lastTier === null || currentTier === this.lastTier) {
      this.tierCombo = Math.min(this.tierCombo + (this.lastTier === null ? 0 : 1), BALANCE.TIER_COMBO_MULT.length - 1)
    } else {
      this.tierCombo = 1
    }
    this.lastTier = currentTier

    // --- 倍率計算 ---
    const bloodPercent = bloodAmount / BALANCE.MAX_BLOOD

    const highVol = bloodPercent >= BALANCE.DELIVERY_HIGH_VOLUME_THRESHOLD
      ? BALANCE.DELIVERY_HIGH_VOLUME_BONUS : 1.0

    const full = isFull ? BALANCE.DELIVERY_FULL_BONUS : 1.0

    let danger = 1.0
    if (alertPercent >= BALANCE.DELIVERY_DANGER_LV2_THRESHOLD) {
      danger = BALANCE.DELIVERY_DANGER_LV2_MULT
    } else if (alertPercent >= BALANCE.DELIVERY_DANGER_LV1_THRESHOLD) {
      danger = BALANCE.DELIVERY_DANGER_LV1_MULT
    }

    const chainIdx = Math.min(this.chain, BALANCE.DELIVERY_CHAIN_MULT.length - 1)
    const chain = BALANCE.DELIVERY_CHAIN_MULT[chainIdx]

    const tierIdx = Math.min(this.tierCombo, BALANCE.TIER_COMBO_MULT.length - 1)
    const tier = BALANCE.TIER_COMBO_MULT[tierIdx]

    // グリードボーナス (血液80%以上で追加倍率)
    const greedMult = bloodPercent >= BALANCE.GREED_THRESHOLD_MAX ? BALANCE.GREED_MULT_MAX
                    : bloodPercent >= BALANCE.GREED_THRESHOLD_BASE ? BALANCE.GREED_MULT_BASE
                    : 1.0

    const totalMult = highVol * full * danger * chain * tier * hungerBonus * stageMult * dailyMult * greedMult * lastSecondMult
    const base = bloodAmount * BALANCE.SCORE_PER_BLOOD_DELIVERED
    const gained = Math.floor(base * totalMult)

    this.deliveryScore += gained

    // UI 更新
    uiController.updateScore(this.deliveryScore)
    uiController.updateDeliveryCombo(this.chain, this.tierCombo, totalMult)
    uiController.showDeliveryScore(gained, totalMult, isFull, alertPercent, lastSecondMult > 1.0)

    return gained
  }

  getBreakdown(): ScoreBreakdown {
    return {
      deliveryScore: this.deliveryScore,
      deliveryCount: this.deliveryCount,
      total: this.deliveryScore,
      survivalSec: Math.floor(this.survivalSec),
    }
  }

  getTotal(): number {
    return this.deliveryScore
  }

  reset(): void {
    this.deliveryScore = 0
    this.deliveryCount = 0
    this.survivalSec = 0
    this.chain = 1
    this.tierCombo = 1
    this.lastTier = null
    this.timeSinceLastDelivery = Infinity
    uiController.updateScore(0)
    uiController.updateDeliveryCombo(0, 0, 1.0)
  }

  // --------------------------------------------------
  // Static helpers
  // --------------------------------------------------

  /** 血液パーセント(0〜1)からティア番号(0〜3)を返す */
  static bloodTier(percent: number): number {
    if (percent >= 0.75) return 3
    if (percent >= 0.50) return 2
    if (percent >= 0.25) return 1
    return 0
  }
}
