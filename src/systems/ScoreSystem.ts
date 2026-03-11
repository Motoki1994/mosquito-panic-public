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
 * 責務: スコアの計算・チェイン管理・UI通知
 *
 * ★ スコアは「納品」でのみ増える。
 *
 * 納品スコア計算式 (全倍率は乗算):
 *   base          = 保有血液量 × SCORE_PER_BLOOD_DELIVERED
 *   highVolume    = 血液90%以上 → × DELIVERY_HIGH_VOLUME_BONUS
 *   fullBonus     = 血液100%    → × DELIVERY_FULL_BONUS (high_volume と重複適用)
 *   dangerBonus   = alert50%以上 → ×1.2 / alert80%以上 → ×1.5
 *   chainMult     = チェイン数に応じた倍率 (DELIVERY_CHAIN_MULT テーブル)
 *   得点          = base × highVolume × fullBonus × dangerBonus × chainMult
 *
 * チェイン:
 *   DELIVERY_CHAIN_TIMEOUT_SEC 秒以内に次の納品で chain++ 。
 *   時間切れでリセット。倍率は DELIVERY_CHAIN_MULT テーブルで決まる。
 */
export class ScoreSystem {
  private deliveryScore: number = 0
  private deliveryCount: number = 0
  private survivalSec: number = 0

  /** 連続納品チェインカウント (1から始まる) */
  private chain: number = 1

  /** 最後に納品してからの経過秒数 */
  private timeSinceLastDelivery: number = Infinity

  constructor() {
    uiController.updateScore(0)
    uiController.updateDeliveryCombo(0, 1.0)
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
      uiController.updateDeliveryCombo(0, 1.0)
    }
  }

  /**
   * 納品処理
   * @param bloodAmount  納品時の血液量 (0〜MAX_BLOOD)
   * @param isFull       満タン (= MAX_BLOOD) で納品したか
   * @param alertPercent 納品時のアラート (0〜1) — 危険納品ボーナスに使う
   */
  deliver(bloodAmount: number, isFull: boolean, alertPercent: number): number {
    // チェイン更新 (タイムアウト前なら +1、初回は 1 のまま)
    if (this.timeSinceLastDelivery < BALANCE.DELIVERY_CHAIN_TIMEOUT_SEC) {
      this.chain = Math.min(this.chain + 1, BALANCE.DELIVERY_CHAIN_MULT.length - 1)
    }
    this.timeSinceLastDelivery = 0
    this.deliveryCount++

    // --- 倍率計算 ---
    const bloodPercent = bloodAmount / BALANCE.MAX_BLOOD

    // 高容量ボーナス (90%以上)
    const highVol = bloodPercent >= BALANCE.DELIVERY_HIGH_VOLUME_THRESHOLD
      ? BALANCE.DELIVERY_HIGH_VOLUME_BONUS : 1.0

    // 満タンボーナス
    const full = isFull ? BALANCE.DELIVERY_FULL_BONUS : 1.0

    // 危険納品ボーナス
    let danger = 1.0
    if (alertPercent >= BALANCE.DELIVERY_DANGER_LV2_THRESHOLD) {
      danger = BALANCE.DELIVERY_DANGER_LV2_MULT
    } else if (alertPercent >= BALANCE.DELIVERY_DANGER_LV1_THRESHOLD) {
      danger = BALANCE.DELIVERY_DANGER_LV1_MULT
    }

    // チェイン倍率
    const chainIdx = Math.min(this.chain, BALANCE.DELIVERY_CHAIN_MULT.length - 1)
    const chain = BALANCE.DELIVERY_CHAIN_MULT[chainIdx]

    const totalMult = highVol * full * danger * chain
    const base = bloodAmount * BALANCE.SCORE_PER_BLOOD_DELIVERED
    const gained = Math.floor(base * totalMult)

    this.deliveryScore += gained

    // UI 更新
    uiController.updateScore(this.deliveryScore)
    uiController.updateDeliveryCombo(this.chain, totalMult)
    uiController.showDeliveryScore(gained, totalMult, isFull)

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
    this.timeSinceLastDelivery = Infinity
    uiController.updateScore(0)
    uiController.updateDeliveryCombo(0, 1.0)
  }
}
