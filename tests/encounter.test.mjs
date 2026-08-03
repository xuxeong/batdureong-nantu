// 조우 판정과 자원 협상 (DEC-RESIDENT-049·050, DEC-CONTENT-009, DEC-CONTENT-022)
//
// 여기서 지키는 것은 대부분 "안 일어나야 하는 일"이다 — 선택지 문장이 결과를
// 바꾸지 않는 것, 거절된 협상이 수확물을 건드리지 않는 것, 같은 시드에서 같은
// 결과가 나오는 것. 전부 화면으로는 확인할 수 없다.

import test from 'node:test'
import assert from 'node:assert/strict'

import { createEncounter, totalCrops } from '../src/systems/encounter.ts'

const RESIDENTS = [
  {
    id: 'resident.yeongsun',
    kind: 'resident',
    personality_profile_id: 'resident_personality_profile.timid',
  },
  {
    id: 'resident.proud',
    kind: 'resident',
    personality_profile_id: 'resident_personality_profile.proud',
  },
]

const PROFILES = [
  { id: 'resident_personality_profile.timid', kind: 'resident_personality_profile' },
  { id: 'resident_personality_profile.proud', kind: 'resident_personality_profile' },
]

const OUTCOMES = [
  // 소심한 주민 — 공감이 통한다
  {
    personality_profile_id: 'resident_personality_profile.timid',
    choice_function: 'empathy',
    result_when_available_id: 'system_result.precombat.resolve',
    result_when_unavailable_id: null,
  },
  {
    personality_profile_id: 'resident_personality_profile.timid',
    choice_function: 'resource_negotiation',
    result_when_available_id: 'system_result.precombat.resolve',
    result_when_unavailable_id: 'system_result.precombat.combat_normal',
  },
  {
    personality_profile_id: 'resident_personality_profile.timid',
    choice_function: 'threat',
    result_when_available_id: 'system_result.precombat.combat_weakened',
    result_when_unavailable_id: null,
  },
  // 자존심 센 주민 — 수확물이 충분해도 협상을 거절한다
  {
    personality_profile_id: 'resident_personality_profile.proud',
    choice_function: 'empathy',
    result_when_available_id: 'system_result.precombat.combat_normal',
    result_when_unavailable_id: null,
  },
  {
    personality_profile_id: 'resident_personality_profile.proud',
    choice_function: 'resource_negotiation',
    result_when_available_id: 'system_result.precombat.combat_enraged',
    result_when_unavailable_id: 'system_result.precombat.combat_normal',
  },
  {
    personality_profile_id: 'resident_personality_profile.proud',
    choice_function: 'threat',
    result_when_available_id: 'system_result.precombat.combat_enraged',
    result_when_unavailable_id: null,
  },
]

const CHOICES = [
  {
    id: 'dialogue_choice.empathy',
    kind: 'dialogue_choice',
    scenario_id: 'story_scenario.s1',
    dialogue_phase: 'precombat',
    choice_function: 'empathy',
    choice_text: '동생들 이야기를 묻는다',
    resource_offer_quantity: null,
  },
  {
    id: 'dialogue_choice.negotiation',
    kind: 'dialogue_choice',
    scenario_id: 'story_scenario.s1',
    dialogue_phase: 'precombat',
    choice_function: 'resource_negotiation',
    choice_text: '수확물 10개를 내민다',
    resource_offer_quantity: 10,
  },
  {
    id: 'dialogue_choice.threat',
    kind: 'dialogue_choice',
    scenario_id: 'story_scenario.s1',
    dialogue_phase: 'precombat',
    choice_function: 'threat',
    choice_text: '낫을 들어 보인다',
    resource_offer_quantity: null,
  },
]

/** 선택지 × 시스템 결과 조합마다 반응 대사 하나 */
const RESPONSES = []
for (const choice of CHOICES) {
  for (const resultId of [
    'system_result.precombat.resolve',
    'system_result.precombat.combat_weakened',
    'system_result.precombat.combat_normal',
    'system_result.precombat.combat_enraged',
  ]) {
    RESPONSES.push({
      choice_id: choice.id,
      system_result_id: resultId,
      reaction_text: `${choice.id} → ${resultId}`,
      revealed_story_info_id:
        resultId === 'system_result.precombat.resolve' ? 'story_info.secret' : null,
    })
  }
}

function encounter() {
  return createEncounter({
    residents: RESIDENTS,
    personalityProfiles: PROFILES,
    choiceOutcomes: OUTCOMES,
    choices: CHOICES,
    responses: RESPONSES,
  })
}

// ── 성격 프로필 판정 (DEC-RESIDENT-049) ───────────────────────

test('같은 선택지라도 주민 성격에 따라 결과가 갈린다', () => {
  const e = encounter()
  const crops = { 'crop.chili': 20 }

  const timid = e.judge('resident.yeongsun', 'dialogue_choice.empathy', crops)
  const proud = e.judge('resident.proud', 'dialogue_choice.empathy', crops)

  assert.equal(timid.systemResultId, 'system_result.precombat.resolve')
  assert.equal(timid.resolved, true)
  assert.equal(proud.systemResultId, 'system_result.precombat.combat_normal')
  assert.equal(proud.resolved, false)
})

test('수확물이 충분해도 성격이 거절하면 전투로 간다', () => {
  const e = encounter()
  const crops = { 'crop.chili': 50 } // 제안 수량 10 을 훨씬 넘는다

  const result = e.judge('resident.proud', 'dialogue_choice.negotiation', crops)

  assert.equal(result.systemResultId, 'system_result.precombat.combat_enraged')
  assert.equal(result.resolved, false)
  assert.equal(crops['crop.chili'], 50, '거절은 수확물을 건드리지 않는다')
})

test('위협은 조우 해결을 낼 수 없다', () => {
  const e = encounter()
  const crops = {}

  for (const residentId of ['resident.yeongsun', 'resident.proud']) {
    const result = e.judge(residentId, 'dialogue_choice.threat', crops)
    assert.notEqual(result.systemResultId, 'system_result.precombat.resolve')
  }
})

test('반응 대사와 공개 정보는 결과 조합에서 조회한다', () => {
  const e = encounter()
  const result = e.judge('resident.yeongsun', 'dialogue_choice.empathy', {})

  assert.equal(
    result.reactionText,
    'dialogue_choice.empathy → system_result.precombat.resolve',
  )
  assert.equal(result.revealedStoryInfoId, 'story_info.secret')
})

// ── 선택지 사용 가능 여부 (DEC-RESIDENT-050) ──────────────────

test('수확물이 모자라면 협상을 표시하되 사용할 수 없게 한다', () => {
  const e = encounter()
  const list = e.availableChoices('story_scenario.s1', { 'crop.chili': 4 })

  assert.equal(list.length, 3, '선택지는 숨기지 않는다')

  const negotiation = list.find((c) => c.choiceFunction === 'resource_negotiation')
  assert.equal(negotiation.usable, false)
  assert.equal(negotiation.offerQuantity, 10)
  assert.equal(negotiation.heldTotal, 4)

  for (const other of list.filter((c) => c.choiceFunction !== 'resource_negotiation')) {
    assert.equal(other.usable, true, '공감과 위협은 항상 선택할 수 있다')
  }
})

test('총수량은 종류가 아니라 개수로 센다', () => {
  assert.equal(totalCrops({ a: 3, b: 4, c: 3 }), 10)

  const e = encounter()
  const list = e.availableChoices('story_scenario.s1', { a: 3, b: 4, c: 3 })
  assert.equal(list.find((c) => c.choiceFunction === 'resource_negotiation').usable, true)
})

test('표시 후 수량이 줄면 확정 직전 재검증에서 불가용 결과를 쓴다', () => {
  const e = encounter()
  // 소심한 주민은 가용이면 조우 해결, 불가용이면 일반 전투다
  const enough = e.judge('resident.yeongsun', 'dialogue_choice.negotiation', { a: 10 })
  const short = e.judge('resident.yeongsun', 'dialogue_choice.negotiation', { a: 9 })

  assert.equal(enough.systemResultId, 'system_result.precombat.resolve')
  assert.equal(short.systemResultId, 'system_result.precombat.combat_normal')
})

// ── 자원 협상 실행 (DEC-RESIDENT-050) ─────────────────────────

test('수락하면 제안 수량만큼 차감하고 관계를 거래로 바꾼다', () => {
  const e = encounter()
  const crops = { 'crop.chili': 6, 'crop.corn': 6 }

  const result = e.settleNegotiation(crops, 'encounter.1', 'dialogue_choice.negotiation', 10, 42)

  assert.equal(result.ok, true)
  assert.equal(result.relationship, 'trade')
  assert.equal(totalCrops(result.consumed), 10)
  assert.equal(totalCrops(crops), 2, '12 - 10')
})

test('개별 단위에서 뽑으므로 많이 가진 작물이 더 많이 나간다', () => {
  const e = encounter()
  // 10 : 1 이면 종류별 균등이 아니라 개수 비례여야 한다
  const crops = { 'crop.many': 30, 'crop.few': 3 }

  const result = e.settleNegotiation(crops, 'encounter.1', 'dialogue_choice.negotiation', 10, 7)

  assert.ok(
    (result.consumed['crop.many'] ?? 0) > (result.consumed['crop.few'] ?? 0),
    '작물 종류별 균등 확률이 아니다',
  )
})

test('같은 시드·조우·선택이면 같은 결과가 나온다', () => {
  const e = encounter()
  const a = { 'crop.chili': 10, 'crop.corn': 10 }
  const b = { 'crop.chili': 10, 'crop.corn': 10 }

  const first = e.settleNegotiation(a, 'encounter.1', 'dialogue_choice.negotiation', 10, 99)
  const second = e.settleNegotiation(b, 'encounter.1', 'dialogue_choice.negotiation', 10, 99)

  assert.deepEqual(first.consumed, second.consumed)
})

test('조우가 다르면 같은 시드에서도 결과가 갈린다', () => {
  const e = encounter()
  const a = { 'crop.chili': 20, 'crop.corn': 20 }
  const b = { 'crop.chili': 20, 'crop.corn': 20 }

  const first = e.settleNegotiation(a, 'encounter.1', 'dialogue_choice.negotiation', 10, 99)
  const second = e.settleNegotiation(b, 'encounter.2', 'dialogue_choice.negotiation', 10, 99)

  assert.notDeepEqual(first.consumed, second.consumed)
})

test('보관함에 넣은 순서가 달라도 같은 시드면 같은 결과다', () => {
  const e = encounter()
  const a = { 'crop.chili': 10, 'crop.corn': 10 }
  const b = { 'crop.corn': 10, 'crop.chili': 10 }

  const first = e.settleNegotiation(a, 'encounter.1', 'dialogue_choice.negotiation', 10, 5)
  const second = e.settleNegotiation(b, 'encounter.1', 'dialogue_choice.negotiation', 10, 5)

  assert.deepEqual(first.consumed, second.consumed)
})

test('수량이 부족하면 수확물을 전혀 건드리지 않는다', () => {
  const e = encounter()
  const crops = { 'crop.chili': 9 }

  const result = e.settleNegotiation(crops, 'encounter.1', 'dialogue_choice.negotiation', 10, 1)

  assert.equal(result.ok, false)
  assert.equal(result.reason, 'insufficient_crops')
  assert.deepEqual(crops, { 'crop.chili': 9 })
})

test('수량이 0이 된 작물은 보관함에서 사라진다', () => {
  const e = encounter()
  const crops = { 'crop.only': 10 }

  e.settleNegotiation(crops, 'encounter.1', 'dialogue_choice.negotiation', 10, 3)

  assert.deepEqual(crops, {})
})

test('같은 작물이 보유 수량 범위 안에서 여러 개 나올 수 있다', () => {
  const e = encounter()
  const crops = { 'crop.only': 12 }

  const result = e.settleNegotiation(crops, 'encounter.1', 'dialogue_choice.negotiation', 10, 11)

  assert.equal(result.consumed['crop.only'], 10)
  assert.equal(crops['crop.only'], 2)
})
