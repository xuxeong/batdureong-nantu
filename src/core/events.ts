// 시스템 ↔ UI 이벤트 계약.
//
// **UI는 상태를 직접 쓰지 않는다.** 요청 이벤트를 보내고, 시스템이 확정한 뒤
// 결과 이벤트를 발행하면 그것을 보고 그린다.
//
// 왜 이렇게 하나:
//
//   거래·제작·협상·보상은 "조건 미달이면 아무것도 바꾸지 않는다"가 확정 규칙이다
//   (DEC-RESOURCE-011, DEC-CRAFT-004, DEC-RESIDENT-050, DEC-RESIDENT-042).
//   UI가 보관함을 직접 깎으면 "화면은 깎였는데 시스템은 거절"이 반드시 생긴다.
//   실패가 눈에 안 보이는 종류의 버그라 8/5에 밸런스 붕괴로만 드러난다.
//   요청과 결과를 갈라 두면 그 경로가 아예 존재하지 않는다.
//
// 요청은 명령형(`요청`), 결과는 과거형(`확정됨`)으로 이름을 맞춘다.
// 요청 하나에 결과가 성공/거절 두 갈래로 온다. UI는 거절도 반드시 처리한다.
//
// 파일 소유: 최수정. 김민주는 import 만 한다. 바꿔야 하면 먼저 말한다 (로드맵 7-2).

import type {
  PrecombatChoiceFunction,
  SurrenderChoiceFunction,
  FinalOutcome,
} from '../data/types.ts'
import type { RunState, FieldState } from '../state/types.ts'

// ─────────────────────────────────────────────────────────────
// 화면 (DEC-UI-014)
// ─────────────────────────────────────────────────────────────

/**
 * 독립 화면. 필드를 덮고 혼자 뜬다.
 *
 * 런 실패와 엔딩은 공유 템플릿으로 묶지 않는다 (DEC-UI-014 명시).
 */
export type ScreenId =
  | 'title'
  | 'name_input'
  | 'tutorial'
  | 'day_start'
  | 'encounter_result'
  | 'night_result'
  | 'run_failed'
  | 'ending'
  | 'data_error'

/**
 * 필드 위에 뜨는 오버레이. 뜨는 동안 필드 시뮬레이션이 정지한다.
 *
 * 전투 전 대화와 투항 대화는 필수 화면이라 `Esc`로 닫을 수 없다.
 * `Esc`는 대화를 그대로 둔 채 일시정지만 겹친다 (DEC-UI-014).
 */
export type OverlayId =
  | 'maintenance_hub'
  | 'precombat_dialogue'
  | 'surrender_dialogue'
  | 'recovery_quickmenu'
  | 'pause'

/** 필드의 두 가지 동작 모드. 필드는 화면이 아니라 베이스다 */
export type FieldMode = 'farming' | 'raid'

// ─────────────────────────────────────────────────────────────
// UI → 시스템 : 요청
// ─────────────────────────────────────────────────────────────

/**
 * 거절 사유.
 *
 * UI가 문구를 지어내지 않게 키로 고정한다. 표시 문구는 UI 쪽 책임이고
 * 시스템은 왜 거절했는지만 알려준다.
 */
export type RejectionReason =
  | 'insufficient_money'
  | 'insufficient_items'
  | 'recipe_locked'
  | 'invalid_quantity'
  | 'duplicate_request'
  | 'wrong_phase'
  | 'data_missing'

export interface UiRequests {
  /** 이름을 확정하고 런을 시작한다 */
  'run.start': { playerName: string }
  /** 타이틀로 돌아간다. 현재 런은 소멸한다 (DEC-RESOURCE-004) */
  'run.abandon': Record<string, never>

  /** 수확물 판매. 판매 가능한 자원은 수확물뿐이다 (DEC-RESOURCE-007) */
  'shop.sell': { cropId: string; quantity: number }
  /** 조합 재료 구매. 구매 가능한 자원은 재료뿐이다 (DEC-RESOURCE-008) */
  'shop.buy': { materialId: string; quantity: number }
  /** 제작. 한 종류 레시피 × 1 이상의 횟수 (DEC-CRAFT-004) */
  'craft.make': { recipeId: string; times: number }

  /** 정비 단계에서만 편성할 수 있다 (DEC-INPUT-006) */
  'quickslot.assign': { slotIndex: number; throwableId: string | null }
  /** 재배·습격 중에는 선택만 가능하다 */
  'quickslot.select': { slotIndex: number }
  'pouch.select': { itemId: string }

  /** 정비 종료. 습격 여부에 따라 다음 화면이 갈린다 (DEC-UI-014) */
  'maintenance.finish': { intent: 'scout_field' | 'sleep_until_morning' }

  /** 전투 전 대화 선택 (DEC-RESIDENT-049) */
  'dialogue.choose': { choiceId: string }
  /** 투항 대화 선택 (DEC-RESIDENT-019) */
  'surrender.choose': { choiceId: string }

  /** 결과 화면에서 다음으로 (DEC-RUN-015) */
  'result.continue': Record<string, never>

  'pause.open': Record<string, never>
  'pause.close': Record<string, never>
}

// ─────────────────────────────────────────────────────────────
// 시스템 → UI : 결과
// ─────────────────────────────────────────────────────────────

export interface SystemEvents {
  // 화면 전환 ───────────────────────────────────────────────
  'screen.changed': { screen: ScreenId }
  'field.entered': { mode: FieldMode }
  'field.exited': Record<string, never>
  'overlay.opened': { overlay: OverlayId }
  'overlay.closed': { overlay: OverlayId }

  /**
   * 필드 시뮬레이션 정지·재개 (DEC-INPUT-009, DEC-RESIDENT-039).
   * 정지 중에는 이동·조준·공격·상호작용 입력과 주민 AI·투사체·상태이상 틱이 모두 멈춘다.
   */
  'simulation.paused': { cause: 'dialogue' | 'pause_menu' | 'focus_lost' }
  'simulation.resumed': Record<string, never>

  // 상태 ─────────────────────────────────────────────────────
  /**
   * 상태가 바뀌었다. UI는 이 스냅샷만 보고 그린다.
   *
   * 읽기 전용으로 넘긴다 — UI가 받은 객체를 고쳐도 시스템 상태는 안 바뀌고
   * 다음 스냅샷에 덮여 사라진다. 그 상황이 제일 찾기 어렵다.
   */
  'state.changed': { run: Readonly<RunState> }
  'field.changed': { field: Readonly<FieldState> }

  // 거래·제작 ─────────────────────────────────────────────────
  /** 확정된 뒤에만 온다. 이 시점에 자원 변경이 이미 전부 반영돼 있다 */
  'shop.sold': { cropId: string; quantity: number; gainedMoney: number }
  'shop.bought': { materialId: string; quantity: number; spentMoney: number }
  'craft.made': { recipeId: string; times: number; resultId: string; resultQuantity: number }
  /** 해금은 제작 결과로만 발생한다 (DEC-CRAFT-007) */
  'craft.recipeUnlocked': { recipeId: string; cropId: string }

  /**
   * 요청을 거절했다. **아무 상태도 바뀌지 않았다.**
   * UI는 낙관적 갱신을 하지 않으므로 되돌릴 것이 없다.
   */
  'request.rejected': { request: keyof UiRequests; reason: RejectionReason }

  // 재배 ─────────────────────────────────────────────────────
  /** 씨앗 단계에서는 종류를 공개하지 않는다. 그래서 cropId 를 싣지 않는다 (DEC-FARM-002) */
  'farm.planted': { plotId: string }
  /**
   * 수확 가능으로 바뀐 순간 (DEC-UI-004).
   *
   * **전환 시점이 필요해서 따로 둔다.** `field.changed` 스냅샷을 이전 것과 비교해
   * 알아내는 방법도 있지만, DEC-UI-004 는 "바뀌는 순간 한 번 강조하고 반복하지 않는다"
   * 와 짧은 효과음을 요구한다. 스냅샷 비교는 프레임을 한 번 건너뛰거나 같은 스냅샷이
   * 두 번 오는 순간 강조가 사라지거나 두 번 울린다 — 둘 다 화면에서 원인을 못 찾는다.
   *
   * 상태 표식(유지되는 동안 계속 표시)은 이 이벤트가 아니라 `field.changed` 로 그린다.
   * 이건 전환 한 번만 알린다.
   */
  'farm.plotReady': { plotId: string }
  'farm.harvested': { plotId: string; cropId: string; quantity: number }
  'farm.timeExpired': Record<string, never>

  // 전투 ─────────────────────────────────────────────────────
  'combat.playerDamaged': { amount: number; remainingHealth: number }
  'combat.throwableSpent': { throwableId: string; remaining: number }
  /**
   * 낫을 실제로 휘둘렀다 (재사용 대기를 통과했다).
   *
   * **명중과 무관하다.** `DEC-RUN-003` 이 튜토리얼 진행 조건을 "기본 조작을 실제로
   * 성공하면" 으로 정했고 낫은 대상이 없어도 휘두르는 것 자체가 성공이다.
   * 대기 중이라 거절된 입력은 여기 오지 않는다.
   */
  'combat.sickleSwung': { hitCount: number }
  /** 소진 후 자동 전환. 같은 입력으로 추가 발사하지 않는다 (DEC-INPUT-007) */
  'quickslot.autoSwitched': { fromIndex: number; toIndex: number | null }
  /** 모든 투척 무기가 소진됐다. 낫은 계속 쓸 수 있다 */
  'quickslot.allEmpty': Record<string, never>
  'recovery.started': { itemId: string; durationSeconds: number }
  /** 공격받거나 대화로 전환되면 취소된다. 아이템은 소비하지 않는다 */
  'recovery.cancelled': { itemId: string }
  'recovery.completed': { itemId: string; healedAmount: number }

  // 조우 ─────────────────────────────────────────────────────
  'dialogue.opened': { residentId: string; scenarioId: string; phase: 'precombat' | 'surrender' }
  /**
   * 판정 결과가 확정됐다. 선택지 문장이 아니라 성격 프로필 조회 결과다
   * (DEC-RESIDENT-049).
   */
  'dialogue.resolved': {
    choiceId: string
    choiceFunction: PrecombatChoiceFunction | SurrenderChoiceFunction
    systemResultId: string
    reactionText: string
    revealedStoryInfoId: string | null
  }
  /** 자원 협상 수락. 무엇이 빠져나갔는지는 실행 후에만 알 수 있다 (DEC-RESIDENT-050) */
  'negotiation.accepted': { residentId: string; consumed: Record<string, number> }
  /** 투항 발동 (DEC-RESIDENT-016) */
  'surrender.offered': { residentId: string; remainingHealth: number }
  /** 조우 종료. finalOutcome 은 여기서 정확히 한 번 확정된다 (DEC-RESIDENT-052) */
  'encounter.finished': { residentId: string; finalOutcome: FinalOutcome }
  /** 보상 지급 완료. 한 런에서 한 번만 온다 (DEC-RESIDENT-042) */
  'reward.granted': { residentId: string; bundleId: string }

  // 런 종료 ───────────────────────────────────────────────────
  /** 체력 0. 엔딩으로 가지 않는다 (DEC-RUN-008, DEC-UI-014) */
  'run.failed': Record<string, never>
  /** 엔딩 확정. 기록문 생성 요청은 이 뒤에 시작한다 (DEC-CONTENT-011) */
  'ending.decided': { endingId: string; endingTitle: string }
  /** 기록문이 준비됐다. LLM 실패로 폴백을 쓴 경우에도 온다 (DEC-JOURNAL-003) */
  'ending.recordReady': { recordText: string; usedFallback: boolean }

  // 오류 ─────────────────────────────────────────────────────
  /**
   * 필수 데이터가 없거나 참조가 깨졌다.
   *
   * **기본값으로 넘기지 않는다** (AGENTS.md 6절). 제출 빌드에서는 상세를 숨긴다
   * (DEC-UI-024, VITE_BUILD_MODE).
   */
  'data.error': { summary: string; detail: string }
}

// ─────────────────────────────────────────────────────────────
// 버스
// ─────────────────────────────────────────────────────────────

export type UiRequestName = keyof UiRequests
export type SystemEventName = keyof SystemEvents

export type Unsubscribe = () => void

/**
 * 이벤트 버스.
 *
 * 방향이 두 개라 타입도 둘로 나눠 둔다. UI가 SystemEvents 를 발행하거나
 * 시스템이 UiRequests 를 듣는 것은 계약 위반이고, 타입 단계에서 막힌다.
 */
export interface EventBus {
  /** UI → 시스템 */
  request<K extends UiRequestName>(name: K, payload: UiRequests[K]): void
  onRequest<K extends UiRequestName>(
    name: K,
    handler: (payload: UiRequests[K]) => void,
  ): Unsubscribe

  /** 시스템 → UI */
  emit<K extends SystemEventName>(name: K, payload: SystemEvents[K]): void
  on<K extends SystemEventName>(name: K, handler: (payload: SystemEvents[K]) => void): Unsubscribe
}
