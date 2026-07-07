import Phaser from 'phaser'
import { JUICE, MOTION_SCALE, DeliverTier } from '../data/juice'
import { GAME_WIDTH, GAME_HEIGHT } from '../data/constants'

export type DeathCause = 'hit' | 'starve'
type ShakeTier = keyof typeof JUICE.SHAKE

interface DeathState {
  cause: DeathCause
  t: number                 // 経過実時間 (ms)
  slowStarted: boolean
  target: Phaser.GameObjects.Container
  startX: number
  startY: number
  veil: Phaser.GameObjects.Rectangle
  onDone: () => void
  doneFired: boolean
}

/**
 * JuiceManager — Phaser 側の演出を一手に引き受ける
 *
 * - ヒットストップ: 論理 timeScale を保持し、GameScene が dt に掛ける。
 *   tweens / time マネージャの timeScale も同期するので予兆・アニメも一緒に止まる。
 * - タイマーは scene の UPDATE イベントで実時間駆動する
 *   (GameScene.update が early return しても演出は進む)
 * - 死亡シーケンスはトゥイーンを使わず実時間で手動アニメーション
 *   (スローモーション中も演出自体は正速で進む)
 */
export class JuiceManager {
  private scene: Phaser.Scene
  private timeScale = 1
  private hitStopLeftMs = 0
  private emitterCount = 0
  private bloodDripAt = 0
  private death: DeathState | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this)
      this.restore()
    })
  }

  /** GameScene が dt に掛ける論理 timeScale */
  getTimeScale(): number {
    return this.timeScale
  }

  // --------------------------------------------------
  // ヒットストップ
  // --------------------------------------------------

  hitStop(ms: number): void {
    if (ms <= 0 || this.death) return
    this.hitStopLeftMs = Math.max(this.hitStopLeftMs, ms * MOTION_SCALE)
    this.applyScale(JUICE.HITSTOP_SCALE)
  }

  private applyScale(s: number): void {
    this.timeScale = s
    this.scene.tweens.timeScale = s
    this.scene.time.timeScale = s
  }

  private restore(): void {
    this.hitStopLeftMs = 0
    this.death = null
    this.applyScale(1)
  }

  /** リトライ・チュートリアル開始時の安全リセット */
  reset(): void {
    this.restore()
  }

  // --------------------------------------------------
  // シェイク / フラッシュ
  // --------------------------------------------------

  shake(tier: ShakeTier): void {
    const [ms, intensity] = JUICE.SHAKE[tier]
    this.scene.cameras.main.shake(ms, intensity * MOTION_SCALE)
  }

  flash(ms: number, r: number, g: number, b: number): void {
    this.scene.cameras.main.flash(ms, r, g, b, true)
  }

  // --------------------------------------------------
  // パーティクル
  // --------------------------------------------------

  /** 納品バースト — 血滴 + (大納品なら) 金スパーク */
  deliveryBurst(x: number, y: number, tier: DeliverTier, isFull: boolean): void {
    const count = JUICE.PARTICLES[tier]
    this.burst(x, y, 'px_drop', count, {
      speed: { min: JUICE.PARTICLE_SPEED_MIN, max: JUICE.PARTICLE_SPEED_MAX },
      lifespan: { min: JUICE.PARTICLE_LIFE_MIN_MS, max: JUICE.PARTICLE_LIFE_MAX_MS },
      gravityY: JUICE.PARTICLE_GRAVITY_Y,
      scale: { start: 1.3, end: 0 },
      rotate: { min: 0, max: 360 },
      tint: 0xee2222,
    })
    if (tier === 'big' || tier === 'huge' || isFull) {
      this.burst(x, y, 'px_spark', Math.ceil(count / 2), {
        speed: { min: 150, max: 320 },
        lifespan: { min: 400, max: 650 },
        gravityY: 120,
        scale: { start: 1.5, end: 0 },
        tint: 0xffdd44,
      })
    }
    // リングエキスパンド
    this.ringPop(x, y, tier === 'huge' ? 0xffee66 : 0x66ffee, tier === 'small' ? 40 : 60)
  }

  /** アイテム取得のポップ (リング + スパーク) */
  collectPop(x: number, y: number, isDebuff: boolean): void {
    const color = isDebuff ? 0xff3333 : 0x88ffcc
    this.ringPop(x, y, color, 46)
    this.burst(x, y, 'px_spark', 8, {
      speed: { min: 60, max: 160 },
      lifespan: { min: 300, max: 500 },
      scale: { start: 1.2, end: 0 },
      tint: color,
    })
  }

  /** 満タン時の血垂れ (スロットル付き) — 毎フレーム呼んでよい */
  bloodDrip(x: number, y: number): void {
    const now = performance.now()
    if (now - this.bloodDripAt < JUICE.FULL_DRIP_INTERVAL_MS) return
    this.bloodDripAt = now
    this.burst(x, y + 10, 'px_drop', 1, {
      speed: { min: 15, max: 40 },
      lifespan: { min: 400, max: 600 },
      gravityY: 240,
      scale: { start: 1.0, end: 0.2 },
      alpha: { start: 0.9, end: 0 },
      tint: 0xcc1111,
      angle: { min: 70, max: 110 },
    })
  }

  /** ニアミス — 風圧リング + 小シェイク */
  nearMiss(x: number, y: number): void {
    this.shake('small')
    this.ringPop(x, y, 0xffffff, 70)
  }

  /** 血液100%到達の瞬間 — 金フラッシュリング */
  fullTankPop(x: number, y: number): void {
    this.ringPop(x, y, 0xffdd44, 55)
    this.burst(x, y, 'px_spark', 10, {
      speed: { min: 80, max: 200 },
      lifespan: { min: 300, max: 550 },
      scale: { start: 1.4, end: 0 },
      tint: 0xffdd44,
    })
  }

  /** マイルストーン祝祭 — 金パーティクル噴水 */
  milestoneFountain(huge: boolean): void {
    const cx = GAME_WIDTH / 2
    const count = huge ? 40 : 24
    this.burst(cx, GAME_HEIGHT - 40, 'px_spark', count, {
      speed: { min: 260, max: 460 },
      lifespan: { min: 900, max: 1300 },
      gravityY: 500,
      scale: { start: 1.6, end: 0 },
      angle: { min: 245, max: 295 },   // 真上方向の扇
      tint: huge ? [0xff5555, 0xffdd44, 0x55ff88, 0x5599ff] : 0xffdd44,
    })
    this.shake(huge ? 'big' : 'medium')
    this.flash(huge ? 400 : 250, 255, 215, 60)
  }

  private ringPop(x: number, y: number, color: number, radius: number): void {
    const ring = this.scene.add.circle(x, y, 10, color, 0)
      .setStrokeStyle(3, color, 0.9)
      .setDepth(62)
    const tween = this.scene.tweens.add({
      targets: ring,
      radius,
      alpha: 0,
      duration: 320,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    })
    // ヒットストップの影響を受けず一瞬で広がるよう補正
    tween.timeScale = 1 / Math.max(this.timeScale, 0.05)
  }

  private burst(
    x: number, y: number, texture: string, count: number,
    config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,
  ): void {
    if (this.emitterCount >= JUICE.MAX_EMITTERS) return
    this.emitterCount++
    const emitter = this.scene.add.particles(x, y, texture, { emitting: false, ...config })
    emitter.setDepth(60)
    emitter.explode(count)
    // 寿命が尽きた頃に破棄 (setTimeout: time.timeScale の影響を受けない)
    window.setTimeout(() => {
      this.emitterCount--
      if (emitter.scene) emitter.destroy()
    }, 1600)
  }

  // --------------------------------------------------
  // 死亡シーケンス
  // --------------------------------------------------

  /**
   * 被弾/餓死の死亡演出。完了時に onDone を呼ぶ (→ ResultScene 遷移)。
   *
   * hit:    フリーズ → スローモ + ズームイン + 蚊が赤く回転落下 → 赤ビネット
   * starve: フリーズ → スローモ + ズームイン + 蚊が力なく降下   → 青灰ビネット
   */
  deathSequence(cause: DeathCause, target: Phaser.GameObjects.Container, onDone: () => void): void {
    if (this.death) return
    const cam = this.scene.cameras.main

    // ① 完全フリーズ + フラッシュ
    this.applyScale(JUICE.HITSTOP_SCALE)
    if (cause === 'hit') {
      cam.flash(90, 255, 255, 255, true)
    } else {
      cam.flash(140, 120, 140, 180, true)
    }

    const veil = this.scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT,
      cause === 'hit' ? 0x990000 : 0x223344, 0,
    ).setDepth(95).setScrollFactor(0)

    this.death = {
      cause,
      t: 0,
      slowStarted: false,
      target,
      startX: target.x,
      startY: target.y,
      veil,
      onDone,
      doneFired: false,
    }
  }

  // --------------------------------------------------
  // 実時間ティック (scene UPDATE イベント)
  // --------------------------------------------------

  private tick(_time: number, delta: number): void {
    if (this.death) {
      this.updateDeath(delta)
      return
    }
    if (this.hitStopLeftMs > 0) {
      this.hitStopLeftMs -= delta
      if (this.hitStopLeftMs <= 0) {
        this.hitStopLeftMs = 0
        this.applyScale(1)
      }
    }
  }

  private updateDeath(delta: number): void {
    const d = this.death!
    d.t += delta
    const cam = this.scene.cameras.main

    // ② スローモーション開始 + ズーム + シェイク
    if (!d.slowStarted && d.t >= JUICE.DEATH_STOP_MS) {
      d.slowStarted = true
      this.applyScale(JUICE.DEATH_SLOW_SCALE)
      cam.zoomTo(JUICE.DEATH_ZOOM, JUICE.DEATH_ZOOM_MS, 'Sine.easeOut')
      cam.pan(d.startX, d.startY, JUICE.DEATH_ZOOM_MS, 'Sine.easeOut')
      this.shake('death')
    }

    // ③ 蚊の落下アニメーション (実時間・手動)
    if (d.slowStarted) {
      const p = Phaser.Math.Clamp((d.t - JUICE.DEATH_STOP_MS) / JUICE.DEATH_SPIN_MS, 0, 1)
      const easeIn = p * p
      if (d.cause === 'hit') {
        // 赤く染まって回転落下
        d.target.setRotation(Phaser.Math.DegToRad(540 * p))
        d.target.y = d.startY + 60 * easeIn
        d.target.setAlpha(1 - easeIn)
        d.target.iterate((child: Phaser.GameObjects.GameObject) => {
          (child as Phaser.GameObjects.Image).setTint?.(0xff2222)
        })
      } else {
        // 力なくゆっくり降下
        d.target.setRotation(Phaser.Math.DegToRad(35 * p))
        d.target.y = d.startY + 40 * easeIn
        d.target.setAlpha(1 - p * 0.85)
        d.target.iterate((child: Phaser.GameObjects.GameObject) => {
          (child as Phaser.GameObjects.Image).setTint?.(0x8899aa)
        })
      }
    }

    // ④ ビネットフェード
    if (d.t >= 900) {
      const vp = Phaser.Math.Clamp((d.t - 900) / 350, 0, 1)
      d.veil.setFillStyle(d.cause === 'hit' ? 0x990000 : 0x223344, vp * 0.45)
    }

    // ⑤ 完了 → ResultScene へ
    if (d.t >= JUICE.DEATH_TOTAL_MS && !d.doneFired) {
      d.doneFired = true
      const cb = d.onDone
      this.death = null
      this.applyScale(1)
      cam.resetFX()
      cam.zoom = 1
      cam.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2)
      cb()
    }
  }
}
