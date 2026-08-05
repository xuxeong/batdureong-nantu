// 런 흐름 테스트 (DEC-RUN-014, DEC-RUN-015).
//
// 습격일과 비습격일이 갈리는 지점은 실행해도 눈에 잘 안 띈다.
// 두 경로가 뒤섞이면 하루가 안 끝나거나 결과 화면이 두 번 뜨는데,
// 그게 폐기된 DEC-RUN-012 에서 실제로 문제가 됐던 지점이다. 여기서 고정한다.
//
// 일정 수치는 픽스처로 넘긴다. 코드에도 테스트에도 게임 데이터를 두지 않는다.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { advance, INITIAL_STEP, isFlowError } from '../src/scenes/flow.ts'
import type { FlowContext, FlowInput, FlowStep } from '../src/scenes/flow.ts'
import type { RaidType } from '../src/data/types.ts'

/** 일차 → 습격 종류. 실제 값은 run_schedule_days.csv 에서 온다 */
function contextOf(days: RaidType[]): FlowContext {
  return {
    totalDays: days.length,
    raidTypeOf: (day) => days[day - 1],
  }
}

/** 입력을 순서대로 흘려 넣고 거쳐 간 단계 이름을 모은다 */
function run(ctx: FlowContext, inputs: FlowInput[]): { trail: string[]; failed?: string } {
  let step: FlowStep = INITIAL_STEP
  const trail = [step.at]

  for (const input of inputs) {
    const result = advance(step, input, ctx)
    if (isFlowError(result)) return { trail, failed: result.error }
    step = result
    trail.push(step.at)
  }
  return { trail }
}

const confirm: FlowInput = { type: 'confirm' }
const farmingDone: FlowInput = { type: 'farming_time_expired' }
const scout: FlowInput = { type: 'maintenance_finished', intent: 'scout_field' }
const sleep: FlowInput = { type: 'maintenance_finished', intent: 'sleep_until_morning' }
const encounterDone: FlowInput = { type: 'encounter_finished' }

test('비습격일은 밤 결과를 거쳐 다음 일차로 간다', () => {
  const { trail, failed } = run(contextOf(['none', 'final_raid']), [
    confirm, // 타이틀 → 이름 입력
    confirm, // → 튜토리얼
    confirm, // → 1일차 시작
    confirm, // → 재배
    farmingDone, // → 정비
    sleep, // → 밤 결과
    confirm, // → 2일차 시작
  ])

  assert.equal(failed, undefined)
  assert.deepEqual(trail, [
    'title',
    'name_input',
    'tutorial',
    'day_start',
    'farming',
    'maintenance',
    'night_result',
    'day_start',
  ])
})

test('습격일은 조우 결과를 거친다. 밤 결과는 뜨지 않는다', () => {
  const { trail, failed } = run(contextOf(['raid', 'final_raid']), [
    confirm,
    confirm,
    confirm,
    confirm,
    farmingDone,
    scout, // → 습격 모드
    encounterDone, // → 조우 결과
    confirm, // → 2일차 시작 (마지막 습격이 아니다)
  ])

  assert.equal(failed, undefined)
  assert.deepEqual(trail, [
    'title',
    'name_input',
    'tutorial',
    'day_start',
    'farming',
    'maintenance',
    'raid',
    'encounter_result',
    'day_start',
  ])
  // 하루에 결과 화면은 하나만 등장한다 (DEC-RUN-015)
  assert.ok(!trail.includes('night_result'))
})

test('마지막 습격의 조우 결과 다음은 엔딩이다', () => {
  const { trail, failed } = run(contextOf(['final_raid']), [
    confirm,
    confirm,
    confirm,
    confirm,
    farmingDone,
    scout,
    encounterDone,
    confirm,
  ])

  assert.equal(failed, undefined)
  assert.equal(trail.at(-1), 'ending')
})

test('체력 0이면 어느 단계에서든 즉시 런 실패다. 엔딩으로 가지 않는다', () => {
  const ctx = contextOf(['final_raid'])
  const died: FlowInput = { type: 'player_died' }

  for (const step of [
    { at: 'farming', day: 1 },
    { at: 'maintenance', day: 1 },
    { at: 'raid', day: 1 },
  ] as FlowStep[]) {
    const result = advance(step, died, ctx)
    assert.ok(!isFlowError(result))
    assert.equal(result.at, 'run_failed')
  }
})

test('습격 여부와 정비 종료 선택이 어긋나면 오류로 보고한다', () => {
  // 비습격일인데 `밭을 정찰하러 간다`가 들어왔다 — 화면이 데이터와 다른 버튼을 띄운 것이다
  const wrong = advance({ at: 'maintenance', day: 1 }, scout, contextOf(['none', 'final_raid']))
  assert.ok(isFlowError(wrong))

  // 습격일인데 `아침까지 잔다`가 들어왔다
  const alsoWrong = advance({ at: 'maintenance', day: 1 }, sleep, contextOf(['raid', 'final_raid']))
  assert.ok(isFlowError(alsoWrong))
})

test('일정에 없는 일차로 넘어가면 기본값으로 메우지 않고 오류로 보고한다', () => {
  // 1일차뿐인 일정인데 final_raid 가 아니라 엔딩으로 빠져나가지 못한다
  const result = advance({ at: 'night_result', day: 1 }, confirm, contextOf(['none']))
  assert.ok(isFlowError(result))
  assert.match(result.error, /final_raid/)
})

test('승인 데이터가 없으면 일차로 진입하는 순간 오류로 보고한다', () => {
  const empty: FlowContext = { totalDays: 0, raidTypeOf: () => undefined }
  const result = advance({ at: 'tutorial' }, confirm, empty)
  assert.ok(isFlowError(result))
})
