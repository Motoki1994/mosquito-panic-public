import { BALANCE } from '../data/balance'
import { uiController } from '../ui/uiController'

/**
 * 現在の風の状態を表す値オブジェクト
 */
export interface WindState {
  /** X方向の風速 (px/s) — 正が右 */
  windX: number
  /** Y方向の風速 (px/s) — 正が下 */
  windY: number
}

/**
 * EventSystem
 * 責務: スコア連動の環境イベント管理
 *
 * 現在の実装: ファンの風
 *   - FAN_START_SCORE を超えると解禁
 *   - 一定間隔でランダムな方向の風が吹く
 *   - 風は 0.5秒でランプアップ、終了1秒前からランプダウン
 *   - update() が WindState を返すので GameScene が Player に適用する
 */
export class EventSystem {
  private fanActive = false
  private fanTimer  = 0
  private fanCooldown: number

  private fanDirX     = 0
  private fanDirY     = 0
  private fanStrength = 0
  private fanRamp     = 0   // 0〜1 : スムーズな強さ変化

  private unlocked = false

  private static readonly RAMP_UP_SEC = 0.5

  constructor() {
    this.fanCooldown = BALANCE.FAN_INITIAL_COOLDOWN_SEC
  }

  /**
   * 毎フレーム呼ぶ。現在の風状態を返す (風なし = null)
   * @param dt    フレーム間隔 (秒)
   * @param score 現在のスコア
   */
  update(dt: number, score: number): WindState | null {
    // 得点が閾値未満は何もしない
    if (!this.unlocked) {
      if (score < BALANCE.FAN_START_SCORE) return null
      this.unlocked = true
    }

    if (this.fanActive) {
      this.fanTimer -= dt

      // ランプアップ (開始から 0.5s で最大)
      this.fanRamp = Math.min(this.fanRamp + dt / EventSystem.RAMP_UP_SEC, 1.0)

      // 終了1秒前からランプダウン
      if (this.fanTimer <= 1.0) {
        this.fanRamp = Math.min(this.fanTimer, this.fanRamp)
      }

      if (this.fanTimer <= 0) {
        this.endFan()
        return null
      }

      return {
        windX: this.fanDirX * this.fanStrength * this.fanRamp,
        windY: this.fanDirY * this.fanStrength * this.fanRamp,
      }
    } else {
      this.fanCooldown -= dt
      if (this.fanCooldown <= 0) this.startFan()
      return null
    }
  }

  reset(): void {
    this.fanActive   = false
    this.fanTimer    = 0
    this.fanCooldown = BALANCE.FAN_INITIAL_COOLDOWN_SEC
    this.fanRamp     = 0
    this.unlocked    = false
    uiController.hideWindIndicator()
  }

  // --------------------------------------------------

  private startFan(): void {
    this.fanActive = true

    // 4方向からランダムに選択
    const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    const [dx, dy] = DIRS[Math.floor(Math.random() * DIRS.length)]
    this.fanDirX = dx
    this.fanDirY = dy

    this.fanStrength = BALANCE.FAN_MIN_STRENGTH +
      Math.random() * (BALANCE.FAN_MAX_STRENGTH - BALANCE.FAN_MIN_STRENGTH)

    this.fanTimer = BALANCE.FAN_MIN_DURATION_SEC +
      Math.random() * (BALANCE.FAN_MAX_DURATION_SEC - BALANCE.FAN_MIN_DURATION_SEC)

    this.fanRamp = 0

    uiController.showWindIndicator(this.fanDirX, this.fanDirY)
  }

  private endFan(): void {
    this.fanActive = false
    this.fanRamp   = 0
    this.fanCooldown = BALANCE.FAN_MIN_COOLDOWN_SEC +
      Math.random() * (BALANCE.FAN_MAX_COOLDOWN_SEC - BALANCE.FAN_MIN_COOLDOWN_SEC)
    uiController.hideWindIndicator()
  }
}
