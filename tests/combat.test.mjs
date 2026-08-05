// 전투 기반 규칙 검사 (DEC-INPUT-004~007, DEC-CONTENT-005, DEC-CONTENT-013)
//
// 여기 있는 것은 전부 **화면으로는 확인할 수 없는 것들**이다.
// 피해가 들어간 것과 순서가 맞는 것은 눈으로 구분되지 않고, 지속 피해가 한 틱
// 모자란 것은 "좀 약하네"로만 보인다. 수치는 이 파일 안의 가짜 데이터에서 온다.

import test from 'node:test'
import assert from 'node:assert/strict'

import { createCombat, effectiveMoveSpeed } from '../src/systems/combat.ts'

const STATS = {
  id: 'player_base_stats.default',
  kind: 'player_base_stats',
  max_health: 100,
  starting_money: 0,
  move_speed: 260,
  collision_radius: 20,
  sickle_damage: 10,
  sickle_range: 50,
  sickle_cooldown_seconds: 0.5,
}

const ATTRIBUTES = [
  { id: 'crop_attribute.burn', kind: 'crop_attribute', combat_mechanic_key: 'damage_over_time' },
  { id: 'crop_attribute.sticky', kind: 'crop_attribute', combat_mechanic_key: 'movement_slow' },
]

/** 지속 피해 무기. 5초 동안 1초마다 3 */
const BURN = {
  id: 'throwable_weapon.chili_bomb',
  kind: 'throwable_weapon',
  crop_attribute_id: 'crop_attribute.burn',
  base_damage: 8,
  projectile_speed: 400,
  max_range: 300,
  cooldown_seconds: 1,
  collision_radius: 4,
  impact_mode: 'direct',
  area_radius: null,
  effect_rank: 1,
  effect_duration_seconds: 5,
  effect_damage_per_tick: 3,
  effect_tick_interval_seconds: 1,
  effect_move_speed_multiplier: null,
}

/** 같은 지속 피해인데 순위가 높은 것 */
const BURN_STRONG = {
  ...BURN,
  id: 'throwable_weapon.chili_bomb_2',
  effect_rank: 2,
  effect_damage_per_tick: 9,
  effect_duration_seconds: 2,
}

/** 범위 둔화 무기 */
const STICKY = {
  ...BURN,
  id: 'throwable_weapon.sticky_bomb',
  crop_attribute_id: 'crop_attribute.sticky',
  base_damage: 5,
  impact_mode: 'area',
  area_radius: 60,
  effect_rank: 1,
  effect_duration_seconds: 3,
  effect_damage_per_tick: null,
  effect_tick_interval_seconds: null,
  effect_move_speed_multiplier: 0.5,
}

const WEAPONS = [BURN, BURN_STRONG, STICKY]

function combat() {
  return createCombat({ stats: STATS, weapons: WEAPONS, attributes: ATTRIBUTES })
}

/** 야생동물처럼 투항이 없는 대상 */
function beast(id, health, x = 0, y = 0) {
  return {
    entity: { instanceId: id, x, y, health, effects: [] },
    collisionRadius: 16,
    surrenderThreshold: null,
    surrenderOffered: false,
  }
}

/** 주민처럼 투항 기준이 있는 대상 */
function resident(id, health, threshold, x = 0, y = 0) {
  return {
    entity: { instanceId: id, x, y, health, effects: [] },
    collisionRadius: 18,
    surrenderThreshold: threshold,
    surrenderOffered: false,
  }
}

function runWith(slots, throwables) {
  return {
    resources: { money: 0, crops: {}, materials: {}, throwables, recoveries: {} },
    quickslots: { slots, selectedIndex: 0 },
  }
}

// ── 낫 ────────────────────────────────────────────────────────

test('낫은 사거리 안의 정면 대상만 친다', () => {
  const c = combat()
  const front = beast('front', 50, 40, 0)
  const behind = beast('behind', 50, -40, 0)
  const far = beast('far', 50, 400, 0)
  c.setTargets([front, behind, far])

  const result = c.swingSickle({ x: 0, y: 0 }, 0) // 오른쪽을 본다

  assert.equal(result.swung, true)
  assert.deepEqual(
    result.hits.map((h) => h.targetId),
    ['front'],
  )
  assert.equal(front.entity.health, 40)
  assert.equal(behind.entity.health, 50, '커서 반대편은 치지 않는다')
  assert.equal(far.entity.health, 50)
})

test('낫은 재사용 대기 중에 헛돌지 않고 아무 일도 하지 않는다', () => {
  const c = combat()
  const target = beast('a', 50, 40, 0)
  c.setTargets([target])

  c.swingSickle({ x: 0, y: 0 }, 0)
  const second = c.swingSickle({ x: 0, y: 0 }, 0)

  assert.equal(second.swung, false)
  assert.equal(target.entity.health, 40, '대기 중 휘두르기는 피해를 주지 않는다')

  c.update(STATS.sickle_cooldown_seconds)
  assert.equal(c.swingSickle({ x: 0, y: 0 }, 0).swung, true)
})

// ── 투척 소비 (DEC-CONTENT-005) ───────────────────────────────

test('발사에 성공한 순간에만 무기를 소비한다', () => {
  const c = combat()
  const run = runWith([BURN.id], { [BURN.id]: 2 })

  const first = c.throwWeapon({ x: 0, y: 0 }, 0, run)
  assert.equal(first.ok, true)
  assert.equal(run.resources.throwables[BURN.id], 1)

  // 재사용 대기 중에는 소비하지 않는다
  const second = c.throwWeapon({ x: 0, y: 0 }, 0, run)
  assert.equal(second.ok, false)
  assert.equal(second.reason, 'cooldown')
  assert.equal(run.resources.throwables[BURN.id], 1, '거절된 발사는 수량을 줄이지 않는다')
})

test('수량이 0이면 발사하지 않고 재사용 대기도 걸지 않는다', () => {
  const c = combat()
  const run = runWith([BURN.id], {})

  const result = c.throwWeapon({ x: 0, y: 0 }, 0, run)

  assert.equal(result.ok, false)
  assert.equal(result.reason, 'out_of_ammo')
  assert.equal(c.throwCooldownRemaining, 0)
  assert.equal(c.projectiles.length, 0)
})

test('투척 재사용 대기는 무기를 바꿔도 우회되지 않는다', () => {
  const c = combat()
  const run = runWith([BURN.id, STICKY.id], { [BURN.id]: 1, [STICKY.id]: 1 })

  c.throwWeapon({ x: 0, y: 0 }, 0, run)
  run.quickslots.selectedIndex = 1

  const swapped = c.throwWeapon({ x: 0, y: 0 }, 0, run)
  assert.equal(swapped.ok, false)
  assert.equal(swapped.reason, 'cooldown')
  assert.equal(run.resources.throwables[STICKY.id], 1)
})

test('단계에 새로 진입하면 전역 투척 대기를 초기화한다', () => {
  const c = combat()
  const run = runWith([BURN.id], { [BURN.id]: 1 })

  c.throwWeapon({ x: 0, y: 0 }, 0, run)
  assert.ok(c.throwCooldownRemaining > 0)

  c.reset()
  assert.equal(c.throwCooldownRemaining, 0)
  assert.equal(c.projectiles.length, 0)
})

// ── 투사체 (DEC-CONTENT-005) ──────────────────────────────────

test('빠른 투사체가 한 프레임에 대상을 뛰어넘지 않는다', () => {
  const c = combat()
  // 속도 400, dt 0.5 면 200 을 한 번에 간다. 대상은 그 중간인 100 에 있다.
  const target = beast('mid', 50, 100, 0)
  c.setTargets([target])
  c.throwWeapon({ x: 0, y: 0 }, 0, runWith([BURN.id], { [BURN.id]: 1 }))

  c.update(0.5)

  assert.equal(target.entity.health, 42, '경로 위의 대상에 명중해야 한다')
  assert.equal(c.projectiles.length, 0, 'direct 는 관통하지 않는다')
})

test('direct 투사체가 사거리까지 못 맞추면 피해 없이 사라진다', () => {
  const c = combat()
  const target = beast('far', 50, 1000, 0)
  c.setTargets([target])
  c.throwWeapon({ x: 0, y: 0 }, 0, runWith([BURN.id], { [BURN.id]: 1 }))

  // max_range 300, 속도 400 → 0.75초면 소멸한다
  c.update(1)

  assert.equal(target.entity.health, 50)
  assert.equal(c.projectiles.length, 0)
})

test('area 는 범위 안의 모든 대상을 한 번씩만 때린다', () => {
  const c = combat()
  const hit = beast('hit', 50, 100, 0)
  const near = beast('near', 50, 130, 0)
  const outside = beast('outside', 50, 300, 0)
  c.setTargets([hit, near, outside])
  c.throwWeapon({ x: 0, y: 0 }, 0, runWith([STICKY.id], { [STICKY.id]: 1 }))

  c.update(0.5)

  assert.equal(hit.entity.health, 45, '최초 충돌 대상도 범위 대상이며 중복 적용하지 않는다')
  assert.equal(near.entity.health, 45)
  assert.equal(outside.entity.health, 50)
})

// ── 전투 효과 (DEC-CONTENT-013) ───────────────────────────────

test('첫 지속 피해는 즉시가 아니라 첫 틱 간격이 지난 뒤에 들어간다', () => {
  const c = combat()
  const target = beast('a', 50, 100, 0)
  c.setTargets([target])
  c.throwWeapon({ x: 0, y: 0 }, 0, runWith([BURN.id], { [BURN.id]: 1 }))

  c.update(0.5) // 명중. 직접 피해 8 만
  assert.equal(target.entity.health, 42)

  c.update(0.9) // 효과가 붙은 뒤 0.9초. 아직 첫 틱(1초) 전이다
  assert.equal(target.entity.health, 42)

  c.update(0.2) // 누적 1.1초 → 첫 틱
  assert.equal(target.entity.health, 39)
})

test('한 번의 update 가 여러 틱을 건너뛰지 않는다', () => {
  const c = combat()
  const target = beast('a', 100, 100, 0)
  c.setTargets([target])
  c.throwWeapon({ x: 0, y: 0 }, 0, runWith([BURN.id], { [BURN.id]: 1 }))

  c.update(0.5) // 명중, 직접 8
  c.update(5) // 지속시간 5초를 통째로 넘긴다 — 틱 5회

  assert.equal(target.entity.health, 100 - 8 - 3 * 5)
  assert.equal(target.entity.effects.length, 0, '지속시간이 끝나면 효과가 사라진다')
})

test('지속시간을 넘긴 틱은 피해를 주지 않는다', () => {
  const c = combat()
  const target = beast('a', 100, 100, 0)
  c.setTargets([target])
  c.throwWeapon({ x: 0, y: 0 }, 0, runWith([BURN.id], { [BURN.id]: 1 }))

  c.update(0.5)
  c.update(100) // 아무리 오래 지나도 5회를 넘지 않는다

  assert.equal(target.entity.health, 100 - 8 - 3 * 5)
})

test('낮은 순위 효과는 기존 효과를 못 밀어내지만 직접 피해는 들어간다', () => {
  const c = combat()
  const target = beast('a', 100, 100, 0)
  c.setTargets([target])

  // 먼저 높은 순위를 맞힌다
  c.throwWeapon({ x: 0, y: 0 }, 0, runWith([BURN_STRONG.id], { [BURN_STRONG.id]: 1 }))
  c.update(0.5)
  assert.equal(target.entity.effects[0].effectRank, 2)

  c.update(BURN.cooldown_seconds)
  c.throwWeapon({ x: 0, y: 0 }, 0, runWith([BURN.id], { [BURN.id]: 1 }))
  const healthBefore = target.entity.health
  c.update(0.5)

  assert.equal(target.entity.effects.length, 1)
  assert.equal(target.entity.effects[0].effectRank, 2, '낮은 순위는 기존 효과를 유지한다')
  assert.ok(target.entity.health < healthBefore, '그래도 기본 직접 피해는 들어간다')
})

test('같은 순위 효과는 최신으로 교체되고 지속시간이 다시 시작한다', () => {
  const c = combat()
  const target = beast('a', 100, 100, 0)
  c.setTargets([target])

  c.throwWeapon({ x: 0, y: 0 }, 0, runWith([BURN.id], { [BURN.id]: 2 }))
  c.update(0.5)
  c.update(3) // 5초 중 3초 소모

  const run = runWith([BURN.id], { [BURN.id]: 1 })
  c.throwWeapon({ x: 0, y: 0 }, 0, run)
  c.update(0.5)

  assert.equal(
    target.entity.effects[0].remainingSeconds,
    BURN.effect_duration_seconds,
    '남은 시간이 아니라 전체 지속시간으로 다시 시작한다',
  )
})

test('둔화와 지속 피해는 한 대상에 하나씩 동시에 붙는다', () => {
  const c = combat()
  const target = beast('a', 100, 100, 0)
  c.setTargets([target])

  c.throwWeapon({ x: 0, y: 0 }, 0, runWith([BURN.id], { [BURN.id]: 1 }))
  c.update(0.5)
  c.update(BURN.cooldown_seconds)
  c.throwWeapon({ x: 0, y: 0 }, 0, runWith([STICKY.id], { [STICKY.id]: 1 }))
  c.update(0.5)

  const keys = target.entity.effects.map((e) => e.mechanicKey).sort()
  assert.deepEqual(keys, ['damage_over_time', 'movement_slow'])
})

test('둔화는 이동속도에만 곱해지고 정지시키지 않는다', () => {
  const effects = [
    { sourceThrowableId: STICKY.id, mechanicKey: 'movement_slow', effectRank: 1, remainingSeconds: 3, nextTickSeconds: 0 },
  ]
  assert.equal(effectiveMoveSpeed(200, effects, WEAPONS), 100)
  assert.equal(effectiveMoveSpeed(200, [], WEAPONS), 200)
})

// ── 투항 (DEC-RESIDENT-016) ───────────────────────────────────

test('투항 기준 이하로 처음 내려갈 때만 투항이 발동한다', () => {
  const c = combat()
  const target = resident('r1', 30, 20, 40, 0)
  c.setTargets([target])

  const first = c.swingSickle({ x: 0, y: 0 }, 0) // 30 → 20
  assert.equal(first.hits[0].outcome, 'surrender_offered')

  c.update(STATS.sickle_cooldown_seconds)
  const second = c.swingSickle({ x: 0, y: 0 }, 0) // 20 → 10
  assert.equal(second.hits[0].outcome, 'alive', '이미 투항한 주민은 다시 투항하지 않는다')
})

test('피해 적용 후 체력이 0이면 투항하지 않고 즉시 처치한다', () => {
  const c = combat()
  const target = resident('r1', 8, 20, 40, 0) // 이미 투항 기준 아래지만 이번 피해로 죽는다
  c.setTargets([target])

  const result = c.swingSickle({ x: 0, y: 0 }, 0)

  assert.equal(result.hits[0].outcome, 'killed')
  assert.equal(target.surrenderOffered, false)
})

test('투항이 발동하면 그 명중의 효과는 걸리지 않는다', () => {
  const c = combat()
  const target = resident('r1', 25, 20, 100, 0)
  c.setTargets([target])
  c.throwWeapon({ x: 0, y: 0 }, 0, runWith([BURN.id], { [BURN.id]: 1 }))

  c.update(0.5) // 직접 피해 8 → 17, 투항 기준 20 이하

  assert.equal(target.surrenderOffered, true)
  assert.deepEqual(target.entity.effects, [], '전투가 계속될 때만 효과를 적용한다')
})

test('지속 피해로도 투항이 발동한다', () => {
  const c = combat()
  const target = resident('r1', 40, 30, 100, 0)
  c.setTargets([target])
  c.throwWeapon({ x: 0, y: 0 }, 0, runWith([BURN.id], { [BURN.id]: 1 }))

  c.update(0.5) // 직접 8 → 32. 아직 기준 위
  assert.equal(target.surrenderOffered, false)

  c.update(1) // 첫 틱 3 → 29. 기준 이하
  assert.equal(target.surrenderOffered, true)
})

test('처치된 대상의 효과는 남지 않는다', () => {
  const c = combat()
  const target = beast('a', 10, 100, 0)
  c.setTargets([target])
  c.throwWeapon({ x: 0, y: 0 }, 0, runWith([BURN.id], { [BURN.id]: 1 }))

  c.update(0.5) // 직접 8 → 2, 효과 부착
  c.update(1) // 틱 3 → 사망

  assert.equal(target.entity.health, 0)
  assert.deepEqual(target.entity.effects, [])
})

// ── 퀵슬롯 선택과 소진 자동 전환 (DEC-INPUT-006, DEC-INPUT-007) ──

test('1~5 는 수량이 0인 슬롯도 직접 선택한다', () => {
  const c = combat()
  const run = runWith([BURN.id, STICKY.id, null, null, null], { [STICKY.id]: 1 })

  c.selectSlot(run, 1)
  assert.equal(run.quickslots.selectedIndex, 1)

  // 수량 0인 0번도 선택된다. 수량 조건은 발사 시점에 본다.
  c.selectSlot(run, 0)
  assert.equal(run.quickslots.selectedIndex, 0)
})

test('휠은 수량이 남은 슬롯만 순환하고 빈 슬롯을 건너뛴다', () => {
  const c = combat()
  // 0번만 비어 있고 1·2번에 수량이 있다
  const run = runWith([BURN.id, STICKY.id, BURN_STRONG.id, null, null], {
    [STICKY.id]: 1,
    [BURN_STRONG.id]: 1,
  })

  c.cycleSlot(run, 1)
  assert.equal(run.quickslots.selectedIndex, 1)

  c.cycleSlot(run, 1)
  assert.equal(run.quickslots.selectedIndex, 2)

  // 3·4는 비어 있고 0은 수량 0이라 다시 1로 돌아온다
  c.cycleSlot(run, 1)
  assert.equal(run.quickslots.selectedIndex, 1)
})

test('휠 역방향도 빈 슬롯을 건너뛴다', () => {
  const c = combat()
  const run = runWith([BURN.id, null, STICKY.id, null, null], {
    [BURN.id]: 1,
    [STICKY.id]: 1,
  })

  c.cycleSlot(run, -1)
  assert.equal(run.quickslots.selectedIndex, 2)
})

test('쓸 수 있는 슬롯이 없으면 휠이 선택을 옮기지 않는다', () => {
  const c = combat()
  const run = runWith([BURN.id, STICKY.id, null, null, null], {})

  c.cycleSlot(run, 1)
  assert.equal(run.quickslots.selectedIndex, 0, '빈 슬롯으로 옮기면 거절 사유가 흐려진다')
})

test('마지막 한 개를 쓰면 다음 비어 있지 않은 슬롯으로 자동 전환한다', () => {
  const c = combat()
  const run = runWith([BURN.id, STICKY.id, null, null, null], {
    [BURN.id]: 1,
    [STICKY.id]: 3,
  })

  const result = c.throwWeapon({ x: 0, y: 0 }, 0, run)

  assert.equal(result.ok, true)
  assert.equal(result.weaponId, BURN.id, '전환 전에 이번 발사는 원래 무기로 나간다')
  assert.equal(result.slot.autoSwitchedTo, 1)
  assert.equal(run.quickslots.selectedIndex, 1)
  assert.equal(result.slot.allEmpty, false)
})

test('모두 소진되면 투척 무기 없음 상태가 되고 선택 위치는 그대로다', () => {
  const c = combat()
  const run = runWith([BURN.id, null, null, null, null], { [BURN.id]: 1 })

  const result = c.throwWeapon({ x: 0, y: 0 }, 0, run)

  assert.equal(result.slot.allEmpty, true)
  assert.equal(result.slot.autoSwitchedTo, null)
  assert.equal(run.quickslots.selectedIndex, 0)

  // 다음 발사는 수량 없음으로 거절된다
  c.update(BURN.cooldown_seconds)
  const next = c.throwWeapon({ x: 0, y: 0 }, 0, run)
  assert.equal(next.ok, false)
  assert.equal(next.reason, 'out_of_ammo')
})

test('수량이 남아 있으면 자동 전환하지 않는다', () => {
  const c = combat()
  const run = runWith([BURN.id, STICKY.id, null, null, null], {
    [BURN.id]: 2,
    [STICKY.id]: 3,
  })

  const result = c.throwWeapon({ x: 0, y: 0 }, 0, run)

  assert.equal(result.slot.autoSwitchedTo, null)
  assert.equal(run.quickslots.selectedIndex, 0)
})
