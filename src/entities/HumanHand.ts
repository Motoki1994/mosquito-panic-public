import Phaser from 'phaser'
import { BALANCE } from '../data/balance'
import { AlertLevel } from '../systems/AlertSystem'

/**
 * HumanHand の攻撃フェーズ
 *
 * フェーズ遷移:
 *   idle → warning(0.6s) → descend(0.4s) → strike(0.2s) → cooldown → idle ...
 */
type HandPhase = 'idle' | 'warning' | 'descend' | 'strike' | 'cooldown'
type OnHitCallback = () => void

/**
 * HumanHand (敵攻撃エンティティ)
 * 責務: 攻撃予兆の表示・叩き判定・被弾コールバック通知
 *
 * アラートフェーズ連動 (4段階):
 *   Ph1 (0〜39):  ランダム  小半径  通常インターバル
 *   Ph2 (40〜69): ±80px   中半径  インターバル30%短縮
 *   Ph3 (70〜89): ±45px   大半径  インターバル50%短縮・即時攻撃開始
 *   Ph4 (90〜100):±20px   最大半径 即時攻撃継続 (散布は残して回避可能)
 */
export class HumanHand {
  private scene: Phaser.Scene
  private phase: HandPhase = 'idle'

  private warnCircle:   Phaser.GameObjects.Arc
  private strikeCircle: Phaser.GameObjects.Arc
  private warnIcon:     Phaser.GameObjects.Image

  private static readonly ICON_SCALE = 0.05

  private targetX: number = 0
  private targetY: number = 0

  private phaseTimer: Phaser.Time.TimerEvent | null = null
  private onHit: OnHitCallback

  private elapsedMs: number = 0
  private alertLevel: AlertLevel = 1

  /** Ph3/Ph4 即時攻撃の最終発火時刻 */
  private lv3TriggeredAt: number = -Infinity

  private playerX: number = 400
  private playerY: number = 300

  constructor(scene: Phaser.Scene, onHit: OnHitCallback) {
    this.scene = scene
    this.onHit = onHit

    this.warnCircle = scene.add.arc(-200, -200, 60, 0, 360, false, 0xffcc00, 0)
    this.warnCircle.setStrokeStyle(2, 0xffcc00, 0)
    this.warnCircle.setDepth(2)

    this.strikeCircle = scene.add.arc(-200, -200, 45, 0, 360, false, 0xff2200, 0)
    this.strikeCircle.setDepth(3)

    this.warnIcon = scene.add.image(-200, -200, 'ui_hand')
      .setScale(HumanHand.ICON_SCALE)
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(4)

    this.phaseTimer = scene.time.addEvent({
      delay: BALANCE.HAND_INITIAL_DELAY_MS,
      callback: this.beginWarn,
      callbackScope: this,
    })
  }

  // --------------------------------------------------
  // Public API
  // --------------------------------------------------

  update(dt: number, level: AlertLevel, playerX: number, playerY: number): void {
    this.elapsedMs += dt * 1000
    this.alertLevel = level
    this.playerX = playerX
    this.playerY = playerY

    if (this.phase === 'strike') {
      this.checkHit()
    }

    // Ph3/Ph4 の即時攻撃トリガー
    if (
      BALANCE.ALERT_LV3_INSTANT_ATTACK &&
      (level === 3 || level === 4) &&
      (this.phase === 'idle' || this.phase === 'cooldown') &&
      this.elapsedMs - this.lv3TriggeredAt > BALANCE.HAND_LV3_INSTANT_COOLDOWN_MS
    ) {
      this.lv3TriggeredAt = this.elapsedMs
      this.phaseTimer?.destroy()
      this.beginWarn()
    }
  }

  /**
   * チュートリアル中: 内部タイマーを停止しビジュアルを全消去する
   * Phaser scene.time イベントは update() を呼ばなくても発火するため
   * タイマー自体を destroy して手攻撃を完全に無効化する
   */
  disable(): void {
    this.phaseTimer?.destroy()
    this.phaseTimer = null
    this.phase = 'idle'
    this.scene.tweens.killTweensOf(this.warnCircle)
    this.scene.tweens.killTweensOf(this.strikeCircle)
    this.scene.tweens.killTweensOf(this.warnIcon)
    this.warnCircle.setAlpha(0).setPosition(-200, -200)
    this.strikeCircle.setAlpha(0).setPosition(-200, -200)
    this.warnIcon.setAlpha(0).setPosition(-200, -200)
  }

  /**
   * チュートリアル終了後: 通常の攻撃タイマーを再開する
   * 残留 disabled 状態なしでクリーンに再起動される
   */
  enable(): void {
    if (this.phaseTimer) return  // 既に稼働中
    this.phase = 'idle'
    this.phaseTimer = this.scene.time.addEvent({
      delay: BALANCE.HAND_INITIAL_DELAY_MS,
      callback: this.beginWarn,
      callbackScope: this,
    })
  }

  destroy(): void {
    this.phaseTimer?.destroy()
    this.warnCircle.destroy()
    this.strikeCircle.destroy()
    this.warnIcon.destroy()
  }

  // --------------------------------------------------
  // フェーズ遷移
  // --------------------------------------------------

  private beginWarn(): void {
    this.phase = 'warning'
    const margin = 80
    const scatter = this.scatterRadius()

    if (scatter >= 999) {
      // Ph1: 完全ランダム
      this.targetX = Phaser.Math.Between(margin, 800 - margin)
      this.targetY = Phaser.Math.Between(margin, 600 - margin)
    } else {
      // Ph2〜4: プレイヤー中心に scatter px 以内
      this.targetX = Phaser.Math.Clamp(
        this.playerX + Phaser.Math.Between(-scatter, scatter),
        margin, 800 - margin
      )
      this.targetY = Phaser.Math.Clamp(
        this.playerY + Phaser.Math.Between(-scatter, scatter),
        margin, 600 - margin
      )
    }

    const hitR  = this.hitRadius()
    const warnR = hitR + BALANCE.HAND_WARN_RADIUS_OFFSET

    this.warnCircle.setRadius(warnR)
    this.strikeCircle.setRadius(hitR)
    this.warnCircle.setPosition(this.targetX, this.targetY)
    this.strikeCircle.setPosition(this.targetX, this.targetY)
    this.warnIcon.setPosition(this.targetX, this.targetY)

    // フェーズ別の予兆ビジュアル
    if (this.alertLevel === 4) {
      // Ph4 RAGE: 赤・太いストローク・塗りつぶし強め
      this.warnCircle.setStrokeStyle(5, 0xff0000, 1)
      this.warnCircle.setFillStyle(0xff0000, 0.18)
    } else if (this.alertLevel === 3) {
      // Ph3 DANGER: 赤オレンジ・やや太い
      this.warnCircle.setStrokeStyle(3, 0xff3300, 1)
      this.warnCircle.setFillStyle(0xff3300, 0.1)
    } else {
      // Ph1/Ph2: 黄色
      this.warnCircle.setStrokeStyle(2, 0xffcc00, 1)
      this.warnCircle.setFillStyle(0xffcc00, 0)
    }

    this.scene.tweens.add({
      targets: [this.warnCircle, this.warnIcon],
      alpha: 1,
      duration: 120,
      ease: 'Power2',
    })

    this.phaseTimer = this.scene.time.addEvent({
      delay: BALANCE.HAND_WARN_MS,
      callback: this.beginDescend,
      callbackScope: this,
    })
  }

  private beginDescend(): void {
    this.phase = 'descend'

    this.scene.tweens.add({
      targets: this.warnCircle,
      scaleX: 0.6, scaleY: 0.6, alpha: 0.4,
      duration: BALANCE.HAND_DESCEND_MS,
      ease: 'Power2.easeIn',
    })
    this.scene.tweens.add({
      targets: this.warnIcon,
      scaleX: HumanHand.ICON_SCALE * 1.8,
      scaleY: HumanHand.ICON_SCALE * 1.8,
      alpha: 1,
      duration: BALANCE.HAND_DESCEND_MS,
      ease: 'Power3.easeIn',
    })

    this.phaseTimer = this.scene.time.addEvent({
      delay: BALANCE.HAND_DESCEND_MS,
      callback: this.beginStrike,
      callbackScope: this,
    })
  }

  private beginStrike(): void {
    this.phase = 'strike'

    this.warnIcon.setAlpha(0).setScale(HumanHand.ICON_SCALE)
    this.strikeCircle.setAlpha(0.9)

    this.scene.tweens.add({
      targets: this.strikeCircle,
      alpha: 0, scaleX: 1.5, scaleY: 1.5,
      duration: BALANCE.HAND_STRIKE_MS,
      ease: 'Power2',
    })
    this.scene.tweens.add({
      targets: this.warnCircle,
      alpha: 0,
      duration: BALANCE.HAND_STRIKE_MS,
    })

    this.phaseTimer = this.scene.time.addEvent({
      delay: BALANCE.HAND_STRIKE_MS,
      callback: this.beginCooldown,
      callbackScope: this,
    })
  }

  private beginCooldown(): void {
    this.phase = 'cooldown'
    this.warnCircle.setScale(1)
    this.strikeCircle.setScale(1)

    this.phaseTimer = this.scene.time.addEvent({
      delay: this.calcNextInterval(),
      callback: this.beginWarn,
      callbackScope: this,
    })
  }

  // --------------------------------------------------
  // Private ヘルパー
  // --------------------------------------------------

  /** フェーズ別の当たり判定半径 */
  private hitRadius(): number {
    if (this.alertLevel === 4) return BALANCE.HAND_HIT_RADIUS_PH4
    if (this.alertLevel === 3) return BALANCE.HAND_HIT_RADIUS_PH3
    if (this.alertLevel === 2) return BALANCE.HAND_HIT_RADIUS_PH2
    return BALANCE.HAND_HIT_RADIUS_PH1
  }

  /** フェーズ別のターゲット散布半径 (999 = 完全ランダム) */
  private scatterRadius(): number {
    if (this.alertLevel === 4) return BALANCE.HAND_SCATTER_PH4
    if (this.alertLevel === 3) return BALANCE.HAND_SCATTER_PH3
    if (this.alertLevel === 2) return BALANCE.HAND_SCATTER_PH2
    return BALANCE.HAND_SCATTER_PH1
  }

  private checkHit(): void {
    const dist = Phaser.Math.Distance.Between(
      this.playerX, this.playerY, this.targetX, this.targetY
    )
    if (dist <= this.hitRadius()) {
      this.phase = 'cooldown'
      this.onHit()
    }
  }

  /**
   * 次の攻撃インターバルを計算する
   *   Ph1: ×1.0  通常
   *   Ph2: ×0.7  30%短縮
   *   Ph3: ×0.5  50%短縮
   *   Ph4: ×0.4  60%短縮 (即時攻撃と重なり高頻度)
   */
  private calcNextInterval(): number {
    const rampRatio = Math.min(1, this.elapsedMs / BALANCE.HAND_RAMP_MS)
    const base = Phaser.Math.Linear(
      BALANCE.HAND_INTERVAL_MAX_MS,
      BALANCE.HAND_INTERVAL_MIN_MS,
      rampRatio
    )

    const levelMult = this.alertLevel === 4 ? 0.4
      : this.alertLevel === 3 ? 0.5
      : this.alertLevel === 2 ? 0.7
      : 1.0

    return base * levelMult + BALANCE.HAND_COOLDOWN_MS
  }
}
