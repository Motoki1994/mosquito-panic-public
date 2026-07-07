import Phaser from 'phaser'
import { SCENE_KEYS } from '../data/constants'
import { uiController } from '../ui/uiController'
import { ScoreBreakdown } from '../systems/ScoreSystem'
import { HighScoreManager } from '../systems/HighScoreManager'
import { sfx } from '../systems/SfxManager'

/**
 * ResultScene
 * ゲームオーバー後のリザルト表示を担当する。
 *
 * 演出: 内訳スライドイン → TOTAL ロールアップ → NEW RECORD 演出
 * Enter 1回目 = 演出スキップ / 2回目 = リトライ
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

    // 「惜しかった」判定 — 新記録でなく、生存15秒以上、スコア差が50%以内のケース
    let nearMiss: { neededSec: number; deficit: number } | undefined
    if (!isNewRecord && breakdown.survivalSec >= 15 && highScore) {
      const deficit = highScore.total - breakdown.total
      const scoreRate = breakdown.total / breakdown.survivalSec
      const closeEnough = highScore.total > 0 && deficit / highScore.total <= 0.5
      if (deficit > 0 && scoreRate > 0 && closeEnough) {
        const neededSec = Math.ceil(deficit / scoreRate)
        if (neededSec <= 90) {
          nearMiss = { neededSec, deficit }
        }
      }
    }

    uiController.animateResult(breakdown, highScore?.total ?? breakdown.total, isNewRecord, nearMiss)

    // Enter キー: 演出中はスキップ、完了後はリトライ (マウス不要の即時リスタート)
    const enterHandler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      if (uiController.isResultAnimating()) {
        uiController.skipResultAnimation()
        return
      }
      document.removeEventListener('keydown', enterHandler)
      uiController.hideResult()
      this.scene.start(SCENE_KEYS.GAME, { showTutorial: false })
    }
    document.addEventListener('keydown', enterHandler)

    uiController.onRetryClick(() => {
      document.removeEventListener('keydown', enterHandler)
      uiController.hideResult()
      this.scene.start(SCENE_KEYS.GAME, { showTutorial: false })
    })

    uiController.onBackToTitleClick(() => {
      document.removeEventListener('keydown', enterHandler)
      uiController.hideResult()
      sfx.startMusic('title')
      this.scene.start(SCENE_KEYS.TITLE)
    })
  }
}
