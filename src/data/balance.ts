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
   *   吸血中: 8/s → 0→100 まで純粋吸血で約12.5秒
   *     血液100% (吸血10秒) 時のアラート上昇は最大80%止まり
   *     → 実プレイで移動ロスが入るため到達時は70〜85% (Ph3) が現実的
   *     → 「血液100%を狙える」設計の根幹となる値
   *   静止中: 1.5/s → 完全放置は防ぎつつ、少し止まるだけでは不利にならない
   */
  ALERT_RATE_SUCKING: 8,
  ALERT_RATE_IDLE:    1.5,

  /**
   * 自然減衰速度 (/s) — 移動中かつ非吸血
   * 0.30/s → アラート80%から離脱後 約44秒でゼロに
   *   「逃げると目に見えてゲージが下がる」テンポを実現
   *   (旧0.15/s では同条件で約9分かかり「待ち」が発生していた)
   */
  ALERT_DECAY_RATE: 0.30,

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
} as const
