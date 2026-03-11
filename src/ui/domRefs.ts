/**
 * DOM要素の参照をまとめて管理する
 * 存在しない要素への参照はエラーを投げる
 */

function getElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`DOM要素が見つかりません: #${id}`)
  return el as T
}

export const domRefs = {
  // HUD — スコア
  get score()              { return getElement<HTMLElement>('score') },
  get comboDisplay()       { return getElement<HTMLElement>('combo-display') },

  // HUD — Blood
  get bloodGauge()         { return getElement<HTMLElement>('blood-gauge-fill') },
  get bloodGaugeTrack()    { return getElement<HTMLElement>('blood-gauge-track') },
  get bloodValue()         { return getElement<HTMLElement>('blood-value') },      // 数値表示
  get bloodStatus()        { return getElement<HTMLElement>('blood-status') },     // HEAVY / CRITICAL

  // HUD — Alert
  get alertGauge()         { return getElement<HTMLElement>('alert-gauge-fill') },
  get alertGaugeTrack()    { return getElement<HTMLElement>('alert-gauge-track') },
  get alertPhaseLabel()    { return getElement<HTMLElement>('alert-phase-label') }, // CALM / ALERT / DANGER / RAGE

  // HUD — Speed
  get speedIndicator()     { return getElement<HTMLElement>('speed-indicator') },

  // 通知バナー
  get bloodFullNotice()    { return getElement<HTMLElement>('blood-full-notice') },
  get heavyNotice()        { return getElement<HTMLElement>('heavy-notice') },
  get deliveryScorePopup() { return getElement<HTMLElement>('delivery-score-popup') },

  // タイトル
  get titleScreen()    { return getElement<HTMLElement>('title-screen') },
  get titleHighScore() { return getElement<HTMLElement>('title-highscore') },
  get startButton()    { return getElement<HTMLButtonElement>('start-btn') },

  // リザルト
  get resultScreen()       { return getElement<HTMLElement>('result-screen') },
  get finalScore()         { return getElement<HTMLElement>('final-score') },
  get resultDelivScore()   { return getElement<HTMLElement>('result-delivery-score') },
  get resultDelivCount()   { return getElement<HTMLElement>('result-delivery-count') },
  get resultSurvivalSec()  { return getElement<HTMLElement>('result-survival-sec') },
  get resultHighScore()    { return getElement<HTMLElement>('result-highscore') },
  get newRecordBadge()     { return getElement<HTMLElement>('new-record-badge') },
  get retryButton()        { return getElement<HTMLButtonElement>('retry-btn') },
}
