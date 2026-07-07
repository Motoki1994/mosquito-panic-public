import Phaser from 'phaser'
import { GAME_WIDTH, GAME_HEIGHT } from './data/constants'
import { BootScene } from './scenes/BootScene'
import { TitleScene } from './scenes/TitleScene'
import { GameScene } from './scenes/GameScene'
import { ResultScene } from './scenes/ResultScene'
import { sfx } from './systems/SfxManager'
import { initResponsiveScale } from './ui/responsiveScale'

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

const game = new Phaser.Game(config)

// 開発時のみ: 動作検証用のデバッグハンドル
if (import.meta.env.DEV) {
  (window as unknown as { __game: Phaser.Game }).__game = game
}

// --------------------------------------------------
// レスポンシブ対応 — ゲーム全体をビューポートに合わせて一様スケール
// --------------------------------------------------
initResponsiveScale()

// --------------------------------------------------
// オーディオ初期化 (autoplay policy 対応)
// 最初のユーザージェスチャで AudioContext を起動する
// --------------------------------------------------
const initAudio = () => sfx.init()
document.addEventListener('pointerdown', initAudio, { once: true })
document.addEventListener('keydown', initAudio, { once: true })

// --------------------------------------------------
// ボタン操作音 — 全ボタンに委譲で hover / click 音を付ける
// --------------------------------------------------
let lastHoverBtn: Element | null = null
document.addEventListener('mouseover', (e) => {
  const btn = (e.target as HTMLElement).closest?.('button')
  if (btn && btn !== lastHoverBtn) {
    lastHoverBtn = btn
    sfx.play('uiHover')
  } else if (!btn) {
    lastHoverBtn = null
  }
})
document.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest?.('button')) {
    sfx.play('uiClick')
  }
})
