import Phaser from 'phaser'
import { SCENE_KEYS } from '../data/constants'
import { uiController } from '../ui/uiController'
import { domRefs } from '../ui/domRefs'
import { HighScoreManager } from '../systems/HighScoreManager'
import { DailyBonusSystem } from '../systems/DailyBonusSystem'

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
    uiController.hideGameHUD()

    const record = HighScoreManager.load()
    uiController.showTitle(record?.total ?? null)

    const dailyBonus = new DailyBonusSystem()
    uiController.showDailyBonusOnTitle(dailyBonus.getBonus())

    // チュートリアルトグル: 初回プレイはON、2回目以降はOFF
    const playCount = parseInt(localStorage.getItem('mosquito_plays') ?? '0')
    domRefs.tutorialToggle.checked = playCount === 0

    uiController.onStartClick(() => {
      const showTutorial = domRefs.tutorialToggle.checked
      uiController.hideTitle()
      this.scene.start(SCENE_KEYS.GAME, { showTutorial })
    })
  }
}
