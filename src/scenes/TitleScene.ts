import Phaser from 'phaser'
import { SCENE_KEYS } from '../data/constants'
import { uiController } from '../ui/uiController'
import { HighScoreManager } from '../systems/HighScoreManager'

/**
 * TitleScene
 * タイトル画面を表示し、ゲーム開始のトリガーを担当する。
 * ハイスコアをタイトルに表示する。
 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.TITLE })
  }

  create(): void {
    const record = HighScoreManager.load()
    uiController.showTitle(record?.total ?? null)

    uiController.onStartClick(() => {
      uiController.hideTitle()
      this.scene.start(SCENE_KEYS.GAME)
    })
  }
}
