import { BALANCE } from '../data/balance'
import { uiController } from '../ui/uiController'

/**
 * HungerSystem
 * 巣の赤ちゃんの空腹度管理。
 *
 * 内部値 hunger (0=満腹, 100=瀕死) はUIに「満腹度」として反転表示 (100-hunger)。
 * ステージに応じて空腹上昇速度が加速する。
 * hunger >= HUNGER_CRITICAL_THRESHOLD でカウントダウン開始 → 0でゲームオーバー。
 * 納品でカウントダウンをキャンセル & 空腹を回復。
 */
export class HungerSystem {
  private hunger: number = BALANCE.HUNGER_INITIAL
  private warnNotified: boolean = false

  // スターベーションカウントダウン
  private countdownActive: boolean = false
  private countdown: number = BALANCE.HUNGER_STARVATION_COUNTDOWN_SEC
  private _starved: boolean = false

  // 過食ブースト (大量納品・アイテムで満腹度が高い値に戻った直後の一時加速)
  private overfedTimer: number = 0

  constructor() {
    uiController.updateHungerGauge(100 - BALANCE.HUNGER_INITIAL)
  }

  /**
   * @param dt           フレーム時間 (秒)
   * @param stageDrainMult ステージ別空腹加速係数 (StageSystem.getHungerMult())
   */
  update(dt: number, stageDrainMult: number = 1.0): void {
    // 過食ブーストタイマー消化
    if (this.overfedTimer > 0) this.overfedTimer = Math.max(0, this.overfedTimer - dt)

    // 段階的ドレイン: 満腹度が高い (hunger 低い) ほど緩やか
    const phaseMult = this.hunger < 40 ? BALANCE.HUNGER_DRAIN_SLOW_MULT
                    : this.hunger < 70 ? BALANCE.HUNGER_DRAIN_NORMAL_MULT
                    : BALANCE.HUNGER_DRAIN_FAST_MULT
    // 過食ブースト: 満腹度が高すぎる状態が続かないよう一時的に加速
    const overfedMult = this.overfedTimer > 0 ? BALANCE.OVERFED_BOOST_MULT : 1.0
    this.hunger = Math.min(100, this.hunger + BALANCE.HUNGER_RATE * phaseMult * stageDrainMult * overfedMult * dt)

    // 満腹度20%以下 (hunger >= 80) で警告
    if (this.hunger >= BALANCE.HUNGER_WARN_THRESHOLD && !this.warnNotified) {
      this.warnNotified = true
      uiController.showHungerWarning()
    }
    if (this.hunger < BALANCE.HUNGER_WARN_THRESHOLD) {
      this.warnNotified = false
    }

    // 危機カウントダウン (hunger >= CRITICAL_THRESHOLD = 90%)
    const isCritical = this.hunger >= BALANCE.HUNGER_CRITICAL_THRESHOLD
    if (isCritical) {
      if (!this.countdownActive) {
        this.countdownActive = true
        this.countdown = BALANCE.HUNGER_STARVATION_COUNTDOWN_SEC
        uiController.showStarvationCountdown(Math.ceil(this.countdown))
      }
      this.countdown -= dt
      uiController.updateStarvationCountdown(Math.ceil(Math.max(0, this.countdown)))
      if (this.countdown <= 0 && !this._starved) {
        this._starved = true
        uiController.hideStarvationCountdown()
      }
    } else {
      if (this.countdownActive) {
        this.countdownActive = false
        uiController.hideStarvationCountdown()
      }
    }

    uiController.updateHungerGauge(100 - this.hunger)
  }

  /** 納品時に空腹を回復し、カウントダウンをキャンセルする */
  feed(bloodAmount: number): void {
    this.hunger = Math.max(0, this.hunger - bloodAmount * BALANCE.HUNGER_FEED_RATIO)
    this.warnNotified = false
    if (this.countdownActive) {
      this.countdownActive = false
      this.countdown = BALANCE.HUNGER_STARVATION_COUNTDOWN_SEC
      uiController.hideStarvationCountdown()
    }
    // 大量回復で過食状態になった場合、一時的にドレインを加速して緊張感を維持
    if (this.hunger < BALANCE.OVERFED_BOOST_THRESHOLD) {
      this.overfedTimer = BALANCE.OVERFED_BOOST_DURATION_SEC
    }
    uiController.updateHungerGauge(100 - this.hunger)
  }

  /**
   * 空腹を直接削減する (アイテム効果・マイルストーン報酬用)
   * hunger を amount だけ下げ、カウントダウンが解除されれば非表示にする
   */
  reduceDirect(amount: number): void {
    this.hunger = Math.max(0, this.hunger - amount)
    this.warnNotified = false
    if (this.countdownActive && this.hunger < BALANCE.HUNGER_CRITICAL_THRESHOLD) {
      this.countdownActive = false
      this.countdown = BALANCE.HUNGER_STARVATION_COUNTDOWN_SEC
      uiController.hideStarvationCountdown()
    }
    if (this.hunger < BALANCE.OVERFED_BOOST_THRESHOLD) {
      this.overfedTimer = BALANCE.OVERFED_BOOST_DURATION_SEC
    }
    uiController.updateHungerGauge(100 - this.hunger)
  }

  /**
   * 空腹を直接増加させる (デバフアイテム効果)
   * hunger 値を上げて満腹度を下げる
   */
  addDirect(amount: number): void {
    this.hunger = Math.min(100, this.hunger + amount)
    uiController.updateHungerGauge(100 - this.hunger)
  }

  /** カウントダウンが0になったか (= ゲームオーバー条件) */
  isStarved(): boolean { return this._starved }

  /** 空腹に応じたスコアボーナス倍率 (1.0〜HUNGER_MAX_BONUS) */
  getBonus(): number {
    return 1.0 + (this.hunger / 100) * (BALANCE.HUNGER_MAX_BONUS - 1.0)
  }

  /** 空腹パーセント (0〜1) — DailyBonus 判定用 */
  getPercent(): number { return this.hunger / 100 }

  reset(): void {
    this.hunger = BALANCE.HUNGER_INITIAL
    this.warnNotified = false
    this.countdownActive = false
    this.countdown = BALANCE.HUNGER_STARVATION_COUNTDOWN_SEC
    this._starved = false
    this.overfedTimer = 0
    uiController.hideStarvationCountdown()
    uiController.updateHungerGauge(100 - BALANCE.HUNGER_INITIAL)
  }
}
