import Phaser from 'phaser'
import { SCENE_KEYS } from '../data/constants'
import { uiController } from '../ui/uiController'
import { ScoreBreakdown } from '../systems/ScoreSystem'
import { HighScoreManager } from '../systems/HighScoreManager'

/**
 * ResultScene
 * ゲームオーバー後のリザルト表示を担当する。
 */
export class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.RESULT })
  }

  create(data: { breakdown: ScoreBreakdown }): void {
    // フォールバック値は新しい ScoreBreakdown 型に合わせる
    const breakdown: ScoreBreakdown = data?.breakdown ?? {
      deliveryScore: 0,
      deliveryCount: 0,
      total: 0,
      survivalSec: 0,
    }

    const isNewRecord = HighScoreManager.save(breakdown)
    const highScore = HighScoreManager.load()

    uiController.showResult(breakdown, highScore?.total ?? breakdown.total, isNewRecord)

    uiController.onRetryClick(() => {
      uiController.hideResult()
      this.scene.start(SCENE_KEYS.GAME)
    })
  }
}
