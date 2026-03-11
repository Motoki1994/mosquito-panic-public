import Phaser from 'phaser'
import { GAME_WIDTH, GAME_HEIGHT } from '../data/constants'
import { BALANCE } from '../data/balance'

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

  /** Current body texture key to avoid redundant setTexture calls */
  private currentBodyKey: string = 'body_empty'

  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null
  private wasd: {
    up: Phaser.Input.Keyboard.Key
    down: Phaser.Input.Keyboard.Key
    left: Phaser.Input.Keyboard.Key
    right: Phaser.Input.Keyboard.Key
  } | null = null

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene

    // Body — 256×256 displayed at ~40px (scale 0.16)
    const BODY_SCALE = 0.16
    const WING_SCALE = 0.18

    this.body = scene.add.image(0, 0, 'body_empty').setScale(BODY_SCALE)

    // Wings attach at the thorax (upper body).
    // x=±12: root overlaps body edge by ~12px (naturally attached), tip extends ~7px beyond body.
    // y=-10: aligns with upper-thorax zone (body content top is at y≈-19.5 rendered).
    this.wingL = scene.add.image(-12, -50, 'wing_left').setScale(WING_SCALE)
    this.wingR = scene.add.image( 12, -50, 'wing_right').setScale(WING_SCALE)

    // Render order: body first (bottom), then wings on top.
    // In Phaser containers, later items in the array are drawn over earlier ones.
    this.container = scene.add.container(x, y, [this.body, this.wingL, this.wingR])
    this.container.setDepth(10)

    // Wing flap tween — rotate around Y axis via scaleY
    scene.tweens.add({
      targets: this.wingL,
      scaleY: -WING_SCALE,
      duration: 70,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
    scene.tweens.add({
      targets: this.wingR,
      scaleY: -WING_SCALE,
      duration: 70,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

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

  destroy(): void { this.container.destroy() }

  // --------------------------------------------------

  private handleMovement(delta: number): void {
    const dt = delta / 1000
    let vx = 0, vy = 0

    if (this.cursors?.left.isDown  || this.wasd?.left.isDown)  vx -= 1
    if (this.cursors?.right.isDown || this.wasd?.right.isDown) vx += 1
    if (this.cursors?.up.isDown    || this.wasd?.up.isDown)    vy -= 1
    if (this.cursors?.down.isDown  || this.wasd?.down.isDown)  vy += 1

    if (vx !== 0 && vy !== 0) { vx /= Math.SQRT2; vy /= Math.SQRT2 }

    this.container.x += vx * this.currentSpeed * dt
    this.container.y += vy * this.currentSpeed * dt

    // Flip sprite to face direction
    if (vx < 0)      this.container.setScale(-1, 1)
    else if (vx > 0) this.container.setScale(1, 1)

    const margin = 12
    this.container.x = Phaser.Math.Clamp(this.container.x, margin, GAME_WIDTH  - margin)
    this.container.y = Phaser.Math.Clamp(this.container.y, margin, GAME_HEIGHT - margin)

    this.lastMoveSpeed = Math.sqrt(vx * vx + vy * vy) * this.currentSpeed
  }
}
