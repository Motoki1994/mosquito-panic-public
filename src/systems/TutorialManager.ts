/**
 * TutorialManager (auto-play demo)
 *
 * Step 0: intro + baby highlight         (3.0s auto)
 * Step 1: demo mosquito bites target     (3.5s auto)
 * Step 2: demo mosquito delivers         (3.5s auto)
 * Step 3: danger / greed tip text        (2.5s auto)
 * Step 4: "PRESS ENTER TO START"         (waits for confirmStart())
 */
export type TutorialStep = 0 | 1 | 2 | 3 | 4

export class TutorialManager {
  private _step: TutorialStep = 0
  private _done = false
  private _waitingForEnter = false
  private stepTimer = 0

  private static readonly DURATIONS: Partial<Record<TutorialStep, number>> = {
    0: 3.0,
    1: 3.5,
    2: 3.5,
    3: 2.5,
    // step 4: no timer — waits for confirmStart()
  }

  getStep(): TutorialStep            { return this._step }
  isDone(): boolean                  { return this._done }
  isActive(): boolean                { return !this._done }
  isWaitingForEnter(): boolean       { return this._waitingForEnter }

  update(dt: number): void {
    if (this._done || this._waitingForEnter) return
    this.stepTimer += dt

    const duration = TutorialManager.DURATIONS[this._step]
    if (duration !== undefined && this.stepTimer >= duration) {
      this.advance()
    }
  }

  /** ENTER/SPACE pressed at final step — starts the real run */
  confirmStart(): void {
    if (this._waitingForEnter) {
      this._done = true
      this._waitingForEnter = false
    }
  }

  /** S キー / スキップボタンで step 4 (PRESS ENTER TO START) に直接ジャンプ */
  skipToEnd(): void {
    if (this._done || this._waitingForEnter) return
    this.stepTimer = 0
    this._step = 4 as TutorialStep
    this._waitingForEnter = true
  }

  /** チュートリアル設定が OFF の場合に即完了扱いにする */
  forceComplete(): void {
    this._done = true
    this._waitingForEnter = false
  }

  private advance(): void {
    this.stepTimer = 0
    const next = (this._step + 1) as TutorialStep
    if (next >= 4) {
      this._step = 4 as TutorialStep
      this._waitingForEnter = true
    } else {
      this._step = next
    }
  }
}
