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
import { JUICE } from '../data/juice'
import { sfx } from '../systems/SfxManager'
import { notificationQueue } from './NotificationQueue'
import { getUiScale, refreshResponsiveScale } from './responsiveScale'
import { getSavedTouchStickOffset, setSavedTouchStickOffset } from './TouchControls'

/** 赤ちゃんの状態種別 */
export type BabyState = 'normal' | 'hungry' | 'dizzy' | 'excited'

/** アラートフェーズのラベル */
const ALERT_PHASE_LABELS: Record<AlertLevel, string> = {
  1: 'CALM',
  2: 'ALERT',
  3: 'DANGER',
  4: 'RAGE',
}

// --- ジュース演出用の内部状態 (モジュールローカル) ---
let displayedScore = 0        // カウントアップ表示中の値
let lastBloodPct   = 0        // ダメージフラッシュ検出用
let lastHungerPct  = 100
let lastHudShakeAt = 0        // HUDシェイクのスロットル
let lastChain      = 0        // コンボパンチ検出用
let lastTierCombo  = 0
let lastStarveSec  = -1       // 餓死カウントダウンtick検出用
let resultAnim: { finish: () => void; cancel: () => void } | null = null

export const uiController = {
  setGameplayCursorHidden(hidden: boolean): void {
    document.body.classList.toggle('gameplay-cursor-hidden', hidden)
  },

  // ==========================================
  // スコア
  // ==========================================

  /**
   * スコア表示を更新する。
   * 毎フレーム呼ばれる前提で、目標値へ lerp するカウントアップ演出を内蔵。
   * 減少 (リセット) 時は即座にスナップする。
   */
  updateScore(score: number): void {
    const target = Math.floor(score)
    if (target < displayedScore) {
      displayedScore = target
    } else if (target > displayedScore) {
      const diff = target - displayedScore
      displayedScore = diff <= 1
        ? target
        : displayedScore + Math.max(1, Math.ceil(diff * JUICE.SCORE_TICK_LERP))
    }
    domRefs.score.textContent = displayedScore.toLocaleString('en-US')
  },

  /** スコア数字のスケールパンチ (加算着弾時) */
  scorePop(): void {
    const el = domRefs.score
    el.classList.remove('score-pop')
    void el.offsetWidth
    el.classList.add('score-pop')
  },

  /**
   * 飛翔スコア — 納品地点 (canvas座標) から TOP BAR のスコアへ数字が飛ぶ。
   * 着弾時にスコアポップを発火する。
   */
  spawnFlyingScore(gameX: number, gameY: number, text: string): void {
    const wrapper   = domRefs.gameWrapper
    const areaRect  = domRefs.gameArea.getBoundingClientRect()
    const wrapRect  = wrapper.getBoundingClientRect()
    const scoreRect = domRefs.score.getBoundingClientRect()

    // レスポンシブスケール補正 — getBoundingClientRect はスケール後の画面座標を
    // 返すが、wrapper 内の left/top はスケール前のローカル座標で指定する必要がある
    const scale = getUiScale()

    const el = document.createElement('div')
    el.className = 'fly-score'
    el.textContent = text
    el.style.left = `${(areaRect.left - wrapRect.left) / scale + gameX}px`
    el.style.top  = `${(areaRect.top  - wrapRect.top)  / scale + gameY}px`
    wrapper.appendChild(el)

    // 2フレーム後に目的地へ (transition を確実に発火させる)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.left = `${(scoreRect.left - wrapRect.left + scoreRect.width  / 2) / scale}px`
      el.style.top  = `${(scoreRect.top  - wrapRect.top  + scoreRect.height / 2) / scale}px`
      el.style.opacity = '0.85'
      el.style.fontSize = '9px'
    }))

    window.setTimeout(() => {
      el.remove()
      this.scorePop()
      sfx.play('tick')
    }, JUICE.FLY_SCORE_MS + 60)
  },

  /**
   * コンボタイマーバー — チェインが切れるまでの残り時間を表示する
   * @param remainRatio 1=満タン 0=切れる寸前 (0以下で非表示)
   */
  updateComboTimer(remainRatio: number): void {
    const track = domRefs.comboTimerTrack
    if (remainRatio <= 0) {
      track.classList.add('hidden')
      return
    }
    track.classList.remove('hidden')
    domRefs.comboTimerFill.style.width = `${Math.min(100, remainRatio * 100)}%`
    track.classList.toggle('combo-timer--warn', remainRatio < JUICE.COMBO_TIMER_WARN)
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
      lastChain = chain
      lastTierCombo = tierCombo
      return
    }
    el.classList.remove('hidden')

    const chainStr = showChain ? `⛓${chain} ` : ''
    const tierStr  = showTier  ? `🩸TIER×${tierCombo} ` : ''
    el.textContent = `${chainStr}${tierStr}×${multiplier.toFixed(1)}`

    el.classList.remove('combo--mid', 'combo--max')
    if (multiplier >= 2.0) el.classList.add('combo--max')
    else if (multiplier >= 1.3) el.classList.add('combo--mid')

    // チェイン/ティア更新時のスケールパンチ — 深いチェインほど大きく弾む
    if (chain > lastChain || tierCombo > lastTierCombo) {
      const punchScale = Math.min(1.3 + Math.max(chain, tierCombo) * 0.06, 1.6)
      el.style.setProperty('--combo-punch-scale', punchScale.toFixed(2))
      el.classList.remove('combo-punch')
      void el.offsetWidth
      el.classList.add('combo-punch')
    }
    lastChain = chain
    lastTierCombo = tierCombo
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
    const clamped = Math.max(0, Math.min(100, percent))
    const track = domRefs.bloodGaugeTrack
    const drop = lastBloodPct - clamped

    if (drop >= 40) {
      // 納品の排出 — ゆっくり流れ出るトランジション
      track.classList.add('gauge--drain')
      window.setTimeout(() => track.classList.remove('gauge--drain'), 320)
    } else if (drop >= 5) {
      // デバフ等の急減 — ダメージフラッシュ + HUDシェイク
      this._gaugeDamageFlash(track)
      this.hudShake()
    }
    lastBloodPct = clamped

    domRefs.bloodGauge.style.width = `${clamped}%`
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
    this._flashNotice(domRefs.bloodFullNotice, undefined, 2)
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
    this._flashNotice(domRefs.heavyNotice, undefined, 0)
  },

  // ==========================================
  // Hunger (巣の空腹) — HUD gauge
  // ==========================================

  updateHungerGauge(percent: number): void {
    const clamped = Math.max(0, Math.min(100, percent))
    // デバフによる急落を検出してフラッシュ
    if (lastHungerPct - clamped >= 5) {
      this._gaugeDamageFlash(domRefs.hungerGaugeTrack)
      this.hudShake()
    }
    lastHungerPct = clamped

    domRefs.hungerGauge.style.width = `${clamped}%`
    domRefs.hungerValue.textContent = `${Math.round(clamped)}%`
    // percent はネストの「満腹度」: 低いほど危険
    const isWarn = percent <= 20
    domRefs.hungerGaugeTrack.classList.toggle('hunger--warn', isWarn)
  },

  /** TOP BAR 全体を短くシェイク (スロットル付き) */
  hudShake(): void {
    const now = performance.now()
    if (now - lastHudShakeAt < 400) return
    lastHudShakeAt = now
    const bar = domRefs.topBar
    bar.classList.remove('hud-shake')
    void bar.offsetWidth
    bar.classList.add('hud-shake')
  },

  /** 危険ビネットの濃度 (0〜1) を設定する */
  setDangerVignette(opacity: number): void {
    domRefs.dangerVignette.style.opacity = String(Math.max(0, Math.min(1, opacity)))
  },

  /** Ph4 RAGE 中の軽いズーム (canvas + DOM層を一緒に拡大) */
  setPh4Zoom(active: boolean): void {
    domRefs.gameArea.classList.toggle('ph4-zoom', active)
  },

  _gaugeDamageFlash(track: HTMLElement): void {
    track.classList.remove('gauge-flash-damage')
    void track.offsetWidth
    track.classList.add('gauge-flash-damage')
  },

  showHungerWarning(): void {
    this._flashNotice(domRefs.hungerNotice, undefined, 2)
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
    this._flashNotice(el, `▶ AREA: ${stage.name} — ${stage.difficulty} (SCORE×${stage.scoreMult.toFixed(1)})`, 2)
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
    refreshResponsiveScale()
  },

  hideGameHUD(): void {
    domRefs.topBar.classList.add('hidden')
    refreshResponsiveScale()
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
    lastStarveSec = sec
    sfx.play('starveTick')
  },

  updateStarvationCountdown(sec: number): void {
    domRefs.starvationCountdown.textContent = String(sec)
    // 1秒ごとに tick 音を鳴らす
    if (sec !== lastStarveSec && sec > 0) {
      lastStarveSec = sec
      sfx.play('starveTick')
    }
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
    this.setGameplayCursorHidden(false)
    const el = domRefs.titleHighScore
    if (highScore !== null) {
      el.textContent = `BEST: ${highScore}`
      el.classList.remove('hidden')
    } else {
      el.classList.add('hidden')
    }
    domRefs.titleScreen.classList.remove('hidden')
    domRefs.resultScreen.classList.add('hidden')
    refreshResponsiveScale()
  },

  hideTitle(): void {
    domRefs.titleScreen.classList.add('hidden')
    refreshResponsiveScale()
  },

  // ==========================================
  // リザルト画面
  // ==========================================

  showResult(breakdown: ScoreBreakdown, highScore: number, isNewRecord: boolean): void {
    this.setGameplayCursorHidden(false)
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
    refreshResponsiveScale()
  },

  /**
   * リザルト演出版:
   *   内訳3行を順にスライドイン → TOTAL を 1.2s でロールアップ →
   *   NEW RECORD スラム + 紙吹雪 + ファンファーレ → SO CLOSE 表示
   * Enter 1回目で skipResultAnimation() により即完了できる。
   */
  animateResult(
    breakdown: ScoreBreakdown,
    highScore: number,
    isNewRecord: boolean,
    nearMiss?: { neededSec: number; deficit: number },
  ): void {
    this.setGameplayCursorHidden(false)
    this.cancelResultAnimation()

    // 静的フィールドを先にセット
    domRefs.resultDelivScore.textContent  = String(breakdown.deliveryScore)
    domRefs.resultDelivCount.textContent  = `${breakdown.deliveryCount}回`
    domRefs.resultSurvivalSec.textContent = `${breakdown.survivalSec}s`
    domRefs.resultHighScore.textContent   = `BEST: ${highScore}`
    domRefs.nearMiss.classList.add('hidden')
    domRefs.newRecordBadge.classList.add('hidden')
    domRefs.newRecordBadge.classList.remove('record-slam')
    domRefs.finalScore.textContent = '0'

    const rows = Array.from(
      document.querySelectorAll<HTMLElement>('#result-screen .breakdown-row'),
    )
    rows.forEach(r => r.classList.add('row-hidden'))

    const screen = domRefs.resultScreen
    screen.classList.remove('hidden', 'result--enter')
    void screen.offsetWidth
    screen.classList.add('result--enter')
    refreshResponsiveScale()

    const timeouts: number[] = []
    let raf: number | null = null
    let done = false

    const cleanup = () => {
      timeouts.forEach(t => clearTimeout(t))
      if (raf !== null) cancelAnimationFrame(raf)
      resultAnim = null
    }

    const showTail = () => {
      if (isNewRecord) {
        domRefs.newRecordBadge.classList.remove('hidden')
        domRefs.newRecordBadge.classList.add('record-slam')
        sfx.play('fanfare')
        this._confettiBurst()
      }
      if (nearMiss) this.showNearMiss(nearMiss.neededSec, nearMiss.deficit)
    }

    const finish = () => {
      if (done) return
      done = true
      cleanup()
      rows.forEach(r => r.classList.remove('row-hidden'))
      domRefs.finalScore.textContent = breakdown.total.toLocaleString('en-US')
      const totalEl = document.querySelector<HTMLElement>('.result-score-value')
      if (totalEl) {
        totalEl.classList.remove('total-punch')
        void totalEl.offsetWidth
        totalEl.classList.add('total-punch')
      }
      showTail()
    }

    const cancel = () => {
      if (done) return
      done = true
      cleanup()
    }

    resultAnim = { finish, cancel }

    // ① 内訳行を 150ms 間隔でスライドイン
    rows.forEach((r, i) => {
      timeouts.push(window.setTimeout(() => {
        r.classList.remove('row-hidden')
        sfx.play('tick')
      }, 300 + i * 150))
    })

    // ② TOTAL ロールアップ (1.2s, ease-out) — 50ms 毎に tick 音
    const ROLL_MS = 1200
    const rollStart = 300 + rows.length * 150 + 150
    timeouts.push(window.setTimeout(() => {
      const t0 = performance.now()
      let lastTickAt = 0
      const step = (now: number) => {
        if (done) return
        const p = Math.min(1, (now - t0) / ROLL_MS)
        const eased = 1 - Math.pow(1 - p, 3)
        domRefs.finalScore.textContent =
          Math.floor(breakdown.total * eased).toLocaleString('en-US')
        if (now - lastTickAt > 50 && breakdown.total > 0) {
          lastTickAt = now
          sfx.play('tick')
        }
        if (p < 1) {
          raf = requestAnimationFrame(step)
        } else {
          finish()
        }
      }
      raf = requestAnimationFrame(step)
    }, rollStart))
  },

  /** Enter 1回目: 演出をスキップして最終状態にする */
  skipResultAnimation(): void {
    resultAnim?.finish()
  },

  isResultAnimating(): boolean {
    return resultAnim !== null
  },

  /** 演出を静かに中断する (リトライ等で画面ごと消える時) */
  cancelResultAnimation(): void {
    resultAnim?.cancel()
  },

  /** NEW RECORD 用の DOM 紙吹雪 */
  _confettiBurst(): void {
    const screen = domRefs.resultScreen
    const colors = ['#ff5555', '#ffdd44', '#55ff88', '#5599ff', '#ff88cc', '#ffffff']
    for (let i = 0; i < 30; i++) {
      const c = document.createElement('div')
      c.className = 'confetti'
      c.style.left = `${Math.random() * 100}%`
      c.style.background = colors[i % colors.length]
      c.style.animationDuration = `${1.2 + Math.random() * 1.2}s`
      c.style.animationDelay = `${Math.random() * 0.4}s`
      screen.appendChild(c)
      window.setTimeout(() => c.remove(), 3200)
    }
  },

  hideResult(): void {
    this.cancelResultAnimation()
    domRefs.resultScreen.classList.add('hidden')
    refreshResponsiveScale()
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

    // oninput 代入で単一化 (ESC 復帰時に removeEventListener が走らず
    // リスナーが蓄積する問題を防ぐ)
    domRefs.musicVolume.oninput = () => {
      const v = domRefs.musicVolume.value
      domRefs.musicVolVal.textContent = v
      localStorage.setItem('musicVol', v)
      sfx.setMusicVolume(parseInt(v) / 100)
    }
    domRefs.sfxVolume.oninput = () => {
      const v = domRefs.sfxVolume.value
      domRefs.sfxVolVal.textContent = v
      localStorage.setItem('sfxVol', v)
      sfx.setSfxVolume(parseInt(v) / 100)
      sfx.play('uiHover')  // 音量確認用のフィードバック (スロットル内蔵)
    }

    domRefs.pauseResumeBtn.onclick = () => onResume()
    domRefs.pauseTitleBtn.onclick  = () => onTitle()

    const stickOffset = getSavedTouchStickOffset()
    domRefs.touchStickOffsetX.value = String(stickOffset.x)
    domRefs.touchStickOffsetY.value = String(stickOffset.y)
    domRefs.touchStickOffsetXVal.textContent = String(stickOffset.x)
    domRefs.touchStickOffsetYVal.textContent = String(stickOffset.y)
    domRefs.touchStickOffsetX.oninput = () => {
      const x = parseInt(domRefs.touchStickOffsetX.value, 10) || 0
      const y = parseInt(domRefs.touchStickOffsetY.value, 10) || 0
      domRefs.touchStickOffsetXVal.textContent = String(x)
      setSavedTouchStickOffset(x, y)
    }
    domRefs.touchStickOffsetY.oninput = () => {
      const x = parseInt(domRefs.touchStickOffsetX.value, 10) || 0
      const y = parseInt(domRefs.touchStickOffsetY.value, 10) || 0
      domRefs.touchStickOffsetYVal.textContent = String(y)
      setSavedTouchStickOffset(x, y)
    }
    domRefs.touchStickResetBtn.onclick = () => {
      domRefs.touchStickOffsetX.value = '0'
      domRefs.touchStickOffsetY.value = '0'
      domRefs.touchStickOffsetXVal.textContent = '0'
      domRefs.touchStickOffsetYVal.textContent = '0'
      setSavedTouchStickOffset(0, 0)
    }

    overlay.classList.remove('hidden')
  },

  hidePauseOverlay(): void {
    domRefs.pauseOverlay.classList.add('hidden')
    domRefs.pauseResumeBtn.onclick = null
    domRefs.pauseTitleBtn.onclick  = null
    domRefs.musicVolume.oninput    = null
    domRefs.sfxVolume.oninput      = null
    domRefs.touchStickOffsetX.oninput = null
    domRefs.touchStickOffsetY.oninput = null
    domRefs.touchStickResetBtn.onclick = null
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
    this._flashNotice(domRefs.missionComplete, '✓ MISSION COMPLETE!', 2)
    sfx.play('milestone')
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

  // ボタンのクリックハンドラは onclick 代入で単一化する。
  // addEventListener + { once } は「クリックされないまま画面遷移」した場合に
  // リスナーが残留・蓄積し、後で多重発火する (scene.start 二重実行) ため使わない。

  onStartClick(callback: () => void): void {
    domRefs.startButton.onclick = () => {
      domRefs.startButton.onclick = null
      callback()
    }
  },

  onRetryClick(callback: () => void): void {
    domRefs.retryButton.onclick = () => {
      domRefs.retryButton.onclick = null
      domRefs.backTitleButton.onclick = null
      callback()
    }
  },

  onBackToTitleClick(callback: () => void): void {
    domRefs.backTitleButton.onclick = () => {
      domRefs.backTitleButton.onclick = null
      domRefs.retryButton.onclick = null
      callback()
    }
  },

  // ==========================================
  // Private
  // ==========================================

  /**
   * フラッシュ通知 — NotificationQueue 経由で重なりを防ぐ
   * @param priority 0=低 1=通常 2=重要 (割り込み)
   */
  _flashNotice(el: HTMLElement, text?: string, priority = 1): void {
    notificationQueue.show(el, text, priority)
  },

  /** 表示中・待機中の通知を全て消す (ゲームオーバー・タイトル復帰時) */
  clearNotices(): void {
    notificationQueue.clear()
  },

  _updateAeNone(): void {
    const hasFan   = !domRefs.aeFan.classList.contains('hidden')
    const hasSmoke = !domRefs.aeSmoke.classList.contains('hidden')
    domRefs.aeNone.classList.toggle('hidden', hasFan || hasSmoke)
  },
}
