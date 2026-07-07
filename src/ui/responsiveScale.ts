/**
 * responsiveScale — 固定レイアウト (1145×652) をビューポートに合わせて一様スケールする
 *
 * ゲームは canvas(800×600) と DOM 層 (skin-layer / オーバーレイUI) の座標が
 * 密結合しているため、メディアクエリでのリフローではなく
 * #game-wrapper 全体を transform: scale() で拡縮する。
 * これにより canvas・DOMターゲット・HUD の位置関係が常に一致する。
 *
 * Phaser のポインタ入力は canvas の boundingRect から自動補正されるため
 * CSS スケール下でも正しく動作する。
 */

/** 画面端に確保する余白 (px) */
const VIEWPORT_MARGIN = 12
/** 拡大の上限 — canvas のぼやけを抑えるため過度なアップスケールは避ける */
const MAX_SCALE = 1.5
/** スマホ判定の閾値 (CSS px)。短辺優先で判定して縦横回転に強くする */
const PHONE_MAX_SHORT_SIDE = 600
const PHONE_MAX_LONG_SIDE = 1200

let wrapper: HTMLElement | null = null
let applyScale: (() => void) | null = null

/** 現在の適用スケール (1 = 等倍)。DOM演出の座標変換に使う */
export function getUiScale(): number {
  if (!wrapper) return 1
  const rect = wrapper.getBoundingClientRect()
  return wrapper.offsetWidth > 0 ? rect.width / wrapper.offsetWidth : 1
}

export function initResponsiveScale(): void {
  wrapper = document.getElementById('game-wrapper')
  if (!wrapper) return

  applyScale = () => {
    if (!wrapper) return
    // innerWidth ではなく clientWidth を使う (スクロールバー・ズーム誤差を除外)
    const viewW = document.documentElement.clientWidth
    const viewH = document.documentElement.clientHeight
    const isLandscape = viewW > viewH
    const isPortrait = viewH >= viewW
    const shortSide = Math.min(viewW, viewH)
    const longSide = Math.max(viewW, viewH)
    const isPhoneSize = shortSide <= PHONE_MAX_SHORT_SIDE && longSide <= PHONE_MAX_LONG_SIDE
    const isTouchDevice =
      window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
    const useMobileShell = isPhoneSize && isTouchDevice
    const isSmallLandscape = isLandscape && useMobileShell
    const isSmallPortrait = isPortrait && useMobileShell
    const topBar = document.getElementById('top-bar')
    const resultScreen = document.getElementById('result-screen')
    const isResultVisible = resultScreen !== null && !resultScreen.classList.contains('hidden')
    const isGameLayout = topBar !== null && !topBar.classList.contains('hidden') && !isResultVisible
    const useMobileGameplayLandscape = isSmallLandscape && isGameLayout
    const useMobileLandscapeShell = isSmallLandscape && !isGameLayout
    const useMobilePortraitShell = isSmallPortrait && !isGameLayout
    document.body.classList.toggle('mobile-gameplay-landscape', useMobileGameplayLandscape)
    document.body.classList.toggle('mobile-landscape-shell', useMobileLandscapeShell)
    document.body.classList.toggle('mobile-portrait-shell', useMobilePortraitShell)
    document.body.classList.toggle('mobile-gameplay-portrait', isSmallPortrait && isGameLayout)

    // offsetWidth/Height は transform の影響を受けない「素のレイアウトサイズ」
    const baseW = wrapper.offsetWidth
    const baseH = wrapper.offsetHeight
    if (baseW === 0 || baseH === 0) return

    const scale = useMobilePortraitShell || useMobileLandscapeShell
      ? 1
      : Math.min(
          (viewW - VIEWPORT_MARGIN) / baseW,
          (viewH - VIEWPORT_MARGIN) / baseH,
          MAX_SCALE,
        )
    wrapper.style.transform = `scale(${scale.toFixed(4)})`
    if (useMobileGameplayLandscape) {
      wrapper.style.left = `${Math.max(0, (viewW - baseW * scale) / 2).toFixed(1)}px`
      wrapper.style.top = '0px'
    } else {
      wrapper.style.left = ''
      wrapper.style.top = ''
    }
  }

  window.addEventListener('resize', applyScale)
  // HUD・サイドパネルの表示/非表示でラッパーの素サイズが変わるため追従する
  // (ResizeObserver は transform の影響を受けないレイアウトサイズを監視する)
  new ResizeObserver(applyScale).observe(wrapper)
  applyScale()
  // Webフォント読み込み等でレイアウトサイズが確定するのを待って再適用
  window.setTimeout(applyScale, 300)
}

export function refreshResponsiveScale(): void {
  applyScale?.()
  requestAnimationFrame(() => applyScale?.())
}
