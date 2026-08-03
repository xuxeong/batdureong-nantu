// 야생동물 규칙 검사 (DEC-CONTENT-007, DEC-FARM-006, DEC-FARM-010)
//
// 화면으로는 "동물이 작물 쪽으로 간다" 까지만 보인다. 씨앗을 목표로 삼지 않는지,
// 먹힌 작물이 보관함에 안 들어가는지, 예고 중 도망치면 취소되는지는 안 보인다.

import test from 'node:test'
import assert from 'node:assert/strict'

import { createWildlife } from '../src/systems/wildlife.ts'

const MAP = {
  id: 'map.farm',
  kind: 'map',
  world_width: 1600,
  world_height: 900,
  farm_interaction_radius: 60,
  wildlife_spawn_edge_margin: 40,
  wildlife_spawn_min_player_distance: 200,
}

const CROP_EATER = {
  id: 'wildlife.boar',
  kind: 'wildlife',
  max_health: 20,
  move_speed: 100,
  collision_radius: 14,
  attack_damage: 7,
  attack_range: 50,
  attack_windup_seconds: 0.5,
  attack_cooldown_seconds: 1,
  crop_eat_duration_seconds: 2,
  target_mode: 'crop_first',
}

const PLAYER_HUNTER = {
  ...CROP_EATER,
  id: 'wildlife.wolf',
  target_mode: 'player_only',
}

const PROFILE = {
  id: 'wildlife_spawn_profile.day1',
  kind: 'wildlife_spawn_profile',
  first_spawn_delay_seconds: 1,
  spawn_interval_seconds: 2,
  max_concurrent: 2,
  total_spawn_limit: 3,
}

const ENTRIES = [
  { wildlife_spawn_profile_id: PROFILE.id, wildlife_id: CROP_EATER.id, spawn_weight: 1 },
]
const WOLF_ENTRIES = [
  { wildlife_spawn_profile_id: PROFILE.id, wildlife_id: PLAYER_HUNTER.id, spawn_weight: 1 },
]

function system(random = () => 0) {
  return createWildlife({
    map: MAP,
    species: [CROP_EATER, PLAYER_HUNTER],
    weapons: [{ id: 'throwable_weapon.sticky', effect_move_speed_multiplier: 0.5 }],
    random,
  })
}

function plot(plotId, x, y, stage, cropId = 'crop.chili') {
  return { plotId, x, y, stage, cropId: stage === 'empty' ? null : cropId, remainingSeconds: 0 }
}

// ── 출현 (DEC-CONTENT-007) ────────────────────────────────────

test('첫 출현 지연 전에는 나오지 않는다', () => {
  const s = system()
  s.beginFarming(PROFILE, ENTRIES)

  s.update(0.9, { x: 800, y: 450 }, [])
  assert.equal(s.instances.length, 0)

  s.update(0.2, { x: 800, y: 450 }, [])
  assert.equal(s.instances.length, 1)
})

test('동시 생존 수와 총 생성 수를 넘지 않는다', () => {
  const s = system()
  s.beginFarming(PROFILE, ENTRIES)

  s.update(100, { x: 800, y: 450 }, []) // 아무리 오래 지나도
  assert.equal(s.instances.length, 2, 'max_concurrent 2')

  s.remove(s.instances[0].entity.instanceId)
  s.update(100, { x: 800, y: 450 }, [])
  assert.equal(s.instances.length, 2, 'total_spawn_limit 3 이라 하나만 더 나온다')
})

test('출현 프로필이 없는 일차에는 아무것도 나오지 않는다', () => {
  const s = system()
  s.beginFarming(null, [])

  s.update(100, { x: 800, y: 450 }, [])
  assert.equal(s.instances.length, 0)
})

test('플레이어에게서 최소 거리를 띄워 출현한다', () => {
  const s = system()
  s.beginFarming(PROFILE, ENTRIES)
  const player = { x: 800, y: 450 }

  s.update(1, player, [])
  const spawned = s.instances[0].entity
  const distance = Math.hypot(spawned.x - player.x, spawned.y - player.y)

  assert.ok(distance >= MAP.wildlife_spawn_min_player_distance)
})

test('재배가 끝나면 전부 사라진다', () => {
  const s = system()
  s.beginFarming(PROFILE, ENTRIES)
  s.update(5, { x: 800, y: 450 }, [])
  assert.ok(s.instances.length > 0)

  s.endFarming()
  assert.equal(s.instances.length, 0)
})

// ── 목표 선택 (DEC-FARM-010) ──────────────────────────────────

test('씨앗과 성장 중 작물은 목표로 삼지 않는다', () => {
  const s = system()
  s.beginFarming(PROFILE, ENTRIES)
  s.update(1, { x: 1500, y: 450 }, [])
  const boar = s.instances[0]
  boar.entity.x = 100
  boar.entity.y = 450

  const plots = [plot('plot_01', 120, 450, 'seed'), plot('plot_02', 130, 450, 'growing')]
  s.update(0.1, { x: 1500, y: 450 }, plots)

  assert.equal(boar.entity.targetPlotId, null, '수확 가능한 작물이 없다')
  assert.ok(boar.entity.x > 100, '플레이어를 향해 간다')
})

test('가장 가까운 수확 가능 작물을 고르고 같은 거리면 경작지 ID 순이다', () => {
  const s = system()
  s.beginFarming(PROFILE, ENTRIES)
  s.update(1, { x: 800, y: 450 }, [])
  const boar = s.instances[0]
  boar.entity.x = 0
  boar.entity.y = 0

  // plot_03 과 plot_02 가 같은 거리
  const plots = [
    plot('plot_03', 300, 0, 'ready'),
    plot('plot_02', 0, 300, 'ready'),
    plot('plot_09', 900, 0, 'ready'),
  ]
  s.update(0.01, { x: 800, y: 450 }, plots)

  assert.equal(boar.entity.targetPlotId, 'plot_02')
})

test('player_only 는 수확 가능 작물이 있어도 플레이어만 쫓는다', () => {
  const s = system()
  s.beginFarming(PROFILE, WOLF_ENTRIES)
  s.update(1, { x: 1500, y: 450 }, [])
  const wolf = s.instances[0]
  wolf.entity.x = 0
  wolf.entity.y = 450

  s.update(0.5, { x: 1500, y: 450 }, [plot('plot_01', 50, 450, 'ready')])

  assert.equal(wolf.entity.targetPlotId, null)
  assert.equal(wolf.entity.x, 50, '작물을 지나쳐 플레이어 쪽으로 간다')
})

test('목표 작물이 수확되면 새 목표를 찾는다', () => {
  const s = system()
  s.beginFarming(PROFILE, ENTRIES)
  s.update(1, { x: 800, y: 450 }, [])
  const boar = s.instances[0]
  boar.entity.x = 0
  boar.entity.y = 0

  const plots = [plot('plot_01', 100, 0, 'ready'), plot('plot_02', 400, 0, 'ready')]
  s.update(0.01, { x: 800, y: 450 }, plots)
  assert.equal(boar.entity.targetPlotId, 'plot_01')

  plots[0].stage = 'empty'
  plots[0].cropId = null
  s.update(0.01, { x: 800, y: 450 }, plots)
  assert.equal(boar.entity.targetPlotId, 'plot_02')
})

// ── 먹기 (DEC-FARM-006) ───────────────────────────────────────

test('먹힌 작물은 보관함에 들어가지 않고 경작지가 빈다', () => {
  const s = system()
  s.beginFarming(PROFILE, ENTRIES)
  s.update(1, { x: 1500, y: 450 }, [])
  const boar = s.instances[0]
  boar.entity.x = 100
  boar.entity.y = 0

  const plots = [plot('plot_01', 120, 0, 'ready')]

  s.update(0.01, { x: 1500, y: 450 }, plots) // 상호작용 거리 안 → 먹기 시작
  assert.ok(boar.eatingSeconds !== null)

  const events = s.update(2, { x: 1500, y: 450 }, plots)

  assert.equal(plots[0].stage, 'empty')
  assert.equal(plots[0].cropId, null)
  assert.ok(events.some((e) => e.type === 'cropEaten' && e.plotId === 'plot_01'))
  // 보관함에 넣는 경로 자체가 없다 — 이 시스템은 보관함을 모른다
})

test('먹는 도중 플레이어가 먼저 수확하면 먹기를 취소한다', () => {
  const s = system()
  s.beginFarming(PROFILE, ENTRIES)
  s.update(1, { x: 1500, y: 450 }, [])
  const boar = s.instances[0]
  boar.entity.x = 100
  boar.entity.y = 0

  const plots = [plot('plot_01', 120, 0, 'ready')]
  s.update(0.01, { x: 1500, y: 450 }, plots)
  assert.ok(boar.eatingSeconds !== null)

  plots[0].stage = 'empty' // 플레이어가 수확했다
  plots[0].cropId = null
  const events = s.update(0.1, { x: 1500, y: 450 }, plots)

  assert.equal(boar.eatingSeconds, null)
  assert.equal(events.filter((e) => e.type === 'cropEaten').length, 0)
})

test('먹는 도중 피해를 받으면 먹기를 취소하고 플레이어에게 영구 적대한다', () => {
  const s = system()
  s.beginFarming(PROFILE, ENTRIES)
  s.update(1, { x: 1500, y: 450 }, [])
  const boar = s.instances[0]
  boar.entity.x = 100
  boar.entity.y = 0

  const plots = [plot('plot_01', 120, 0, 'ready')]
  s.update(0.01, { x: 1500, y: 450 }, plots)

  s.notifyDamagedByPlayer(boar.entity.instanceId)

  assert.equal(boar.eatingSeconds, null)
  assert.equal(boar.hostileToPlayer, true)

  // 작물이 그대로 있어도 다시 목표로 삼지 않는다
  s.update(0.5, { x: 1500, y: 450 }, plots)
  assert.equal(boar.entity.targetPlotId, null)
  assert.ok(boar.entity.x > 100)
})

// ── 공격 예고 (DEC-CONTENT-007) ───────────────────────────────

test('공격은 예고를 거친 뒤에 들어간다', () => {
  const s = system()
  s.beginFarming(PROFILE, WOLF_ENTRIES)
  s.update(1, { x: 800, y: 450 }, [])
  const wolf = s.instances[0]
  wolf.entity.x = 780
  wolf.entity.y = 450

  const immediate = s.update(0.01, { x: 800, y: 450 }, [])
  assert.equal(immediate.filter((e) => e.type === 'playerDamaged').length, 0, '예고 없이 때리지 않는다')
  assert.ok(wolf.windupSeconds !== null)

  const later = s.update(0.6, { x: 800, y: 450 }, [])
  assert.equal(later.filter((e) => e.type === 'playerDamaged').length, 1)
})

test('예고가 끝날 때 범위를 벗어났으면 공격을 취소한다', () => {
  const s = system()
  s.beginFarming(PROFILE, WOLF_ENTRIES)
  s.update(1, { x: 800, y: 450 }, [])
  const wolf = s.instances[0]
  wolf.entity.x = 780
  wolf.entity.y = 450

  s.update(0.01, { x: 800, y: 450 }, []) // 예고 시작
  const events = s.update(0.6, { x: 1500, y: 450 }, []) // 플레이어가 도망쳤다

  assert.equal(events.filter((e) => e.type === 'playerDamaged').length, 0)
  assert.ok(events.some((e) => e.type === 'attackCancelled'))
  assert.ok(wolf.cooldownRemaining > 0, '취소해도 재사용 대기는 시작한다')
})

test('둔화는 이동만 늦추고 예고 시간은 그대로다', () => {
  const s = system()
  s.beginFarming(PROFILE, WOLF_ENTRIES)
  s.update(1, { x: 800, y: 450 }, [])
  const wolf = s.instances[0]
  wolf.entity.x = 0
  wolf.entity.y = 450
  wolf.entity.effects.push({
    sourceThrowableId: 'throwable_weapon.sticky',
    mechanicKey: 'movement_slow',
    effectRank: 1,
    remainingSeconds: 10,
    nextTickSeconds: 0,
  })

  s.update(1, { x: 800, y: 450 }, [])
  assert.equal(wolf.entity.x, 50, '100 × 1 × 0.5')

  wolf.entity.x = 780
  s.update(0.01, { x: 800, y: 450 }, [])
  const events = s.update(0.6, { x: 800, y: 450 }, [])
  assert.equal(
    events.filter((e) => e.type === 'playerDamaged').length,
    1,
    '예고 0.5초는 둔화와 무관하다',
  )
})
