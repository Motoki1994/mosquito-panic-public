/**
 * ゲームバランス調整用の数値
 * デザイナーが触る値はここに集約する
 */

export const BALANCE = {
  // --------------------------------------------------
  // プレイヤー
  // --------------------------------------------------

  /** プレイヤー基本移動速度 (px/s) */
  PLAYER_BASE_SPEED: 200,

  /**
   * 血液量ごとの速度減衰係数
   * penaltyFactor = PENALTY_PER_UNIT × MAX_BLOOD
   * ratio(満タン) = max(SPEED_MIN_RATIO, 1 - penaltyFactor)
   */
  BLOOD_SPEED_PENALTY_PER_UNIT: 0.013,

  /**
   * 最低速度保証 (BASE_SPEEDに対する比率)
   * 0.40 → 満タンで 200 × 0.40 = 80px/s
   *
   * 設計根拠:
   *   Ph4 (SCATTER=32, HIT_RADIUS=74) の回避に必要な移動距離 = 32+74 = 106px
   *   予兆時間 = WARN_MS(600) + DESCEND_MS(400) = 1000ms
   *   80px/s × 1.0s = 80px → Ph4でも「動けばギリギリ逃げられる」緊張感
   *   (旧0.32=64px/s では 0.6s+降下0.4s=1sで64px → 106px圏外に出られず詰んでいた)
   */
  PLAYER_SPEED_MIN_RATIO: 0.40,

  // --------------------------------------------------
  // 血液
  // --------------------------------------------------

  MAX_BLOOD: 100,
  SUCK_RATE: 10,
  RELEASE_RATE: 20,
  BLOOD_SPOT_RADIUS: 18,
  BLOOD_SPOT_MAX: 4,
  BLOOD_SPOT_MIN_DIST: 150,
  BLOOD_SPOT_RESPAWN_MS: 4000,
  SUCK_OVERLAP_RADIUS: 26,

  // --------------------------------------------------
  // 納品 (DeliveryPoint)
  // --------------------------------------------------

  DELIVERY_RADIUS: 36,
  SCORE_PER_BLOOD_DELIVERED: 10,

  // --------------------------------------------------
  // 納品ボーナス倍率
  // --------------------------------------------------

  DELIVERY_FULL_BONUS: 1.5,
  DELIVERY_HIGH_VOLUME_THRESHOLD: 0.9,
  DELIVERY_HIGH_VOLUME_BONUS: 1.3,

  DELIVERY_DANGER_LV1_THRESHOLD: 0.5,
  DELIVERY_DANGER_LV1_MULT:      1.2,
  DELIVERY_DANGER_LV2_THRESHOLD: 0.8,
  DELIVERY_DANGER_LV2_MULT:      1.5,

  DELIVERY_CHAIN_TIMEOUT_SEC: 8,
  DELIVERY_CHAIN_MULT: [1.0, 1.0, 1.2, 1.4, 1.6] as readonly number[],

  DELIVERY_MIN_DIST_FROM_PLAYER: 320,
  DELIVERY_MIN_DIST_FROM_SPOT:   200,
  DELIVERY_EDGE_MARGIN: 70,

  /**
   * 納品チャージ時間 (秒)
   * プレイヤーが納品エリア内に滞在し続けないと納品されない
   * 手の攻撃は安全地帯で止まるが、空腹タイマーは進み続けるため
   * 「早く戻って早く吸いに行く」動機が生まれる
   */
  DELIVERY_CHARGE_SEC: 2.0,

  // --------------------------------------------------
  // HungerSystem (赤ちゃんの空腹度)
  // --------------------------------------------------

  /** ゲーム開始時の空腹初期値 — 序盤から緊張感を生む */
  HUNGER_INITIAL: 40,

  /** 空腹上昇速度 (/s) — LEGステージ基準 */
  HUNGER_RATE: 1.0,

  /**
   * 納品時の空腹削減係数
   * 血液量 × この値 だけ空腹が下がる
   */
  HUNGER_FEED_RATIO: 0.5,

  /** 警告通知を出す閾値 (%) — 満腹度20%以下で警告 = 空腹80%以上 */
  HUNGER_WARN_THRESHOLD: 80,

  /**
   * 空腹100%時のスコアボーナス最大倍率
   */
  HUNGER_MAX_BONUS: 2.0,

  /** スターベーションカウントダウン開始閾値 — 空腹がこの値以上で危機 */
  HUNGER_CRITICAL_THRESHOLD: 90,

  /** カウントダウン秒数 */
  HUNGER_STARVATION_COUNTDOWN_SEC: 10,

  /**
   * 空腹段階別ドレイン倍率
   * hunger 0–40  (fullness 100–60%): slow
   * hunger 40–70 (fullness 60–30%): normal
   * hunger 70–90 (fullness 30–10%): fast
   */
  HUNGER_DRAIN_SLOW_MULT:   0.5,
  HUNGER_DRAIN_NORMAL_MULT: 1.0,
  HUNGER_DRAIN_FAST_MULT:   2.0,

  /**
   * ラストセカンド納品
   * hunger >= この閾値 (fullness <= 15%) で特別ボーナス
   */
  LAST_SECOND_THRESHOLD: 0.85,
  LAST_SECOND_MULT: 2.5,

  // --------------------------------------------------
  // Item durations & effect multipliers
  // --------------------------------------------------

  /** Hourglass 持続時間 (秒) */
  HOURGLASS_DURATION_SEC: 8,
  /** Hourglass 発動中の空腹ドレイン倍率 (0=完全停止 → 0.7=70%速度) */
  HOURGLASS_HUNGER_MULT: 0.7,
  /** Hourglass 発動中のアラート上昇速度倍率 */
  HOURGLASS_ALERT_MULT: 0.5,

  /** Smoke Filter 持続時間 (秒) */
  SMOKE_FILTER_DURATION_SEC: 12,

  /** Shield 持続時間 (秒) — 全環境ダメージを遮断 */
  SHIELD_DURATION_SEC: 4,

  // --------------------------------------------------
  // Overfed boost (大量納品後の一時的空腹加速)
  // --------------------------------------------------

  /** 空腹内部値がこの値を下回ると過食ブーストが発動 (hunger < 20 = fullness > 80%) */
  OVERFED_BOOST_THRESHOLD: 20,
  /** 過食ブースト中の空腹上昇倍率 */
  OVERFED_BOOST_MULT: 1.4,
  /** 過食ブースト持続時間 (秒) */
  OVERFED_BOOST_DURATION_SEC: 6,

  // --------------------------------------------------
  // Debuff items (バウンドするネガティブアイテム)
  // --------------------------------------------------

  /** デバフアイテムのスポーン確率 (クールダウン消化後) */
  DEBUFF_SPAWN_CHANCE: 0.20,
  /** デバフアイテムの移動速度 (px/s) */
  DEBUFF_SPEED_PX_S: 70,
  /** バウンス時の進行方向ランダム散布幅 (px/s) */
  DEBUFF_BOUNCE_SPREAD: 22,

  // --------------------------------------------------
  // Mission system (ランダムミッション)
  // --------------------------------------------------

  /** ゲーム開始からミッション初回発動までの待機時間 (秒) */
  MISSION_INITIAL_DELAY_SEC: 30,
  /** ミッション間クールダウン最小値 (秒) */
  MISSION_INTERVAL_MIN_SEC: 25,
  /** ミッション間クールダウン最大値 (秒) */
  MISSION_INTERVAL_MAX_SEC: 40,
  /** ミッションタイムアウト — この時間内に完了しなければキャンセル (秒) */
  MISSION_TIMEOUT_SEC: 45,
  /** ミッション報酬がシールドになる確率 */
  MISSION_SHIELD_REWARD_CHANCE: 0.20,

  // --------------------------------------------------
  // Greed Moment (強欲ボーナス)
  // --------------------------------------------------

  /** グリードボーナス発動の血液量閾値 (0〜1) */
  GREED_THRESHOLD_BASE: 0.80,
  GREED_THRESHOLD_MAX:  0.95,

  /** グリードボーナス倍率 */
  GREED_MULT_BASE: 1.5,
  GREED_MULT_MAX:  2.0,

  // --------------------------------------------------
  // Target placement distance tiers (from delivery point)
  // --------------------------------------------------

  /** Medium tier: ≥ this distance from delivery point */
  TARGET_DIST_MEDIUM: 260,

  /** Far tier: ≥ this distance from delivery point */
  TARGET_DIST_FAR: 380,

  // --------------------------------------------------
  // HumanHand (敵攻撃)
  // --------------------------------------------------

  HAND_WARN_MS:     600,
  HAND_DESCEND_MS:  400,
  HAND_STRIKE_MS:   200,
  HAND_COOLDOWN_MS: 1200,

  /**
   * 当たり判定半径 (px) — アラートフェーズ別
   *   Ph1 (0〜39):  ランダム  小半径
   *   Ph2 (40〜69): ±80px    中半径
   *   Ph3 (70〜92): ±45px    大半径
   *   Ph4 (93〜100):±32px    最大半径 (散布を残して回避可能に)
   *
   *   Ph4 回避計算:
   *     満タン速度80px/s × 予兆1秒 = 80px移動可能
   *     SCATTER(32) + HIT_RADIUS(74) = 106px 圏外が安全圏
   *     → 80px移動では厳しいが「動き続ければ当たらない」緊張感に
   */
  HAND_HIT_RADIUS_PH1: 40,
  HAND_HIT_RADIUS_PH2: 55,
  HAND_HIT_RADIUS_PH3: 68,
  HAND_HIT_RADIUS_PH4: 74,   // 82 → 74 : 絶望感を緩和

  /** ターゲット散布幅 (px) — フェーズごとのプレイヤーからのズレ上限 */
  HAND_SCATTER_PH1: 999,  // 完全ランダム (画面内)
  HAND_SCATTER_PH2: 80,
  HAND_SCATTER_PH3: 45,
  HAND_SCATTER_PH4: 32,   // 20 → 32 : 直撃確定感を緩和。パターン読みで回避可能

  HAND_WARN_RADIUS_OFFSET: 12,
  HAND_INITIAL_DELAY_MS: 3000,

  HAND_INTERVAL_MAX_MS: 3500,
  HAND_INTERVAL_MIN_MS: 550,
  HAND_RAMP_MS: 60000,

  /** Ph3/Ph4 での即時攻撃クールタイム (ms) */
  HAND_LV3_INSTANT_COOLDOWN_MS: 1500,

  // --------------------------------------------------
  // AlertSystem (警戒度・4段階)
  // --------------------------------------------------

  /**
   * アラートフェーズ閾値
   * Ph1:  0〜39  CALM  — ランダム攻撃、余裕あり
   * Ph2: 40〜69  ALERT — プレイヤー付近を狙い始める
   * Ph3: 70〜92  DANGER— 高頻度・近距離・即時攻撃開始
   * Ph4: 93〜100 RAGE  — ほぼ直上を狙うが散布で回避可能
   *
   * Ph4閾値を90→93に引き上げた理由:
   *   血液100%到達時のアラートは吸血8/s×10s=80% (Ph3範囲)
   *   移動ロスなしの理想ケースでも93%に届かないため
   *   「意図的にリスクを取らないとPh4に入らない」設計になる
   */
  ALERT_PH2_THRESHOLD: 40,
  ALERT_PH3_THRESHOLD: 70,
  ALERT_PH4_THRESHOLD: 93,

  /**
   * 警戒度上昇速度 (/s)
   *
   *   吸血中: 4.8/s
   *     LEG (×1.0): 4.8/s → 血液100%で48% (ALERT圏)
   *     ARM (×1.4): 6.72/s → 血液100%で67% (DANGER手前)
   *     FACE(×1.7): 8.16/s → 血液86%でDANGER(70%)到達
   *                         → 血液100%で82% (DANGER圏、RAGEではない)
   *
   *   設計意図:
   *     FACE ステージで血液75%を狙える「グリードプレイ」を成立させる。
   *     「もう一口だけ…」という判断が生まれるリスク vs 報酬の緊張感を復元。
   *     血液100%は DANGER 圏で十分危険だが、熟練者なら到達可能。
   *     RAGE(93%+) は事前アラートが溜まっている場合のみ現実的に到達する。
   *
   *   静止中: 1.0/s → 完全放置は防ぎつつ、少し止まるだけでは不利にならない
   */
  ALERT_RATE_SUCKING: 4.8,
  ALERT_RATE_IDLE:    1.0,

  /**
   * 自然減衰速度 (/s) — 移動中かつ非吸血
   * 0.30/s → アラート80%から離脱後 約44秒でゼロに
   *   「逃げると目に見えてゲージが下がる」テンポを実現
   *   (旧0.15/s では同条件で約9分かかり「待ち」が発生していた)
   */
  ALERT_DECAY_RATE: 0.40,

  /**
   * 安全地帯内での減衰倍率
   * 3.5倍 → 0.30 × 3.5 = 1.05/s
   *   アラート80%でも約76秒でゼロ。納品エリアが「立て直し地点」として機能する
   */
  ALERT_SAFE_ZONE_DECAY_MULT: 3.5,

  /**
   * 納品時アラート削減 (現在値をこの上限まで切り下げる)
   *   通常納品: 10 まで
   *   満タン納品: 0 (完全リセット)
   */
  ALERT_REDUCE_ON_DELIVERY:      10,
  ALERT_REDUCE_ON_FULL_DELIVERY:  0,

  /** 「静止」と判定する移動速度の閾値 (px/s) */
  ALERT_IDLE_SPEED_THRESHOLD: 8,

  /** 静止扱いになるまでのバッファ時間 (秒) */
  ALERT_IDLE_BUFFER_SEC: 1.8,

  /** Ph3/Ph4 到達時に即時攻撃をトリガーする */
  ALERT_LV3_INSTANT_ATTACK: true,

  // --------------------------------------------------
  // ティアコンボ (血液ティア連続納品ボーナス)
  // --------------------------------------------------

  /**
   * 血液ティア (0〜3)
   *   Tier0: 0〜25%  Tier1: 25〜50%  Tier2: 50〜75%  Tier3: 75〜100%
   * 同じティアを連続で納品するとティアコンボが積み上がる。
   * 異なるティアを納品するとリセット。
   *
   * インデックス = ティアコンボ数 (1 = 初回 = ×1.0)
   */
  TIER_COMBO_MULT: [1.0, 1.0, 1.2, 1.5, 2.0, 2.5] as readonly number[],

  // --------------------------------------------------
  // EventSystem (環境イベント — ファンの風)
  // --------------------------------------------------

  /** この得点を超えるとファンイベントが解禁される */
  FAN_START_SCORE: 200,

  /** 得点200到達後、最初のファンが起動するまでの待機時間 (秒) */
  FAN_INITIAL_COOLDOWN_SEC: 20,

  /** ファン終了後の次回クールダウン範囲 (秒) */
  FAN_MIN_COOLDOWN_SEC: 10,
  FAN_MAX_COOLDOWN_SEC: 22,

  /** 1回のファンイベントの持続時間範囲 (秒) */
  FAN_MIN_DURATION_SEC: 4,
  FAN_MAX_DURATION_SEC: 7,

  /** 風力 (px/s) の範囲 */
  FAN_MIN_STRENGTH: 35,
  FAN_MAX_STRENGTH: 70,

  // --------------------------------------------------
  // StageSystem (エリア段階)
  // --------------------------------------------------

  /**
   * スコア閾値 — この得点以上で次のステージへ移行
   * LEG → ARM → FACE の3段階構成
   */
  STAGE_LEG_THRESHOLD:  0,
  STAGE_ARM_THRESHOLD:  8000,   // 5000 → 8000: 段階進行を緩やかにし難易度エスカレーションを維持
  STAGE_FACE_THRESHOLD: 20000,  // 10000 → 20000

  /**
   * アラート上昇速度への乗数 (ALERT_RATE_SUCKING / IDLE に掛ける)
   */
  STAGE_LEG_ALERT_MULT:  1.0,
  STAGE_ARM_ALERT_MULT:  1.4,
  STAGE_FACE_ALERT_MULT: 1.7,  // 2.0 → 1.7 (-15%): 圧倒的になりすぎない範囲で最高難易度を維持

  /**
   * 納品スコアへの乗数 — 危険なエリアほど高報酬
   */
  STAGE_LEG_SCORE_MULT:  1.0,
  STAGE_ARM_SCORE_MULT:  1.3,
  STAGE_FACE_SCORE_MULT: 1.8,

  /**
   * 空腹上昇速度への乗数 — 上位ステージほど赤ちゃんの消費が激しい
   */
  STAGE_LEG_HUNGER_MULT:  1.0,
  STAGE_ARM_HUNGER_MULT:  1.3,
  STAGE_FACE_HUNGER_MULT: 2.0,

  // --------------------------------------------------
  // SmokeSystem (蚊取り線香の煙)
  // --------------------------------------------------

  /** この得点を超えると煙エリアが出現し始める */
  SMOKE_START_SCORE: 500,

  /** 煙エリアの半径 (px) */
  SMOKE_RADIUS: 65,

  /**
   * 煙エリア内でのアラート上昇速度乗数
   * ALERT_RATE × stageAlertMult × SMOKE_ALERT_MULT で一気に上昇
   */
  SMOKE_ALERT_MULT: 4.0,

  /**
   * 煙エリア内での血液減少速度 (units/s)
   * 進入中は血液が徐々に失われる → ルート選択に圧力をかける
   */
  SMOKE_BLOOD_DRAIN_RATE: 3.0,

  /** 1つの煙エリアが消えるまでの時間範囲 (秒) */
  SMOKE_MIN_LIFETIME_SEC: 28,
  SMOKE_MAX_LIFETIME_SEC: 45,

  /** 新しい煙エリアが出現するまでのクールダウン範囲 (秒) */
  SMOKE_SPAWN_COOLDOWN_MIN_SEC: 20,
  SMOKE_SPAWN_COOLDOWN_MAX_SEC: 38,

  /** 同時に存在できる煙エリアの最大数 */
  SMOKE_MAX_ZONES: 2,

  // --------------------------------------------------
  // DailyBonusSystem (日替わりボーナス)
  // --------------------------------------------------

  /**
   * 日替わりボーナス条件を満たした納品への乗数
   * 全ボーナス共通で同じ倍率を使用 — 毎日「何が有利か」が変わる
   */
  DAILY_BONUS_MULT: 1.8,
} as const
