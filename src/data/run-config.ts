// 플레이어 기본 수치의 단일 통로 (DEC-CONTENT-019, 개발 로드맵 5-1).
//
// `player_base_stats.csv`의 승인 행은 정확히 하나다. 로더가 그 하나를 여기 넣고,
// `resetState()`·HUD·이동·전투는 **이 통로만** 참조한다. 여러 곳에서 각자 읽지 않는다.
//
// 낫 수치가 여기 묶여 있다는 점에 주의한다. 투척 무기는 `throwable_weapons.csv`에서
// 오지만 낫은 무기 데이터가 아니라 플레이어 기본 수치다 (DEC-INPUT-004).
//
// ── 임시 값은 없다 ───────────────────────────────────────────
//
// 이 파일에는 `?? 기본값`이 없다. 데이터가 없으면 조용히 넘어가지 않고 던진다
// (AGENTS.md 6절 — 필수 데이터가 없으면 검증 오류로 보고한다).
//
// 승인 전에는 `usePlaceholderStats()` 로 이동만 확인할 수 있게 해 뒀었는데,
// `player_base_stats.csv` 가 승인되고 `DEC-UI-024` 의 데이터 오류 화면이 생기면서
// **8/6에 지웠다.** 적재가 실패하면 부팅을 멈추고 그 사실을 화면에 띄우는 것이
// 확정 규칙이고, 임시 수치로 넘어가면 "데이터가 깨졌다" 가 "밭이 안 보인다" 로만
// 드러난다. 다시 필요해지면 그때 만든다 — 지금 남겨 두면 다음 사람이 부른다.

import type { PlayerBaseStats } from './types.ts'

let stats: PlayerBaseStats | null = null

/** 로더가 승인 행 하나를 넣는다 */
export function setPlayerBaseStats(rows: PlayerBaseStats[]): void {
  if (rows.length !== 1) {
    throw new DataMissingError(
      `player_base_stats 승인 행은 정확히 하나여야 하는데 ${rows.length}개다`,
    )
  }
  stats = rows[0]
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

  get moveSpeed(): number {
    return require('move_speed')
  },

  get collisionRadius(): number {
    return require('collision_radius')
  },
}

/** 테스트와 런 리셋에서 상태를 비운다 */
export function resetRunConfig(): void {
  stats = null
}
