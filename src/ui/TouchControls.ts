import { domRefs } from './domRefs'

type MoveHandler = (x: number, y: number) => void

/**
 * TouchControls — mobile-only virtual joystick and pause affordance.
 *
 * The visual layer lives inside #game-area so it is scaled together with the
 * fixed canvas layout. Pointer math uses the element's scaled bounding rect,
 * so it stays correct under responsiveScale transforms.
 */
export class TouchControls {
  private readonly onMove: MoveHandler
  private readonly onPause: () => void
  private activePointerId: number | null = null

  constructor(onMove: MoveHandler, onPause: () => void) {
    this.onMove = onMove
    this.onPause = onPause

    domRefs.touchStick.addEventListener('pointerdown', this.onStickDown, { passive: false })
    domRefs.touchStick.addEventListener('pointermove', this.onStickMove, { passive: false })
    domRefs.touchStick.addEventListener('pointerup', this.onStickUp, { passive: false })
    domRefs.touchStick.addEventListener('pointercancel', this.onStickUp, { passive: false })
    domRefs.touchPauseBtn.onclick = (e) => {
      e.preventDefault()
      this.onPause()
    }
  }

  show(): void {
    domRefs.touchControls.classList.remove('hidden')
  }

  hide(): void {
    domRefs.touchControls.classList.add('hidden')
    this.reset()
  }

  destroy(): void {
    this.hide()
    domRefs.touchStick.removeEventListener('pointerdown', this.onStickDown)
    domRefs.touchStick.removeEventListener('pointermove', this.onStickMove)
    domRefs.touchStick.removeEventListener('pointerup', this.onStickUp)
    domRefs.touchStick.removeEventListener('pointercancel', this.onStickUp)
    domRefs.touchPauseBtn.onclick = null
  }

  private readonly onStickDown = (e: PointerEvent): void => {
    if (this.activePointerId !== null) return
    e.preventDefault()
    this.activePointerId = e.pointerId
    domRefs.touchStick.setPointerCapture(e.pointerId)
    this.updateStick(e)
  }

  private readonly onStickMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.activePointerId) return
    e.preventDefault()
    this.updateStick(e)
  }

  private readonly onStickUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.activePointerId) return
    e.preventDefault()
    this.reset()
  }

  private updateStick(e: PointerEvent): void {
    const rect = domRefs.touchStick.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = e.clientX - cx
    const dy = e.clientY - cy
    const dist = Math.hypot(dx, dy)
    const maxDist = Math.min(rect.width, rect.height) * 0.5 - 18
    const scale = dist > maxDist ? maxDist / dist : 1
    const knobX = dx * scale
    const knobY = dy * scale

    domRefs.touchStickKnob.style.transform =
      `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`

    const inputScale = maxDist > 0 ? Math.min(1, dist / maxDist) : 0
    const nx = dist > 0 ? (dx / dist) * inputScale : 0
    const ny = dist > 0 ? (dy / dist) * inputScale : 0
    this.onMove(nx, ny)
  }

  private reset(): void {
    this.activePointerId = null
    domRefs.touchStickKnob.style.transform = 'translate(-50%, -50%)'
    this.onMove(0, 0)
  }
}
