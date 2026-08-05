// 영입 주민 지원 공격의 주기 규칙 (DEC-RESIDENT-021, DEC-RESIDENT-045)
//
// 화면으로는 확인하기 어려운 것들이다. 첫 공격이 지연 뒤에 오는지, 프레임이 밀렸을 때
// 몰아서 때리지 않는지는 눈으로 세기 어렵고 밸런스로만 드러난다.

import test from 'node:test'
import assert from 'node:assert/strict'

import { createAllySupport } from '../src/systems/ally-support.ts'

/** 첫 공격 2초 뒤, 이후 3초마다 7 피해 */
const PROFILE = {
  damage: 7,
  firstAttackDelaySeconds: 2,
  attackIntervalSeconds: 3,
}

function ally(profile = PROFILE) {
  return createAllySupport({
    residentId: 'resident.yeongsun',
    x: 560,
    y: 700,
    profile,
  })
}

test('첫 공격은 first_attack_delay_seconds 가 지나야 나온다', () => {
  const a = ally()

  assert.equal(a.update(1.9), null)
  assert.equal(a.update(0.2), 7)
})

test('이후에는 attack_interval_seconds 마다 때린다', () => {
  const a = ally()
  a.update(2)

  assert.equal(a.update(2.9), null)
  assert.equal(a.update(0.2), 7)
})

test('프레임이 밀려도 한 호출에 한 번만 때린다', () => {
  const a = ally()

  // 10초를 한 번에 흘리면 지연 2 + 간격 3 × 2 = 세 번 칠 시간이지만 한 번이다.
  assert.equal(a.update(10), 7)
  // 다음 간격은 새로 시작한다 — 밀린 만큼 곧바로 또 때리지 않는다
  assert.equal(a.update(2.9), null)
  assert.equal(a.update(0.2), 7)
})

test('공격 표시는 때린 순간 켜지고 그 뒤 줄어든다 (DEC-UI-012)', () => {
  const a = ally()

  a.update(1)
  assert.equal(a.attackFlash, 0)

  a.update(1)
  assert.equal(a.attackFlash, 1)

  a.update(0.2)
  assert.ok(a.attackFlash > 0 && a.attackFlash < 1)
})

test('공격 표시는 0 아래로 내려가지 않는다', () => {
  const a = ally()
  a.update(2)
  a.update(10)

  assert.ok(a.attackFlash >= 0)
})

test('위치는 런 내내 바뀌지 않는다 — 경로 탐색을 하지 않는다 (DEC-RESIDENT-021)', () => {
  const a = ally()

  a.update(5)
  a.update(5)

  assert.equal(a.x, 560)
  assert.equal(a.y, 700)
})
