/**
 * LeftPanel
 *
 * DOM-based left side UI panel.
 * Shows contextual information only — real-time meters live in the top HUD.
 *
 *   - Mosquito portrait (changes by blood level × alert state)
 *   - PHASE label (CALM / ALERT / DANGER / RAGE)
 *   - AREA label (LEG / ARM / NECK / FACE)
 *   - Timer
 */

import { AlertLevel } from '../systems/AlertSystem'

type BloodBucket = 'empty' | '25' | '50' | '100'
type AlertState  = 'normal' | 'alert'

export class LeftPanel {
  private panel: HTMLElement

  private charImg:    HTMLImageElement
  private alertLabel: HTMLElement
  private timerEl:    HTMLElement

  private elapsedSec: number = 0

  constructor() {
    this.panel = this.get('left-panel')

    this.charImg    = this.get<HTMLImageElement>('lp-char-img')
    this.alertLabel = this.get('lp-alert-label')
    this.timerEl    = this.get('lp-timer-value')
  }

  // --------------------------------------------------

  /**
   * Update PHASE label from alert level.
   * Blood fill is handled by the HUD; only the label is shown here.
   */
  updateAlert(_amount: number, level: AlertLevel): void {
    const labels: Record<AlertLevel, string> = { 1: 'CALM', 2: 'ALERT', 3: 'DANGER', 4: 'RAGE' }
    this.alertLabel.textContent = labels[level]
    this.alertLabel.className = `lp-stat-value lp-phase-label lp-phase--lv${level}`
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
