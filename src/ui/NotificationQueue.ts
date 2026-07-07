/**
 * NotificationQueue — DOM 通知バナーの優先度キュー
 *
 * これまで 8 種の通知 (#item-notice / #event-notice / #stage-notice など) が
 * それぞれ固定座標に出ており、同時発生時に重なっていた。
 * 全てを #notice-stack コンテナ内の縦積みに統一し、
 *   - 同時表示は最大 2 件
 *   - 空きがなければ優先度順に待機
 *   - 高優先度 (priority >= 2) は最低優先度の表示中通知を追い出す
 * というルールで整理する。
 */

interface ActiveNotice {
  el: HTMLElement
  priority: number
  timer: number
}

interface QueuedNotice {
  el: HTMLElement
  text?: string
  priority: number
  duration: number
}

const MAX_VISIBLE = 2

export class NotificationQueue {
  private active: ActiveNotice[] = []
  private queue: QueuedNotice[] = []

  /**
   * 通知を表示する (満杯なら待機、または低優先を追い出す)
   * @param el       通知要素 (#notice-stack の子)
   * @param text     テキスト (省略時は既存の内容を使う)
   * @param priority 0=低 1=通常 2=重要 (重要は割り込む)
   * @param duration 表示時間 ms
   */
  show(el: HTMLElement, text?: string, priority = 1, duration = 1800): void {
    // 既に表示中なら内容更新 + タイマー延長
    const existing = this.active.find(a => a.el === el)
    if (existing) {
      if (text !== undefined) el.textContent = text
      this.retriggerAnim(el)
      clearTimeout(existing.timer)
      existing.timer = window.setTimeout(() => this.dismiss(el), duration)
      return
    }
    // 待機中なら内容だけ更新
    const queued = this.queue.find(q => q.el === el)
    if (queued) {
      queued.text = text ?? queued.text
      queued.priority = Math.max(queued.priority, priority)
      return
    }

    if (this.active.length >= MAX_VISIBLE) {
      if (priority >= 2) {
        // 最低優先度の表示中通知を追い出す
        const lowest = [...this.active].sort((a, b) => a.priority - b.priority)[0]
        if (lowest && lowest.priority < priority) {
          this.dismiss(lowest.el)
        } else {
          this.enqueue({ el, text, priority, duration })
          return
        }
      } else {
        this.enqueue({ el, text, priority, duration })
        return
      }
    }
    this.activate(el, text, priority, duration)
  }

  /** 全通知を即座に消す (ゲームオーバー・タイトル復帰時) */
  clear(): void {
    for (const a of this.active) {
      clearTimeout(a.timer)
      a.el.classList.add('hidden')
      a.el.classList.remove('notice--stack-flash')
    }
    this.active = []
    this.queue = []
  }

  // --------------------------------------------------

  private enqueue(item: QueuedNotice): void {
    this.queue.push(item)
    this.queue.sort((a, b) => b.priority - a.priority)
    // 待機が溜まりすぎたら古い低優先を捨てる
    if (this.queue.length > 4) this.queue.length = 4
  }

  private activate(el: HTMLElement, text: string | undefined, priority: number, duration: number): void {
    if (text !== undefined) el.textContent = text
    el.classList.remove('hidden')
    this.retriggerAnim(el)
    const timer = window.setTimeout(() => this.dismiss(el), duration)
    this.active.push({ el, priority, timer })
  }

  private dismiss(el: HTMLElement): void {
    const idx = this.active.findIndex(a => a.el === el)
    if (idx >= 0) {
      clearTimeout(this.active[idx].timer)
      this.active.splice(idx, 1)
    }
    el.classList.add('hidden')
    el.classList.remove('notice--stack-flash')
    // 待機中の通知を昇格
    const next = this.queue.shift()
    if (next) this.activate(next.el, next.text, next.priority, next.duration)
  }

  private retriggerAnim(el: HTMLElement): void {
    el.classList.remove('notice--stack-flash')
    void el.offsetWidth
    el.classList.add('notice--stack-flash')
  }
}

export const notificationQueue = new NotificationQueue()
