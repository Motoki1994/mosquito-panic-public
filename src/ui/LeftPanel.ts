/**
 * LeftPanel
 *
 * DOM-based left side UI panel.
 * Shows:
 *   - Mosquito UI character (changes by blood level × alert state)
 *   - Score
 *   - Speed
 *   - Blood bar
 *   - Alert bar
 *   - Timer
 *
 * The panel element (#left-panel) must exist in index.html.
 */

import { AlertLevel } from '../systems/AlertSystem'

/** Blood level bucket for UI character selection */
type BloodBucket = 'empty' | '25' | '50' | '100'
type AlertState  = 'normal' | 'alert'

export class LeftPanel {
  private panel: HTMLElement

  private charImg:    HTMLImageElement
  private scoreEl:    HTMLElement
  private speedEl:    HTMLElement
  private bloodFill:  HTMLElement
  private alertFill:  HTMLElement
  private alertLabel: HTMLElement
  private timerEl:    HTMLElement

  private elapsedSec: number = 0

  constructor() {
    this.panel = this.get('left-panel')

    this.charImg    = this.get<HTMLImageElement>('lp-char-img')
    this.scoreEl    = this.get('lp-score-value')
    this.speedEl    = this.get('lp-speed-value')
    this.bloodFill  = this.get('lp-blood-fill')
    this.alertFill  = this.get('lp-alert-fill')
    this.alertLabel = this.get('lp-alert-label')
    this.timerEl    = this.get('lp-timer-value')
  }

  // --------------------------------------------------

  updateScore(score: number): void {
    this.scoreEl.textContent = String(Math.floor(score))
  }

  updateSpeed(ratio: number): void {
    this.speedEl.textContent = `${Math.round(ratio * 100)}%`
    this.speedEl.className = 'lp-stat-value lp-speed ' +
      (ratio >= 0.7 ? 'spd--fast' : ratio >= 0.4 ? 'spd--mid' : 'spd--slow')
  }

  updateBlood(percent: number): void {
    this.bloodFill.style.width = `${Math.max(0, Math.min(100, percent))}%`
  }

  updateAlert(amount: number, level: AlertLevel): void {
    this.alertFill.style.width = `${Math.max(0, Math.min(100, amount))}%`

    const labels: Record<AlertLevel, string> = { 1: 'CALM', 2: 'ALERT', 3: 'DANGER', 4: 'RAGE' }
    this.alertLabel.textContent = labels[level]
    this.alertFill.className = `lp-bar-fill lp-alert-fill lp-alert--lv${level}`
  }

  updateTimer(dt: number): void {
    this.elapsedSec += dt
    const m = Math.floor(this.elapsedSec / 60)
    const s = Math.floor(this.elapsedSec % 60)
    this.timerEl.textContent = `${m}:${String(s).padStart(2, '0')}`
  }

  /**
   * Switch the mosquito character image based on blood % and alert state.
   * @param bloodPercent  0–1
   * @param alertLevel    1–4
   */
  updateCharacter(bloodPercent: number, alertLevel: AlertLevel): void {
    const bucket: BloodBucket =
      bloodPercent >= 1.0 ? '100'
      : bloodPercent >= 0.5 ? '50'
      : bloodPercent >= 0.25 ? '25'
      : 'empty'

    const state: AlertState = alertLevel >= 2 ? 'alert' : 'normal'
    const key = `${bucket}_${state}` as const

    const MAP: Record<string, string> = {
      'empty_normal': 'assets/ui/mosquito/mosquito_ui_empty_normal.png',
      'empty_alert':  'assets/ui/mosquito/mosquito_ui_empty_alert.png',
      '25_normal':    'assets/ui/mosquito/mosquito_ui_25_normal.png',
      '25_alert':     'assets/ui/mosquito/mosquito_ui_25_alert.png',
      '50_normal':    'assets/ui/mosquito/mosquito_ui_50_normal.png',
      '50_alert':     'assets/ui/mosquito/mosquito_ui_50_alert.png',
      '100_normal':   'assets/ui/mosquito/mosquito_ui_100_normal.png',
      '100_alert':    'assets/ui/mosquito/mosquito_ui_100_alert.png',
    }

    const src = MAP[key]
    if (this.charImg.dataset.key !== key) {
      this.charImg.src = src
      this.charImg.dataset.key = key
    }
  }

  reset(): void {
    this.elapsedSec = 0
    this.timerEl.textContent = '0:00'
  }

  show(): void { this.panel.classList.remove('hidden') }
  hide(): void { this.panel.classList.add('hidden') }

  // --------------------------------------------------

  private get<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id)
    if (!el) throw new Error(`LeftPanel: #${id} not found`)
    return el as T
  }
}
