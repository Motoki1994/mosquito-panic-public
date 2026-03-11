import Phaser from 'phaser'
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT } from '../data/constants'
import { Player } from '../entities/Player'
import { SkinLayer } from '../entities/SkinLayer'
import { HumanHand } from '../entities/HumanHand'
import { DeliveryPoint } from '../entities/DeliveryPoint'
import { BloodSystem } from '../systems/BloodSystem'
import { WeightSystem } from '../systems/WeightSystem'
import { AlertSystem } from '../systems/AlertSystem'
import { ScoreSystem } from '../systems/ScoreSystem'
import { LeftPanel } from '../ui/LeftPanel'
import { BALANCE } from '../data/balance'

const TARGET_COUNT      = 4
const TARGET_MIN_DIST   = 150
const TARGET_MARGIN     = 80
const TARGET_RESPAWN_MS = 4000

export class GameScene extends Phaser.Scene {
  private player!: Player
  private skinLayer!: SkinLayer
  private hand!: HumanHand
  private deliveryPoint!: DeliveryPoint

  private bloodSystem!: BloodSystem
  private weightSystem!: WeightSystem
  private alertSystem!: AlertSystem
  private scoreSystem!: ScoreSystem
  private leftPanel!: LeftPanel

  private isGameOver = false

  // Ph4 overlay
  private ph4Overlay!: Phaser.GameObjects.Rectangle
  private ph4Warning!: Phaser.GameObjects.Text
  private ph4Active   = false

  private dpPos!: { x: number; y: number }
  private respawnTimers: Phaser.Time.TimerEvent[] = []

  constructor() { super({ key: SCENE_KEYS.GAME }) }

  create(): void {
    this.isGameOver     = false
    this.ph4Active      = false
    this.respawnTimers  = []

    this.bloodSystem  = new BloodSystem()
    this.weightSystem = new WeightSystem()
    this.alertSystem  = new AlertSystem()
    this.scoreSystem  = new ScoreSystem()

    this.leftPanel = new LeftPanel()
    this.leftPanel.reset()
    this.leftPanel.show()

    this.player = new Player(this, GAME_WIDTH / 2, GAME_HEIGHT / 2)

    // Skin DOM layer
    const gameContainer = document.getElementById('game-container')!
    this.skinLayer = new SkinLayer(gameContainer, (id) => this.onTargetDepleted(id))

    // Delivery position (needed before target placement)
    this.dpPos = this.findDeliveryPosition([])
    this.spawnInitialTargets()

    this.deliveryPoint = new DeliveryPoint(
      this, this.dpPos.x, this.dpPos.y,
      (bloodAmount, isFull) => this.onDelivery(bloodAmount, isFull),
    )

    this.hand = new HumanHand(this, () => this.triggerGameOver())

    // Ph4 overlays (depth above hand, below game-over flash)
    this.ph4Overlay = this.add.rectangle(GAME_WIDTH/2, GAME_HEIGHT/2, GAME_WIDTH, GAME_HEIGHT, 0xff0000, 0).setDepth(80)
    this.ph4Warning = this.add.text(GAME_WIDTH/2, GAME_HEIGHT/2 - 40, '⚠  WARNING  ⚠', {
      fontFamily: "'Press Start 2P', monospace",
      fontSize: '20px',
      color: '#ff2222',
    }).setOrigin(0.5).setAlpha(0).setDepth(81)
  }

  update(_t: number, delta: number): void {
    if (this.isGameOver) return
    const dt = delta / 1000

    this.player.update(delta)
    const pos = this.player.getPosition()

    const inSafeZone = this.deliveryPoint.isPlayerInside(pos.x, pos.y)

    // Suck from skin targets
    const canSuck = !this.bloodSystem.isFull()
    const { totalSucked, isSucking } = this.skinLayer.update(
      pos.x, pos.y,
      BALANCE.SUCK_OVERLAP_RADIUS,
      dt,
      BALANCE.SUCK_RATE,   // blood units/sec
      canSuck,
    )
    if (totalSucked > 0) {
      this.bloodSystem.add(totalSucked)
    }

    this.alertSystem.update(dt, isSucking, this.player.getMoveSpeed(), inSafeZone)
    this.applyWeight()
    this.scoreSystem.update(dt)

    this.deliveryPoint.update(
      pos.x, pos.y,
      this.bloodSystem.getAmount(),
      this.bloodSystem.isFull(),
    )

    if (!inSafeZone) {
      this.hand.update(dt, this.alertSystem.getLevel(), pos.x, pos.y)
    }

    this.updatePh4Effect()

    // Left panel sync
    const bp  = this.bloodSystem.getPercent()
    const lvl = this.alertSystem.getLevel()
    this.leftPanel.updateCharacter(bp, lvl)
    this.leftPanel.updateScore(this.scoreSystem.getBreakdown().total)
    this.leftPanel.updateBlood(bp * 100)
    this.leftPanel.updateAlert(this.alertSystem.getAmount(), lvl)
    this.leftPanel.updateTimer(dt)
    this.leftPanel.updateSpeed(this.weightSystem.lastRatio)
  }

  // --------------------------------------------------

  private spawnInitialTargets(): void {
    for (let i = 0; i < TARGET_COUNT; i++) this.placeTarget()
  }

  private placeTarget(): void {
    const margin   = TARGET_MARGIN
    const maxTries = 60

    const getExistingPositions = () =>
      [...this.skinLayer.targets.values()].map(t => ({ x: t.x, y: t.y }))

    for (let t = 0; t < maxTries; t++) {
      const x = Phaser.Math.Between(margin, GAME_WIDTH  - margin)
      const y = Phaser.Math.Between(margin, GAME_HEIGHT - margin)

      if (Phaser.Math.Distance.Between(x, y, GAME_WIDTH/2, GAME_HEIGHT/2) < 80) continue
      if (Phaser.Math.Distance.Between(x, y, this.dpPos.x, this.dpPos.y) < BALANCE.DELIVERY_MIN_DIST_FROM_SPOT) continue

      const tooClose = getExistingPositions().some(p =>
        Phaser.Math.Distance.Between(x, y, p.x, p.y) < TARGET_MIN_DIST)
      if (tooClose) continue

      this.skinLayer.addTarget(x, y)
      return
    }
    // Fallback
    this.skinLayer.addTarget(
      Phaser.Math.Between(margin, GAME_WIDTH  - margin),
      Phaser.Math.Between(margin, GAME_HEIGHT - margin),
    )
  }

  private onTargetDepleted(_id: number): void {
    const timer = this.time.addEvent({
      delay: TARGET_RESPAWN_MS,
      callback: () => { if (!this.isGameOver) this.placeTarget() },
    })
    this.respawnTimers.push(timer)
  }

  private findDeliveryPosition(_existingPositions: { x: number; y: number }[]): { x: number; y: number } {
    const margin = BALANCE.DELIVERY_EDGE_MARGIN
    for (let i = 0; i < 60; i++) {
      const x = Phaser.Math.Between(margin, GAME_WIDTH  - margin)
      const y = Phaser.Math.Between(margin, GAME_HEIGHT - margin)
      if (Phaser.Math.Distance.Between(x, y, GAME_WIDTH/2, GAME_HEIGHT/2) >= BALANCE.DELIVERY_MIN_DIST_FROM_PLAYER)
        return { x, y }
    }
    return { x: GAME_WIDTH - 120, y: GAME_HEIGHT - 100 }
  }

  private applyWeight(): void {
    const bp    = this.bloodSystem.getPercent()
    const speed = this.weightSystem.calcSpeed(bp)
    this.player.setSpeed(speed)
    this.player.updateBodyScale(bp)
    // ratio is stored in weightSystem.lastRatio for left panel
  }

  private updatePh4Effect(): void {
    const isRage = this.alertSystem.getLevel() === 4
    if (isRage === this.ph4Active) return
    this.ph4Active = isRage

    if (isRage) {
      this.tweens.killTweensOf([this.ph4Overlay, this.ph4Warning])
      this.tweens.add({ targets: this.ph4Overlay, alpha: 0.18, duration: 300, yoyo: true, repeat: -1 })
      this.tweens.add({ targets: this.ph4Warning, alpha: 1,    duration: 250, yoyo: true, repeat: -1 })
    } else {
      this.tweens.killTweensOf([this.ph4Overlay, this.ph4Warning])
      this.ph4Overlay.setAlpha(0)
      this.ph4Warning.setAlpha(0)
    }
  }

  private onDelivery(bloodAmount: number, isFull: boolean): void {
    this.scoreSystem.deliver(bloodAmount, isFull, this.alertSystem.getPercent())
    this.bloodSystem.reset()
    this.alertSystem.reduceOnDelivery(isFull)
  }

  private triggerGameOver(): void {
    if (this.isGameOver) return
    this.isGameOver = true

    this.leftPanel.hide()
    this.skinLayer.destroy()
    this.respawnTimers.forEach(t => t.destroy())

    const breakdown = this.scoreSystem.getBreakdown()
    const flash = this.add.rectangle(GAME_WIDTH/2, GAME_HEIGHT/2, GAME_WIDTH, GAME_HEIGHT, 0xff0000, 0.6).setDepth(95)

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 600,
      ease: 'Power2',
      onComplete: () => {
        this.hand.destroy()
        this.deliveryPoint.destroy()
        this.scene.start(SCENE_KEYS.RESULT, { breakdown })
      },
    })
  }
}
