import Phaser from 'phaser'
import { GAME_WIDTH, GAME_HEIGHT } from './data/constants'
import { BootScene } from './scenes/BootScene'
import { TitleScene } from './scenes/TitleScene'
import { GameScene } from './scenes/GameScene'
import { ResultScene } from './scenes/ResultScene'

/**
 * Phaserゲーム設定
 * Canvas描画はゲームプレイ専用。UIはindex.htmlのDOMで管理する。
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  scene: [BootScene, TitleScene, GameScene, ResultScene],
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
}

new Phaser.Game(config)
