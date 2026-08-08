// 기준 해상도 무대 (DEC-UI-025, DEC-ART-004)
//
// ── 왜 무대를 따로 두나 ────────────────────────────────────
//
// `DEC-UI-025` 가 기준 해상도를 1920×1080 으로 확정하고, 창이 다르면 **화면 전체를
// 비율을 유지한 채 확대·축소하고 남는 영역은 여백**으로 두라고 정했다. 그리고
// **필드와 UI 를 서로 다른 비율로 늘리지 않는다**고 못 박았다.
//
// 그래서 캔버스와 DOM 오버레이를 각자 늘리지 않는다. 둘을 한 상자(`#stage`) 안에
// 넣고 그 상자 하나만 `transform: scale()` 한다. 그러면 둘이 어긋날 수가 없다 —
// 어긋남은 "HUD 는 맞는데 클릭 위치가 밀린다" 같은 형태로 나와서 원인을 찾기 어렵다.
//
// ── 좌표가 안 깨지는 이유 ──────────────────────────────────
//
// 무대 안쪽은 언제나 1920×1080 이다. 캔버스도, `getBoundingClientRect()` 를 쓰는
// 마우스 각도 계산도 그 크기를 본다. `transform` 은 사각형 값에 이미 반영되므로
// 입력 쪽에서 배율을 따로 곱할 일이 없다.
//
// ── 최소 크기를 두지 않는다 ────────────────────────────────
//
// 같은 결정이 "최소 브라우저 크기를 정하지 않는다. 창이 작아도 플레이를 막거나
// 경고를 표시하지 않는다" 로 정했다. 그래서 배율에 하한이 없다.

/** 기준 해상도. `DEC-UI-025` 확정 값이라 코드 상수로 둔다 (게임 데이터가 아니다) */
export const BASE_WIDTH = 1920
export const BASE_HEIGHT = 1080

export interface Stage {
  /** 창 크기에 맞춰 배율을 다시 계산한다 */
  apply(): void
  destroy(): void
}

export interface StageOptions {
  /**
   * 배율이 바뀐 뒤 불린다.
   *
   * **캔버스가 이걸 기다려야 한다.** 렌더러는 변환이 반영된 크기를 읽어 백킹
   * 해상도를 정하는데, 자기 `resize` 리스너가 먼저 돌면 이전 배율을 본다.
   */
  onScaleChanged?(): void
}

/**
 * 무대를 창에 맞춘다.
 *
 * 여백은 무대 바깥이며 `body` 배경색이 그대로 보인다. 여백에 아무것도 그리지
 * 않는 것이 확정 내용이다 — 늘려서 채우면 비율이 깨진다.
 */
export function createStage(element: HTMLElement, options: StageOptions = {}): Stage {
  // 크기는 여기서만 정한다. CSS 에도 적으면 두 곳이 갈라진다.
  element.style.width = `${BASE_WIDTH}px`
  element.style.height = `${BASE_HEIGHT}px`

  function apply(): void {
    const scale = Math.min(
      window.innerWidth / BASE_WIDTH,
      window.innerHeight / BASE_HEIGHT,
    )
    element.style.transform = `translate(-50%, -50%) scale(${scale})`
    options.onScaleChanged?.()
  }

  apply()
  window.addEventListener('resize', apply)

  return {
    apply,
    destroy() {
      window.removeEventListener('resize', apply)
    },
  }
}
