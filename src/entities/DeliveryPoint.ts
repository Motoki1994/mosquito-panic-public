import Phaser from 'phaser'
import { BALANCE } from '../data/balance'

/** 納品完了コールバックの型 */
type OnDeliverCallback = (bloodAmount: number, isFull: boolean) => void

/**
 * DeliveryPoint — 「蚊の赤ちゃんに血を渡す場所」
 *
 * 責務: 納品エリアの表示・プレイヤー接触検知・納品コールバック通知
 *
 * - マップ上に1つ固定配置する
 * - プレイヤーが血液を持った状態で入ると自動納品
 * - 納品直後はクールダウンアニメーションが流れる
 * - 血液 0 のまま入っても何も起きない
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

  private x: number
  private y: number

  /** 納品クールダウン中かどうか (連続納品を防ぐ) */
  private onCooldown: boolean = false

  /** 納品完了時に呼ぶコールバック */
  private onDeliver: OnDeliverCallback

  /** クールダウンタイマー */
  private cooldownTimer: Phaser.Time.TimerEvent | null = null

  /** クールダウン時間 (ms) — 納品後この時間は受け付けない */
  private static readonly COOLDOWN_MS = 800

  constructor(scene: Phaser.Scene, x: number, y: number, onDeliver: OnDeliverCallback) {
    this.scene = scene
    this.x = x
    this.y = y
    this.onDeliver = onDeliver

    const r = BALANCE.DELIVERY_RADIUS

    // 外側リング (アニメーションで回転しているように見せる)
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

    // アイコン
    this.icon = scene.add.text(x, y, '🍼', { fontSize: '22px' })
      .setOrigin(0.5)
      .setDepth(6)

    // 常時パルスアニメ
    this.startIdleAnim()
  }

  // --------------------------------------------------
  // Public API
  // --------------------------------------------------

  /**
   * 毎フレーム呼ぶ
   * プレイヤーが範囲内かつ血液を持っていれば納品する
   *
   * @param playerX     プレイヤー X
   * @param playerY     プレイヤー Y
   * @param bloodAmount プレイヤーの現在血液量
   * @param isFull      満タンかどうか
   */
  update(playerX: number, playerY: number, bloodAmount: number, isFull: boolean): void {
    if (this.onCooldown) return
    if (bloodAmount <= 0) return

    const dist = Phaser.Math.Distance.Between(playerX, playerY, this.x, this.y)
    if (dist <= BALANCE.DELIVERY_RADIUS) {
      this.triggerDelivery(bloodAmount, isFull)
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
    this.ring.destroy()
    this.core.destroy()
    this.cooldownOverlay.destroy()
    this.icon.destroy()
  }

  // --------------------------------------------------
  // Private
  // --------------------------------------------------

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
    // リングが呼吸するように
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
    // コアが微妙に輝く
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
