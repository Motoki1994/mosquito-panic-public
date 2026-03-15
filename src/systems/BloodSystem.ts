import { BALANCE } from '../data/balance'
import { uiController } from '../ui/uiController'

/**
 * BloodSystem
 * 責務: プレイヤーが保有する血液量の管理とUI通知
 *
 * - 吸血量の蓄積
 * - 最大血液量のクランプ
 * - uiController経由でゲージを更新
 * - 血液量のパーセントを返す (重量システムが使う)
 *
 * ※ DOM操作は直接行わず、必ず uiController を経由する
 */
export class BloodSystem {
  /** 現在の血液保有量 (0 〜 MAX_BLOOD) */
  private blood: number = 0

  /** 満タン通知済みフラグ (連続通知を防ぐ) */
  private fullNotified: boolean = false

  constructor() {
    uiController.updateBloodGauge(0)
    uiController.setBloodWarning(false)
  }

  /**
   * 血液量を加算する
   * BloodSpot.suck() の返り値をそのまま渡す
   * @param amount 吸った血液量
   */
  add(amount: number): void {
    this.blood = Math.min(this.blood + amount, BALANCE.MAX_BLOOD)
    this.syncUI()
  }

  /**
   * 血液量を放出する (STEP5以降でキー入力から呼ぶ)
   * @param delta フレーム間隔 (秒)
   */
  release(delta: number): void {
    this.blood = Math.max(0, this.blood - BALANCE.RELEASE_RATE * delta)
    this.syncUI()
  }

  /**
   * 煙などの外部効果で血液を減らす
   * @param amount 減少量 (生値)
   */
  drain(amount: number): void {
    this.blood = Math.max(0, this.blood - amount)
    this.syncUI()
  }

  /**
   * 血液量をパーセント (0〜1) で返す
   * 重量システムが速度計算に使う
   */
  getPercent(): number {
    return this.blood / BALANCE.MAX_BLOOD
  }

  /** 現在の血液量 (生値) を返す */
  getAmount(): number {
    return this.blood
  }

  /** 満タンかどうかを返す */
  isFull(): boolean {
    return this.blood >= BALANCE.MAX_BLOOD
  }

  /** ゲーム開始・リトライ時にリセットする */
  reset(): void {
    this.blood = 0
    this.fullNotified = false
    uiController.updateBloodGauge(0)
    uiController.updateBloodStatus(0)  // FULL/HEAVYラベルを確実にクリア
    uiController.setBloodWarning(false)
  }

  /**
   * 血液量をUIに同期する
   * 警告色・満タン通知もここで制御する
   */
  private syncUI(): void {
    const percent = this.getPercent() * 100
    uiController.updateBloodGauge(percent)
    uiController.updateBloodStatus(percent)

    // 80%以上で警告色
    uiController.setBloodWarning(percent >= 80)

    // 満タン通知 (一度だけ)
    if (this.isFull() && !this.fullNotified) {
      this.fullNotified = true
      uiController.showBloodFullNotice()
    }
    if (!this.isFull()) {
      this.fullNotified = false
    }
  }
}
