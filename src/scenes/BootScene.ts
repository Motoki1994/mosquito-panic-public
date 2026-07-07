import Phaser from 'phaser'
import { SCENE_KEYS } from '../data/constants'

/**
 * BootScene
 * Loads all sprite and UI assets before transitioning to TitleScene.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.BOOT })
  }

  preload(): void {
    // Player body textures (blood level variants)
    this.load.image('body_empty', 'assets/sprites/mosquito/mosquito_body_back_empty.png')
    this.load.image('body_25',    'assets/sprites/mosquito/mosquito_body_back_25.png')
    this.load.image('body_50',    'assets/sprites/mosquito/mosquito_body_back_50.png')
    this.load.image('body_100',   'assets/sprites/mosquito/mosquito_body_back_100.png')

    // Player wing textures
    this.load.image('wing_left',  'assets/sprites/mosquito/mosquito_wing_left_back.png')
    this.load.image('wing_right', 'assets/sprites/mosquito/mosquito_wing_right_back.png')

    // UI panel mosquito character images
    this.load.image('ui_empty_normal', 'assets/ui/mosquito/mosquito_ui_empty_normal.png')
    this.load.image('ui_empty_alert',  'assets/ui/mosquito/mosquito_ui_empty_alert.png')
    this.load.image('ui_25_normal',    'assets/ui/mosquito/mosquito_ui_25_normal.png')
    this.load.image('ui_25_alert',     'assets/ui/mosquito/mosquito_ui_25_alert.png')
    this.load.image('ui_50_normal',    'assets/ui/mosquito/mosquito_ui_50_normal.png')
    this.load.image('ui_50_alert',     'assets/ui/mosquito/mosquito_ui_50_alert.png')
    this.load.image('ui_100_normal',   'assets/ui/mosquito/mosquito_ui_100_normal.png')
    this.load.image('ui_100_alert',    'assets/ui/mosquito/mosquito_ui_100_alert.png')
  }

  create(): void {
    this.generateParticleTextures()
    this.scene.start(SCENE_KEYS.TITLE)
  }

  /**
   * ジュース演出用のパーティクルテクスチャを実行時生成する (外部アセット不要)
   *   px_circle: 8px 白丸 / px_drop: 血滴形 / px_spark: 菱形スパーク
   */
  private generateParticleTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false)

    // 白丸
    g.fillStyle(0xffffff, 1)
    g.fillCircle(4, 4, 4)
    g.generateTexture('px_circle', 8, 8)
    g.clear()

    // 血滴 (丸 + 上に尖り) — tint で色を付ける前提の白
    g.fillStyle(0xffffff, 1)
    g.fillCircle(3, 6, 3)
    g.fillTriangle(3, 0, 1, 5, 5, 5)
    g.generateTexture('px_drop', 6, 9)
    g.clear()

    // 菱形スパーク
    g.fillStyle(0xffffff, 1)
    g.fillPoints([
      new Phaser.Geom.Point(3, 0),
      new Phaser.Geom.Point(6, 3),
      new Phaser.Geom.Point(3, 6),
      new Phaser.Geom.Point(0, 3),
    ], true)
    g.generateTexture('px_spark', 6, 6)
    g.destroy()
  }
}
