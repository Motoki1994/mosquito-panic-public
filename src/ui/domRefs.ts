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
  // Top bar (game HUD wrapper)
  get topBar()             { return getElement<HTMLElement>('top-bar') },

  // HUD — スコア
  get score()              { return getElement<HTMLElement>('score') },
  get scoreGap()           { return getElement<HTMLElement>('score-gap') },
  get comboDisplay()       { return getElement<HTMLElement>('combo-display') },

  // HUD — Blood
  get bloodGauge()         { return getElement<HTMLElement>('blood-gauge-fill') },
  get bloodGaugeTrack()    { return getElement<HTMLElement>('blood-gauge-track') },
  get bloodValue()         { return getElement<HTMLElement>('blood-value') },
  get bloodStatus()        { return getElement<HTMLElement>('blood-status') },

  // HUD — Alert
  get alertGauge()         { return getElement<HTMLElement>('alert-gauge-fill') },
  get alertGaugeTrack()    { return getElement<HTMLElement>('alert-gauge-track') },
  get alertPhaseLabel()    { return getElement<HTMLElement>('alert-phase-label') },

  // HUD — Hunger
  get hungerGauge()        { return getElement<HTMLElement>('hud-hunger-fill') },
  get hungerGaugeTrack()   { return getElement<HTMLElement>('hud-hunger-gauge-track') },
  get hungerValue()        { return getElement<HTMLElement>('hud-hunger-value') },

  // HUD — Speed
  get speedIndicator()     { return getElement<HTMLElement>('speed-indicator') },

  // Alert danger glow overlay
  get alertGlow()          { return getElement<HTMLElement>('alert-glow') },

  // アクティブイベント (Right Panel top section)
  get aeFan()              { return getElement<HTMLElement>('ae-fan') },
  get aeFanDir()           { return getElement<HTMLElement>('ae-fan-dir') },
  get aeSmoke()            { return getElement<HTMLElement>('ae-smoke') },
  get aeNone()             { return getElement<HTMLElement>('ae-none') },
  get eventNotice()        { return getElement<HTMLElement>('event-notice') },

  // Right Panel (Daily Bonus)
  get rightPanel()         { return getElement<HTMLElement>('right-panel') },
  get rpDbName()           { return getElement<HTMLElement>('rp-db-name') },
  get rpDbCondition()      { return getElement<HTMLElement>('rp-db-condition') },
  get rpDbMult()           { return getElement<HTMLElement>('rp-db-mult') },
  get rpDbBarFill()        { return getElement<HTMLElement>('rp-db-bar-fill') },
  get rpDbReady()          { return getElement<HTMLElement>('rp-db-ready') },

  // 通知バナー
  get bloodFullNotice()    { return getElement<HTMLElement>('blood-full-notice') },
  get heavyNotice()        { return getElement<HTMLElement>('heavy-notice') },
  get hungerNotice()       { return getElement<HTMLElement>('hunger-notice') },
  get deliveryScorePopup() { return getElement<HTMLElement>('delivery-score-popup') },

  // グリードボーナス
  get greedNotice()        { return getElement<HTMLElement>('greed-notice') },
  get greedMultText()      { return getElement<HTMLElement>('greed-mult-text') },

  // マイルストーン
  get milestoneDisplay()   { return getElement<HTMLElement>('milestone-display') },

  // スターベーションカウントダウン
  get starvationOverlay()  { return getElement<HTMLElement>('starvation-overlay') },
  get starvationCountdown(){ return getElement<HTMLElement>('starvation-countdown') },

  // Stage (Left Panel)
  get stageLabel()         { return getElement<HTMLElement>('lp-stage-label') },

  // Notices
  get stageNotice()        { return getElement<HTMLElement>('stage-notice') },
  get itemNotice()         { return getElement<HTMLElement>('item-notice') },
  get activeEffects()      { return getElement<HTMLElement>('active-effects') },
  get missionComplete()    { return getElement<HTMLElement>('mission-complete') },
  get debuffPopup()        { return getElement<HTMLElement>('debuff-popup') },

  // Mission banner
  get missionBanner()      { return getElement<HTMLElement>('mission-banner') },
  get mbDesc()             { return getElement<HTMLElement>('mb-desc') },
  get mbProgress()         { return getElement<HTMLElement>('mb-progress') },

  // Title — daily bonus
  get titleDailyBonus()    { return getElement<HTMLElement>('title-daily-bonus') },
  get tdbCondition()       { return getElement<HTMLElement>('tdb-condition') },

  // Pause
  get pauseBtn()       { return getElement<HTMLButtonElement>('pause-btn') },
  get pauseOverlay()   { return getElement<HTMLElement>('pause-overlay') },
  get pauseResumeBtn() { return getElement<HTMLButtonElement>('pause-resume-btn') },
  get pauseTitleBtn()  { return getElement<HTMLButtonElement>('pause-title-btn') },
  get musicVolume()    { return getElement<HTMLInputElement>('music-volume') },
  get sfxVolume()      { return getElement<HTMLInputElement>('sfx-volume') },
  get musicVolVal()    { return getElement<HTMLElement>('music-vol-val') },
  get sfxVolVal()      { return getElement<HTMLElement>('sfx-vol-val') },

  // Baby portrait (Left Panel)
  get babyWrap()       { return getElement<HTMLElement>('lp-baby-wrap') },
  get babyImg()        { return getElement<HTMLImageElement>('lp-baby-img') },

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
  get nearMiss()           { return getElement<HTMLElement>('near-miss') },
  get retryButton()        { return getElement<HTMLButtonElement>('retry-btn') },
  get backTitleButton()    { return getElement<HTMLButtonElement>('back-title-btn') },
}
