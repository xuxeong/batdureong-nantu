// 회복 파우치 — 자동 선택과 사용 (DEC-RESOURCE-017, 018, DEC-INPUT-005, 012)
//
// ── 파우치에는 장착이 없다 (DEC-RESOURCE-017) ──────────────
//
// 칸 수 제한도 별도 장착 과정도 두지 않는다. **소모품 보관함의 회복 아이템과
// 수확물 보관함의 생식 가능한 수확물을 자동으로 참조**하며, 실제 보유 수량이
// 1개 이상인 것만 쓸 수 있다. 그래서 "무엇을 가졌나" 는 저장하지 않고 매번
// 보관함에서 계산한다 — 파우치가 들고 있는 것은 **선택 하나**뿐이다.
//
// ── 선택은 강제로 바뀌지 않는다 ────────────────────────────
//
// 새 아이템을 얻어도 현재 선택의 수량이 남아 있으면 바꾸지 않는다. 바꾸는 때는
// 둘뿐이다 — `회복 아이템 없음` 상태에서 뭔가를 얻었을 때(DEC-RESOURCE-017),
// 그리고 선택한 것이 소진됐을 때(DEC-RESOURCE-018).
//
// ── 순서는 하나다 (DEC-UI-037) ─────────────────────────────
//
// 제작 회복 아이템 먼저, 생식 가능한 수확물 뒤, 각 묶음 안에서 ID 오름차순.
// `DEC-UI-037` 이 퀵메뉴 표시 순서로 정하고 **그 순서를 자동 선택에도 쓴다**고
// 명시했다. 그래서 목록을 만드는 곳이 여기 하나다 — 두 벌이면 화면에서 고른
// 순서와 자동으로 고르는 순서가 달라진다.

import type { Crop, RecoveryItem } from '../data/types.ts'
import type { ItemStore, RecoveryPouch, RunState } from '../state/types.ts'

/** 파우치가 참조하는 한 항목. 보관함에서 매번 계산한다 */
export interface RecoveryOption {
  id: string
  displayName: string
  /** 승인 데이터에서 읽은 회복량 (DEC-UI-037) */
  healAmount: number
  useDurationSeconds: number
  moveSpeedMultiplier: number
  held: number
  /** 제작 회복 아이템인가 생식 수확물인가. 표시 순서가 갈린다 */
  kind: 'recovery_item' | 'crop'
}

export interface RecoverySources {
  items: readonly RecoveryItem[]
  crops: readonly Crop[]
  /**
   * 최대 체력. 런 상태에는 **현재 체력만** 있고 최대치는 `player_base_stats`
   * 승인 행이 원본이다 (DEC-CONTENT-019). 여기 숫자를 두지 않는다.
   */
  maxHealth: number
}

function countIn(store: ItemStore, id: string): number {
  return store[id] ?? 0
}

/**
 * 지금 쓸 수 있는 회복 항목 (DEC-RESOURCE-017, DEC-UI-037).
 *
 * **보유 1개 이상만** 담는다. 0개인 것을 목록에 두면 퀵메뉴가 못 쓰는 항목을
 * 보여주게 되고 자동 선택도 그것을 고른다.
 */
export function recoveryOptions(run: RunState, sources: RecoverySources): RecoveryOption[] {
  const made = sources.items
    .map((item) => ({
      id: item.id,
      displayName: item.display_name,
      healAmount: item.heal_amount,
      useDurationSeconds: item.use_duration_seconds,
      moveSpeedMultiplier: item.move_speed_multiplier,
      held: countIn(run.resources.recoveries, item.id),
      kind: 'recovery_item' as const,
    }))
    .filter((option) => option.held > 0)
    .sort((a, b) => a.id.localeCompare(b.id))

  // 생식 가능한 수확물만 (DEC-RESOURCE-017). 승인 데이터가 그 여부와 수치를 갖는다.
  const raw = sources.crops
    .filter((crop) => crop.is_raw_edible)
    .map((crop) => ({
      id: crop.id,
      displayName: crop.display_name,
      healAmount: crop.raw_heal_amount ?? 0,
      useDurationSeconds: crop.raw_use_duration_seconds ?? 0,
      moveSpeedMultiplier: crop.raw_move_speed_multiplier ?? 1,
      held: countIn(run.resources.crops, crop.id),
      kind: 'crop' as const,
    }))
    .filter((option) => option.held > 0)
    .sort((a, b) => a.id.localeCompare(b.id))

  // 제작 회복 아이템이 먼저다 (DEC-UI-037)
  return [...made, ...raw]
}

/**
 * 선택을 규칙대로 맞춘다 (DEC-RESOURCE-017, 018).
 *
 * **매 프레임 불러도 안전하다.** 현재 선택의 수량이 남아 있으면 아무것도 하지
 * 않는다 — 그것이 "새 아이템을 얻어도 선택을 강제로 변경하지 않는다" 의 구현이다.
 *
 * @returns 선택이 실제로 바뀌었으면 true
 */
export function syncSelection(pouch: RecoveryPouch, options: readonly RecoveryOption[]): boolean {
  const before = pouch.selectedId

  if (before !== null && options.some((option) => option.id === before)) return false

  // 소진됐거나 아직 아무것도 안 골랐다. 정해진 순서에서 첫 번째를 고른다.
  pouch.selectedId = options[0]?.id ?? null
  return pouch.selectedId !== before
}

export type RecoveryStart =
  | { ok: true; option: RecoveryOption }
  | { ok: false; reason: string }

/**
 * 사용을 시작할 수 있는가 (DEC-INPUT-005, DEC-RESOURCE-018).
 *
 * 시작 자체는 아이템을 소비하지 않는다. 게이지가 완료돼야 소비한다 —
 * 중간에 취소되거나 공격받으면 소비 없이 끝난다 (DEC-INPUT-012).
 */
export function startRecovery(
  run: RunState,
  options: readonly RecoveryOption[],
): RecoveryStart {
  const selected = options.find((option) => option.id === run.pouch.selectedId)
  if (selected === undefined) return { ok: false, reason: '회복 아이템 없음' }

  // 체력이 가득이어도 막지 않는다 — 그런 규칙을 정한 확정 DEC 가 없다.
  return { ok: true, option: selected }
}

export interface RecoveryFinished {
  itemId: string
  healed: number
  health: number
}

/**
 * 게이지를 진행한다. 완료되면 **소비와 회복을 한 처리로** 끝낸다.
 *
 * 부분 반영을 만들지 않는다 (`AGENTS.md` 6절) — 수량만 줄고 체력이 안 오르는
 * 상태가 남으면 플레이어에게는 아이템이 사라진 것으로만 보인다.
 *
 * @returns 이번 호출에서 완료됐으면 결과, 아니면 null
 */
export function advanceRecovery(
  run: RunState,
  deltaSeconds: number,
  sources: RecoverySources,
): RecoveryFinished | null {
  const progress = run.recovering
  if (progress === null) return null

  progress.elapsedSeconds += deltaSeconds
  if (progress.elapsedSeconds < progress.durationSeconds) return null

  const option = recoveryOptions(run, sources).find((o) => o.id === progress.itemId)
  run.recovering = null

  // 진행 중에 수량이 사라졌다. 회복시키지 않는다 — 없는 것을 먹을 수 없다.
  if (option === undefined || option.held <= 0) return null

  const store = option.kind === 'crop' ? run.resources.crops : run.resources.recoveries
  store[option.id] = option.held - 1
  if (store[option.id] === 0) delete store[option.id]

  const before = run.health
  run.health = Math.min(sources.maxHealth, run.health + option.healAmount)

  return { itemId: option.id, healed: run.health - before, health: run.health }
}
