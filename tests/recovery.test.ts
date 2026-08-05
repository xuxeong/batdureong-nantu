// 회복 파우치 테스트 (DEC-RESOURCE-017, 018, DEC-UI-001).
//
// 여기서 고정하는 것은 **언제 선택이 바뀌고 언제 안 바뀌는가** 다.
// 8/5 플레이 테스트에서 꿀바나나를 만들어 보관함에 넣었는데 HUD 가
// `회복 아이템 없음` 이라고 말했다 — 자동 선택이 아예 없었기 때문이다.
//
// 수치는 픽스처로 넘긴다. 코드에도 테스트에도 게임 데이터를 두지 않는다.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  advanceRecovery,
  recoveryOptions,
  startRecovery,
  syncSelection,
} from '../src/systems/recovery.ts'
import type { RecoverySources } from '../src/systems/recovery.ts'
import type { Crop, RecoveryItem } from '../src/data/types.ts'
import type { RunState } from '../src/state/types.ts'

const items = [
  {
    id: 'recovery_item.honey_banana',
    display_name: '꿀바나나',
    heal_amount: 35,
    use_duration_seconds: 2,
    move_speed_multiplier: 0.5,
  },
  {
    id: 'recovery_item.honey_tomato',
    display_name: '꿀 토마토',
    heal_amount: 15,
    use_duration_seconds: 1,
    move_speed_multiplier: 0.8,
  },
] as RecoveryItem[]

const crops = [
  {
    id: 'crop.chili',
    display_name: '고추',
    is_raw_edible: true,
    raw_heal_amount: 5,
    raw_use_duration_seconds: 1,
    raw_move_speed_multiplier: 0.9,
  },
  { id: 'crop.tomato', display_name: '토마토', is_raw_edible: false },
] as Crop[]

const sources: RecoverySources = { items, crops, maxHealth: 100 }

function runOf(overrides: {
  recoveries?: Record<string, number>
  crops?: Record<string, number>
  selectedId?: string | null
  health?: number
  recovering?: RunState['recovering']
}): RunState {
  return {
    playerName: '두렁',
    seed: 1,
    runScheduleId: 'run_schedule.standard_5day',
    dayNumber: 1,
    phase: 'farming',
    health: overrides.health ?? 100,
    resources: {
      money: 0,
      crops: overrides.crops ?? {},
      materials: {},
      throwables: {},
      recoveries: overrides.recoveries ?? {},
    },
    quickslots: { slots: [null, null, null, null, null], selectedIndex: 0 },
    pouch: { selectedId: overrides.selectedId ?? null },
    recovering: overrides.recovering ?? null,
    residents: {},
    record: {
      fear: 0,
      importantActions: {} as never,
      cropMastery: {},
      cropCraftConsumed: {},
      cropHarvested: {},
      unlockedRecipeIds: [],
      journalEntries: [],
      journalBaseline: null,
    },
    ending: null,
  } as RunState
}

// ── 목록 ────────────────────────────────────────────────────

test('보유 0인 것은 목록에 없다', () => {
  const run = runOf({ recoveries: { 'recovery_item.honey_banana': 0 } })
  assert.deepEqual(recoveryOptions(run, sources), [])
})

test('제작 회복 아이템이 생식 수확물보다 앞이고 각 묶음은 ID 오름차순이다', () => {
  const run = runOf({
    recoveries: { 'recovery_item.honey_tomato': 1, 'recovery_item.honey_banana': 1 },
    crops: { 'crop.chili': 3 },
  })

  assert.deepEqual(
    recoveryOptions(run, sources).map((o) => o.id),
    ['recovery_item.honey_banana', 'recovery_item.honey_tomato', 'crop.chili'],
  )
})

test('생식할 수 없는 수확물은 들어가지 않는다', () => {
  const run = runOf({ crops: { 'crop.tomato': 9 } })
  assert.deepEqual(recoveryOptions(run, sources), [])
})

// ── 자동 선택 ───────────────────────────────────────────────

test('회복 아이템 없음 상태에서 얻으면 자동 선택된다', () => {
  // 8/5에 실제로 났던 증상이다 — 만들어서 보관함에 있는데 HUD 가 없다고 했다
  const run = runOf({ recoveries: { 'recovery_item.honey_banana': 1 } })

  assert.equal(syncSelection(run.pouch, recoveryOptions(run, sources)), true)
  assert.equal(run.pouch.selectedId, 'recovery_item.honey_banana')
})

test('선택한 것의 수량이 남아 있으면 새로 얻어도 안 바뀐다', () => {
  const run = runOf({
    recoveries: { 'recovery_item.honey_tomato': 1, 'recovery_item.honey_banana': 1 },
    // 순서상 honey_banana 가 앞이지만 이미 tomato 를 고른 상태다
    selectedId: 'recovery_item.honey_tomato',
  })

  assert.equal(syncSelection(run.pouch, recoveryOptions(run, sources)), false)
  assert.equal(run.pouch.selectedId, 'recovery_item.honey_tomato')
})

test('선택한 것이 소진되면 정해진 순서에서 다음으로 넘어간다', () => {
  const run = runOf({
    recoveries: { 'recovery_item.honey_tomato': 2 },
    selectedId: 'recovery_item.honey_banana',
  })

  assert.equal(syncSelection(run.pouch, recoveryOptions(run, sources)), true)
  assert.equal(run.pouch.selectedId, 'recovery_item.honey_tomato')
})

test('쓸 수 있는 것이 하나도 없으면 선택이 비워진다', () => {
  const run = runOf({ selectedId: 'recovery_item.honey_banana' })

  syncSelection(run.pouch, recoveryOptions(run, sources))
  assert.equal(run.pouch.selectedId, null)
})

// ── 사용 ────────────────────────────────────────────────────

test('선택된 것이 없으면 시작하지 않는다', () => {
  const run = runOf({})
  assert.equal(startRecovery(run, recoveryOptions(run, sources)).ok, false)
})

test('게이지가 끝나야 소비하고 회복한다', () => {
  const run = runOf({
    recoveries: { 'recovery_item.honey_banana': 2 },
    selectedId: 'recovery_item.honey_banana',
    health: 40,
    recovering: { itemId: 'recovery_item.honey_banana', elapsedSeconds: 0, durationSeconds: 2 },
  })

  // 아직 진행 중 — 아무것도 바뀌지 않는다
  assert.equal(advanceRecovery(run, 1, sources), null)
  assert.equal(run.health, 40)
  assert.equal(run.resources.recoveries['recovery_item.honey_banana'], 2)

  const finished = advanceRecovery(run, 1, sources)
  assert.equal(finished?.healed, 35)
  assert.equal(run.health, 75)
  assert.equal(run.resources.recoveries['recovery_item.honey_banana'], 1)
  assert.equal(run.recovering, null)
})

test('최대 체력을 넘기지 않는다', () => {
  const run = runOf({
    recoveries: { 'recovery_item.honey_banana': 1 },
    selectedId: 'recovery_item.honey_banana',
    health: 80,
    recovering: { itemId: 'recovery_item.honey_banana', elapsedSeconds: 0, durationSeconds: 1 },
  })

  const finished = advanceRecovery(run, 1, sources)
  assert.equal(run.health, 100)
  assert.equal(finished?.healed, 20)
})

test('마지막 하나를 쓰면 보관함에서 사라진다', () => {
  const run = runOf({
    recoveries: { 'recovery_item.honey_banana': 1 },
    selectedId: 'recovery_item.honey_banana',
    health: 10,
    recovering: { itemId: 'recovery_item.honey_banana', elapsedSeconds: 0, durationSeconds: 1 },
  })

  advanceRecovery(run, 1, sources)
  assert.equal('recovery_item.honey_banana' in run.resources.recoveries, false)
})
