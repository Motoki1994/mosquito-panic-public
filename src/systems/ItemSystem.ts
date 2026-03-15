import Phaser from 'phaser'
import { BALANCE } from '../data/balance'
import { GAME_WIDTH, GAME_HEIGHT } from '../data/constants'

export type ItemType =
  | 'hourglass' | 'calm_mist' | 'sugar_drop' | 'blood_boost' | 'smoke_filter' | 'shield'
  | 'rotten_blood' | 'panic_surge' | 'starvation_spike'

export interface ItemEffect {
  type: ItemType
  label: string
  isDebuff: boolean
}

// デバフタイプのセット
const DEBUFF_SET = new Set<ItemType>(['rotten_blood', 'panic_surge', 'starvation_spike'])

const ITEM_DEFS: Record<ItemType, { icon: string; label: string; color: number }> = {
  // ポジティブアイテム
  hourglass:         { icon: '⏳', label: '⏳ TIME FREEZE!',  color: 0xffdd44 },
  calm_mist:         { icon: '💨', label: '💨 CALM −20!',     color: 0x44ddff },
  sugar_drop:        { icon: '🍭', label: '🍭 FED BABIES!',   color: 0xff88cc },
  blood_boost:       { icon: '💉', label: '💉 BLOOD BOOST!',  color: 0xff4444 },
  smoke_filter:      { icon: '🔥', label: '🔥 SMOKE SHIELD!', color: 0x88ff44 },
  shield:            { icon: '🛡️', label: '🛡️ SHIELD UP!',   color: 0x4488ff },
  // デバフアイテム
  rotten_blood:      { icon: '🩸', label: 'ROTTEN BLOOD!',   color: 0x880000 },
  panic_surge:       { icon: '⚡', label: 'PANIC SURGE!',     color: 0x660044 },
  starvation_spike:  { icon: '💀', label: 'STARVATION SPIKE!', color: 0x553300 },
}

// ポジティブアイテムのスポーン候補 (hourglass / shield は別抽選)
const BUFF_TYPES: ItemType[] = ['calm_mist', 'sugar_drop', 'blood_boost', 'smoke_filter']
const DEBUFF_TYPES: ItemType[] = ['rotten_blood', 'panic_surge', 'starvation_spike']

const COLLECT_RADIUS    = 50
const BUFF_DESPAWN_SEC  = 10
const DEBUFF_DESPAWN_SEC = 16   // デバフは長めに残す
const MAX_BUFF_ITEMS    = 2
const WALL_MARGIN       = 22

interface ActiveItem {
  container: Phaser.GameObjects.Container
  type: ItemType
  x: number
  y: number
  lifeTimer: number
  isDebuff: boolean
  vx: number   // デバフのみ使用 (速度成分)
  vy: number
}

/**
 * ItemSystem
 * ポジティブアイテム (浮遊) とデバフアイテム (バウンド移動) を管理する
 * 効果の適用は GameScene 側で行う
 */
export class ItemSystem {
  private scene: Phaser.Scene
  private items: ActiveItem[] = []
  private buffCooldown: number  = 15   // ポジティブアイテム スポーン待機
  private debuffCooldown: number = 30  // デバフアイテム スポーン待機 (初期は長め)
  private randomSpawnTimer: number = 15 + Math.random() * 10  // 時間ベーススポーン

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /**
   * 毎フレーム更新
   * @returns 収集したアイテム効果、なければ null
   */
  update(
    dt: number,
    playerX: number,
    playerY: number,
    alertPercent: number,
    hungerPercent: number,
    stageId: string,
    isBehindPace: boolean,
  ): ItemEffect | null {

    // ポジティブアイテムのスポーン
    this.buffCooldown -= dt
    const buffCount = this.items.filter(i => !i.isDebuff).length
    if (this.buffCooldown <= 0 && buffCount < MAX_BUFF_ITEMS) {
      const shouldSpawn = alertPercent > 0.60
        || hungerPercent > 0.60
        || stageId === 'face'
        || isBehindPace
      if (shouldSpawn && Math.random() < 0.35) {
        this.spawnBuff(stageId)
      }
      this.buffCooldown = 15 + Math.random() * 10
    }

    // デバフアイテムのスポーン (FACEステージは最大2個・高確率・短クールダウン)
    this.debuffCooldown -= dt
    const debuffCount = this.items.filter(i => i.isDebuff).length
    const isFaceStage  = stageId === 'face'
    const maxDebuffs   = isFaceStage ? 2 : 1
    const debuffChance = isFaceStage ? Math.min(0.45, BALANCE.DEBUFF_SPAWN_CHANCE * 2.2) : BALANCE.DEBUFF_SPAWN_CHANCE
    if (this.debuffCooldown <= 0 && debuffCount < maxDebuffs) {
      if (Math.random() < debuffChance) {
        this.spawnDebuff()
      }
      this.debuffCooldown = isFaceStage ? 10 + Math.random() * 8 : 20 + Math.random() * 15
    }

    // 時間ベーススポーン — 15〜25秒ごとに強制的にアイテムを追加 (クラッチ救済)
    this.randomSpawnTimer -= dt
    if (this.randomSpawnTimer <= 0) {
      this.tryRandomSpawn(stageId)
      this.randomSpawnTimer = 15 + Math.random() * 10
    }

    // アイテム更新 (移動・寿命・収集判定)
    let collected: ItemEffect | null = null

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i]
      item.lifeTimer += dt

      if (item.isDebuff) {
        // --- バウンド移動 ---
        item.x += item.vx * dt
        item.y += item.vy * dt

        // 壁バウンス + 散布
        const spread = BALANCE.DEBUFF_BOUNCE_SPREAD
        if (item.x <= WALL_MARGIN) {
          item.x = WALL_MARGIN
          item.vx = Math.abs(item.vx)
          item.vy += (Math.random() - 0.5) * spread
        }
        if (item.x >= GAME_WIDTH - WALL_MARGIN) {
          item.x = GAME_WIDTH - WALL_MARGIN
          item.vx = -Math.abs(item.vx)
          item.vy += (Math.random() - 0.5) * spread
        }
        if (item.y <= WALL_MARGIN) {
          item.y = WALL_MARGIN
          item.vy = Math.abs(item.vy)
          item.vx += (Math.random() - 0.5) * spread
        }
        if (item.y >= GAME_HEIGHT - WALL_MARGIN) {
          item.y = GAME_HEIGHT - WALL_MARGIN
          item.vy = -Math.abs(item.vy)
          item.vx += (Math.random() - 0.5) * spread
        }

        // 速度を一定範囲に保つ (ランダム散布で速くなりすぎるのを防ぐ)
        const spd = Math.sqrt(item.vx * item.vx + item.vy * item.vy)
        if (spd > BALANCE.DEBUFF_SPEED_PX_S * 1.4) {
          item.vx = (item.vx / spd) * BALANCE.DEBUFF_SPEED_PX_S
          item.vy = (item.vy / spd) * BALANCE.DEBUFF_SPEED_PX_S
        }

        item.container.setPosition(item.x, item.y)

        if (item.lifeTimer >= DEBUFF_DESPAWN_SEC) {
          this.destroyItem(i); continue
        }
      } else {
        // --- 浮遊アニメーション ---
        item.container.y = item.y + Math.sin(item.lifeTimer * 2.5) * 6

        // 残り3秒で点滅
        if (item.lifeTimer >= BUFF_DESPAWN_SEC - 3) {
          item.container.setAlpha(Math.sin(item.lifeTimer * 8) * 0.5 + 0.5)
        }

        if (item.lifeTimer >= BUFF_DESPAWN_SEC) {
          this.destroyItem(i); continue
        }
      }

      // 収集判定
      const dist = Phaser.Math.Distance.Between(playerX, playerY, item.x, item.y)
      if (dist <= COLLECT_RADIUS) {
        const def = ITEM_DEFS[item.type]
        collected = { type: item.type, label: def.label, isDebuff: item.isDebuff }
        this.destroyItem(i)
        break
      }
    }

    return collected
  }

  /** ランダムなポジティブアイテムをスポーン */
  private spawnBuff(stageId: string): void {
    // LEG ステージでは sugar_drop を除外 (序盤の緊張感を維持するため)
    const pool = stageId === 'leg'
      ? BUFF_TYPES.filter(t => t !== 'sugar_drop')
      : BUFF_TYPES

    // 抽選テーブル (累積):
    //   5%  → shield
    //   6%  → hourglass (画面上に1個のみ。すでにある場合はスキップして通常アイテム)
    //   残り → pool からランダム
    const hasHourglass = this.items.some(i => i.type === 'hourglass')
    const r = Math.random()
    let type: ItemType
    if (r < 0.05) {
      type = 'shield'
    } else if (!hasHourglass && r < 0.11) {
      type = 'hourglass'
    } else {
      type = pool[Math.floor(Math.random() * pool.length)]
    }
    this.spawn(type, false)
  }

  /**
   * 時間ベーススポーン — 条件に関係なく定期的にアイテムを出現させる
   * 画面上のアイテム合計が上限に達している場合は何もしない
   */
  private tryRandomSpawn(stageId: string): void {
    const total = this.items.length
    if (total >= 5) return  // 5個以上なら過密なのでスキップ

    const count = Math.random() < 0.35 ? 2 : 1
    for (let i = 0; i < count; i++) {
      if (this.items.length >= 5) break
      // 25%でデバフ、75%でバフ (FACEは35%でデバフ)
      const debuffProb = stageId === 'face' ? 0.35 : 0.25
      if (Math.random() < debuffProb) {
        this.spawnDebuff()
      } else {
        this.spawnBuff(stageId)
      }
    }
  }

  /** ランダムなデバフアイテムをスポーン */
  private spawnDebuff(): void {
    const type = DEBUFF_TYPES[Math.floor(Math.random() * DEBUFF_TYPES.length)]
    this.spawn(type, true)
  }

  /** 特定タイプをスポーン (マイルストーン・ミッション報酬用) */
  spawnSpecific(type: ItemType): void {
    this.spawn(type, DEBUFF_SET.has(type))
  }

  private spawn(type: ItemType, isDebuff: boolean): void {
    const def = ITEM_DEFS[type]
    const x   = Phaser.Math.Between(70, GAME_WIDTH  - 70)
    const y   = Phaser.Math.Between(70, GAME_HEIGHT - 70)

    let container: Phaser.GameObjects.Container

    if (isDebuff) {
      // デバフ: 暗めの色 + 赤いリング + フリッカー
      const glow = this.scene.add.circle(0, 0, 26, def.color, 0.40)
      const ring = this.scene.add.circle(0, 0, 26, def.color, 0)
      ring.setStrokeStyle(2, 0xdd1111, 0.95)
      const txt = this.scene.add.text(0, 2, def.icon, { fontSize: '22px' }).setOrigin(0.5)

      container = this.scene.add.container(x, y, [glow, ring, txt])
      container.setDepth(50)

      // 不安定なフリッカーアニメーション
      this.scene.tweens.add({
        targets: container,
        alpha: 0.55,
        duration: 160 + Math.random() * 140,
        yoyo: true,
        repeat: -1,
        ease: 'Linear',
      })

      // 初期速度: ランダム方向
      const angle = Math.random() * Math.PI * 2
      const spd   = BALANCE.DEBUFF_SPEED_PX_S
      const vx    = Math.cos(angle) * spd
      const vy    = Math.sin(angle) * spd
      this.items.push({ container, type, x, y, lifeTimer: 0, isDebuff: true, vx, vy })

    } else {
      // ポジティブ: 明るい色 + 脈動グロー
      const glow = this.scene.add.circle(0, 0, 30, def.color, 0.25)
      const ring = this.scene.add.circle(0, 0, 30, def.color, 0)
      ring.setStrokeStyle(2, def.color, 0.9)
      const txt = this.scene.add.text(0, 2, def.icon, { fontSize: '26px' }).setOrigin(0.5)

      container = this.scene.add.container(x, y, [glow, ring, txt])
      container.setDepth(50)

      this.scene.tweens.add({
        targets: glow,
        alpha: 0.55,
        duration: 600,
        yoyo: true,
        repeat: -1,
      })

      this.items.push({ container, type, x, y, lifeTimer: 0, isDebuff: false, vx: 0, vy: 0 })
    }
  }

  private destroyItem(index: number): void {
    const item = this.items[index]
    this.scene.tweens.killTweensOf(item.container.list)
    this.scene.tweens.killTweensOf(item.container)
    item.container.destroy()
    this.items.splice(index, 1)
  }

  destroy(): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      this.destroyItem(i)
    }
  }
}
