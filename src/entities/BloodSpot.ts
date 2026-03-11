import Phaser from 'phaser'
import { BALANCE } from '../data/balance'

/** BloodSpotの状態 */
type BloodSpotState = 'active' | 'depleted' | 'respawning'

/**
 * BloodSpot (吸血ポイント)
 * 責務: 吸血ポイントの表示・吸血量管理・再出現タイミング
 * 当たり判定の結果受け取りは GameScene が行い、
 * 吸血処理の実行はこのクラスの suck() を呼ぶ
 */
export class BloodSpot {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private circle: Phaser.GameObjects.Arc
  private pulseCircle: Phaser.GameObjects.Arc
  private state: BloodSpotState = 'active'

  /** 残血液量 (0〜MAX_BLOOD) */
  private remaining: number = BALANCE.MAX_BLOOD

  /** 再出現タイマー */
  private respawnTimer: Phaser.Time.TimerEvent | null = null

  /** 吸血中かどうか (パルスアニメ制御用) */
  private isSucking: boolean = false

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene

    const r = BALANCE.BLOOD_SPOT_RADIUS

    // 外側パルス円 (吸血中に脈動する)
    this.pulseCircle = scene.add.circle(0, 0, r + 6, 0xcc0000, 0.0)

    // メイン円
    this.circle = scene.add.arc(0, 0, r, 0, 360, false, 0xaa0000)
    this.circle.setStrokeStyle(2, 0xff4444)

    this.container = scene.add.container(x, y, [this.pulseCircle, this.circle])
    this.container.setDepth(5)

    // 待機パルスアニメ (常時ゆっくり脈動)
    this.startIdlePulse()
  }

  // --------------------------------------------------
  // Public API
  // --------------------------------------------------

  /**
   * 毎フレーム呼ぶ。
   * 吸血中フラグは GameScene から setSucking() で制御する。
   */
  update(): void {
    // 現在は状態監視のみ。吸血量の更新は suck() で行う。
  }

  /**
   * 吸血処理。delta秒分の血液を吸い取り、実際に吸えた量を返す。
   * @param delta フレーム間隔 (秒)
   * @returns 吸えた血液量
   */
  suck(delta: number): number {
    if (this.state !== 'active') return 0

    const amount = Math.min(this.remaining, BALANCE.SUCK_RATE * delta)
    this.remaining -= amount

    // 残量に応じて色を暗くする
    const ratio = this.remaining / BALANCE.MAX_BLOOD
    const color = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0x330000),
      Phaser.Display.Color.ValueToColor(0xcc0000),
      100,
      Math.floor(ratio * 100)
    )
    this.circle.setFillStyle(
      Phaser.Display.Color.GetColor(color.r, color.g, color.b)
    )
    // 残量に応じてサイズを縮小
    const scale = 0.4 + ratio * 0.6
    this.circle.setScale(scale)

    if (this.remaining <= 0) {
      this.deplete()
    }

    return amount
  }

  /**
   * 吸血中フラグをセットする。
   * trueの間はパルスアニメが速くなる。
   */
  setSucking(sucking: boolean): void {
    if (this.isSucking === sucking) return
    this.isSucking = sucking
    this.scene.tweens.killTweensOf(this.pulseCircle)

    if (sucking && this.state === 'active') {
      this.startSuckingPulse()
    } else {
      this.pulseCircle.setAlpha(0)
    }
  }

  /** ワールド座標を返す */
  getPosition(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y }
  }

  /** activeかどうかを返す */
  isActive(): boolean {
    return this.state === 'active'
  }

  /** 破棄する */
  destroy(): void {
    this.respawnTimer?.destroy()
    this.container.destroy()
  }

  // --------------------------------------------------
  // Private
  // --------------------------------------------------

  /** 枯渇処理: スポットを非表示にして再出現タイマーを開始する */
  private deplete(): void {
    this.state = 'depleted'
    this.isSucking = false
    this.scene.tweens.killTweensOf(this.pulseCircle)
    this.scene.tweens.killTweensOf(this.circle)

    // 枯渇エフェクト: フェードアウト
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => {
        this.state = 'respawning'
        this.scheduleRespawn()
      },
    })
  }

  /** 再出現タイマーをセットする */
  private scheduleRespawn(): void {
    this.respawnTimer = this.scene.time.addEvent({
      delay: BALANCE.BLOOD_SPOT_RESPAWN_MS,
      callback: this.respawn,
      callbackScope: this,
    })
  }

  /** 再出現: 残量リセットとフェードイン */
  private respawn(): void {
    this.remaining = BALANCE.MAX_BLOOD
    this.circle.setScale(1)
    this.circle.setFillStyle(0xaa0000)
    this.state = 'active'

    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 600,
      ease: 'Power2',
      onComplete: () => {
        this.startIdlePulse()
      },
    })
  }

  /** 待機中のゆっくりパルス */
  private startIdlePulse(): void {
    this.scene.tweens.add({
      targets: this.circle,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  /** 吸血中の速いパルス */
  private startSuckingPulse(): void {
    this.pulseCircle.setAlpha(0.5)
    this.scene.tweens.add({
      targets: this.pulseCircle,
      alpha: 0,
      scaleX: 1.6,
      scaleY: 1.6,
      duration: 400,
      repeat: -1,
      ease: 'Power2',
    })
  }
}
