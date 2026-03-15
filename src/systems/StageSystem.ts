import { BALANCE } from '../data/balance'
import { uiController } from '../ui/uiController'

export type StageId = 'leg' | 'arm' | 'face'

export interface StageConfig {
  id: StageId
  name: string
  difficulty: string
  alertMult: number
  scoreMult: number
  hungerMult: number
  threshold: number
}

const STAGES: StageConfig[] = [
  {
    id: 'leg', name: 'LEG', difficulty: 'NORMAL',
    alertMult:  BALANCE.STAGE_LEG_ALERT_MULT,
    scoreMult:  BALANCE.STAGE_LEG_SCORE_MULT,
    hungerMult: BALANCE.STAGE_LEG_HUNGER_MULT,
    threshold:  BALANCE.STAGE_LEG_THRESHOLD,
  },
  {
    id: 'arm', name: 'ARM', difficulty: 'HARD',
    alertMult:  BALANCE.STAGE_ARM_ALERT_MULT,
    scoreMult:  BALANCE.STAGE_ARM_SCORE_MULT,
    hungerMult: BALANCE.STAGE_ARM_HUNGER_MULT,
    threshold:  BALANCE.STAGE_ARM_THRESHOLD,
  },
  {
    id: 'face', name: 'FACE', difficulty: 'EXTREME',
    alertMult:  BALANCE.STAGE_FACE_ALERT_MULT,
    scoreMult:  BALANCE.STAGE_FACE_SCORE_MULT,
    hungerMult: BALANCE.STAGE_FACE_HUNGER_MULT,
    threshold:  BALANCE.STAGE_FACE_THRESHOLD,
  },
]

/**
 * StageSystem
 * LEG (0+) / ARM (5000+) / FACE (10000+)
 */
export class StageSystem {
  private currentIndex: number = 0

  constructor() {
    uiController.updateStageLabel(STAGES[0])
  }

  update(score: number): void {
    for (let i = STAGES.length - 1; i >= 0; i--) {
      if (score >= STAGES[i].threshold) {
        if (i !== this.currentIndex) {
          this.currentIndex = i
          const stage = STAGES[i]
          uiController.updateStageLabel(stage)
          if (i > 0) uiController.showStageChange(stage)
        }
        break
      }
    }
  }

  getAlertMult(): number  { return STAGES[this.currentIndex].alertMult }
  getScoreMult(): number  { return STAGES[this.currentIndex].scoreMult }
  getHungerMult(): number { return STAGES[this.currentIndex].hungerMult }

  getCurrentStage(): StageConfig { return STAGES[this.currentIndex] }

  reset(): void {
    this.currentIndex = 0
    uiController.updateStageLabel(STAGES[0])
  }
}
