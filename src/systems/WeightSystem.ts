import { BALANCE } from '../data/balance'
import { uiController } from '../ui/uiController'

/**
 * WeightSystem
 * Calculates player speed from blood level and notifies UI.
 */
export class WeightSystem {
  private heavyNotified: boolean = false
  private _lastRatio: number = 1.0

  calcSpeed(bloodPercent: number): number {
    const penaltyFactor = BALANCE.BLOOD_SPEED_PENALTY_PER_UNIT * BALANCE.MAX_BLOOD
    const ratio = Math.max(
      BALANCE.PLAYER_SPEED_MIN_RATIO,
      1 - bloodPercent * penaltyFactor
    )
    this._lastRatio = ratio
    const speed = BALANCE.PLAYER_BASE_SPEED * ratio
    this.syncUI(bloodPercent, ratio)
    return speed
  }

  /** Last computed speed ratio (0–1). Call after calcSpeed(). */
  get lastRatio(): number { return this._lastRatio }

  reset(): void {
    this.heavyNotified = false
    this._lastRatio = 1.0
    uiController.updateSpeedIndicator(1.0)
  }

  private syncUI(bloodPercent: number, speedRatio: number): void {
    uiController.updateSpeedIndicator(speedRatio)

    if (bloodPercent >= 0.6 && !this.heavyNotified) {
      this.heavyNotified = true
      uiController.showHeavyNotice()
    }
    if (bloodPercent < 0.6) {
      this.heavyNotified = false
    }
  }
}
