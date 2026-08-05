// 플레이어 기본 수치의 단일 통로 (DEC-CONTENT-019, 개발 로드맵 5-1).
//
// `player_base_stats.csv`의 승인 행은 정확히 하나다. 로더가 그 하나를 여기 넣고,
// `resetState()`·HUD·이동·전투는 **이 통로만** 참조한다. 여러 곳에서 각자 읽지 않는다.
//
// 낫 수치가 여기 묶여 있다는 점에 주의한다. 투척 무기는 `throwable_weapons.csv`에서
// 오지만 낫은 무기 데이터가 아니라 플레이어 기본 수치다 (DEC-INPUT-004).
//
// ── 승인 전 임시 값에 대하여 ──────────────────────────────────
//
// 이 파일에는 `?? 기본값`이 없다. 데이터가 없으면 조용히 넘어가지 않고 던진다
// (AGENTS.md 6절 — 필수 데이터가 없으면 검증 오류로 보고한다).
//
// 다만 `player_base_stats.csv`는 초안조차 없어서 지금은 플레이어가 움직일 수 없다.
// 그래서 임시 값을 쓰려면 `usePlaceholderStats()`를 **명시적으로 호출**해야 한다.
// 폴백이 아니라 선언이다 — 부르지 않으면 임시 값은 존재하지 않는다.
// 승인 행이 올라오면 호출부만 지운다.

import type { PlayerBaseStats } from './types.ts'

/** 승인 데이터가 아직 없을 때 화면에서 움직여 보기 위한 값 */
export interface PlaceholderStats {
  moveSpeed: number
  collisionRadius: number
  worldWidth: number
  worldHeight: number
}

let stats: PlayerBaseStats | null = null
let placeholder: PlaceholderStats | null = null

/** 로더가 승인 행 하나를 넣는다 */
export function setPlayerBaseStats(rows: PlayerBaseStats[]): void {
  if (rows.length !== 1) {
    throw new DataMissingError(
      `player_base_stats 승인 행은 정확히 하나여야 하는데 ${rows.length}개다`,
    )
  }
  stats = rows[0]
  placeholder = null
}

/**
 * 승인 전 임시 값을 쓰겠다고 선언한다. 개발 중에만 호출한다.
 *
 * 콘솔에 남기는 것은 필수다. 조용히 돌아가면 승인 데이터가 들어온 뒤에도
 * 왜 수치가 안 바뀌는지 아무도 못 찾는다.
 */
export function usePlaceholderStats(values: PlaceholderStats): void {
  if (stats !== null) return
  placeholder = values
  console.warn(
    '[임시 값] player_base_stats 승인 행이 없어 임시 수치로 동작한다. ' +
      '승인되면 usePlaceholderStats() 호출을 지운다. (DEC-CONTENT-019)',
  )
}

/** 필수 데이터가 없다. 화면에 데이터 오류로 올린다 (DEC-UI-024) */
export class DataMissingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DataMissingError'
  }
}

function require<K extends keyof PlayerBaseStats>(field: K): PlayerBaseStats[K] {
  if (stats === null) {
    throw new DataMissingError(
      `player_base_stats 가 로드되지 않아 ${String(field)} 를 읽을 수 없다`,
    )
  }
  return stats[field]
}

export const runConfig = {
  /** 승인 데이터가 들어와 있는가. 임시 값은 여기서 true 가 되지 않는다 */
  get loaded(): boolean {
    return stats !== null
  },

  get maxHealth(): number {
    return require('max_health')
  },
  /** 런 시작 시 소지금 초기화 (DEC-RESOURCE-004) */
  get startingMoney(): number {
    return require('starting_money')
  },
  get sickleDamage(): number {
    return require('sickle_damage')
  },
  get sickleRange(): number {
    return require('sickle_range')
  },
  get sickleCooldownSeconds(): number {
    return require('sickle_cooldown_seconds')
  },

  /**
   * 이동속도. 임시 값이 선언돼 있으면 그것을 쓴다.
   *
   * 이동과 충돌만 임시 값을 허용한다 — 이 둘이 없으면 화면에서 아무것도 확인할 수 없다.
   * 체력·소지금·낫 수치는 임시 값을 두지 않는다. 없는 채로 런을 시작하면
   * 밸런스가 조용히 틀어지고, 그건 실행해도 안 보인다.
   */
  get moveSpeed(): number {
    if (stats !== null) return stats.move_speed
    if (placeholder !== null) return placeholder.moveSpeed
    throw new DataMissingError('move_speed 가 없다')
  },

  get collisionRadius(): number {
    if (stats !== null) return stats.collision_radius
    if (placeholder !== null) return placeholder.collisionRadius
    throw new DataMissingError('collision_radius 가 없다')
  },
}

/**
 * 임시 월드 크기. 실제 값은 `maps.csv`의 `world_width` / `world_height` 에서 온다.
 * 승인 전에 카메라를 확인하기 위한 것이며 승인되면 이 함수는 쓰이지 않는다.
 */
export function placeholderWorldSize(): { width: number; height: number } | null {
  if (placeholder === null) return null
  return { width: placeholder.worldWidth, height: placeholder.worldHeight }
}

/** 테스트와 런 리셋에서 상태를 비운다 */
export function resetRunConfig(): void {
  stats = null
  placeholder = null
}
