import { BALANCE } from '../data/balance'
import { uiController } from '../ui/uiController'

/**
 * アラートフェーズ (4段階)
 * Ph1:  0〜39  CALM   — 余裕
 * Ph2: 40〜69  ALERT  — 要注意
 * Ph3: 70〜89  DANGER — 危険、帰還を意識
 * Ph4: 90〜100 RAGE   — 激怒、ほぼ直上を狙う
 */
export type AlertLevel = 1 | 2 | 3 | 4

/**
 * AlertSystem
 * 責務: 警戒度 (0〜100) とフェーズの管理・UIへの通知
 */
export class AlertSystem {
  private alert: number = 0
  private idleTimer: number = 0
  private isIdle: boolean = false
  private prevLevel: AlertLevel = 1

  constructor() {
    uiController.updateAlertGauge(0)
    uiController.updateAlertLevel(1)
  }

  /**
   * 毎フレーム警戒度を更新する
   * @param dt           フレーム間隔 (秒)
   * @param sucking      吸血中かどうか
   * @param moveSpeed    プレイヤーの実際の移動速度 (px/s)
   * @param inSafeZone   納品エリア内かどうか
   * @param externalMult アラート上昇速度への外部乗数
   *                     = stageAlertMult × (isInSmoke ? SMOKE_ALERT_MULT : 1.0)
   *                     減衰には影響しない (逃げると必ず下がる設計を維持)
   */
  update(dt: number, sucking: boolean, moveSpeed: number, inSafeZone: boolean, externalMult: number = 1.0): void {
    // 静止判定
    if (moveSpeed <= BALANCE.ALERT_IDLE_SPEED_THRESHOLD) {
      this.idleTimer += dt
    } else {
      this.idleTimer = 0
      this.isIdle = false
    }
    if (this.idleTimer >= BALANCE.ALERT_IDLE_BUFFER_SEC) {
      this.isIdle = true
    }

    // 警戒度更新 (上昇には externalMult を適用、減衰には適用しない)
    if (sucking) {
      this.alert = Math.min(100, this.alert + BALANCE.ALERT_RATE_SUCKING * externalMult * dt)
    } else if (this.isIdle && !inSafeZone) {
      this.alert = Math.min(100, this.alert + BALANCE.ALERT_RATE_IDLE * externalMult * dt)
    } else {
      const decayRate = inSafeZone
        ? BALANCE.ALERT_DECAY_RATE * BALANCE.ALERT_SAFE_ZONE_DECAY_MULT
        : BALANCE.ALERT_DECAY_RATE
      this.alert = Math.max(0, this.alert - decayRate * dt)
    }

    uiController.updateAlertGauge(this.alert)

    const currentLevel = this.getLevel()
    if (currentLevel !== this.prevLevel) {
      this.prevLevel = currentLevel
      uiController.updateAlertLevel(currentLevel)
    }
  }

  /** 現在のアラートフェーズを返す */
  getLevel(): AlertLevel {
    if (this.alert >= BALANCE.ALERT_PH4_THRESHOLD) return 4
    if (this.alert >= BALANCE.ALERT_PH3_THRESHOLD) return 3
    if (this.alert >= BALANCE.ALERT_PH2_THRESHOLD) return 2
    return 1
  }

  getPercent(): number {
    return this.alert / 100
  }

  getAmount(): number {
    return this.alert
  }

  /**
   * 指定した量だけアラートを直接増加する (デバフアイテム効果)
   */
  addDirect(amount: number): void {
    this.alert = Math.min(100, this.alert + amount)
    uiController.updateAlertGauge(this.alert)
    const level = this.getLevel()
    if (level !== this.prevLevel) {
      this.prevLevel = level
      uiController.updateAlertLevel(level)
    }
  }

  /**
   * 指定した量だけアラートを直接削減する (アイテム効果など)
   */
  reduce(amount: number): void {
    this.alert = Math.max(0, this.alert - amount)
    uiController.updateAlertGauge(this.alert)
    const level = this.getLevel()
    if (level !== this.prevLevel) {
      this.prevLevel = level
      uiController.updateAlertLevel(level)
    }
  }

  /**
   * 納品時にアラートを大幅削減する
   */
  reduceOnDelivery(isFull: boolean): void {
    const cap = isFull
      ? BALANCE.ALERT_REDUCE_ON_FULL_DELIVERY
      : BALANCE.ALERT_REDUCE_ON_DELIVERY
    this.alert = Math.min(this.alert, cap)

    uiController.updateAlertGauge(this.alert)
    const level = this.getLevel()
    if (level !== this.prevLevel) {
      this.prevLevel = level
      uiController.updateAlertLevel(level)
    }
  }

  reset(): void {
    this.alert = 0
    this.idleTimer = 0
    this.isIdle = false
    this.prevLevel = 1
    uiController.updateAlertGauge(0)
    uiController.updateAlertLevel(1)
  }
}
