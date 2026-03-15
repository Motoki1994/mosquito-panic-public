/**
 * SkinLayer
 *
 * DOM layer above the Phaser canvas.
 * Manages skin background, bite targets, and post-suck swellings.
 *
 * Blood units: each target holds MAX_BLOOD (100) units.
 * SkinLayer.update() returns blood units sucked this frame (same unit as BloodSystem).
 */

export interface BiteTarget {
  id: number
  x: number
  y: number
  el: HTMLElement
  /** Remaining blood in BloodSystem units (0 – MAX_BLOOD) */
  remaining: number
}

type OnDepletedCallback = (id: number) => void

const MAX_BLOOD_PER_TARGET = 100

export class SkinLayer {
  private layer: HTMLElement
  readonly targets: Map<number, BiteTarget> = new Map()
  private nextId: number = 0
  private onDepleted: OnDepletedCallback

  constructor(container: HTMLElement, onDepleted: OnDepletedCallback) {
    this.onDepleted = onDepleted

    let layer = container.querySelector<HTMLElement>('#skin-layer')
    if (!layer) {
      layer = document.createElement('div')
      layer.id = 'skin-layer'
      container.appendChild(layer)
    } else {
      layer.innerHTML = ''
    }
    this.layer = layer
  }

  // --------------------------------------------------
  // Targets
  // --------------------------------------------------

  addTarget(x: number, y: number, tier: 'near' | 'medium' | 'far' = 'near'): number {
    const id = this.nextId++
    const el = document.createElement('div')
    el.className  = `bite-target bite-target--${tier}`
    el.style.left = `${x}px`
    el.style.top  = `${y}px`
    this.layer.appendChild(el)

    this.targets.set(id, { id, x, y, el, remaining: MAX_BLOOD_PER_TARGET })
    return id
  }

  /**
   * Called every frame from GameScene.
   * Checks player overlap with each target and drains blood.
   *
   * @returns { totalSucked (blood units 0–100 scale), isSucking }
   */
  update(
    playerX: number,
    playerY: number,
    suckRadius: number,
    dt: number,
    suckRate: number,   // blood units per second (e.g. BALANCE.SUCK_RATE = 10)
    canSuck: boolean,
  ): { totalSucked: number; isSucking: boolean } {
    let totalSucked = 0
    let isSucking   = false

    for (const [id, t] of this.targets) {
      const dx   = playerX - t.x
      const dy   = playerY - t.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const inRange = dist <= suckRadius

      t.el.classList.toggle('bite-target--active', inRange && canSuck && t.remaining > 0)

      if (inRange && canSuck && t.remaining > 0) {
        const sucked = Math.min(t.remaining, suckRate * dt)
        t.remaining -= sucked
        totalSucked += sucked
        isSucking    = true

        // Shrink ring as blood drains
        const frac = t.remaining / MAX_BLOOD_PER_TARGET
        t.el.style.setProperty('--target-scale', String(0.4 + frac * 0.6))

        if (t.remaining <= 0) {
          this.depleteTarget(id, t)
        }
      }
    }

    return { totalSucked, isSucking }
  }

  /**
   * チュートリアル中: skin-layer DOM 要素を非表示にして
   * Phaser canvas 上のチュートリアルオーバーレイを正しく見えるようにする
   * (DOM 要素は Phaser canvas の上に重なるため、非表示にしないと overlay が隠れる)
   */
  setLayerVisible(visible: boolean): void {
    this.layer.style.visibility = visible ? '' : 'hidden'
  }

  destroy(): void {
    this.layer.innerHTML = ''
    this.targets.clear()
  }

  // --------------------------------------------------

  private depleteTarget(id: number, t: BiteTarget): void {
    this.targets.delete(id)
    t.el.classList.add('bite-target--depleted')
    this.onDepleted(id)

    setTimeout(() => {
      if (t.el.parentNode) t.el.remove()
      this.addSwelling(t.x, t.y)
    }, 350)
  }

  private addSwelling(x: number, y: number): void {
    const el = document.createElement('div')
    el.className  = 'bite-swelling'
    el.style.left = `${x}px`
    el.style.top  = `${y}px`
    this.layer.appendChild(el)

    setTimeout(() => {
      el.classList.add('bite-swelling--fading')
      setTimeout(() => { if (el.parentNode) el.remove() }, 2000)
    }, 5000)
  }
}
