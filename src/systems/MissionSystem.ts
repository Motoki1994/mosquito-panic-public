import { BALANCE } from '../data/balance'

export type MissionReward = 'hourglass' | 'sugar_drop' | 'calm_mist' | 'shield'

export interface MissionState {
  label: string
  description: string
  current: number
  target: number
  progressFormat: 'count' | 'time' | 'none'
}

interface MissionDef {
  label: string
  description: string
  progressFormat: 'count' | 'time' | 'none'
  targetValue: number
  defaultReward: MissionReward
}

const MISSION_POOL: MissionDef[] = [
  {
    label: 'BITE RUSH',
    description: 'BITE 3 TARGETS',
    progressFormat: 'count',
    targetValue: 3,
    defaultReward: 'hourglass',
  },
  {
    label: 'GREEDY RUN',
    description: 'DELIVER 75%+ BLOOD',
    progressFormat: 'none',
    targetValue: 75,
    defaultReward: 'sugar_drop',
  },
  {
    label: 'GHOST FLIGHT',
    description: 'SURVIVE 10s NO BITE',
    progressFormat: 'time',
    targetValue: 10,
    defaultReward: 'calm_mist',
  },
]

type ActiveMission = MissionDef & {
  current: number
  timer: number  // elapsed time since mission started (for timeout)
}

type CompletedResult = { reward: MissionReward }

/**
 * MissionSystem
 * ランダムミッションのトリガー・進行・報酬を管理する
 * GameScene が毎フレーム update() を呼び、完了時に報酬を受け取る
 */
export class MissionSystem {
  private cooldown: number = BALANCE.MISSION_INITIAL_DELAY_SEC
  private activeMission: ActiveMission | null = null

  /**
   * 毎フレーム更新
   * @param dt フレーム時間 (秒)
   * @param isSucking 吸血中かどうか (GHOST FLIGHT ミッション用)
   * @returns ミッション完了時は { reward } を返す、それ以外は null
   */
  update(dt: number, isSucking: boolean): CompletedResult | null {
    if (this.activeMission) {
      this.activeMission.timer += dt

      // タイムアウト — 制限時間内に完了しなければキャンセル
      if (this.activeMission.timer > BALANCE.MISSION_TIMEOUT_SEC) {
        this.activeMission = null
        return null
      }

      // GHOST FLIGHT: 継続的な無吸血時間を追跡
      if (this.activeMission.label === 'GHOST FLIGHT') {
        if (!isSucking) {
          this.activeMission.current += dt
        } else {
          this.activeMission.current = 0  // 吸血でリセット
        }
        if (this.activeMission.current >= this.activeMission.targetValue) {
          return this._complete()
        }
      }

      return null
    }

    // ミッション待機中 — クールダウン消化
    this.cooldown -= dt
    if (this.cooldown <= 0) {
      this._startNew()
      this.cooldown = BALANCE.MISSION_INTERVAL_MIN_SEC
        + Math.random() * (BALANCE.MISSION_INTERVAL_MAX_SEC - BALANCE.MISSION_INTERVAL_MIN_SEC)
    }

    return null
  }

  /**
   * ターゲット(血液スポット)を吸い切ったときに呼ぶ
   * BITE RUSH ミッション用
   */
  onTargetCollected(): CompletedResult | null {
    if (!this.activeMission || this.activeMission.label !== 'BITE RUSH') return null
    this.activeMission.current++
    if (this.activeMission.current >= this.activeMission.targetValue) {
      return this._complete()
    }
    return null
  }

  /**
   * 納品が完了したときに呼ぶ
   * GREEDY RUN ミッション用
   * @param bloodPct 納品時の血液量 (0〜1)
   */
  onDelivery(bloodPct: number): CompletedResult | null {
    if (!this.activeMission || this.activeMission.label !== 'GREEDY RUN') return null
    if (bloodPct * 100 >= this.activeMission.targetValue) {
      return this._complete()
    }
    return null
  }

  /** 現在のアクティブミッション状態を返す (バナー表示用) */
  getActiveState(): MissionState | null {
    if (!this.activeMission) return null
    return {
      label:          this.activeMission.label,
      description:    this.activeMission.description,
      current:        this.activeMission.current,
      target:         this.activeMission.targetValue,
      progressFormat: this.activeMission.progressFormat,
    }
  }

  private _startNew(): void {
    const def = MISSION_POOL[Math.floor(Math.random() * MISSION_POOL.length)]
    this.activeMission = { ...def, current: 0, timer: 0 }
  }

  private _complete(): CompletedResult {
    const reward: MissionReward = Math.random() < BALANCE.MISSION_SHIELD_REWARD_CHANCE
      ? 'shield'
      : this.activeMission!.defaultReward
    this.activeMission = null
    return { reward }
  }
}
