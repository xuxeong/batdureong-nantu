// 재배 시스템 규칙 검사 (DEC-FARM-001 ~ 005, DEC-INPUT-003)
//
// 승인 데이터가 아직 없어 화면으로 확인할 수 없는 동안, 상태 전이가 결정 로그대로인지
// 여기서 확인한다. 수치는 전부 이 파일 안의 가짜 데이터에서 오며 실제 CSV를 읽지 않는다.

import test from 'node:test'
import assert from 'node:assert/strict'

import { createFarming } from '../src/systems/farming.ts'

/** 두 칸짜리 밭과 작물 한 종. 시간은 검사하기 쉽게 짧게 잡았다 */
function fixture(overrides = {}) {
  return {
    plots: [
      { map_id: 'map.test', plot_id: 'plot_01', x: 0, y: 0 },
      { map_id: 'map.test', plot_id: 'plot_02', x: 100, y: 0 },
    ],
    crops: [
      {
        id: 'crop.chili',
        kind: 'crop',
        display_name: '고추',
        spawn_weight: 30,
        seed_duration_seconds: 10,
        growth_duration_seconds: 40,
        base_yield: 2,
      },
    ],
    interactionRadius: 60,
    random: () => 0,
    ...overrides,
  }
}

test('빈 경작지에서 E를 누르면 파종되고 씨앗 단계가 된다 (DEC-FARM-001)', () => {
  const farming = createFarming(fixture())
  const event = farming.interact({ x: 0, y: 0 })

  assert.equal(event.type, 'planted')
  assert.equal(farming.plots[0].stage, 'seed')
  // 종류는 파종 순간 확정된다. 수확 시점에 다시 뽑지 않는다.
  assert.equal(farming.plots[0].cropId, 'crop.chili')
})

test('씨앗 → 성장 중 → 수확 가능 순서로 바뀐다 (DEC-FARM-002)', () => {
  const farming = createFarming(fixture())
  farming.interact({ x: 0, y: 0 })

  farming.update(9)
  assert.equal(farming.plots[0].stage, 'seed')

  farming.update(1)
  assert.equal(farming.plots[0].stage, 'growing')

  farming.update(39)
  assert.equal(farming.plots[0].stage, 'growing')

  farming.update(1)
  assert.equal(farming.plots[0].stage, 'ready')
})

test('단계 전환 시 남은 초과분을 다음 단계로 넘긴다', () => {
  const farming = createFarming(fixture())
  farming.interact({ x: 0, y: 0 })

  // 10초 단계를 25초 한 번에 넘기면 15초는 다음 단계에서 소모돼야 한다.
  // 안 그러면 프레임이 길어질수록 작물이 느리게 자란다.
  farming.update(25)
  assert.equal(farming.plots[0].stage, 'growing')
  assert.equal(farming.plots[0].remainingSeconds, 25)
})

test('update 를 부르지 않으면 자라지 않고 잔여 시간이 보존된다 (DEC-FARM-003)', () => {
  const farming = createFarming(fixture())
  farming.interact({ x: 0, y: 0 })
  farming.update(5)

  const remaining = farming.plots[0].remainingSeconds

  // 정비·대화·습격·일시정지 중에는 호출 자체가 빠진다
  assert.equal(farming.plots[0].remainingSeconds, remaining)
  assert.equal(farming.plots[0].stage, 'seed')
})

test('수확하면 base_yield 가 보관함에 들어가고 경작지가 즉시 빈다 (DEC-FARM-005)', () => {
  const farming = createFarming(fixture())
  farming.interact({ x: 0, y: 0 })
  farming.update(50)

  const event = farming.interact({ x: 0, y: 0 })

  assert.equal(event.type, 'harvested')
  assert.equal(event.amount, 2)
  assert.equal(farming.harvested.get('crop.chili'), 2)
  assert.equal(farming.plots[0].stage, 'empty')
  assert.equal(farming.plots[0].cropId, null)
})

test('수확이 끝난 경작지에 바로 다시 심을 수 있다 (DEC-FARM-005)', () => {
  const farming = createFarming(fixture())
  farming.interact({ x: 0, y: 0 })
  farming.update(50)
  farming.interact({ x: 0, y: 0 })

  const again = farming.interact({ x: 0, y: 0 })
  assert.equal(again.type, 'planted')
})

test('상호작용 반경 밖에서는 대상이 없다 (DEC-INPUT-003)', () => {
  const farming = createFarming(fixture())

  assert.equal(farming.targetAt({ x: 0, y: 61 }), null)
  assert.equal(farming.interact({ x: 0, y: 61 }), null)
  assert.notEqual(farming.targetAt({ x: 0, y: 59 }), null)
})

test('같은 거리에서 겹치면 수확이 빈 경작지보다 우선한다 (DEC-INPUT-003)', () => {
  const farming = createFarming(fixture())

  // plot_01 만 수확 가능으로 만들고, 두 칸에서 같은 거리인 지점에 선다
  farming.interact({ x: 0, y: 0 })
  farming.update(50)

  const target = farming.targetAt({ x: 50, y: 0 })
  assert.equal(target.kind, 'harvest')
  assert.equal(target.plot.plotId, 'plot_01')
})

test('가장 가까운 대상을 고른다 (DEC-INPUT-003)', () => {
  const farming = createFarming(fixture())
  const target = farming.targetAt({ x: 70, y: 0 })

  assert.equal(target.plot.plotId, 'plot_02')
})

test('가중치가 1 이상인 작물이 없으면 오류로 보고한다 (DEC-CONTENT-003)', () => {
  assert.throws(
    () => createFarming(fixture({ crops: [{ id: 'crop.x', spawn_weight: 0 }] })),
    /spawn_weight/,
  )
})

test('경작지가 없으면 기본값으로 넘기지 않고 오류를 낸다', () => {
  assert.throws(() => createFarming(fixture({ plots: [] })), /farm_plots/)
})

test('가중치 비율대로 뽑는다 (DEC-CONTENT-003)', () => {
  const crops = [
    { id: 'crop.a', spawn_weight: 30, seed_duration_seconds: 1, growth_duration_seconds: 1, base_yield: 1 },
    { id: 'crop.b', spawn_weight: 10, seed_duration_seconds: 1, growth_duration_seconds: 1, base_yield: 1 },
  ]
  // 합이 40이므로 0.74 는 첫 번째(0~30), 0.80 은 두 번째(30~40) 구간이다
  const first = createFarming(fixture({ crops, random: () => 0.74 }))
  first.interact({ x: 0, y: 0 })
  assert.equal(first.plots[0].cropId, 'crop.a')

  const second = createFarming(fixture({ crops, random: () => 0.80 }))
  second.interact({ x: 0, y: 0 })
  assert.equal(second.plots[0].cropId, 'crop.b')
})
