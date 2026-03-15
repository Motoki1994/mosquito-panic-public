import Phaser from 'phaser'
import { BALANCE } from '../data/balance'
import { GAME_WIDTH, GAME_HEIGHT } from '../data/constants'

interface SmokeZone {
  x: number
  y: number
  lifetime: number      // 残り寿命 (秒)
  graphics: Phaser.GameObjects.Graphics
  label: Phaser.GameObjects.Text
}

/**
 * SmokeSystem
 * 責務: 蚊取り線香の煙エリアの管理
 *
 * - SMOKE_START_SCORE を超えると煙エリアが出現し始める
 * - 最大 SMOKE_MAX_ZONES 個の円形エリアを同時に管理
 * - プレイヤーが進入するとアラートが急上昇 (externalAlertMult を 4倍に)
 * - ゾーンは SMOKE_MIN〜MAX_LIFETIME_SEC 後に自然消滅
 * - 新ゾーンは SPAWN_COOLDOWN_MIN〜MAX_SEC ごとに生成
 *
 * 呼び出し側 (GameScene) は update() が返す boolean を
 * AlertSystem.update() の externalMult 計算に使用する。
 */
export class SmokeSystem {
  private scene: Phaser.Scene
  private zones: SmokeZone[] = []
  private spawnCooldown: number
  private unlocked = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.spawnCooldown = BALANCE.SMOKE_SPAWN_COOLDOWN_MIN_SEC +
      Math.random() * (BALANCE.SMOKE_SPAWN_COOLDOWN_MAX_SEC - BALANCE.SMOKE_SPAWN_COOLDOWN_MIN_SEC)
  }

  /**
   * 毎フレーム呼ぶ。プレイヤーが煙エリア内にいれば true を返す。
   * @param dt      フレーム間隔 (秒)
   * @param score   現在のスコア
   * @param playerX プレイヤー X
   * @param playerY プレイヤー Y
   */
  update(dt: number, score: number, playerX: number, playerY: number): boolean {
    if (!this.unlocked) {
      if (score < BALANCE.SMOKE_START_SCORE) return false
      this.unlocked = true
    }

    // 既存ゾーンの更新 & 寿命切れ削除
    this.zones = this.zones.filter(z => {
      z.lifetime -= dt
      // 残り5秒でフェードアウト開始
      if (z.lifetime <= 5) {
        z.graphics.setAlpha(Math.max(0, z.lifetime / 5) * 0.35)
        z.label.setAlpha(Math.max(0, z.lifetime / 5))
      }
      if (z.lifetime <= 0) {
        z.graphics.destroy()
        z.label.destroy()
        return false
      }
      return true
    })

    // 新ゾーン生成
    if (this.zones.length < BALANCE.SMOKE_MAX_ZONES) {
      this.spawnCooldown -= dt
      if (this.spawnCooldown <= 0) {
        this.spawnZone()
        this.spawnCooldown = BALANCE.SMOKE_SPAWN_COOLDOWN_MIN_SEC +
          Math.random() * (BALANCE.SMOKE_SPAWN_COOLDOWN_MAX_SEC - BALANCE.SMOKE_SPAWN_COOLDOWN_MIN_SEC)
      }
    }

    // プレイヤーが煙の中にいるか判定
    return this.zones.some(z =>
      Phaser.Math.Distance.Between(playerX, playerY, z.x, z.y) <= BALANCE.SMOKE_RADIUS
    )
  }

  /** 煙エリアが1つ以上存在するか */
  hasActiveZones(): boolean {
    return this.unlocked && this.zones.length > 0
  }

  destroy(): void {
    this.zones.forEach(z => { z.graphics.destroy(); z.label.destroy() })
    this.zones = []
  }

  // --------------------------------------------------

  private spawnZone(): void {
    const margin = BALANCE.SMOKE_RADIUS + 40
    const MAX_TRIES = 40

    let x = 0, y = 0

    for (let i = 0; i < MAX_TRIES; i++) {
      x = margin + Math.random() * (GAME_WIDTH  - margin * 2)
      y = margin + Math.random() * (GAME_HEIGHT - margin * 2)

      // 中央(プレイヤー初期位置)から遠ざける
      if (Phaser.Math.Distance.Between(x, y, GAME_WIDTH / 2, GAME_HEIGHT / 2) < 120) continue

      // 既存ゾーンと重ならない
      const tooClose = this.zones.some(z =>
        Phaser.Math.Distance.Between(x, y, z.x, z.y) < BALANCE.SMOKE_RADIUS * 2.2)
      if (tooClose) continue

      break
    }

    const lifetime = BALANCE.SMOKE_MIN_LIFETIME_SEC +
      Math.random() * (BALANCE.SMOKE_MAX_LIFETIME_SEC - BALANCE.SMOKE_MIN_LIFETIME_SEC)

    // グラフィック描画
    const g = this.scene.add.graphics().setDepth(3)
    const r = BALANCE.SMOKE_RADIUS

    // 外縁リング
    g.lineStyle(2, 0x886688, 0.5)
    g.strokeCircle(x, y, r)

    // 内側塗り (薄い紫灰色)
    g.fillStyle(0x442244, 0.22)
    g.fillCircle(x, y, r)

    // 内側の薄いリング (2重で深みを出す)
    g.lineStyle(1, 0xaa88aa, 0.3)
    g.strokeCircle(x, y, r * 0.65)

    // ラベル
    const label = this.scene.add.text(x, y, '🌀', { fontSize: '14px' })
      .setOrigin(0.5)
      .setDepth(3)
      .setAlpha(0.7)

    // 出現フェードイン
    g.setAlpha(0)
    this.scene.tweens.add({
      targets: [g],
      alpha: 0.35,
      duration: 1200,
      ease: 'Power2',
    })

    // ゆっくりパルス
    this.scene.tweens.add({
      targets: g,
      alpha: 0.2,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    this.zones.push({ x, y, lifetime, graphics: g, label })
  }
}
