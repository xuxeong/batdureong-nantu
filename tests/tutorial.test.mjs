// 튜토리얼 진행 규칙 (DEC-UI-030, DEC-RUN-003, DEC-CONTENT-025)
//
// 화면으로는 "안 넘어간다" 로만 보이는 것들이다. 아직 오지 않은 안내의 키를 미리
// 눌러 건너뛰어지는지, 같은 조작을 두 번 해서 두 칸 가는지는 눌러 보기 어렵다.
//
// 안내 수치는 픽스처로 넘긴다. 실제 값은 tutorial_steps.csv 에서 온다.

import test from 'node:test'
import assert from 'node:assert/strict'

import { createTutorialProgress } from '../src/systems/tutorial.ts'

function step(order, stage, key) {
  return {
    id: `tutorial_step.${key}`,
    kind: 'tutorial_step',
    content_version: 1,
    display_name: key,
    step_order: order,
    stage,
    completion_key: key,
    guide_text: `${key} 안내`,
  }
}

/** 승인본과 같은 모양 — 재배 2 · 정비 3 · 전투 2 */
const STEPS = [
  step(1, 'farming', 'plant_crop'),
  step(2, 'farming', 'harvest_crop'),
  step(3, 'maintenance', 'sell_crop'),
  step(4, 'maintenance', 'buy_material'),
  step(5, 'maintenance', 'craft_item'),
  step(6, 'combat', 'use_sickle'),
  step(7, 'combat', 'use_throwable'),
]

test('step_order 순으로 나온다 — 배열 순서가 아니라', () => {
  // 일부러 뒤섞어 넣는다. 승인 CSV 의 행 순서를 믿지 않는다.
  const shuffled = [STEPS[4], STEPS[0], STEPS[6], STEPS[2], STEPS[1], STEPS[5], STEPS[3]]
  const p = createTutorialProgress(shuffled)

  const seen = []
  while (!p.finished) {
    seen.push(p.current.completion_key)
    p.complete(p.current.completion_key)
  }

  assert.deepEqual(seen, [
    'plant_crop', 'harvest_crop', 'sell_crop',
    'buy_material', 'craft_item', 'use_sickle', 'use_throwable',
  ])
})

test('현재 안내의 키가 와야 넘어간다', () => {
  const p = createTutorialProgress(STEPS)

  // 아직 오지 않은 안내의 키를 미리 눌러도 건너뛰지 않는다
  assert.equal(p.complete('use_throwable'), false)
  assert.equal(p.current.completion_key, 'plant_crop')

  assert.equal(p.complete('plant_crop'), true)
  assert.equal(p.current.completion_key, 'harvest_crop')
})

test('같은 조작을 두 번 해도 한 칸만 간다', () => {
  const p = createTutorialProgress(STEPS)

  assert.equal(p.complete('plant_crop'), true)
  assert.equal(p.complete('plant_crop'), false)
  assert.equal(p.current.completion_key, 'harvest_crop')
})

test('진행도는 몇 번째인지만 알린다 (DEC-UI-030)', () => {
  const p = createTutorialProgress(STEPS)

  assert.equal(p.total, 7)
  assert.equal(p.position, 1)

  p.complete('plant_crop')
  assert.equal(p.position, 2)
})

test('마지막까지 가면 끝난다', () => {
  const p = createTutorialProgress(STEPS)
  for (const s of STEPS) p.complete(s.completion_key)

  assert.equal(p.finished, true)
  assert.equal(p.current, null)
  assert.equal(p.position, 7)
  // 끝난 뒤 키가 더 들어와도 아무 일도 없다
  assert.equal(p.complete('plant_crop'), false)
})

test('승인 안내가 없으면 처음부터 끝난 상태다', () => {
  const p = createTutorialProgress([])

  assert.equal(p.finished, true)
  assert.equal(p.current, null)
  assert.equal(p.total, 0)
})
