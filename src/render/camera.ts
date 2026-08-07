// 카메라와 좌표 변환 (개발 로드맵 9-1).
//
// **월드 ↔ 스크린 변환은 이 파일에만 둔다.** 시스템마다 따로 계산하면
// 상호작용 판정과 렌더 위치가 어긋나고, 그 어긋남은 "가까이 갔는데 E가 안 먹는다"처럼
// 원인을 짐작하기 어려운 형태로 나온다.
//
// 같은 좌표계를 쓰는 것: farm_plots 의 x/y, farm_interaction_radius,
// wildlife_spawn_edge_margin, wildlife_spawn_min_player_distance,
// attack_range, projectile_max_range.

/**
 * 월드 1단위가 화면 몇 픽셀인가.
 *
 * **1은 확정 값이다.** `DEC-ART-003`이 "논리 월드 1단위를 화면 1픽셀로 한다"로
 * 확정했다 (8/4). 화면 배율은 표현이지 게임 데이터가 아니므로 CSV로 빼지 않는다
 * (로드맵 2절).
 *
 * 임시로 1을 쓰던 근거도 확정 내용과 같았다 — `maps.csv` 의 승인 값이
 * `world_width` 1600 · `world_height` 900 이라 `DEC-UI-025` 의 기준 해상도
 * 1920×1080 안에 그대로 들어가고, 남는 영역은 여백이 되어 필드 HUD가 쓴다.
 */
export const WORLD_TO_PIXEL = 1

export interface Vec2 {
  x: number
  y: number
}

export interface Camera {
  /** 카메라가 비추는 월드 좌표의 좌상단 */
  readonly x: number
  readonly y: number

  /** 뷰포트 크기가 바뀌면 알린다 */
  resize(viewportWidth: number, viewportHeight: number): void
  /** 월드 크기가 바뀌면 알린다. maps.csv 의 world_width / world_height */
  setWorldSize(width: number, height: number): void

  /** 대상을 화면 중앙에 두되 맵 경계 밖을 비추지 않는다 */
  follow(target: Vec2): void

  worldToScreen(point: Vec2): Vec2
  screenToWorld(point: Vec2): Vec2
}

export function createCamera(): Camera {
  let viewportWidth = 0
  let viewportHeight = 0
  let worldWidth = 0
  let worldHeight = 0
  let x = 0
  let y = 0

  /** 뷰포트가 월드보다 크면 남는 쪽은 월드를 가운데에 둔다 */
  function clampAxis(value: number, world: number, viewport: number): number {
    const worldPixels = world * WORLD_TO_PIXEL
    if (worldPixels <= viewport) return (worldPixels - viewport) / 2
    return Math.min(Math.max(value, 0), worldPixels - viewport)
  }

  return {
    get x() {
      return x
    },
    get y() {
      return y
    },

    resize(width, height) {
      viewportWidth = width
      viewportHeight = height
    },

    setWorldSize(width, height) {
      worldWidth = width
      worldHeight = height
    },

    follow(target) {
      x = clampAxis(
        target.x * WORLD_TO_PIXEL - viewportWidth / 2,
        worldWidth,
        viewportWidth,
      )
      y = clampAxis(
        target.y * WORLD_TO_PIXEL - viewportHeight / 2,
        worldHeight,
        viewportHeight,
      )
    },

    worldToScreen(point) {
      return {
        x: point.x * WORLD_TO_PIXEL - x,
        y: point.y * WORLD_TO_PIXEL - y,
      }
    },

    screenToWorld(point) {
      return {
        x: (point.x + x) / WORLD_TO_PIXEL,
        y: (point.y + y) / WORLD_TO_PIXEL,
      }
    },
  }
}
