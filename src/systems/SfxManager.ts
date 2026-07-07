import { JUICE, DeliverTier } from '../data/juice'

/**
 * SfxManager — WebAudio プロシージャル合成サウンド (外部アセット不要)
 *
 * 構成:
 *   AudioContext → master → sfxBus   (効果音)
 *                        → musicBus (BGM)
 *
 * - AudioContext はユーザージェスチャ後の init() で生成する (autoplay policy)
 * - 音量は localStorage の musicVol / sfxVol (0〜100) と連動
 *   知覚補正のため (v/100)^2 をゲインに使う
 * - BGM は lookahead 25ms のステップシーケンサで生成
 *
 * シングルトン `sfx` を import して使う。
 */

export type SfxName =
  | 'uiClick' | 'uiHover'
  | 'warn' | 'warnRage' | 'slam' | 'whoosh'
  | 'pickup' | 'debuff'
  | 'greed' | 'milestone' | 'fanfare'
  | 'tick' | 'starveTick' | 'fullTank' | 'stageUp'
  | 'death' | 'starveDeath'

type MusicMode = 'title' | 'game'

/** A ペンタトニック (半音オフセット) — コンボ音階に使う */
const PENTA_SEMITONES = [0, 2, 4, 7, 9, 12] as const
const C5 = 523.25

class SfxManager {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private sfxBus!: GainNode
  private musicBus!: GainNode

  /** スライダー値 0〜1 */
  private sfxVol = 0.8
  private musicVol = 0.8

  // 吸血ループ
  private suck: { osc1: OscillatorNode; osc2: OscillatorNode; lfo: OscillatorNode; gain: GainNode } | null = null

  // ハートビート (Ph4)
  private heartbeatTimer: number | null = null

  // BGM シーケンサ
  private musicMode: MusicMode | null = null
  private pendingMusic: MusicMode | null = null
  private schedTimer: number | null = null
  private nextNoteTime = 0
  private stepIndex = 0
  private tension = 0

  // ノイズ用の共有バッファ
  private noiseBuffer: AudioBuffer | null = null

  // ホバー音のスパム防止
  private lastHoverAt = 0

  // --------------------------------------------------
  // 初期化・音量
  // --------------------------------------------------

  /** ユーザージェスチャ (クリック/キー入力) の中で呼ぶこと */
  init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const Ctor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    this.ctx = new Ctor()

    this.master   = this.ctx.createGain()
    this.sfxBus   = this.ctx.createGain()
    this.musicBus = this.ctx.createGain()
    this.sfxBus.connect(this.master)
    this.musicBus.connect(this.master)
    this.master.connect(this.ctx.destination)
    this.master.gain.value = 1

    this.sfxVol   = this.loadVol('sfxVol')
    this.musicVol = this.loadVol('musicVol')
    this.applyVolumes()

    if (this.pendingMusic) {
      const mode = this.pendingMusic
      this.pendingMusic = null
      this.startMusic(mode)
    }
  }

  isReady(): boolean { return this.ctx !== null }

  /** @param v 0〜1 */
  setSfxVolume(v: number): void {
    this.sfxVol = Math.max(0, Math.min(1, v))
    this.applyVolumes()
  }

  /** @param v 0〜1 */
  setMusicVolume(v: number): void {
    this.musicVol = Math.max(0, Math.min(1, v))
    this.applyVolumes()
  }

  private loadVol(key: string): number {
    const raw = parseInt(localStorage.getItem(key) ?? '80')
    return Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) / 100 : 0.8
  }

  private applyVolumes(): void {
    if (!this.ctx) return
    // 知覚補正: スライダー値の二乗
    this.sfxBus.gain.value   = this.sfxVol * this.sfxVol * JUICE.SFX_BASE_GAIN
    this.musicBus.gain.value = this.musicVol * this.musicVol * JUICE.MUSIC_BASE_GAIN
  }

  // --------------------------------------------------
  // ワンショット効果音
  // --------------------------------------------------

  play(name: SfxName): void {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    switch (name) {
      case 'uiClick':
        this.tone({ freq: 2000, dur: 0.03, type: 'sine', gain: 0.05, at: t })
        break
      case 'uiHover': {
        // マウス移動で連射されるためスロットル
        const now = performance.now()
        if (now - this.lastHoverAt < 90) return
        this.lastHoverAt = now
        this.tone({ freq: 1500, dur: 0.02, type: 'sine', gain: 0.02, at: t })
        break
      }
      case 'warn':
        this.tone({ freq: 880, dur: 0.06, type: 'square', gain: 0.05, at: t })
        this.tone({ freq: 880, dur: 0.06, type: 'square', gain: 0.05, at: t + 0.09 })
        break
      case 'warnRage':
        for (let i = 0; i < 3; i++) {
          this.tone({ freq: 1245, dur: 0.05, type: 'square', gain: 0.06, at: t + i * 0.08 })
        }
        break
      case 'slam':
        this.noise({ dur: 0.12, gain: 0.15, at: t, filter: 'lowpass', freq: 400 })
        this.tone({ freq: 90, freqEnd: 45, dur: 0.15, type: 'sine', gain: 0.2, at: t })
        break
      case 'whoosh':
        this.noise({ dur: 0.18, gain: 0.09, at: t, filter: 'bandpass', freq: 500, freqEnd: 2600 })
        break
      case 'pickup':
        this.tone({ freq: 660, freqEnd: 1320, dur: 0.12, type: 'sine', gain: 0.09, at: t })
        this.tone({ freq: 1320, dur: 0.10, type: 'sine', gain: 0.05, at: t + 0.10 })
        break
      case 'debuff':
        this.tone({ freq: 440, freqEnd: 110, dur: 0.25, type: 'square', gain: 0.08, at: t })
        break
      case 'greed':
        this.tone({ freq: 200, freqEnd: 800, dur: 0.3, type: 'sawtooth', gain: 0.06, at: t })
        break
      case 'milestone':
        this.tone({ freq: C5,          dur: 0.4, type: 'triangle', gain: 0.07, at: t })
        this.tone({ freq: C5 * 5 / 4,  dur: 0.4, type: 'triangle', gain: 0.06, at: t })
        this.tone({ freq: C5 * 3 / 2,  dur: 0.4, type: 'triangle', gain: 0.06, at: t })
        this.noise({ dur: 0.3, gain: 0.03, at: t, filter: 'highpass', freq: 6000 })
        break
      case 'fanfare': {
        const seq = [C5, C5 * 5 / 4, C5 * 3 / 2, C5 * 2]
        seq.forEach((f, i) => this.tone({ freq: f, dur: 0.16, type: 'triangle', gain: 0.09, at: t + i * 0.13 }))
        // 最後に和音
        this.tone({ freq: C5 * 2,         dur: 0.5, type: 'triangle', gain: 0.08, at: t + 0.55 })
        this.tone({ freq: C5 * 5 / 2,     dur: 0.5, type: 'triangle', gain: 0.06, at: t + 0.55 })
        this.tone({ freq: C5 * 3,         dur: 0.5, type: 'triangle', gain: 0.05, at: t + 0.55 })
        this.noise({ dur: 0.4, gain: 0.04, at: t + 0.55, filter: 'highpass', freq: 5000 })
        break
      }
      case 'tick':
        this.tone({ freq: 1400, dur: 0.025, type: 'sine', gain: 0.04, at: t })
        break
      case 'starveTick':
        this.tone({ freq: 1000, dur: 0.04, type: 'square', gain: 0.07, at: t })
        break
      case 'fullTank':
        this.tone({ freq: 880, freqEnd: 1760, dur: 0.1, type: 'sine', gain: 0.09, at: t })
        this.tone({ freq: C5 * 2, dur: 0.2, type: 'triangle', gain: 0.08, at: t + 0.08 })
        break
      case 'stageUp':
        this.tone({ freq: 150, freqEnd: 900, dur: 0.5, type: 'sawtooth', gain: 0.05, at: t })
        this.noise({ dur: 0.5, gain: 0.04, at: t, filter: 'bandpass', freq: 400, freqEnd: 3000 })
        break
      case 'death':
        this.noise({ dur: 0.3, gain: 0.2, at: t, filter: 'lowpass', freq: 2000, freqEnd: 200 })
        this.tone({ freq: 220, freqEnd: 55, dur: 0.5, type: 'sine', gain: 0.22, at: t })
        break
      case 'starveDeath':
        this.tone({ freq: 440, freqEnd: 110, dur: 0.6, type: 'triangle', gain: 0.15, at: t })
        this.noise({ dur: 0.4, gain: 0.06, at: t + 0.1, filter: 'lowpass', freq: 800, freqEnd: 150 })
        break
    }
  }

  /** 納品成功 — コインアルペジオ。ティアが上がるほど豪華に */
  playDeliver(tier: DeliverTier): void {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const arp = [C5, C5 * 5 / 4, C5 * 3 / 2]  // C5-E5-G5
    arp.forEach((f, i) => this.tone({ freq: f, dur: 0.06, type: 'square', gain: 0.07, at: t + i * 0.06 }))
    this.tone({ freq: C5 * 2, dur: 0.15, type: 'sine', gain: 0.1, at: t + 0.18 })

    if (tier === 'big' || tier === 'huge') {
      // オクターブ上を重ねる
      arp.forEach((f, i) => this.tone({ freq: f * 2, dur: 0.06, type: 'square', gain: 0.05, at: t + 0.24 + i * 0.06 }))
      this.tone({ freq: C5 * 4, dur: 0.2, type: 'sine', gain: 0.08, at: t + 0.42 })
    }
    if (tier === 'huge') {
      this.noise({ dur: 0.35, gain: 0.05, at: t + 0.3, filter: 'highpass', freq: 5000 })
      this.tone({ freq: C5 * 3, dur: 0.4, type: 'triangle', gain: 0.07, at: t + 0.45 })
    }
  }

  /** コンボ音階 — チェイン数が上がるほど高い音 (ペンタトニック) */
  playCombo(chain: number): void {
    if (!this.ctx || chain <= 1) return
    const idx  = Math.min(chain - 1, PENTA_SEMITONES.length - 1)
    const freq = C5 * Math.pow(2, PENTA_SEMITONES[idx] / 12)
    this.tone({ freq, dur: 0.09, type: 'square', gain: 0.08, at: this.ctx.currentTime + 0.05 })
  }

  // --------------------------------------------------
  // 吸血ループ音
  // --------------------------------------------------

  startSuckLoop(): void {
    if (!this.ctx || this.suck) return
    const t = this.ctx.currentTime

    const osc1 = this.ctx.createOscillator()
    const osc2 = this.ctx.createOscillator()
    osc1.type = 'triangle'; osc1.frequency.value = 85
    osc2.type = 'triangle'; osc2.frequency.value = 90

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 300

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.05, t + 0.15)

    // 振幅 LFO 8Hz — 「ズズズ…」という脈動
    const lfo = this.ctx.createOscillator()
    lfo.frequency.value = 8
    const lfoGain = this.ctx.createGain()
    lfoGain.gain.value = 0.02
    lfo.connect(lfoGain)
    lfoGain.connect(gain.gain)

    osc1.connect(filter); osc2.connect(filter)
    filter.connect(gain)
    gain.connect(this.sfxBus)
    osc1.start(t); osc2.start(t); lfo.start(t)

    this.suck = { osc1, osc2, lfo, gain }
  }

  /** 血液量 (0〜1) に応じて吸血音のピッチを上げる — 「満ちていく」感覚 */
  setSuckPitch(bloodPercent: number): void {
    if (!this.ctx || !this.suck) return
    const base = 85 + 25 * bloodPercent
    this.suck.osc1.frequency.setTargetAtTime(base, this.ctx.currentTime, 0.1)
    this.suck.osc2.frequency.setTargetAtTime(base + 5, this.ctx.currentTime, 0.1)
  }

  stopSuckLoop(): void {
    if (!this.ctx || !this.suck) return
    const { osc1, osc2, lfo, gain } = this.suck
    this.suck = null
    const t = this.ctx.currentTime
    gain.gain.cancelScheduledValues(t)
    gain.gain.setValueAtTime(gain.gain.value, t)
    gain.gain.linearRampToValueAtTime(0, t + 0.1)
    osc1.stop(t + 0.15); osc2.stop(t + 0.15); lfo.stop(t + 0.15)
  }

  // --------------------------------------------------
  // ハートビート (Ph4 RAGE)
  // --------------------------------------------------

  startHeartbeat(): void {
    if (!this.ctx || this.heartbeatTimer !== null) return
    const beat = () => {
      if (!this.ctx) return
      const t = this.ctx.currentTime
      this.tone({ freq: 60, dur: 0.09, type: 'sine', gain: 0.22, at: t })
      this.tone({ freq: 55, dur: 0.09, type: 'sine', gain: 0.16, at: t + 0.18 })
    }
    beat()
    this.heartbeatTimer = window.setInterval(beat, 800)  // 75BPM
  }

  stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  // --------------------------------------------------
  // BGM — lookahead ステップシーケンサ
  // --------------------------------------------------

  startMusic(mode: MusicMode): void {
    if (!this.ctx) {
      this.pendingMusic = mode
      return
    }
    if (this.musicMode === mode) return
    this.musicMode = mode
    this.stepIndex = 0
    this.nextNoteTime = this.ctx.currentTime + 0.05
    if (this.schedTimer === null) {
      this.schedTimer = window.setInterval(() => this.scheduler(), 25)
    }
  }

  stopMusic(): void {
    this.musicMode = null
    this.pendingMusic = null
    if (this.schedTimer !== null) {
      clearInterval(this.schedTimer)
      this.schedTimer = null
    }
  }

  /** 緊張度 0=通常 1=Ph3以上 (BGMテンポ・キック追加) */
  setMusicTension(level: number): void {
    this.tension = level
  }

  /** ポーズ時: ループ音を止める (BGMは残す) */
  onPause(): void {
    this.stopSuckLoop()
    this.stopHeartbeat()
  }

  private scheduler(): void {
    if (!this.ctx || !this.musicMode) return
    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
      if (this.musicMode === 'game') {
        this.scheduleGameStep(this.stepIndex, this.nextNoteTime)
        const bpm = this.tension >= 1 ? 115 : 100
        this.nextNoteTime += 60 / bpm / 4   // 16分音符
      } else {
        this.scheduleTitleStep(this.stepIndex, this.nextNoteTime)
        this.nextNoteTime += 60 / 70 / 2    // 8分音符 (ゆったり)
      }
      this.stepIndex = (this.stepIndex + 1) % 16
    }
  }

  /** ゲーム中 BGM: Am ペンタ 100BPM (Ph3+ で 115BPM + キック) */
  private scheduleGameStep(step: number, t: number): void {
    const A2 = 110, C3 = 130.81, G2 = 98
    // ベースライン
    const bassMap: Record<number, number> = { 0: A2, 4: A2, 8: C3, 12: G2, 14: A2 }
    const bass = bassMap[step]
    if (bass !== undefined) {
      this.tone({ freq: bass, dur: 0.22, type: 'triangle', gain: 0.16, at: t, bus: this.musicBus })
    }
    // ハイハット (偶数ステップ、4拍目頭はアクセント)
    if (step % 2 === 0) {
      const accent = step % 4 === 0
      this.noise({ dur: 0.03, gain: accent ? 0.035 : 0.02, at: t, filter: 'highpass', freq: 8000, bus: this.musicBus })
    }
    // プラック (Aペンタ)
    const A4 = 220, C5n = 261.63, D5 = 293.66, E5 = 329.63, G4 = 196
    const pluckMap: Record<number, number> = { 2: A4, 5: C5n, 7: E5, 10: D5, 13: G4 }
    const pluck = pluckMap[step]
    if (pluck !== undefined) {
      this.tone({ freq: pluck * 2, dur: 0.12, type: 'square', gain: 0.03, at: t, bus: this.musicBus })
    }
    // 緊張時のキック
    if (this.tension >= 1 && step % 4 === 0) {
      this.tone({ freq: 150, freqEnd: 50, dur: 0.12, type: 'sine', gain: 0.25, at: t, bus: this.musicBus })
    }
  }

  /** タイトル BGM: 低速アンビエントアルペジオ */
  private scheduleTitleStep(step: number, t: number): void {
    const seq = [110, 130.81, 164.81, 196, 220, 196, 164.81, 130.81]  // A2 C3 E3 G3 A3 ...
    if (step % 2 === 0) {
      const f = seq[(step / 2) % seq.length]
      this.tone({ freq: f, dur: 0.8, type: 'triangle', gain: 0.06, at: t, bus: this.musicBus })
      this.tone({ freq: f * 2.005, dur: 0.8, type: 'triangle', gain: 0.025, at: t, bus: this.musicBus })
    }
  }

  // --------------------------------------------------
  // 合成プリミティブ
  // --------------------------------------------------

  private tone(opts: {
    freq: number
    dur: number
    type: OscillatorType
    gain: number
    at: number
    freqEnd?: number
    bus?: GainNode
  }): void {
    if (!this.ctx) return
    const { freq, dur, type, gain, at, freqEnd, bus } = opts
    const osc = this.ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freq, at)
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), at + dur)
    }
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(gain, at + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    osc.connect(g)
    g.connect(bus ?? this.sfxBus)
    osc.start(at)
    osc.stop(at + dur + 0.05)
  }

  private noise(opts: {
    dur: number
    gain: number
    at: number
    filter?: BiquadFilterType
    freq?: number
    freqEnd?: number
    bus?: GainNode
  }): void {
    if (!this.ctx) return
    const { dur, gain, at, filter, freq, freqEnd, bus } = opts

    if (!this.noiseBuffer) {
      const len = this.ctx.sampleRate  // 1秒
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const data = this.noiseBuffer.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    }

    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.loop = true

    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(gain, at + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)

    let node: AudioNode = src
    if (filter && freq !== undefined) {
      const f = this.ctx.createBiquadFilter()
      f.type = filter
      f.frequency.setValueAtTime(freq, at)
      if (freqEnd !== undefined) {
        f.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), at + dur)
      }
      node.connect(f)
      node = f
    }
    node.connect(g)
    g.connect(bus ?? this.sfxBus)
    src.start(at)
    src.stop(at + dur + 0.05)
  }
}

/** シングルトン */
export const sfx = new SfxManager()
