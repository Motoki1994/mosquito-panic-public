import Phaser from 'phaser'
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT } from '../data/constants'
import { Player } from '../entities/Player'
import { SkinLayer } from '../entities/SkinLayer'
import { HumanHand } from '../entities/HumanHand'
import { DeliveryPoint } from '../entities/DeliveryPoint'
import { BloodSystem } from '../systems/BloodSystem'
import { WeightSystem } from '../systems/WeightSystem'
import { AlertSystem } from '../systems/AlertSystem'
import { ScoreSystem } from '../systems/ScoreSystem'
import { HungerSystem } from '../systems/HungerSystem'
import { EventSystem } from '../systems/EventSystem'
import { StageSystem } from '../systems/StageSystem'
import { SmokeSystem } from '../systems/SmokeSystem'
import { DailyBonusSystem } from '../systems/DailyBonusSystem'
import { HighScoreManager } from '../systems/HighScoreManager'
import { ItemSystem, ItemType } from '../systems/ItemSystem'
import { MissionSystem } from '../systems/MissionSystem'
import { TutorialManager } from '../systems/TutorialManager'
import { LeftPanel } from '../ui/LeftPanel'
import { TouchControls } from '../ui/TouchControls'
import { uiController, BabyState } from '../ui/uiController'
import { BALANCE } from '../data/balance'
import { JUICE, DeliverTier } from '../data/juice'
import { JuiceManager, DeathCause } from '../systems/JuiceManager'
import { sfx } from '../systems/SfxManager'

const TARGET_COUNT      = 4
const TARGET_MIN_DIST   = 150
const TARGET_MARGIN     = 80
const TARGET_RESPAWN_MS = 4000

export class GameScene extends Phaser.Scene {
  private player!: Player
  private skinLayer!: SkinLayer
  private hand!: HumanHand
  private deliveryPoint!: DeliveryPoint

  private bloodSystem!: BloodSystem
  private weightSystem!: WeightSystem
  private alertSystem!: AlertSystem
  private scoreSystem!: ScoreSystem
  private hungerSystem!: HungerSystem
  private eventSystem!: EventSystem
  private stageSystem!: StageSystem
  private smokeSystem!: SmokeSystem
  private dailyBonusSystem!: DailyBonusSystem
  private itemSystem!: ItemSystem
  private missionSystem!: MissionSystem
  private leftPanel!: LeftPanel
  private touchControls!: TouchControls

  private bestScore: number = 0
  private elapsedSec: number = 0

  private isGameOver = false
  private isPaused   = false
  private orientationPaused = false
  private orientationPauseWasInitial = false
  private hasPlayStarted = false
  private prevSmokeZones = false
  private greedActive    = false
  private _escHandler!: (e: KeyboardEvent) => void

  // ジュース演出
  private juice!: JuiceManager
  private wasSucking = false   // 吸血ループ音のエッジ検出
  private prevFull   = false   // 血液100%到達の瞬間検出

  // Active item effect timers (seconds remaining)
  private hourglassTimer:    number = 0
  private sugarDropTimer:    number = 0
  private smokeFilterTimer:  number = 0
  private shieldTimer:       number = 0

  // Baby portrait excited-state timer (seconds)
  private babyExcitedTimer: number = 0

  // Shield visual (Phaser ring that follows player)
  private shieldRing!: Phaser.GameObjects.Arc

  // Milestone system
  private static readonly MILESTONES = [2500, 5000, 7500, 10000, 15000, 20000] as const
  private milestoneIndex = 0

  // Ph4 overlay
  private ph4Overlay!: Phaser.GameObjects.Rectangle
  private ph4Warning!: Phaser.GameObjects.Text
  private ph4Active   = false

  private dpPos!: { x: number; y: number }
  private respawnTimers: Phaser.Time.TimerEvent[] = []

  // 皮膚テクスチャ背景
  private skinBackground!: Phaser.GameObjects.Image
  private prevSkinStage: string = ''
  private skinTransitioning: boolean = false

  // チュートリアル
  private tutorialManager!: TutorialManager
  private tutOverlay!: Phaser.GameObjects.Rectangle
  private tutText!: Phaser.GameObjects.Text
  private tutSubText!: Phaser.GameObjects.Text
  private tutRing!: Phaser.GameObjects.Arc
  private demoMosquito!: Phaser.GameObjects.Image
  private tutStep: number = -1
  private _tutEnterHandler!: (e: KeyboardEvent) => void
  private _tutSkipHandler!:  (e: KeyboardEvent) => void
  private _tutClickHandler!: (e: PointerEvent) => void

  constructor() { super({ key: SCENE_KEYS.GAME }) }

  preload(): void {
    this.load.image('ui_hand',  'assets/ui/human/hand.png')
    this.load.image('ui_arm',   'assets/ui/human/arm.png')
    this.load.image('ui_face',  'assets/ui/human/face.png')
    this.load.image('ui_leg',   'assets/ui/human/leg.png')
    this.load.image('skin_face', 'assets/ui/skin/skin.png')
    this.load.image('skin_arm',  'assets/ui/skin/downy hair.png')
    this.load.image('skin_leg',  'assets/ui/skin/shin-hair.png')
  }

  create(): void {
    this.isGameOver      = false
    this.isPaused        = false
    this.orientationPaused = false
    this.orientationPauseWasInitial = false
    this.hasPlayStarted = false
    this.ph4Active       = false
    this.prevSmokeZones  = false
    this.greedActive     = false
    this.milestoneIndex  = 0
    this.elapsedSec      = 0
    this.hourglassTimer  = 0
    this.sugarDropTimer  = 0
    this.smokeFilterTimer = 0
    this.shieldTimer     = 0
    this.babyExcitedTimer  = 0
    this.respawnTimers     = []
    this.prevSkinStage     = 'leg'
    this.skinTransitioning = false
    this.tutStep           = -1
    this.wasSucking        = false
    this.prevFull          = false

    // ジュースマネージャ (ヒットストップ・シェイク・パーティクル・死亡演出)
    this.juice = new JuiceManager(this)

    uiController.showGameHUD()
    uiController.setDangerVignette(0)
    uiController.setPh4Zoom(false)
    // イベントUIを明示的にリセット (前回プレイの残留状態を消去)
    uiController.hideWindIndicator()
    uiController.hideSmokeActive()

    this.bloodSystem  = new BloodSystem()
    this.weightSystem = new WeightSystem()
    this.alertSystem  = new AlertSystem()
    this.scoreSystem      = new ScoreSystem()
    this.hungerSystem     = new HungerSystem()
    this.eventSystem      = new EventSystem()
    this.stageSystem      = new StageSystem()
    this.dailyBonusSystem = new DailyBonusSystem()
    this.bestScore        = HighScoreManager.load()?.total ?? 0

    uiController.showRightPanel(this.dailyBonusSystem.getBonus())

    this.leftPanel = new LeftPanel()
    this.leftPanel.reset()
    this.leftPanel.show()
    uiController.showBabyUI()
    uiController.updateBabyState('normal')

    // 皮膚テクスチャ背景 (depth 0 — 全ゲームオブジェクトの背面)
    this.skinBackground = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'skin_leg')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(0)

    this.player = new Player(this, GAME_WIDTH / 2, GAME_HEIGHT / 2)
    this.touchControls = new TouchControls(
      (x, y) => this.player.setTouchInput(x, y),
      () => this.pauseGame(),
    )

    // Skin DOM layer
    const gameContainer = document.getElementById('game-container')!
    this.skinLayer = new SkinLayer(gameContainer, (id) => this.onTargetDepleted(id))

    // Delivery position (needed before target placement)
    this.dpPos = this.findDeliveryPosition([])
    this.spawnInitialTargets()

    this.deliveryPoint = new DeliveryPoint(
      this, this.dpPos.x, this.dpPos.y,
      (bloodAmount, isFull) => this.onDelivery(bloodAmount, isFull),
    )

    this.hand          = new HumanHand(
      this,
      () => this.triggerGameOver('hit'),
      (x, y) => {
        // ニアミス報酬 — ギリギリ回避の快感
        if (this.isGameOver || this.tutorialManager.isActive()) return
        this.juice.nearMiss(x, y)
        sfx.play('whoosh')
      },
    )
    this.smokeSystem   = new SmokeSystem(this)
    this.itemSystem    = new ItemSystem(this)
    this.missionSystem = new MissionSystem()

    // シールドリング (プレイヤーに追従する Phaser グラフィック)
    this.shieldRing = this.add.circle(0, 0, 44, 0x4488ff, 0)
    this.shieldRing.setStrokeStyle(3, 0x66bbff, 0.9)
    this.shieldRing.setVisible(false)
    this.shieldRing.setDepth(30)

    // ミッションバナーを初期化
    uiController.setMissionBanner(null)

    // Ph4 overlays (depth above hand, below game-over flash)
    this.ph4Overlay = this.add.rectangle(GAME_WIDTH/2, GAME_HEIGHT/2, GAME_WIDTH, GAME_HEIGHT, 0xff0000, 0).setDepth(80)
    this.ph4Warning = this.add.text(GAME_WIDTH/2, GAME_HEIGHT/2 - 40, '⚠  WARNING  ⚠', {
      fontFamily: "'Press Start 2P', monospace",
      fontSize: '20px',
      color: '#ff2222',
    }).setOrigin(0.5).setAlpha(0).setDepth(81)

    // 初期マイルストーン表示
    uiController.updateMilestone(GameScene.MILESTONES[0])

    // チュートリアルオーバーレイ (depth 200+ — 全ゲームオブジェクトの前面)
    // alpha 0 で開始 — step 0 の最初に 0.65 にフェードイン (tutorial OFF 時は常に非表示)
    this.tutOverlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0)
      .setDepth(200)
    this.tutText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, '', {
      fontFamily: "'Press Start 2P', monospace",
      fontSize:   '12px',
      color:      '#ffffff',
      align:      'center',
      wordWrap:   { width: 580 },
      lineSpacing: 8,
    }).setOrigin(0.5).setDepth(202).setAlpha(0)
    this.tutSubText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 70, '', {
      fontFamily: "'Rajdhani', sans-serif",
      fontSize:   '17px',
      color:      '#ffdd88',
      align:      'center',
      wordWrap:   { width: 500 },
    }).setOrigin(0.5).setDepth(202).setAlpha(0)
    this.tutRing = this.add.arc(0, 0, 70, 0, 360, false, 0xffffff, 0)
      .setStrokeStyle(3, 0xffff88, 1)
      .setDepth(201)
      .setVisible(false)

    this.tutorialManager = new TutorialManager()

    // scene.start() で渡された showTutorial フラグを確認
    // false なら即完了 (オーバーレイは alpha 0 のまま変化しない)
    const sceneData = this.scene.settings.data as { showTutorial?: boolean } | undefined
    if (sceneData?.showTutorial === false) {
      this.tutorialManager.forceComplete()
      this.incrementPlayCount()
    }
    uiController.setGameplayCursorHidden(!this.tutorialManager.isActive())

    // チュートリアル中: 手攻撃を完全無効化 (BGMはタイトル曲を継続)
    if (this.tutorialManager.isActive()) {
      this.hand.disable()
      this.touchControls.hide()
    } else {
      this.touchControls.show()
      sfx.startMusic('game')
      sfx.setMusicTension(0)
    }

    // デモ蚊 (チュートリアル自動演示用 — 実際のプレイヤーテクスチャを使用)
    this.demoMosquito = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'body_empty')
      .setScale(0.13)
      .setDepth(190)
      .setVisible(false)
      .setTint(0xff88aa)   // ピンク色のティントでデモ蚊を区別

    // ENTERキー: チュートリアル最終ステップでゲーム開始
    this._tutEnterHandler = (e: KeyboardEvent) => {
      if ((e.code === 'Enter' || e.code === 'Space') && this.tutorialManager.isWaitingForEnter()) {
        this.resetForGameStart()
      }
    }
    document.addEventListener('keydown', this._tutEnterHandler, { capture: true })

    // S キー: チュートリアルをスキップして "PRESS ENTER TO START" へジャンプ
    this._tutSkipHandler = (e: KeyboardEvent) => {
      if (e.code === 'KeyS' && this.tutorialManager.isActive() && !this.tutorialManager.isWaitingForEnter()) {
        this.tutorialManager.skipToEnd()
      }
    }
    document.addEventListener('keydown', this._tutSkipHandler, { capture: true })

    // クリック/タップ: チュートリアル最終ステップでゲーム開始
    this._tutClickHandler = (e: PointerEvent) => {
      if (!this.tutorialManager.isWaitingForEnter()) return
      e.preventDefault()
      this.resetForGameStart()
    }
    document.addEventListener('pointerdown', this._tutClickHandler, { capture: true })

    // ポーズボタン & ESCキー
    // チュートリアル中: ESC = スキップ (PRESS ENTER TO START へ)
    // 通常ゲーム中:   ESC = ポーズ/レジューム
    uiController.showPauseButton(() => this.pauseGame())
    const rotateTitleBtn = document.getElementById('rotate-title-btn') as HTMLButtonElement | null
    if (rotateTitleBtn) rotateTitleBtn.onclick = () => this.returnToTitle()
    this._escHandler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || this.isGameOver) return
      if (this.tutorialManager.isActive() && !this.tutorialManager.isWaitingForEnter()) {
        this.tutorialManager.skipToEnd()
        return
      }
      this.isPaused ? this.resumeGame() : this.pauseGame()
    }
    document.addEventListener('keydown', this._escHandler, { capture: true })

    // DOM フォーカスを解除してキー入力を Phaser に渡す
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    this.input.keyboard?.resetKeys()
  }

  update(_t: number, delta: number): void {
    if (this.isGameOver) return
    if (this.handleOrientationPause()) return
    this.hasPlayStarted = true

    // ヒットストップ中は論理時間を圧縮する (JuiceManager が実時間で管理)
    const dt = (delta / 1000) * this.juice.getTimeScale()

    // ========== チュートリアルモード (自動デモ) ==========
    // プレイヤー入力・移動を完全にブロック。タイマーも凍結。
    // デモ蚊がトゥイーンで自動的にゲームループを演示する。
    if (this.tutorialManager.isActive()) {
      this.tutorialManager.update(dt)
      this.updateTutorialOverlay()

      const bp  = this.bloodSystem.getPercent()
      const lvl = this.alertSystem.getLevel()
      this.leftPanel.updateCharacter(bp, lvl)
      // タイマー停止: updateTimer を呼ばない
      this.leftPanel.updateAreaIcons('leg')
      uiController.updateScore(0)
      return
    }
    // ==========================================

    this.player.update(delta * this.juice.getTimeScale())

    // 風イベント — 入力処理後に位置を補正
    const wind = this.eventSystem.update(dt, this.scoreSystem.getTotal())
    if (wind) this.player.applyWind(wind.windX, wind.windY, dt)

    const pos = this.player.getPosition()

    const inSafeZone = this.deliveryPoint.isPlayerInside(pos.x, pos.y)

    // Suck from skin targets
    const canSuck = !this.bloodSystem.isFull()
    const { totalSucked, isSucking } = this.skinLayer.update(
      pos.x, pos.y,
      BALANCE.SUCK_OVERLAP_RADIUS,
      dt,
      BALANCE.SUCK_RATE,   // blood units/sec
      canSuck,
    )
    if (totalSucked > 0) {
      this.bloodSystem.add(totalSucked)
    }

    // 吸血フィードバック — ループ音 (血液量でピッチ上昇) + パルス + 血滴
    if (isSucking !== this.wasSucking) {
      this.wasSucking = isSucking
      this.player.setSucking(isSucking)
      isSucking ? sfx.startSuckLoop() : sfx.stopSuckLoop()
    }
    if (isSucking) {
      sfx.setSuckPitch(this.bloodSystem.getPercent())
    }

    // 血液100%到達の瞬間 — 小ヒットストップ + 金ポップ
    const isFullNow = this.bloodSystem.isFull()
    // 満タンの間は血が垂れる (吸いすぎ感の表現)
    if (isFullNow) this.juice.bloodDrip(pos.x, pos.y)
    if (isFullNow && !this.prevFull) {
      this.juice.hitStop(JUICE.HITSTOP_FULLTANK_MS)
      this.juice.fullTankPop(pos.x, pos.y)
      sfx.play('fullTank')
    }
    this.prevFull = isFullNow

    const score        = this.scoreSystem.getTotal()
    const isInSmoke    = this.smokeSystem.update(dt, score, pos.x, pos.y)
    // Smoke blood drain (Smoke Filter / Shield がキャンセル)
    const smokeBlocked = this.smokeFilterTimer > 0 || this.shieldTimer > 0
    if (isInSmoke && !smokeBlocked) {
      this.bloodSystem.drain(BALANCE.SMOKE_BLOOD_DRAIN_RATE * dt)
    }
    const hourglassAlertMult = this.hourglassTimer > 0 ? 0 : 1.0
    const smokeAlertMult = (isInSmoke && !smokeBlocked) ? BALANCE.SMOKE_ALERT_MULT : 1.0
    const externalMult = this.stageSystem.getAlertMult() * smokeAlertMult * hourglassAlertMult

    this.alertSystem.update(dt, isSucking, this.player.getMoveSpeed(), inSafeZone, externalMult)
    this.applyWeight()
    this.scoreSystem.update(dt)
    this.stageSystem.update(score)
    this.elapsedSec += dt

    // 皮膚テクスチャ切替 (ステージが変わった時のみ)
    const currentSkinStage = this.stageSystem.getCurrentStage().id
    if (currentSkinStage !== this.prevSkinStage) {
      this.prevSkinStage = currentSkinStage
      this.switchSkinTexture(currentSkinStage)
      sfx.play('stageUp')
      this.juice.shake('medium')
    }

    // アクティブアイテムタイマー消化
    if (this.hourglassTimer   > 0) this.hourglassTimer   = Math.max(0, this.hourglassTimer   - dt)
    if (this.sugarDropTimer   > 0) this.sugarDropTimer   = Math.max(0, this.sugarDropTimer   - dt)
    if (this.smokeFilterTimer > 0) this.smokeFilterTimer = Math.max(0, this.smokeFilterTimer - dt)
    if (this.shieldTimer      > 0) this.shieldTimer      = Math.max(0, this.shieldTimer      - dt)

    // Shield / Hourglass: 空腹ドレイン完全停止
    const hungerDt = this.shieldTimer > 0 || this.hourglassTimer > 0 ? 0 : dt
    this.hungerSystem.update(hungerDt, this.stageSystem.getHungerMult())

    // アクティブアイテム残り時間HUD
    {
      const effects: { icon: string; name: string; remaining: number }[] = []
      if (this.shieldTimer      > 0) effects.push({ icon: '🛡️', name: 'SHIELD', remaining: this.shieldTimer })
      if (this.hourglassTimer   > 0) effects.push({ icon: '⏳', name: 'FREEZE', remaining: this.hourglassTimer })
      if (this.smokeFilterTimer > 0) effects.push({ icon: '🔥', name: 'SMOKE',  remaining: this.smokeFilterTimer })
      uiController.updateActiveEffects(effects)
    }

    // 赤ちゃんポートレート更新
    if (this.babyExcitedTimer > 0) this.babyExcitedTimer = Math.max(0, this.babyExcitedTimer - dt)
    {
      const hp = this.hungerSystem.getPercent()   // 0=full, 1=starving
      let babyState: BabyState
      if (this.babyExcitedTimer > 0)                                        babyState = 'excited'
      else if (hp >= BALANCE.HUNGER_CRITICAL_THRESHOLD / 100)               babyState = 'dizzy'
      else if (hp >= BALANCE.HUNGER_WARN_THRESHOLD    / 100)                babyState = 'hungry'
      else                                                                   babyState = 'normal'
      uiController.updateBabyState(babyState)
    }

    // アイテム収集チェック
    const isBehindPace = this.bestScore > 0
      && this.elapsedSec > 20
      && score < (this.bestScore / 90) * this.elapsedSec
    const itemEffect = this.itemSystem.update(
      dt,
      pos.x, pos.y,
      this.alertSystem.getPercent(),
      this.hungerSystem.getPercent(),
      this.stageSystem.getCurrentStage().id,
      isBehindPace,
    )
    if (itemEffect) {
      this.juice.collectPop(itemEffect.x, itemEffect.y, itemEffect.isDebuff)
      if (itemEffect.isDebuff) {
        sfx.play('debuff')
        this.juice.shake('small')
        uiController.hudShake()
        this.applyDebuffEffect(itemEffect.type)
        uiController.showDebuffHit(itemEffect.label)
      } else {
        sfx.play('pickup')
        this.applyItemEffect(itemEffect.type)
        uiController.showItemPickup(itemEffect.label)
      }
    }

    // ミッションシステム更新
    const missionCompleted = this.missionSystem.update(dt, isSucking)
    if (missionCompleted) {
      uiController.flashMissionComplete()
      this.itemSystem.spawnSpecific(missionCompleted.reward)
    }
    uiController.setMissionBanner(this.missionSystem.getActiveState())

    // スターベーション判定
    if (this.hungerSystem.isStarved()) {
      this.triggerGameOver('starve')
      return
    }

    this.deliveryPoint.update(
      pos.x, pos.y,
      this.bloodSystem.getAmount(),
      this.bloodSystem.isFull(),
      dt,
    )

    if (!inSafeZone) {
      this.hand.update(dt, this.alertSystem.getLevel(), pos.x, pos.y)
    }

    this.updatePh4Effect()

    // シールドリングをプレイヤーに追従させる
    if (this.shieldTimer > 0) {
      const sPos = this.player.getPosition()
      this.shieldRing.setPosition(sPos.x, sPos.y)
      this.shieldRing.setVisible(true)
      this.shieldRing.setAlpha(0.35 + Math.sin(this.elapsedSec * 10) * 0.22)
    } else {
      this.shieldRing.setVisible(false)
    }

    // Left panel sync (portrait + PHASE label + timer + area icons)
    const bp  = this.bloodSystem.getPercent()
    const lvl = this.alertSystem.getLevel()
    this.leftPanel.updateCharacter(bp, lvl)
    this.leftPanel.updateAlert(this.alertSystem.getAmount(), lvl)
    this.leftPanel.updateTimer(dt)
    this.leftPanel.updateAreaIcons(this.stageSystem.getCurrentStage().id)

    uiController.updateScore(this.scoreSystem.getTotal())
    uiController.updateScoreGap(this.scoreSystem.getTotal(), this.bestScore)
    uiController.setAlertDangerGlow(this.alertSystem.getAmount() > 80)

    // 危険ビネット — アラート60%以上で連続的に濃くなる
    const alertPct = this.alertSystem.getPercent()
    const vignette = alertPct >= JUICE.VIGNETTE_START
      ? ((alertPct - JUICE.VIGNETTE_START) / (1 - JUICE.VIGNETTE_START)) * JUICE.VIGNETTE_MAX_OPACITY
      : 0
    uiController.setDangerVignette(vignette)

    // BGM 緊張度 (Ph3+ でテンポアップ + キック)
    sfx.setMusicTension(lvl >= 3 ? 1 : 0)

    // グリードボーナス表示 + 発動時カメラシェイク
    const bloodPct = this.bloodSystem.getPercent()
    const isGreedNow = bloodPct >= BALANCE.GREED_THRESHOLD_BASE
    if (isGreedNow !== this.greedActive) {
      this.greedActive = isGreedNow
      if (isGreedNow) {
        this.cameras.main.shake(200, 0.003)
        sfx.play('greed')
      }
    }
    const greedMult = bloodPct >= BALANCE.GREED_THRESHOLD_MAX ? BALANCE.GREED_MULT_MAX
                    : isGreedNow ? BALANCE.GREED_MULT_BASE : 0
    uiController.updateGreedBonus(greedMult)

    // マイルストーン進行チェック
    const currentScore = this.scoreSystem.getTotal()
    while (
      this.milestoneIndex < GameScene.MILESTONES.length &&
      currentScore >= GameScene.MILESTONES[this.milestoneIndex]
    ) {
      const reachedMilestone = GameScene.MILESTONES[this.milestoneIndex]
      this.milestoneIndex++
      const next = this.milestoneIndex < GameScene.MILESTONES.length
        ? GameScene.MILESTONES[this.milestoneIndex]
        : null
      uiController.flashMilestoneReached(next)
      this.triggerMilestoneReward(reachedMilestone)
      // 祝祭演出: 金パーティクル噴水 + フラッシュ + シェイク
      const isFinal = reachedMilestone >= 20000
      this.juice.milestoneFountain(isFinal)
      sfx.play(isFinal ? 'fanfare' : 'milestone')
    }

    // Smoke active event status
    const hasSmokeZones = this.smokeSystem.hasActiveZones()
    if (hasSmokeZones !== this.prevSmokeZones) {
      this.prevSmokeZones = hasSmokeZones
      hasSmokeZones ? uiController.showSmokeActive() : uiController.hideSmokeActive()
    }

    // Daily bonus progress
    uiController.updateDailyBonusProgress(
      this.dailyBonusSystem.getBonus(),
      bp * 100,
      this.alertSystem.getPercent() * 100,
      this.hungerSystem.getPercent() * 100,
    )
  }

  // --------------------------------------------------

  private handleOrientationPause(): boolean {
    const blocked = document.body.classList.contains('mobile-gameplay-portrait')
    if (blocked) {
      if (!this.orientationPaused) {
        this.orientationPaused = true
        this.orientationPauseWasInitial = !this.hasPlayStarted || this.elapsedSec < 0.05
        uiController.setGameplayCursorHidden(false)
        sfx.onPause()
        this.wasSucking = false
        this.player.setSucking(false)
        this.touchControls.hide()
      }
      return true
    }

    if (this.orientationPaused) {
      this.orientationPaused = false
      if (this.orientationPauseWasInitial) {
        this.orientationPauseWasInitial = false
        uiController.setGameplayCursorHidden(!this.tutorialManager.isActive())
        if (this.tutorialManager.isActive()) {
          this.touchControls.hide()
        } else {
          this.touchControls.show()
        }
        if (this.ph4Active) sfx.startHeartbeat()
        return false
      }
      this.orientationPauseWasInitial = false
      this.pauseGame()
      return true
    }
    return false
  }

  /**
   * チュートリアルオーバーレイを現在ステップに合わせて更新する (自動デモ版)
   *
   * テキスト表示: DOM (#tut-text-panel) — skin-layer の上に確実に表示される
   * 暗幕:         Phaser tutOverlay (canvas コンテンツを暗くする)
   * スポットライト: Phaser tutRing (canvas 上、ターゲットや納品点を示す)
   * デモ蚊:       Phaser Image (canvas 上で自動移動)
   */
  private updateTutorialOverlay(): void {
    const step = this.tutorialManager.getStep()

    // Step 4: ENTER待ち — 一度だけ更新
    if (this.tutorialManager.isWaitingForEnter()) {
      if (step !== this.tutStep) {
        this.tutStep = step
        this.tweens.killTweensOf(this.tutRing)
        this.tweens.killTweensOf(this.demoMosquito)
        this.tutRing.setVisible(false)
        this.demoMosquito.setVisible(false)
        uiController.removeTutorialHighlight()
        // DOM テキストをブリンク表示
        uiController.showTutorialText('PRESS ENTER\nTO START', '[ ENTER / SPACE / CLICK ]', true)
      }
      return
    }

    // 完了済み (resetForGameStart() 後)
    if (this.tutorialManager.isDone()) return

    // ステップが変わった時だけビジュアルを更新
    if (step === this.tutStep) return
    this.tutStep = step

    // 前ステップのトゥイーンをリセット
    this.tweens.killTweensOf(this.tutRing)
    this.tweens.killTweensOf(this.demoMosquito)
    this.tutRing.setVisible(false).setAlpha(1).setScale(1)

    switch (step) {
      case 0:
        // canvas 暗幕を表示 (DOM skin-layer ターゲットはその上に見える)
        this.tutOverlay.setAlpha(0.65)
        uiController.showTutorialText(
          'You are a mosquito mother.\nFeed your hungry babies.',
          'WASD / Arrow keys to move\n[ S / ESC to skip ]',
        )
        this.demoMosquito.setVisible(false)
        uiController.showTutorialHighlightBaby()
        break

      case 1: {
        uiController.showTutorialText('Bite the red targets\nto collect blood.', '')
        uiController.removeTutorialHighlight()
        const firstTarget = this.skinLayer.targets.values().next().value
        if (firstTarget) {
          this.demoMosquito.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2).setVisible(true)
          this.tweens.add({
            targets: this.demoMosquito,
            x: firstTarget.x, y: firstTarget.y,
            duration: 1200, ease: 'Sine.easeInOut',
          })
          this.tutRing.setPosition(firstTarget.x, firstTarget.y).setRadius(50).setVisible(true)
          this.tweens.add({
            targets: this.tutRing,
            scaleX: 1.4, scaleY: 1.4, alpha: 0.4,
            duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
          })
        }
        break
      }

      case 2:
        uiController.showTutorialText('Deliver blood\nto the baby nest.', '')
        uiController.removeTutorialHighlight()
        this.tweens.add({
          targets: this.demoMosquito,
          x: this.dpPos.x, y: this.dpPos.y,
          duration: 1200, ease: 'Sine.easeInOut',
        })
        this.tutRing.setPosition(this.dpPos.x, this.dpPos.y)
          .setRadius(BALANCE.DELIVERY_RADIUS + 20).setVisible(true)
        this.tweens.add({
          targets: this.tutRing,
          scaleX: 1.4, scaleY: 1.4, alpha: 0.4,
          duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        })
        break

      case 3:
        uiController.showTutorialText("Don't get caught.\nGreed scores higher.", '')
        uiController.removeTutorialHighlight()
        this.tweens.killTweensOf(this.demoMosquito)
        this.demoMosquito.setVisible(false)
        break
    }
  }

  /**
   * 皮膚テクスチャをフェードで切り替える
   * fade out (100ms) → テクスチャ変更 → fade in (100ms)
   */
  private switchSkinTexture(stageId: string): void {
    if (this.skinTransitioning) return
    this.skinTransitioning = true

    const textureKey = stageId === 'face' ? 'skin_face'
                     : stageId === 'arm'  ? 'skin_arm'
                     : 'skin_leg'

    this.tweens.add({
      targets:  this.skinBackground,
      alpha:    0,
      duration: 150,
      ease:     'Linear',
      onComplete: () => {
        this.skinBackground.setTexture(textureKey)
        this.skinBackground.setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
        this.tweens.add({
          targets:  this.skinBackground,
          alpha:    1,
          duration: 150,
          ease:     'Linear',
          onComplete: () => { this.skinTransitioning = false },
        })
      },
    })
  }

  private spawnInitialTargets(): void {
    for (let i = 0; i < TARGET_COUNT; i++) this.placeTarget()
  }

  private placeTarget(): void {
    const margin   = TARGET_MARGIN
    const maxTries = 60

    const getExistingPositions = () =>
      [...this.skinLayer.targets.values()].map(t => ({ x: t.x, y: t.y }))

    // Stage-based distance tier from delivery point
    const stageId = this.stageSystem.getCurrentStage().id
    const rand    = Math.random()
    let minDistFromDelivery: number

    if (stageId === 'face') {
      // 60% far, 30% medium, 10% near
      minDistFromDelivery = rand < 0.60 ? BALANCE.TARGET_DIST_FAR
                          : rand < 0.90 ? BALANCE.TARGET_DIST_MEDIUM
                          : BALANCE.DELIVERY_MIN_DIST_FROM_SPOT
    } else if (stageId === 'arm') {
      // 25% far, 40% medium, 35% near
      minDistFromDelivery = rand < 0.25 ? BALANCE.TARGET_DIST_FAR
                          : rand < 0.65 ? BALANCE.TARGET_DIST_MEDIUM
                          : BALANCE.DELIVERY_MIN_DIST_FROM_SPOT
    } else {
      // LEG: 0% far, 40% medium, 60% near
      minDistFromDelivery = rand < 0.40 ? BALANCE.TARGET_DIST_MEDIUM
                          : BALANCE.DELIVERY_MIN_DIST_FROM_SPOT
    }

    // Visual tier for the target ring
    const tier: 'near' | 'medium' | 'far' =
      minDistFromDelivery >= BALANCE.TARGET_DIST_FAR    ? 'far'    :
      minDistFromDelivery >= BALANCE.TARGET_DIST_MEDIUM ? 'medium' : 'near'

    for (let t = 0; t < maxTries; t++) {
      const x = Phaser.Math.Between(margin, GAME_WIDTH  - margin)
      const y = Phaser.Math.Between(margin, GAME_HEIGHT - margin)

      if (Phaser.Math.Distance.Between(x, y, GAME_WIDTH/2, GAME_HEIGHT/2) < 80) continue
      if (Phaser.Math.Distance.Between(x, y, this.dpPos.x, this.dpPos.y) < minDistFromDelivery) continue

      const tooClose = getExistingPositions().some(p =>
        Phaser.Math.Distance.Between(x, y, p.x, p.y) < TARGET_MIN_DIST)
      if (tooClose) continue

      this.skinLayer.addTarget(x, y, tier)
      return
    }
    // Fallback to minimum distance only
    for (let t = 0; t < 30; t++) {
      const x = Phaser.Math.Between(margin, GAME_WIDTH  - margin)
      const y = Phaser.Math.Between(margin, GAME_HEIGHT - margin)
      if (Phaser.Math.Distance.Between(x, y, this.dpPos.x, this.dpPos.y) >= BALANCE.DELIVERY_MIN_DIST_FROM_SPOT) {
        this.skinLayer.addTarget(x, y, 'near')
        return
      }
    }
    this.skinLayer.addTarget(
      Phaser.Math.Between(margin, GAME_WIDTH  - margin),
      Phaser.Math.Between(margin, GAME_HEIGHT - margin),
      'near',
    )
  }

  private onTargetDepleted(_id: number): void {
    const timer = this.time.addEvent({
      delay: TARGET_RESPAWN_MS,
      callback: () => { if (!this.isGameOver) this.placeTarget() },
    })
    this.respawnTimers.push(timer)

    // BITE RUSH ミッション進行
    const missionResult = this.missionSystem.onTargetCollected()
    if (missionResult) {
      uiController.flashMissionComplete()
      this.itemSystem.spawnSpecific(missionResult.reward)
    }
  }

  private findDeliveryPosition(_existingPositions: { x: number; y: number }[]): { x: number; y: number } {
    const margin = BALANCE.DELIVERY_EDGE_MARGIN
    for (let i = 0; i < 60; i++) {
      const x = Phaser.Math.Between(margin, GAME_WIDTH  - margin)
      const y = Phaser.Math.Between(margin, GAME_HEIGHT - margin)
      if (Phaser.Math.Distance.Between(x, y, GAME_WIDTH/2, GAME_HEIGHT/2) >= BALANCE.DELIVERY_MIN_DIST_FROM_PLAYER)
        return { x, y }
    }
    return { x: GAME_WIDTH - 120, y: GAME_HEIGHT - 100 }
  }

  private applyWeight(): void {
    const bp    = this.bloodSystem.getPercent()
    const speed = this.weightSystem.calcSpeed(bp)
    this.player.setSpeed(speed)
    this.player.updateBodyScale(bp)
    // ratio is stored in weightSystem.lastRatio for left panel
  }

  private updatePh4Effect(): void {
    const isRage = this.alertSystem.getLevel() === 4
    if (isRage === this.ph4Active) return
    this.ph4Active = isRage

    if (isRage) {
      this.tweens.killTweensOf([this.ph4Overlay, this.ph4Warning])
      this.tweens.add({ targets: this.ph4Overlay, alpha: 0.18, duration: 300, yoyo: true, repeat: -1 })
      this.tweens.add({ targets: this.ph4Warning, alpha: 1,    duration: 250, yoyo: true, repeat: -1 })
      // RAGE 突入: ハートビート + 軽いズームで緊張感を演出
      sfx.startHeartbeat()
      uiController.setPh4Zoom(true)
    } else {
      this.tweens.killTweensOf([this.ph4Overlay, this.ph4Warning])
      this.ph4Overlay.setAlpha(0)
      this.ph4Warning.setAlpha(0)
      sfx.stopHeartbeat()
      uiController.setPh4Zoom(false)
    }
  }

  private onDelivery(bloodAmount: number, isFull: boolean): void {
    // チュートリアル中は納品処理しない (deliveryPoint を更新しないため通常は発火しない)
    if (this.tutorialManager.isActive()) return

    const alertPercent   = this.alertSystem.getPercent()
    const hungerBonus    = this.hungerSystem.getBonus()
    const stageMult      = this.stageSystem.getScoreMult()
    const dailyMult      = this.dailyBonusSystem.applyBonus(
      bloodAmount / BALANCE.MAX_BLOOD,
      isFull,
      alertPercent,
      this.hungerSystem.getPercent(),
    )
    // ラストセカンドボーナス: 空腹が85%以上 (満腹度15%以下) で納品
    const lastSecondMult = this.hungerSystem.getPercent() >= BALANCE.LAST_SECOND_THRESHOLD
      ? BALANCE.LAST_SECOND_MULT : 1.0

    const { gained } = this.scoreSystem.deliver(
      bloodAmount, isFull, alertPercent, hungerBonus, stageMult, dailyMult, lastSecondMult,
    )
    this.bloodSystem.reset()
    this.alertSystem.reduceOnDelivery(isFull)
    this.hungerSystem.feed(bloodAmount)
    // 赤ちゃんが喜ぶ — 納品直後に excited ポートレートを一定時間表示
    this.babyExcitedTimer = 1.5

    // --- 納品ジュース: 獲得スコアに応じて演出を階層化 ---
    const tier: DeliverTier =
      gained >= JUICE.DELIVER_TIER_HUGE   ? 'huge'   :
      gained >= JUICE.DELIVER_TIER_BIG    ? 'big'    :
      gained >= JUICE.DELIVER_TIER_MEDIUM ? 'medium' : 'small'

    this.juice.hitStop(JUICE.HITSTOP_DELIVER_MS[tier])
    if (tier === 'medium')    this.juice.shake('small')
    else if (tier === 'big')  this.juice.shake('medium')
    else if (tier === 'huge') {
      this.juice.shake('huge')
      this.juice.flash(120, 255, 255, 220)
    }
    this.juice.deliveryBurst(this.dpPos.x, this.dpPos.y, tier, isFull)
    sfx.playDeliver(tier)
    sfx.playCombo(this.scoreSystem.getChain())
    uiController.spawnFlyingScore(
      this.dpPos.x, this.dpPos.y, `+${gained.toLocaleString('en-US')}`,
    )

    // GREEDY RUN ミッション進行
    const missionResult = this.missionSystem.onDelivery(bloodAmount / BALANCE.MAX_BLOOD)
    if (missionResult) {
      uiController.flashMissionComplete()
      this.itemSystem.spawnSpecific(missionResult.reward)
    }
  }

  /** プレイ回数を localStorage に記録 (チュートリアルOFFデフォルト切替用) */
  private incrementPlayCount(): void {
    const count = parseInt(localStorage.getItem('mosquito_plays') ?? '0') + 1
    localStorage.setItem('mosquito_plays', String(count))
  }

  /**
   * チュートリアル完了後に ENTER で呼ばれる。
   * オーバーレイをフェードアウトし全ゲーム状態をリセットして本番ゲームを開始する。
   */
  private resetForGameStart(): void {
    uiController.setGameplayCursorHidden(true)

    // ハンドラを外す (二重呼び出し防止)
    document.removeEventListener('keydown', this._tutEnterHandler, { capture: true })
    document.removeEventListener('keydown', this._tutSkipHandler,  { capture: true })
    document.removeEventListener('pointerdown', this._tutClickHandler, { capture: true })

    // プレイカウントを +1 (2回目以降はチュートリアルがOFF デフォルト)
    this.incrementPlayCount()

    // チュートリアル完了 → isActive() が false になりゲームループが通常に戻る
    this.tutorialManager.confirmStart()

    // 手攻撃を再開
    this.hand.enable()
    this.touchControls.show()

    // 演出状態をリセットして本番用 BGM を開始
    this.juice.reset()
    this.wasSucking = false
    this.prevFull   = false
    uiController.setDangerVignette(0)
    uiController.setPh4Zoom(false)
    sfx.startMusic('game')
    sfx.setMusicTension(0)

    // オーバーレイをフェードアウト
    this.tweens.killTweensOf(this.tutSubText)
    this.tweens.add({
      targets:  [this.tutOverlay, this.tutText, this.tutSubText],
      alpha:    0,
      duration: 400,
      ease:     'Linear',
    })
    uiController.removeTutorialHighlight()
    uiController.hideTutorialText()
    this.tweens.killTweensOf(this.demoMosquito)
    this.demoMosquito.setVisible(false)

    // ゲームプレイ状態リセット
    this.bloodSystem.reset()
    this.alertSystem.reset()
    this.hungerSystem.reset()
    this.scoreSystem.reset()
    this.stageSystem  = new StageSystem()
    this.eventSystem  = new EventSystem()
    this.elapsedSec   = 0
    this.hourglassTimer   = 0
    this.sugarDropTimer   = 0
    this.smokeFilterTimer = 0
    this.shieldTimer      = 0
    this.babyExcitedTimer = 0
    this.milestoneIndex   = 0
    this.greedActive      = false
    this.prevSkinStage    = 'leg'
    this.skinTransitioning = false

    // アイテムシステムをリセット
    this.itemSystem.destroy()
    this.itemSystem = new ItemSystem(this)

    // リスポーンタイマーをクリア
    this.respawnTimers.forEach(t => t.destroy())
    this.respawnTimers = []

    // UI リセット
    this.leftPanel.reset()
    uiController.updateScore(0)
    uiController.updateScoreGap(0, this.bestScore)
    uiController.updateMilestone(GameScene.MILESTONES[0])
    uiController.updateBabyState('normal')
    uiController.updateActiveEffects([])
    uiController.setMissionBanner(null)
    uiController.updateGreedBonus(0)
    this.shieldRing.setVisible(false)
  }

  private pauseGame(): void {
    if (this.isGameOver || this.isPaused) return
    this.isPaused = true
    uiController.setGameplayCursorHidden(false)
    this.touchControls.hide()
    // ループ音を止める (BGMは残す) — 再開時はエッジ検出で自動復帰
    sfx.onPause()
    this.wasSucking = false
    this.player.setSucking(false)
    this.scene.pause()
    uiController.showPauseOverlay(
      () => this.resumeGame(),
      () => this.returnToTitle(),
    )
  }

  private resumeGame(): void {
    if (!this.isPaused) return
    this.isPaused = false
    uiController.hidePauseOverlay()
    uiController.setGameplayCursorHidden(!this.tutorialManager.isActive())
    if (this.tutorialManager.isActive()) {
      this.touchControls.hide()
    } else {
      this.touchControls.show()
    }
    this.scene.resume()
    // Ph4 継続中ならハートビートを再開
    if (this.ph4Active) sfx.startHeartbeat()
    // DOM フォーカスを解除してキー入力を Phaser に戻す
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    this.input.keyboard?.resetKeys()
  }

  private returnToTitle(): void {
    this.isPaused = false
    uiController.setGameplayCursorHidden(false)
    this.touchControls.destroy()
    sfx.stopSuckLoop()
    sfx.stopHeartbeat()
    sfx.setMusicTension(0)
    sfx.startMusic('title')
    this.juice.reset()
    uiController.clearNotices()
    uiController.setDangerVignette(0)
    uiController.setPh4Zoom(false)
    uiController.hidePauseOverlay()
    uiController.hidePauseButton()
    document.removeEventListener('keydown', this._escHandler,      { capture: true })
    document.removeEventListener('keydown', this._tutEnterHandler,  { capture: true })
    document.removeEventListener('keydown', this._tutSkipHandler,   { capture: true })
    document.removeEventListener('pointerdown', this._tutClickHandler, { capture: true })
    const rotateTitleBtn = document.getElementById('rotate-title-btn') as HTMLButtonElement | null
    if (rotateTitleBtn) rotateTitleBtn.onclick = null
    this.leftPanel.hide()
    uiController.hideBabyUI()
    uiController.hideRightPanel()
    uiController.hideGameHUD()
    uiController.setAlertDangerGlow(false)
    uiController.updateGreedBonus(0)
    uiController.hideStarvationCountdown()
    uiController.hideMilestone()
    uiController.updateActiveEffects([])
    uiController.setMissionBanner(null)
    uiController.hideTutorialText()
    this.skinLayer.destroy()
    this.smokeSystem.destroy()
    this.itemSystem.destroy()
    this.respawnTimers.forEach(t => t.destroy())
    this.scene.resume()
    this.scene.start(SCENE_KEYS.TITLE)
  }

  /**
   * ゲームオーバー — 死因別の演出シーケンスを流してから ResultScene へ。
   *   hit:    フリーズ → スローモ + ズーム + 蚊が赤く回転落下 → 赤ビネット
   *   starve: 青灰フラッシュ + 力なく降下
   * HUD は演出終了まで残す (唐突な消滅を防ぐ)。
   */
  private triggerGameOver(cause: DeathCause): void {
    if (this.isGameOver) return
    this.isGameOver = true
    uiController.setGameplayCursorHidden(false)
    this.touchControls.hide()
    document.removeEventListener('keydown', this._escHandler,      { capture: true })
    document.removeEventListener('keydown', this._tutEnterHandler,  { capture: true })
    document.removeEventListener('keydown', this._tutSkipHandler,   { capture: true })
    document.removeEventListener('pointerdown', this._tutClickHandler, { capture: true })
    const rotateTitleBtn = document.getElementById('rotate-title-btn') as HTMLButtonElement | null
    if (rotateTitleBtn) rotateTitleBtn.onclick = null
    uiController.hidePauseButton()

    // ループ音・緊張演出を停止して死亡音へ
    sfx.stopSuckLoop()
    sfx.stopHeartbeat()
    sfx.setMusicTension(0)
    sfx.stopMusic()
    sfx.play(cause === 'hit' ? 'death' : 'starveDeath')

    this.player.setSucking(false)
    uiController.clearNotices()
    uiController.setDangerVignette(0)
    uiController.setPh4Zoom(false)
    uiController.hideTutorialText()
    uiController.removeTutorialHighlight()
    uiController.hideStarvationCountdown()

    // 敵とターゲットは即座に停止 (インパクトで画面が静止する)
    this.hand.disable()
    this.skinLayer.destroy()
    this.respawnTimers.forEach(t => t.destroy())

    const breakdown = this.scoreSystem.getBreakdown()

    this.juice.deathSequence(cause, this.player.getSprite(), () => {
      uiController.hideGameHUD()
      uiController.updateGreedBonus(0)
      uiController.hideMilestone()
      uiController.updateActiveEffects([])
      uiController.setMissionBanner(null)
      this.leftPanel.hide()
      uiController.hideBabyUI()
      uiController.hideRightPanel()
      uiController.setAlertDangerGlow(false)
      this.smokeSystem.destroy()
      this.itemSystem.destroy()
      this.touchControls.destroy()
      this.hand.destroy()
      this.deliveryPoint.destroy()
      this.scene.start(SCENE_KEYS.RESULT, { breakdown })
    })
  }

  private applyItemEffect(type: ItemType): void {
    switch (type) {
      case 'hourglass':
        // 空腹ドレイン70%・アラート上昇50% に減速
        this.hourglassTimer = BALANCE.HOURGLASS_DURATION_SEC
        this.cameras.main.flash(300, 255, 220, 0, true)
        break
      case 'calm_mist':
        // アラートを20ポイント直接削減
        this.alertSystem.reduce(20)
        this.cameras.main.flash(300, 0, 200, 255, true)
        break
      case 'sugar_drop':
        // 空腹を15単位直接回復 (hunger値を15下げる)
        this.hungerSystem.reduceDirect(15)
        this.cameras.main.flash(300, 255, 100, 180, true)
        break
      case 'blood_boost':
        // 血液量を20単位即時補充
        this.bloodSystem.add(20)
        this.cameras.main.flash(300, 255, 50, 50, true)
        break
      case 'smoke_filter':
        // 煙による血液ドレインを無効化
        this.smokeFilterTimer = BALANCE.SMOKE_FILTER_DURATION_SEC
        this.cameras.main.flash(300, 100, 255, 50, true)
        break
      case 'shield':
        // 全環境ダメージ (煙・空腹ドレイン) を遮断
        this.shieldTimer = BALANCE.SHIELD_DURATION_SEC
        this.cameras.main.flash(400, 60, 120, 255, true)
        break
    }
  }

  private applyDebuffEffect(type: ItemType): void {
    switch (type) {
      case 'rotten_blood':
        // 血液 -25%
        this.bloodSystem.drain(BALANCE.MAX_BLOOD * 0.25)
        this.cameras.main.flash(250, 180, 0, 0, true)
        break
      case 'panic_surge':
        // アラート +30
        this.alertSystem.addDirect(30)
        this.cameras.main.flash(250, 130, 0, 170, true)
        break
      case 'starvation_spike':
        // 空腹 +30 (満腹度を下げる)
        this.hungerSystem.addDirect(30)
        this.cameras.main.flash(250, 160, 80, 0, true)
        break
    }
  }

  private triggerMilestoneReward(milestone: number): void {
    switch (milestone) {
      case 2500:
        // ランダムアイテムをスポーン
        this.itemSystem.spawnSpecific(['hourglass', 'calm_mist', 'sugar_drop', 'blood_boost', 'smoke_filter'][Math.floor(Math.random() * 5)] as ItemType)
        break
      case 5000:
        // アラートを20ポイント削減
        this.alertSystem.reduce(20)
        uiController.showItemPickup('🎯 ALERT −20!')
        break
      case 7500:
        // 空腹を15単位回復
        this.hungerSystem.reduceDirect(15)
        uiController.showItemPickup('🎯 BABIES FED!')
        break
      case 10000:
        // Blood Boost + Hourglass をスポーン
        this.itemSystem.spawnSpecific('blood_boost')
        this.itemSystem.spawnSpecific('hourglass')
        break
      case 15000:
        // Hourglass をスポーン
        this.itemSystem.spawnSpecific('hourglass')
        break
      case 20000:
        // 祝福: アラートリセット + 空腹回復 (シェイク/フラッシュは milestoneFountain 側で発火)
        this.alertSystem.reduce(30)
        this.hungerSystem.reduceDirect(30)
        uiController.showItemPickup('🌟 MAX STAGE BONUS!')
        break
    }
  }
}
