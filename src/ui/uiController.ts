/**
 * UIController
 * PhaserシーンからDOMを直接操作することを禁止し、
 * このファイルを通じてのみUI更新を行う
 */

import { domRefs } from './domRefs'
import { ScoreBreakdown } from '../systems/ScoreSystem'
import { AlertLevel } from '../systems/AlertSystem'

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
    domRefs.score.textContent = String(Math.floor(score))
  },

  updateDeliveryCombo(combo: number, multiplier: number): void {
    const el = domRefs.comboDisplay
    if (combo <= 1) {
      el.classList.add('hidden')
      return
    }
    el.classList.remove('hidden')
    el.textContent = `CHAIN ×${combo}  ×${multiplier.toFixed(1)}`
    el.classList.remove('combo--mid', 'combo--max')
    if (multiplier >= 2.0) el.classList.add('combo--max')
    else if (multiplier >= 1.3) el.classList.add('combo--mid')
  },

  showDeliveryScore(score: number, multiplier: number, isFull: boolean): void {
    const el = domRefs.deliveryScorePopup
    const fullTag = isFull ? ' 🩸FULL!' : ''
    el.textContent = `+${score}${fullTag}  ×${multiplier.toFixed(1)}`
    el.classList.remove('hidden', 'popup--flash')
    void el.offsetWidth
    el.classList.add('popup--flash')
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

  /**
   * Blood状態ラベルを更新する
   * @param percent 血液量 0〜100
   */
  updateBloodStatus(percent: number): void {
    const el = domRefs.bloodStatus
    el.classList.remove('bstatus--heavy', 'bstatus--critical', 'hidden')

    if (percent >= 100) {
      el.textContent = 'FULL'
      el.classList.add('bstatus--critical')
    } else if (percent >= 70) {
      el.textContent = 'HEAVY'
      el.classList.add('bstatus--heavy')
    } else {
      el.classList.add('hidden')
    }
  },

  showBloodFullNotice(): void {
    this._flashNotice(domRefs.bloodFullNotice)
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
  // ボタン
  // ==========================================

  onStartClick(callback: () => void): void {
    domRefs.startButton.addEventListener('click', callback, { once: true })
  },

  onRetryClick(callback: () => void): void {
    domRefs.retryButton.addEventListener('click', callback, { once: true })
  },

  // ==========================================
  // Private
  // ==========================================

  _flashNotice(el: HTMLElement): void {
    el.classList.remove('hidden', 'notice--flash')
    void el.offsetWidth
    el.classList.add('notice--flash')
    el.classList.remove('hidden')
    setTimeout(() => {
      el.classList.add('hidden')
      el.classList.remove('notice--flash')
    }, 1800)
  },
}
