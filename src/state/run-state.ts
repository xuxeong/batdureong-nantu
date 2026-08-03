// 런 상태 생성과 초기화 (DEC-RESOURCE-004, DEC-CRAFT-008, 개발 로드맵 9-5)
//
// 새 런과 런 실패 후 타이틀 복귀에서 이 객체를 **새로 만들어 통째로 교체**한다.
// 부분 초기화를 하지 않는 이유는 빠뜨린 필드가 이전 런의 값을 그대로 들고 남기 때문이다.
//
// 초기값은 전부 승인 데이터에서 온다. 체력·소지금은 `player_base_stats` 승인 행에서
// 오며 여기에 숫자를 쓰지 않는다 (DEC-CONTENT-019, DEC-PIPELINE-016).

import type { PlayerBaseStats, RunSchedule } from '../data/types.ts'
import type { ItemStore, Resources, RunState } from './types.ts'
import { THROWABLE_QUICKSLOT_COUNT } from './types.ts'

export interface NewRunOptions {
  stats: PlayerBaseStats
  schedule: RunSchedule
  playerName: string
  /** 자원 협상 추첨을 재현하기 위한 시드 (DEC-RESIDENT-050) */
  seed: number
}

function emptyStore(): ItemStore {
  return {}
}

/**
 * 새 런의 자원.
 *
 * 새 런을 시작하면 소지금과 모든 보관함을 초기화한다 (DEC-RESOURCE-004).
 * 씨앗은 무제한 공용이라 자원이 아니다 (DEC-RESOURCE-005).
 */
function newResources(stats: PlayerBaseStats): Resources {
  return {
    money: stats.starting_money,
    crops: emptyStore(),
    materials: emptyStore(),
    throwables: emptyStore(),
    recoveries: emptyStore(),
  }
}

export function createRunState(options: NewRunOptions): RunState {
  const { stats, schedule, playerName, seed } = options

  return {
    playerName,
    seed,
    runScheduleId: schedule.id,

    dayNumber: 1,
    phase: 'farming',

    health: stats.max_health,
    resources: newResources(stats),

    // 편성과 선택 상태는 새 런에서 초기화한다 (DEC-RESOURCE-016)
    quickslots: {
      slots: Array.from({ length: THROWABLE_QUICKSLOT_COUNT }, () => null),
      selectedIndex: 0,
    },
    // 목록을 저장하지 않는다. 보관함에서 매번 계산한다 (DEC-RESOURCE-017)
    pouch: { selectedId: null },
    recovering: null,

    // 주민 런 상태는 조우 시스템(최수정, 8/3)이 붙을 때 승인 주민으로 채운다.
    // 지금 임의로 채우면 그쪽 구현과 초기값이 두 곳에서 갈린다.
    residents: {},

    record: {
      fear: 0,
      importantActions: {
        empathy_resolve: 0,
        resource_negotiation_resolve: 0,
        resource_negotiation_rejected: 0,
        threat_selected: 0,
        surrender_recruit: 0,
        surrender_retreat_reward: 0,
        surrender_resume_combat: 0,
        resident_killed: 0,
      },
      // 작물 숙련도와 해금 상태는 새 런에서 초기화한다 (DEC-CRAFT-008)
      cropMastery: {},
      cropCraftConsumed: {},
      cropHarvested: {},
      unlockedRecipeIds: [],
      journalEntries: [],
    },

    ending: null,
  }
}
