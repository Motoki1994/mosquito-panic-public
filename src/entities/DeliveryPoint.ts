import Phaser from 'phaser'
import { BALANCE } from '../data/balance'

/** 納品完了コールバックの型 */
type OnDeliverCallback = (bloodAmount: number, isFull: boolean) => void

/**
 * DeliveryPoint — 「蚊の赤ちゃんに血を渡す場所」
 *
 * 責務: 納品エリアの表示・プレイヤー接触検知・チャージ納品・コールバック通知
 *
 * チャージ仕様:
 *   - プレイヤーが血液を持ってエリアに入ると黄色の弧が填まり始める
 *   - DELIVERY_CHARGE_SEC 秒間エリア内に留まると納品成立
 *   - エリアを離れるとチャージがリセットされる
 *   - 納品後 COOLDOWN_MS 間は再チャージ不可
 */
export class DeliveryPoint {
  private scene: Phaser.Scene

  /** 外側のリング (常時回転) */
  private ring: Phaser.GameObjects.Arc
  /** 内側のコア */
  private core: Phaser.GameObjects.Arc
  /** アイコン */
  private icon: Phaser.GameObjects.Text
  /** 納品クールダウン中の暗いオーバーレイ */
  private cooldownOverlay: Phaser.GameObjects.Arc
  /** チャージ進捗を示す弧 */
  private chargeGraphics: Phaser.GameObjects.Graphics

  private x: number
  private y: number

  /** 納品クールダウン中かどうか (連続納品を防ぐ) */
  private onCooldown: boolean = false

  /** 納品完了時に呼ぶコールバック */
  private onDeliver: OnDeliverCallback

  /** クールダウンタイマー */
  private cooldownTimer: Phaser.Time.TimerEvent | null = null

  /** チャージ経過時間 (秒) */
  private chargeTimer: number = 0
  /** チャージ中かどうか */
  private isCharging: boolean = false

  /** クールダウン時間 (ms) — 納品後この時間は受け付けない */
  private static readonly COOLDOWN_MS = 800

  constructor(scene: Phaser.Scene, x: number, y: number, onDeliver: OnDeliverCallback) {
    this.scene = scene
    this.x = x
    this.y = y
    this.onDeliver = onDeliver

    const r = BALANCE.DELIVERY_RADIUS

    // 外側リング
    this.ring = scene.add.arc(x, y, r + 8, 0, 360, false, 0x00ccff, 0)
    this.ring.setStrokeStyle(2, 0x00ccff, 0.7)
    this.ring.setDepth(4)

    // 内側コア
    this.core = scene.add.arc(x, y, r, 0, 360, false, 0x003344, 0.85)
    this.core.setStrokeStyle(2, 0x00aaff, 1)
    this.core.setDepth(4)

    // クールダウンオーバーレイ
    this.cooldownOverlay = scene.add.arc(x, y, r, 0, 360, false, 0x000000, 0)
    this.cooldownOverlay.setDepth(5)

    // アイコン (padding を確保しないと Phaser の measureText が emoji を clip する)
    this.icon = scene.add.text(x, y , '🍼', {
      fontSize: '25px',
      padding: { top: 8, bottom: 8, left: 4, right: 4 },
    }).setOrigin(0.5).setDepth(6)

    // チャージ弧 (チャージ中のみ描画)
    this.chargeGraphics = scene.add.graphics().setDepth(7)

    // 常時パルスアニメ
    this.startIdleAnim()
  }

  // --------------------------------------------------
  // Public API
  // --------------------------------------------------

  /**
   * 毎フレーム呼ぶ
   * プレイヤーがエリア内に血液を持って留まり続けると
   * DELIVERY_CHARGE_SEC 秒後に納品する
   *
   * @param playerX     プレイヤー X
   * @param playerY     プレイヤー Y
   * @param bloodAmount プレイヤーの現在血液量
   * @param isFull      満タンかどうか
   * @param dt          フレーム間隔 (秒)
   */
  update(playerX: number, playerY: number, bloodAmount: number, isFull: boolean, dt: number): void {
    if (this.onCooldown) return

    const dist   = Phaser.Math.Distance.Between(playerX, playerY, this.x, this.y)
    const inZone = dist <= BALANCE.DELIVERY_RADIUS
    const hasBlood = bloodAmount > 0

    if (inZone && hasBlood) {
      if (!this.isCharging) {
        this.isCharging  = true
        this.chargeTimer = 0
      }
      this.chargeTimer += dt
      const progress = Math.min(this.chargeTimer / BALANCE.DELIVERY_CHARGE_SEC, 1)
      this.drawChargeArc(progress)

      if (this.chargeTimer >= BALANCE.DELIVERY_CHARGE_SEC) {
        this.isCharging  = false
        this.chargeTimer = 0
        this.chargeGraphics.clear()
        this.triggerDelivery(bloodAmount, isFull)
      }
    } else {
      if (this.isCharging) {
        this.isCharging  = false
        this.chargeTimer = 0
        this.chargeGraphics.clear()
      }
    }
  }

  /**
   * プレイヤーが納品エリア内にいるかを返す
   * 安全地帯判定に使う (AlertSystem / HumanHand の制御)
   */
  isPlayerInside(playerX: number, playerY: number): boolean {
    return Phaser.Math.Distance.Between(playerX, playerY, this.x, this.y)
      <= BALANCE.DELIVERY_RADIUS
  }

  /** 破棄する */
  destroy(): void {
    this.cooldownTimer?.destroy()
    this.chargeGraphics.destroy()
    this.ring.destroy()
    this.core.destroy()
    this.cooldownOverlay.destroy()
    this.icon.destroy()
  }

  // --------------------------------------------------
  // Private
  // --------------------------------------------------

  /**
   * チャージ進捗弧を描画する
   * 12時位置 (-90°) から時計回りに progress × 360° 分の弧
   */
  private drawChargeArc(progress: number): void {
    if (progress <= 0) return
    const r = BALANCE.DELIVERY_RADIUS + 14

    // 色を進捗に合わせて緑→黄→白に変化
    const color = progress < 0.5 ? 0xffaa00 : progress < 0.9 ? 0xffdd00 : 0xffffff

    this.chargeGraphics.clear()
    this.chargeGraphics.lineStyle(4, color, 1)
    this.chargeGraphics.beginPath()
    // Phaser arc は度数 (0° = 3時方向、時計回り)
    this.chargeGraphics.arc(this.x, this.y, r, -90, -90 + progress * 360, false)
    this.chargeGraphics.strokePath()
  }

  /**
   * 納品を実行する
   * コールバックを呼んだあとクールダウンアニメを流す
   */
  private triggerDelivery(bloodAmount: number, isFull: boolean): void {
    this.onCooldown = true

    // コールバック → ScoreSystem が計算
    this.onDeliver(bloodAmount, isFull)

    // 納品エフェクト: コアをフラッシュ
    this.scene.tweens.add({
      targets: this.core,
      scaleX: 1.4,
      scaleY: 1.4,
      alpha: 0.3,
      duration: 200,
      yoyo: true,
      ease: 'Power2',
    })

    // クールダウンオーバーレイをフェードイン→アウト
    this.cooldownOverlay.setAlpha(0.5)
    this.scene.tweens.add({
      targets: this.cooldownOverlay,
      alpha: 0,
      duration: DeliveryPoint.COOLDOWN_MS,
      ease: 'Power1',
    })

    // クールダウン終了
    this.cooldownTimer = this.scene.time.addEvent({
      delay: DeliveryPoint.COOLDOWN_MS,
      callback: () => { this.onCooldown = false },
    })
  }

  /** 待機中の静かなパルスアニメ */
  private startIdleAnim(): void {
    this.scene.tweens.add({
      targets: this.ring,
      scaleX: 1.08,
      scaleY: 1.08,
      alpha: 0.5,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
    this.scene.tweens.add({
      targets: this.core,
      alpha: 0.65,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }
}
