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

    // 「惜しかった」表示 — 新記録でなく、生存15秒以上、スコア差が50%以内のケース
    if (!isNewRecord && breakdown.survivalSec >= 15 && highScore) {
      const deficit = highScore.total - breakdown.total
      const scoreRate = breakdown.total / breakdown.survivalSec
      const closeEnough = highScore.total > 0 && deficit / highScore.total <= 0.5
      if (deficit > 0 && scoreRate > 0 && closeEnough) {
        const neededSec = Math.ceil(deficit / scoreRate)
        if (neededSec <= 90) {
          uiController.showNearMiss(neededSec, deficit)
        }
      }
    }

    // Enter キーでリトライ (マウス不要の即時リスタート)
    const enterHandler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      document.removeEventListener('keydown', enterHandler)
      uiController.hideResult()
      this.scene.start(SCENE_KEYS.GAME)
    }
    document.addEventListener('keydown', enterHandler)

    uiController.onRetryClick(() => {
      document.removeEventListener('keydown', enterHandler)
      uiController.hideResult()
      this.scene.start(SCENE_KEYS.GAME)
    })

    uiController.onBackToTitleClick(() => {
      document.removeEventListener('keydown', enterHandler)
      uiController.hideResult()
      this.scene.start(SCENE_KEYS.TITLE)
    })
  }
}
