// 재배 단계 제한시간 (DEC-RUN-004)

import test from 'node:test'
import assert from 'node:assert/strict'

import { createStageTimer, URGENT_THRESHOLD_SECONDS } from '../src/systems/stage-timer.ts'

test('제한시간이 끝나면 만료를 한 번만 알린다 (DEC-RUN-004)', () => {
  const timer = createStageTimer(60)

  assert.equal(timer.tick(59), false)
  assert.equal(timer.expired, false)

  // 처음 0에 닿는 순간만 true
  assert.equal(timer.tick(1), true)
  assert.equal(timer.expired, true)

  // 매 프레임 true 가 나오면 단계 전환이 여러 번 발행된다
  assert.equal(timer.tick(1), false)
  assert.equal(timer.tick(10), false)
})

test('남은 시간은 0 아래로 내려가지 않는다', () => {
  const timer = createStageTimer(60)
  timer.tick(1000)
  assert.equal(timer.remainingSeconds, 0)
})

test('tick 을 부르지 않으면 시간이 흐르지 않는다 (DEC-RUN-004 · 일시정지·정비·대화)', () => {
  const timer = createStageTimer(60)
  timer.tick(20)
  const remaining = timer.remainingSeconds

  // 정지 판단은 호출하는 쪽이 한다. 안 부르면 그대로 보존된다.
  assert.equal(timer.remainingSeconds, remaining)
  assert.equal(timer.remainingSeconds, 40)
})

test('임박 구간에 들어오면 urgent 가 된다 (DEC-UI-018)', () => {
  const timer = createStageTimer(60)

  timer.tick(60 - URGENT_THRESHOLD_SECONDS - 1)
  assert.equal(timer.urgent, false)

  timer.tick(1)
  assert.equal(timer.urgent, true)

  // 만료된 뒤에는 강조하지 않는다
  timer.tick(URGENT_THRESHOLD_SECONDS)
  assert.equal(timer.urgent, false)
  assert.equal(timer.expired, true)
})

test('reset 하면 다음 일차의 재배 단계를 다시 시작한다', () => {
  const timer = createStageTimer(60)
  timer.tick(60)
  assert.equal(timer.expired, true)

  timer.reset()
  assert.equal(timer.remainingSeconds, 60)
  assert.equal(timer.expired, false)
  // 만료 알림도 다시 한 번 나와야 한다
  assert.equal(timer.tick(60), true)
})

test('제한시간이 0 이하면 기본값으로 넘기지 않고 오류를 낸다', () => {
  assert.throws(() => createStageTimer(0), /0보다 커야/)
  assert.throws(() => createStageTimer(-5), /0보다 커야/)
})
