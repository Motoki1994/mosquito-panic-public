import Phaser from 'phaser'
import { GAME_WIDTH, GAME_HEIGHT } from '../data/constants'
import { BALANCE } from '../data/balance'
import { JUICE } from '../data/juice'

/**
 * Player — mosquito sprite container
 *
 * Structure:
 *   container
 *    ├ wing_left  (Image, rotates on tween)
 *    ├ wing_right (Image, rotates on tween)
 *    └ body       (Image, texture swaps by blood level)
 *
 * Body texture keys: body_empty | body_25 | body_50 | body_100
 * Wing texture keys: wing_left  | wing_right
 */
export class Player {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private body: Phaser.GameObjects.Image
  private wingL: Phaser.GameObjects.Image
  private wingR: Phaser.GameObjects.Image

  /** Current movement speed — injected by WeightSystem */
  private currentSpeed: number = BALANCE.PLAYER_BASE_SPEED

  /** Actual speed last frame — read by AlertSystem */
  private lastMoveSpeed: number = 0

  /** Wobble tween reference for full-blood effect */
  private wobbleTween: Phaser.Tweens.Tween | null = null
  private isWobbling: boolean = false

  /** 慣性付き速度 (px/s) — 加速度で目標値に追従する */
  private velX: number = 0
  private velY: number = 0

  /** 羽ばたきトゥイーン (移動時に速める) */
  private flapTweens: Phaser.Tweens.Tween[] = []

  /** 吸血中の body パルストゥイーン */
  private suckTween: Phaser.Tweens.Tween | null = null
  private isSuckingVisual: boolean = false

  /** Current body texture key to avoid redundant setTexture calls */
  private currentBodyKey: string = 'body_empty'

  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null
  private wasd: {
    up: Phaser.Input.Keyboard.Key
    down: Phaser.Input.Keyboard.Key
    left: Phaser.Input.Keyboard.Key
    right: Phaser.Input.Keyboard.Key
  } | null = null
  private touchInput = { x: 0, y: 0 }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene

    // Body — 256×256 displayed at ~40px (scale 0.16)
    const BODY_SCALE = 0.16
    const WING_SCALE = 0.18

    this.body = scene.add.image(0, 0, 'body_empty').setScale(BODY_SCALE)

    // Wings attach at the thorax (upper body).
    // x=±12: root overlaps body edge by ~12px (naturally attached), tip extends ~7px beyond body.
    // y=-10: aligns with upper-thorax zone (body content top is at y≈-19.5 rendered).
    this.wingL = scene.add.image(-10, -5, 'wing_left').setScale(WING_SCALE)
    this.wingR = scene.add.image( 10, -5, 'wing_right').setScale(WING_SCALE)

    // Render order: body first (bottom), then wings on top.
    // In Phaser containers, later items in the array are drawn over earlier ones.
    this.container = scene.add.container(x, y, [this.body, this.wingL, this.wingR])
    this.container.setDepth(10)

    // Wing flap tween — rotate around Y axis via scaleY
    this.flapTweens = [
      scene.tweens.add({
        targets: this.wingL,
        scaleY: -WING_SCALE,
        duration: 70,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
      scene.tweens.add({
        targets: this.wingR,
        scaleY: -WING_SCALE,
        duration: 70,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    ]

    // Keyboard
    if (scene.input.keyboard) {
      this.cursors = scene.input.keyboard.createCursorKeys()
      this.wasd = {
        up:    scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down:  scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left:  scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      }
    }
  }

  update(delta: number): void {
    this.handleMovement(delta)
  }

  setSpeed(speed: number): void {
    this.currentSpeed = speed
  }

  /**
   * Switch body texture and apply wobble at 100%.
   * Called every frame by GameScene via applyWeight().
   */
  updateBodyScale(bloodPercent: number): void {
    // Select body texture
    const key = bloodPercent >= 1.0 ? 'body_100'
               : bloodPercent >= 0.5 ? 'body_50'
               : bloodPercent >= 0.25 ? 'body_25'
               : 'body_empty'

    if (key !== this.currentBodyKey) {
      this.body.setTexture(key)
      this.currentBodyKey = key
    }

    // Full-blood belly wobble (scale ~1.05, yoyo)
    if (bloodPercent >= 1.0 && !this.isWobbling) {
      this.isWobbling = true
      // 吸血パルスと競合しないよう停止する
      this.suckTween?.stop()
      this.suckTween = null
      this.wobbleTween = this.scene.tweens.add({
        targets: this.body,
        scaleX: 0.16 * 1.06,
        scaleY: 0.16 * 1.06,
        duration: 220,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    } else if (bloodPercent < 1.0 && this.isWobbling) {
      this.isWobbling = false
      this.wobbleTween?.stop()
      this.body.setScale(0.16)
    }

    // Wing opacity dims as blood increases (looks heavier)
    const wingAlpha = Phaser.Math.Linear(0.9, 0.4, bloodPercent)
    this.wingL.setAlpha(wingAlpha)
    this.wingR.setAlpha(wingAlpha)
  }

  getMoveSpeed(): number { return this.lastMoveSpeed }
  getPosition(): { x: number; y: number } { return { x: this.container.x, y: this.container.y } }
  getSprite(): Phaser.GameObjects.Container { return this.container }

  setTouchInput(x: number, y: number): void {
    this.touchInput.x = Phaser.Math.Clamp(x, -1, 1)
    this.touchInput.y = Phaser.Math.Clamp(y, -1, 1)
  }

  /**
   * 吸血中の視覚フィードバック — body を 6Hz でパルスさせる
   * (満タンの wobble 中はそちらを優先)
   */
  setSucking(active: boolean): void {
    if (active === this.isSuckingVisual) return
    this.isSuckingVisual = active

    if (active && !this.isWobbling) {
      const halfPeriodMs = 1000 / JUICE.SUCK_PULSE_HZ / 2
      this.suckTween = this.scene.tweens.add({
        targets: this.body,
        scaleX: 0.16 * 1.06,
        scaleY: 0.16 * 1.06,
        duration: halfPeriodMs,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    } else if (!active) {
      this.suckTween?.stop()
      this.suckTween = null
      if (!this.isWobbling) this.body.setScale(0.16)
    }
  }

  /**
   * 風などの外力をプレイヤー位置に加算する
   * handleMovement() の後に GameScene から呼ぶ
   * @param windX  X方向の力 (px/s)
   * @param windY  Y方向の力 (px/s)
   * @param dt     フレーム間隔 (秒)
   */
  applyWind(windX: number, windY: number, dt: number): void {
    this.container.x += windX * dt
    this.container.y += windY * dt
    const margin = 12
    this.container.x = Phaser.Math.Clamp(this.container.x, margin, GAME_WIDTH  - margin)
    this.container.y = Phaser.Math.Clamp(this.container.y, margin, GAME_HEIGHT - margin)
  }

  destroy(): void { this.container.destroy() }

  // --------------------------------------------------

  private handleMovement(delta: number): void {
    const dt = delta / 1000
    let ix = 0, iy = 0

    if (this.cursors?.left.isDown  || this.wasd?.left.isDown)  ix -= 1
    if (this.cursors?.right.isDown || this.wasd?.right.isDown) ix += 1
    if (this.cursors?.up.isDown    || this.wasd?.up.isDown)    iy -= 1
    if (this.cursors?.down.isDown  || this.wasd?.down.isDown)  iy += 1

    ix += this.touchInput.x
    iy += this.touchInput.y

    const inputLen = Math.hypot(ix, iy)
    if (inputLen > 1) {
      ix /= inputLen
      iy /= inputLen
    }

    // 慣性: 目標速度へ加速度追従 (入力あり=ACCEL / なし=DECEL)
    const targetVx = ix * this.currentSpeed
    const targetVy = iy * this.currentSpeed
    const hasInput = ix !== 0 || iy !== 0
    const follow = Math.min(1, (hasInput ? JUICE.PLAYER_ACCEL : JUICE.PLAYER_DECEL) * dt)
    this.velX += (targetVx - this.velX) * follow
    this.velY += (targetVy - this.velY) * follow

    this.container.x += this.velX * dt
    this.container.y += this.velY * dt

    // Flip sprite to face direction (入力ベース)
    if (ix < 0)      this.container.setScale(-1, 1)
    else if (ix > 0) this.container.setScale(1, 1)

    // バンキング: 横方向の速度に応じて機体を傾ける
    // (回転はスケール反転より後に適用されるため、左右どちら向きでも符号補正は不要)
    const bankRatio = Phaser.Math.Clamp(this.velX / BALANCE.PLAYER_BASE_SPEED, -1, 1)
    this.container.setRotation(bankRatio * JUICE.PLAYER_BANK_MAX_RAD)

    // 移動中は羽ばたきを速める
    const moving = Math.abs(this.velX) + Math.abs(this.velY) > 20
    const flapScale = moving ? JUICE.WING_FLAP_MOVE_SCALE : 1
    for (const t of this.flapTweens) t.timeScale = flapScale

    const margin = 12
    this.container.x = Phaser.Math.Clamp(this.container.x, margin, GAME_WIDTH  - margin)
    this.container.y = Phaser.Math.Clamp(this.container.y, margin, GAME_HEIGHT - margin)

    this.lastMoveSpeed = Math.sqrt(this.velX * this.velX + this.velY * this.velY)
  }
}
