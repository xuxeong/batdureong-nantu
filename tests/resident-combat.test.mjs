// 적대 주민 전투 규칙 검사 (DEC-CONTENT-008, DEC-CONTENT-009, DEC-RESIDENT-016·039)
//
// 화면으로 확인할 수 없는 것들이다. 전투 보정이 곱해졌는지, 투항 기준이 보정 후
// 최대 체력으로 계산됐는지, 둔화가 공격 주기까지 늦추지는 않았는지는 눈에 안 보인다.

import test from 'node:test'
import assert from 'node:assert/strict'

import { createResidentCombat } from '../src/systems/resident-combat.ts'

const MELEE = {
  id: 'resident_combat_profile.melee',
  kind: 'resident_combat_profile',
  max_health: 60,
  move_speed: 200,
  collision_radius: 18,
  attack_pattern_key: 'melee_chase',
  attack_damage: 10,
  attack_range: 50,
  attack_cooldown_seconds: 1,
  projectile_speed: null,
  projectile_radius: null,
  projectile_max_range: null,
  surrender_health_ratio: 0.3,
  retreat_reward_bundle_id: 'reward_bundle.r',
  kill_reward_bundle_id: 'reward_bundle.k',
}

const RANGED = {
  ...MELEE,
  id: 'resident_combat_profile.ranged',
  attack_pattern_key: 'ranged_chase',
  attack_range: 300,
  projectile_speed: 400,
  projectile_radius: 6,
  projectile_max_range: 400,
}

const NORMAL = {
  id: 'resident_combat_modifier.normal',
  combat_state: 'normal',
  max_health_multiplier: 1,
  move_speed_multiplier: 1,
  attack_damage_multiplier: 1,
  attack_cooldown_multiplier: 1,
}

const ENRAGED = {
  ...NORMAL,
  id: 'resident_combat_modifier.enraged',
  combat_state: 'enraged',
  max_health_multiplier: 1.1,
  move_speed_multiplier: 1.15,
  attack_damage_multiplier: 1.3,
  attack_cooldown_multiplier: 0.85,
}

const STICKY = {
  id: 'throwable_weapon.sticky',
  effect_move_speed_multiplier: 0.5,
}

/**
 * 맵 경계는 좌표 기대값에 걸리지 않게 넉넉히 둔다 (DEC-CONTENT-016).
 * 경계 자체를 보는 것은 아래 별도 테스트다.
 */
const WIDE = { width: 100000, height: 100000 }

function system(bounds = WIDE) {
  return createResidentCombat({ weapons: [STICKY], bounds })
}

function player(x, y = 0) {
  return { x, y, collisionRadius: 20 }
}

function slowEffect() {
  return {
    sourceThrowableId: STICKY.id,
    mechanicKey: 'movement_slow',
    effectRank: 1,
    remainingSeconds: 5,
    nextTickSeconds: 0,
  }
}

// ── 전투 보정 (DEC-CONTENT-008, DEC-CONTENT-009) ──────────────

test('최종 수치는 기본 프로필에 전투 보정을 한 번 곱해 만든다', () => {
  const s = system()
  const hostile = s.spawn({
    instanceId: 'h1',
    residentId: 'resident.a',
    profile: MELEE,
    modifier: ENRAGED,
    x: 0,
    y: 0,
  })

  assert.equal(hostile.maxHealth, 66) // floor(60 × 1.1)
  assert.equal(hostile.entity.health, 66, '현재 체력을 최종 최대 체력으로 초기화한다')
  assert.equal(hostile.attackDamage, 13) // floor(10 × 1.3)
  assert.equal(hostile.baseMoveSpeed, 200 * 1.15)
  assert.equal(hostile.attackCooldownSeconds, 0.85)
  assert.equal(hostile.entity.combatState, 'enraged')
})

test('투항 기준은 보정 전이 아니라 보정 후 최대 체력으로 계산한다', () => {
  const s = system()
  const normal = s.spawn({ instanceId: 'h1', residentId: 'r', profile: MELEE, modifier: NORMAL, x: 0, y: 0 })
  const enraged = s.spawn({ instanceId: 'h2', residentId: 'r', profile: MELEE, modifier: ENRAGED, x: 0, y: 0 })

  assert.equal(normal.surrenderThreshold, 18) // floor(60 × 0.3)
  assert.equal(enraged.surrenderThreshold, 19) // floor(66 × 0.3)
})

test('투항 기준은 최소 1이다', () => {
  const s = system()
  const tiny = s.spawn({
    instanceId: 'h1',
    residentId: 'r',
    profile: { ...MELEE, max_health: 2, surrender_health_ratio: 0.1 },
    modifier: NORMAL,
    x: 0,
    y: 0,
  })
  assert.equal(tiny.surrenderThreshold, 1) // floor(2 × 0.1) = 0 → 1
})

// ── melee_chase (DEC-CONTENT-008) ─────────────────────────────

test('사거리 밖이면 플레이어를 향해 직선으로 이동한다', () => {
  const s = system()
  const h = s.spawn({ instanceId: 'h1', residentId: 'r', profile: MELEE, modifier: NORMAL, x: 0, y: 0 })

  s.update(0.5, player(500))

  assert.equal(h.entity.x, 100) // 200 × 0.5
  assert.equal(h.entity.y, 0)
})

test('사거리 안이면 예고 없이 즉시 피해를 준다', () => {
  const s = system()
  s.spawn({ instanceId: 'h1', residentId: 'r', profile: MELEE, modifier: NORMAL, x: 0, y: 0 })

  const events = s.update(0.1, player(40))

  const damage = events.find((e) => e.type === 'playerDamaged')
  assert.ok(damage, '공격 전 대기시간 없이 같은 프레임에 피해가 들어간다')
  assert.equal(damage.amount, 10)
})

test('사거리 안에서는 이동을 멈추고 재사용 대기 중에도 물러나지 않는다', () => {
  const s = system()
  const h = s.spawn({ instanceId: 'h1', residentId: 'r', profile: MELEE, modifier: NORMAL, x: 0, y: 0 })

  s.update(0.1, player(40))
  const after = { x: h.entity.x, y: h.entity.y }

  const events = s.update(0.5, player(40)) // 아직 재사용 대기 중
  assert.equal(events.filter((e) => e.type === 'playerDamaged').length, 0)
  assert.deepEqual({ x: h.entity.x, y: h.entity.y }, after, '거리를 유지하려 물러나지 않는다')
})

test('재사용 대기가 끝나면 다시 공격한다', () => {
  const s = system()
  s.spawn({ instanceId: 'h1', residentId: 'r', profile: MELEE, modifier: NORMAL, x: 0, y: 0 })

  s.update(0.1, player(40)) // 1회차 공격. 대기 1초 시작

  const tooEarly = s.update(0.9, player(40))
  assert.equal(tooEarly.filter((e) => e.type === 'playerDamaged').length, 0)

  // 대기가 0 이 되는 프레임에서 바로 다음 공격이 나간다
  const onTime = s.update(0.2, player(40))
  assert.equal(onTime.filter((e) => e.type === 'playerDamaged').length, 1)
})

// ── 둔화 (DEC-CONTENT-013) ────────────────────────────────────

test('둔화는 이동속도만 늦추고 공격 주기는 그대로다', () => {
  const s = system()
  const h = s.spawn({ instanceId: 'h1', residentId: 'r', profile: MELEE, modifier: NORMAL, x: 0, y: 0 })
  h.entity.effects.push(slowEffect())

  s.update(0.5, player(500))
  assert.equal(h.entity.x, 50, '200 × 0.5 × 0.5')

  // 공격 대기는 원래대로 1초다
  h.entity.x = 0
  s.update(0.1, player(40))
  const tooEarly = s.update(0.9, player(40))
  assert.equal(tooEarly.filter((e) => e.type === 'playerDamaged').length, 0)
  const onTime = s.update(0.2, player(40))
  assert.equal(onTime.filter((e) => e.type === 'playerDamaged').length, 1)
})

// ── ranged_chase (DEC-CONTENT-008) ────────────────────────────

test('원거리 주민은 사거리 안에서 투사체를 쏘고 추적하지 않는다', () => {
  const s = system()
  s.spawn({ instanceId: 'h1', residentId: 'r', profile: RANGED, modifier: NORMAL, x: 0, y: 0 })

  const events = s.update(0.01, player(200))

  assert.ok(events.some((e) => e.type === 'projectileFired'))
  assert.equal(s.projectiles.length, 1)
  assert.equal(
    events.filter((e) => e.type === 'playerDamaged').length,
    0,
    '근접과 달리 발사 시점에는 피해가 없다',
  )
})

test('주민 투사체는 플레이어를 맞히면 한 번 피해를 주고 사라진다', () => {
  const s = system()
  s.spawn({ instanceId: 'h1', residentId: 'r', profile: RANGED, modifier: NORMAL, x: 0, y: 0 })

  s.update(0.01, player(200))
  const events = s.update(0.5, player(200)) // 속도 400 × 0.5 = 200

  const damage = events.filter((e) => e.type === 'playerDamaged')
  assert.equal(damage.length, 1)
  assert.equal(damage[0].amount, 10)
  assert.equal(s.projectiles.length, 0)
})

test('발사된 투사체는 플레이어를 따라가지 않는다', () => {
  const s = system()
  s.spawn({ instanceId: 'h1', residentId: 'r', profile: RANGED, modifier: NORMAL, x: 0, y: 0 })

  s.update(0.01, player(200, 0)) // 오른쪽으로 발사
  s.update(0.2, player(0, 200)) // 플레이어가 위로 이동

  assert.equal(s.projectiles.length, 1)
  assert.ok(s.projectiles[0].x > 0, '발사 방향 그대로 간다')
  assert.equal(s.projectiles[0].y, 0)
})

test('최대 사거리에 닿은 투사체는 피해 없이 사라진다', () => {
  const s = system()
  s.spawn({ instanceId: 'h1', residentId: 'r', profile: RANGED, modifier: NORMAL, x: 0, y: 0 })

  s.update(0.01, player(299))
  const events = s.update(5, player(-500)) // 플레이어가 반대편으로 빠졌다

  assert.equal(events.filter((e) => e.type === 'playerDamaged').length, 0)
  assert.equal(s.projectiles.length, 0)
})

test('원거리 주민도 사거리 밖이면 추적한다', () => {
  const s = system()
  const h = s.spawn({ instanceId: 'h1', residentId: 'r', profile: RANGED, modifier: NORMAL, x: 0, y: 0 })

  s.update(0.5, player(1000))

  assert.equal(h.entity.x, 100)
  assert.equal(s.projectiles.length, 0, '사거리 밖에서는 쏘지 않는다')
})

// ── 투항 대화 (DEC-RESIDENT-039) ──────────────────────────────

test('투항 대화를 시작하면 적대 투사체를 제거한다', () => {
  const s = system()
  const h = s.spawn({ instanceId: 'h1', residentId: 'r', profile: RANGED, modifier: NORMAL, x: 0, y: 0 })
  h.entity.effects.push(slowEffect())

  s.update(0.01, player(200))
  assert.equal(s.projectiles.length, 1)

  s.suspendForSurrender()

  assert.equal(s.projectiles.length, 0)
  assert.equal(h.entity.health, h.maxHealth, '체력은 보존된다')
  assert.equal(h.entity.effects.length, 1, '효과는 제거하지 않고 정지한다')
})

test('update 를 부르지 않으면 전투 타이머가 그대로 멈춘다', () => {
  const s = system()
  const h = s.spawn({ instanceId: 'h1', residentId: 'r', profile: MELEE, modifier: NORMAL, x: 0, y: 0 })

  s.update(0.1, player(40))
  const frozen = h.cooldownRemaining

  // 대화 중 — 호출자가 update 를 부르지 않는다
  assert.equal(h.cooldownRemaining, frozen)

  s.update(0.5, player(40))
  assert.ok(h.cooldownRemaining < frozen, '재개하면 남은 시간부터 다시 흐른다')
})

// ── 맵 경계 (DEC-CONTENT-016) ─────────────────────────────────
//
// "플레이어, 야생동물, 적대 주민의 이동 위치는 맵 경계 안으로 제한한다."
// 8/6까지 셋 다 빠져 있었고 플레이 테스트에서 플레이어가 화면 밖으로 걸어 나갔다.

test('적대 주민은 맵 경계 밖으로 나가지 않는다', () => {
  const s = system({ width: 300, height: 300 })
  const h = s.spawn({ instanceId: 'h1', residentId: 'r', profile: MELEE, modifier: NORMAL, x: 280, y: 0 })

  // 경계 밖(x 900)에 있는 플레이어를 향해 오래 달려도 300 을 넘지 않는다
  s.update(5, player(900))

  assert.equal(h.entity.x, 300)
})

test('음수 방향으로도 잘린다', () => {
  const s = system({ width: 300, height: 300 })
  const h = s.spawn({ instanceId: 'h1', residentId: 'r', profile: MELEE, modifier: NORMAL, x: 20, y: 20 })

  s.update(5, player(-900, -900))

  assert.equal(h.entity.x, 0)
  assert.equal(h.entity.y, 0)
})
