/**
 * UIController
 * PhaserシーンからDOMを直接操作することを禁止し、
 * このファイルを通じてのみUI更新を行う
 */

import { domRefs } from './domRefs'
import { ScoreBreakdown } from '../systems/ScoreSystem'
import { AlertLevel } from '../systems/AlertSystem'
import { StageConfig } from '../systems/StageSystem'
import { DailyBonus } from '../systems/DailyBonusSystem'
import { MissionState } from '../systems/MissionSystem'

/** 赤ちゃんの状態種別 */
export type BabyState = 'normal' | 'hungry' | 'dizzy' | 'excited'

/** アラートフェーズのラベル */
const ALERT_PHASE_LABELS: Record<AlertLevel, string> = {
  1: 'CALM',
  2: 'ALERT',
  3: 'DANGER',
  4: 'RAGE',
}

export const uiController = {

  // ==========================================
  // スコア
  // ==========================================

  updateScore(score: number): void {
    domRefs.score.textContent = Math.floor(score).toLocaleString('en-US')
  },

  /**
   * チェインコンボ + ティアコンボ表示を更新する
   * @param chain      連続納品チェイン数 (1=表示なし)
   * @param tierCombo  同一ティア連続数 (1=表示なし)
   * @param multiplier 現在の合計倍率
   */
  updateDeliveryCombo(chain: number, tierCombo: number, multiplier: number): void {
    const el = domRefs.comboDisplay
    const showChain = chain > 1
    const showTier  = tierCombo > 1

    if (!showChain && !showTier) {
      el.classList.add('hidden')
      return
    }
    el.classList.remove('hidden')

    const chainStr = showChain ? `⛓${chain} ` : ''
    const tierStr  = showTier  ? `🩸TIER×${tierCombo} ` : ''
    el.textContent = `${chainStr}${tierStr}×${multiplier.toFixed(1)}`

    el.classList.remove('combo--mid', 'combo--max')
    if (multiplier >= 2.0) el.classList.add('combo--max')
    else if (multiplier >= 1.3) el.classList.add('combo--mid')
  },

  showDeliveryScore(score: number, multiplier: number, isFull: boolean, alertPercent: number = 0, isLastSecond: boolean = false): void {
    const el = domRefs.deliveryScorePopup
    const fullTag       = isFull               ? ' 🩸FULL!'      : ''
    const rageTag       = alertPercent >= 0.93 ? ' ⚡RAGE!'       : ''
    const dangerTag     = !rageTag && alertPercent >= 0.70 ? ' ⚠DANGER!' : ''
    const lastSecTag    = isLastSecond          ? ' ⏰LAST SEC!'  : ''
    el.textContent = `+${score}${fullTag}${rageTag}${dangerTag}${lastSecTag}  ×${multiplier.toFixed(1)}`
    el.classList.remove('hidden', 'popup--flash', 'popup--danger', 'popup--rage', 'popup--lastsec')
    void el.offsetWidth
    el.classList.add('popup--flash')
    if      (isLastSecond)         el.classList.add('popup--lastsec')
    else if (alertPercent >= 0.93) el.classList.add('popup--rage')
    else if (alertPercent >= 0.70) el.classList.add('popup--danger')
    setTimeout(() => el.classList.add('hidden'), 1600)
  },

  // ==========================================
  // Blood ゲージ
  // ==========================================

  updateBloodGauge(percent: number): void {
    domRefs.bloodGauge.style.width = `${Math.max(0, Math.min(100, percent))}%`
    // 数値表示 (0〜100 の整数)
    domRefs.bloodValue.textContent = `${Math.round(percent)}%`
  },

  setBloodWarning(active: boolean): void {
    active
      ? domRefs.bloodGaugeTrack.classList.add('gauge--warning')
      : domRefs.bloodGaugeTrack.classList.remove('gauge--warning')
  },

  setBloodFull(active: boolean): void {
    active
      ? domRefs.bloodGaugeTrack.classList.add('gauge--full')
      : domRefs.bloodGaugeTrack.classList.remove('gauge--full')
  },

  /**
   * Blood状態ラベルを更新する
   * @param percent 血液量 0〜100
   */
  updateBloodStatus(percent: number): void {
    const el = domRefs.bloodStatus
    el.classList.remove('bstatus--heavy', 'bstatus--critical', 'hidden')

    const display = Math.round(percent)
    if (display >= 100) {
      el.textContent = 'FULL'
      el.classList.add('bstatus--critical')
    } else if (display >= 70) {
      el.textContent = 'HEAVY'
      el.classList.add('bstatus--heavy')
    } else {
      el.classList.add('hidden')
    }
  },

  showBloodFullNotice(): void {
    this._flashNotice(domRefs.bloodFullNotice)
  },

  /** チュートリアル: DOM テキストパネルにメインテキストとサブテキストを表示 */
  showTutorialText(main: string, sub: string, blinkSub = false): void {
    domRefs.tutMain.textContent = main
    domRefs.tutSub.textContent  = sub
    domRefs.tutSub.classList.toggle('tut-blink', blinkSub)
    domRefs.tutTextPanel.classList.remove('hidden')
  },

  /** チュートリアル: DOM テキストパネルを非表示 */
  hideTutorialText(): void {
    domRefs.tutTextPanel.classList.add('hidden')
    domRefs.tutSub.classList.remove('tut-blink')
  },

  /** チュートリアル: 赤ちゃんUIをハイライト */
  showTutorialHighlightBaby(): void {
    domRefs.babyWrap.classList.add('tutorial-highlight')
  },

  /** チュートリアル: ハイライトを解除 */
  removeTutorialHighlight(): void {
    domRefs.babyWrap.classList.remove('tutorial-highlight')
  },

  // ==========================================
  // Alert ゲージ
  // ==========================================

  updateAlertGauge(amount: number): void {
    domRefs.alertGauge.style.width = `${Math.max(0, Math.min(100, amount))}%`
  },

  /**
   * アラートフェーズをゲージとラベルに反映する
   */
  updateAlertLevel(level: AlertLevel): void {
    const track = domRefs.alertGaugeTrack
    track.classList.remove('alert--lv1', 'alert--lv2', 'alert--lv3', 'alert--lv4')
    track.classList.add(`alert--lv${level}`)

    const label = domRefs.alertPhaseLabel
    label.textContent = ALERT_PHASE_LABELS[level]
    label.className = `alert-phase alert-phase--lv${level}`
  },

  // ==========================================
  // Speed
  // ==========================================

  updateSpeedIndicator(ratio: number): void {
    const el = domRefs.speedIndicator
    el.textContent = `${Math.round(ratio * 100)}%`
    el.classList.remove('speed--fast', 'speed--mid', 'speed--slow')
    if (ratio >= 0.7)   el.classList.add('speed--fast')
    else if (ratio >= 0.4) el.classList.add('speed--mid')
    else                el.classList.add('speed--slow')
  },

  showHeavyNotice(): void {
    this._flashNotice(domRefs.heavyNotice)
  },

  // ==========================================
  // Hunger (巣の空腹) — HUD gauge
  // ==========================================

  updateHungerGauge(percent: number): void {
    const clamped = Math.max(0, Math.min(100, percent))
    domRefs.hungerGauge.style.width = `${clamped}%`
    domRefs.hungerValue.textContent = `${Math.round(clamped)}%`
    // percent はネストの「満腹度」: 低いほど危険
    const isWarn = percent <= 20
    domRefs.hungerGaugeTrack.classList.toggle('hunger--warn', isWarn)
  },

  showHungerWarning(): void {
    this._flashNotice(domRefs.hungerNotice)
  },

  // ==========================================
  // Alert danger edge glow
  // ==========================================

  setAlertDangerGlow(active: boolean): void {
    domRefs.alertGlow.classList.toggle('alert-glow--active', active)
  },

  // ==========================================
  // 風インジケーター / アクティブイベント
  // ==========================================

  showWindIndicator(dirX: number, dirY: number): void {
    const ARROWS: Record<string, string> = {
      '1,0': '→', '-1,0': '←', '0,1': '↓', '0,-1': '↑',
    }
    const arrow = ARROWS[`${dirX},${dirY}`] ?? '→'
    domRefs.aeFanDir.textContent = arrow
    domRefs.aeFan.classList.remove('hidden')
    this._updateAeNone()
    this._flashNotice(domRefs.eventNotice, `💨 FAN ON ${arrow}`)
  },

  hideWindIndicator(): void {
    domRefs.aeFan.classList.add('hidden')
    this._updateAeNone()
  },

  showSmokeActive(): void {
    domRefs.aeSmoke.classList.remove('hidden')
    this._updateAeNone()
    this._flashNotice(domRefs.eventNotice, '🌀 SMOKE ACTIVE')
  },

  hideSmokeActive(): void {
    domRefs.aeSmoke.classList.add('hidden')
    this._updateAeNone()
  },

  // ==========================================
  // Right Panel (Daily Bonus + Active Events)
  // ==========================================

  showRightPanel(bonus: DailyBonus): void {
    domRefs.rpDbName.textContent      = bonus.label
    domRefs.rpDbCondition.textContent = bonus.condition
    domRefs.rpDbMult.textContent      = `×${bonus.multiplier.toFixed(1)}`
    domRefs.rightPanel.classList.remove('hidden')
  },

  hideRightPanel(): void {
    domRefs.rightPanel.classList.add('hidden')
  },

  updateDailyBonusProgress(bonus: DailyBonus, bloodPct: number, alertPct: number, hungerPct: number): void {
    let progress = 0
    let threshold = 100

    switch (bonus.type) {
      case 'full_tank':   progress = bloodPct;  threshold = 100; break
      case 'danger':      progress = alertPct;  threshold = 70;  break
      case 'tier3':       progress = bloodPct;  threshold = 75;  break
      case 'high_hunger': progress = hungerPct; threshold = 80;  break
    }

    const ratio = Math.min(1, progress / threshold)
    domRefs.rpDbBarFill.style.width = `${ratio * 100}%`

    const isReady = progress >= threshold
    domRefs.rpDbReady.classList.toggle('hidden', !isReady)
    domRefs.rpDbBarFill.classList.toggle('rp-db-bar--ready', isReady)
  },

  // ==========================================
  // スコアギャップ (vs ベスト)
  // ==========================================

  updateScoreGap(current: number, best: number): void {
    const el = domRefs.scoreGap
    if (best <= 0) { el.classList.add('hidden'); return }
    el.classList.remove('hidden', 'score-gap--ahead')
    const diff = current - best
    if (diff >= 0) {
      el.textContent = '★ NEW BEST!'
      el.classList.add('score-gap--ahead')
    } else {
      el.textContent = `TO BEAT: ${Math.abs(diff).toLocaleString('en-US')}`
    }
  },

  // ==========================================
  // 惜しかった (リザルト)
  // ==========================================

  showNearMiss(neededSec: number, deficit: number): void {
    const el = domRefs.nearMiss
    el.innerHTML = `SO CLOSE!<br>${deficit.toLocaleString('en-US')} PTS TO BEAT BEST (+${neededSec}s)`
    el.classList.remove('hidden')
  },

  // ==========================================
  // StageSystem
  // ==========================================

  updateStageLabel(stage: StageConfig): void {
    domRefs.stageLabel.textContent = stage.name
    domRefs.stageLabel.className = `lp-stat-value lp-stage-label lp-stage--${stage.id}`
  },

  showStageChange(stage: StageConfig): void {
    const el = domRefs.stageNotice
    el.textContent = `▶ AREA: ${stage.name} — ${stage.difficulty} (SCORE×${stage.scoreMult.toFixed(1)})`
    this._flashNotice(el)
  },

  // ==========================================
  // DailyBonusSystem
  // ==========================================

  showDailyBonusOnTitle(bonus: DailyBonus): void {
    domRefs.tdbCondition.textContent = `${bonus.condition}  ×${bonus.multiplier.toFixed(1)}`
    domRefs.titleDailyBonus.classList.remove('hidden')
  },

  // ==========================================
  // Game HUD (top bar) visibility
  // ==========================================

  showGameHUD(): void {
    domRefs.topBar.classList.remove('hidden')
  },

  hideGameHUD(): void {
    domRefs.topBar.classList.add('hidden')
  },

  // ==========================================
  // Greed bonus indicator
  // ==========================================

  /**
   * @param mult 0 = not active, 1.5 or 2.0 = active
   */
  updateGreedBonus(mult: number): void {
    const el = domRefs.greedNotice
    if (mult <= 0) {
      el.classList.add('hidden')
      el.classList.remove('greed--max')
      return
    }
    domRefs.greedMultText.textContent = `×${mult.toFixed(1)}`
    el.classList.remove('hidden')
    el.classList.toggle('greed--max', mult >= 2.0)
  },

  // ==========================================
  // Starvation countdown
  // ==========================================

  showStarvationCountdown(sec: number): void {
    domRefs.starvationCountdown.textContent = String(sec)
    domRefs.starvationOverlay.classList.remove('hidden')
  },

  updateStarvationCountdown(sec: number): void {
    domRefs.starvationCountdown.textContent = String(sec)
  },

  hideStarvationCountdown(): void {
    domRefs.starvationOverlay.classList.add('hidden')
  },

  // ==========================================
  // Score milestone
  // ==========================================

  updateMilestone(nextScore: number | null): void {
    const el = domRefs.milestoneDisplay
    if (nextScore === null) {
      el.textContent = '— MAX STAGE —'
      el.classList.remove('hidden', 'milestone--reached')
      return
    }
    el.textContent = `NEXT: ${nextScore.toLocaleString('en-US')}`
    el.classList.remove('hidden', 'milestone--reached')
  },

  flashMilestoneReached(nextScore: number | null): void {
    const el = domRefs.milestoneDisplay
    el.textContent = '★ TARGET REACHED!'
    el.classList.add('milestone--reached')
    setTimeout(() => {
      el.classList.remove('milestone--reached')
      if (nextScore === null) {
        el.textContent = '— MAX STAGE —'
      } else {
        el.textContent = `NEXT: ${nextScore.toLocaleString('en-US')}`
      }
    }, 1800)
  },

  hideMilestone(): void {
    domRefs.milestoneDisplay.classList.add('hidden')
  },

  // ==========================================
  // タイトル画面
  // ==========================================

  showTitle(highScore: number | null): void {
    const el = domRefs.titleHighScore
    if (highScore !== null) {
      el.textContent = `BEST: ${highScore}`
      el.classList.remove('hidden')
    } else {
      el.classList.add('hidden')
    }
    domRefs.titleScreen.classList.remove('hidden')
    domRefs.resultScreen.classList.add('hidden')
  },

  hideTitle(): void {
    domRefs.titleScreen.classList.add('hidden')
  },

  // ==========================================
  // リザルト画面
  // ==========================================

  showResult(breakdown: ScoreBreakdown, highScore: number, isNewRecord: boolean): void {
    domRefs.finalScore.textContent        = String(breakdown.total)
    domRefs.resultDelivScore.textContent  = String(breakdown.deliveryScore)
    domRefs.resultDelivCount.textContent  = `${breakdown.deliveryCount}回`
    domRefs.resultSurvivalSec.textContent = `${breakdown.survivalSec}s`
    domRefs.resultHighScore.textContent   = `BEST: ${highScore}`
    domRefs.nearMiss.classList.add('hidden')

    isNewRecord
      ? domRefs.newRecordBadge.classList.remove('hidden')
      : domRefs.newRecordBadge.classList.add('hidden')

    const screen = domRefs.resultScreen
    screen.classList.remove('hidden', 'result--enter')
    void screen.offsetWidth
    screen.classList.add('result--enter')
    screen.classList.remove('hidden')
  },

  hideResult(): void {
    domRefs.resultScreen.classList.add('hidden')
  },

  // ==========================================
  // ポーズメニュー
  // ==========================================

  showPauseButton(onPause: () => void): void {
    domRefs.pauseBtn.onclick = onPause
    domRefs.pauseBtn.classList.remove('hidden')
  },

  hidePauseButton(): void {
    domRefs.pauseBtn.classList.add('hidden')
    domRefs.pauseBtn.onclick = null
  },

  showPauseOverlay(onResume: () => void, onTitle: () => void): void {
    const overlay = domRefs.pauseOverlay

    // スライダーの値をlocalStorageから復元
    const musicVol = parseInt(localStorage.getItem('musicVol') ?? '80')
    const sfxVol   = parseInt(localStorage.getItem('sfxVol')   ?? '80')
    domRefs.musicVolume.value       = String(musicVol)
    domRefs.sfxVolume.value         = String(sfxVol)
    domRefs.musicVolVal.textContent = String(musicVol)
    domRefs.sfxVolVal.textContent   = String(sfxVol)

    const onMusicInput = () => {
      const v = domRefs.musicVolume.value
      domRefs.musicVolVal.textContent = v
      localStorage.setItem('musicVol', v)
    }
    const onSfxInput = () => {
      const v = domRefs.sfxVolume.value
      domRefs.sfxVolVal.textContent = v
      localStorage.setItem('sfxVol', v)
    }
    domRefs.musicVolume.addEventListener('input', onMusicInput)
    domRefs.sfxVolume.addEventListener('input', onSfxInput)

    const cleanup = () => {
      domRefs.musicVolume.removeEventListener('input', onMusicInput)
      domRefs.sfxVolume.removeEventListener('input', onSfxInput)
    }

    domRefs.pauseResumeBtn.onclick = () => { cleanup(); onResume() }
    domRefs.pauseTitleBtn.onclick  = () => { cleanup(); onTitle() }

    overlay.classList.remove('hidden')
  },

  hidePauseOverlay(): void {
    domRefs.pauseOverlay.classList.add('hidden')
    domRefs.pauseResumeBtn.onclick = null
    domRefs.pauseTitleBtn.onclick  = null
  },

  // ==========================================
  // ボタン
  // ==========================================

  showItemPickup(label: string): void {
    this._flashNotice(domRefs.itemNotice, label)
  },

  // ==========================================
  // Mission system
  // ==========================================

  /**
   * ミッションバナーを更新する
   * state が null なら非表示、非nullなら内容を更新して表示
   */
  setMissionBanner(state: MissionState | null): void {
    const el = domRefs.missionBanner
    if (!state) {
      el.classList.add('hidden')
      return
    }
    domRefs.mbDesc.textContent = state.description
    if (state.progressFormat === 'time') {
      domRefs.mbProgress.textContent = `${state.current.toFixed(1)}s / ${state.target}s`
    } else if (state.progressFormat === 'count') {
      domRefs.mbProgress.textContent = `${state.current} / ${state.target}`
    } else {
      domRefs.mbProgress.textContent = ''
    }
    el.classList.remove('hidden')
  },

  flashMissionComplete(): void {
    this._flashNotice(domRefs.missionComplete, '✓ MISSION COMPLETE!')
  },

  // ==========================================
  // Debuff collision feedback
  // ==========================================

  showDebuffHit(label: string): void {
    const el = domRefs.debuffPopup
    el.textContent = `⚠ ${label}`
    el.classList.remove('hidden', 'debuff--pop')
    void el.offsetWidth
    el.classList.add('debuff--pop')
    setTimeout(() => el.classList.add('hidden'), 1400)
  },

  /**
   * アクティブアイテムの残り時間を表示する
   * effects が空なら非表示にする
   */
  updateActiveEffects(effects: { icon: string; name: string; remaining: number }[]): void {
    const el = domRefs.activeEffects
    if (effects.length === 0) {
      el.classList.add('hidden')
      return
    }
    el.classList.remove('hidden')
    el.innerHTML = effects.map(e => {
      const urgent = e.remaining < 1.5
      const secStr = e.remaining.toFixed(1) + 's'
      return `<div class="ae-row${urgent ? ' ae-row--urgent' : ''}"><span class="ae-row-icon">${e.icon}</span><span class="ae-row-name">${e.name}</span><span class="ae-row-time">${secStr}</span></div>`
    }).join('')
  },

  // ==========================================
  // Baby portrait
  // ==========================================

  updateBabyState(state: BabyState): void {
    const SRCS: Record<BabyState, string> = {
      normal:  'assets/ui/baby/baby_normal.png',
      hungry:  'assets/ui/baby/baby_hungry.png',
      dizzy:   'assets/ui/baby/baby_dizzy.png',
      excited: 'assets/ui/baby/baby_excited.png',
    }
    const img = domRefs.babyImg
    if (img.dataset.babyState === state) return
    img.dataset.babyState = state
    img.src = SRCS[state]
    // Pop animation — reset classes first to retrigger
    img.classList.remove('baby-pop', 'baby--dizzy')
    void img.offsetWidth
    img.classList.add('baby-pop')
    if (state === 'dizzy') img.classList.add('baby--dizzy')
  },

  showBabyUI(): void {
    domRefs.babyWrap.classList.remove('hidden')
  },

  hideBabyUI(): void {
    domRefs.babyWrap.classList.add('hidden')
    // Reset state so next show() triggers a fresh pop
    const img = domRefs.babyImg
    img.dataset.babyState = ''
    img.classList.remove('baby-pop', 'baby--dizzy')
  },

  onStartClick(callback: () => void): void {
    domRefs.startButton.addEventListener('click', callback, { once: true })
  },

  onRetryClick(callback: () => void): void {
    domRefs.retryButton.addEventListener('click', callback, { once: true })
  },

  onBackToTitleClick(callback: () => void): void {
    domRefs.backTitleButton.addEventListener('click', callback, { once: true })
  },

  // ==========================================
  // Private
  // ==========================================

  _flashNotice(el: HTMLElement, text?: string): void {
    if (text !== undefined) el.textContent = text
    el.classList.remove('hidden', 'notice--flash')
    void el.offsetWidth
    el.classList.add('notice--flash')
    el.classList.remove('hidden')
    setTimeout(() => {
      el.classList.add('hidden')
      el.classList.remove('notice--flash')
    }, 1800)
  },

  _updateAeNone(): void {
    const hasFan   = !domRefs.aeFan.classList.contains('hidden')
    const hasSmoke = !domRefs.aeSmoke.classList.contains('hidden')
    domRefs.aeNone.classList.toggle('hidden', hasFan || hasSmoke)
  },
}
