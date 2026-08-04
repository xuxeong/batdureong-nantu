// 조우 해결 — 최종 결과 확정, 관계·공포도, 보상 원자성
// (DEC-RESIDENT-052·012·042·043·046)
//
// 여기서 지키는 것도 대부분 "안 일어나야 하는 일"이다 — 최종 결과가 두 번
// 확정되지 않는 것, 보상이 두 번 나가지 않는 것, 검증에 실패한 보상이 자원도
// 주민 상태도 건드리지 않는 것. 전부 런이 끝난 뒤에야 증상이 보이는 종류다.

import test from 'node:test'
import assert from 'node:assert/strict'

import { createResolution } from '../src/systems/resolution.ts'

const RESIDENTS = [
  { id: 'resident.yeongsun', kind: 'resident', combat_profile_id: 'resident_combat_profile.yeongsun' },
  { id: 'resident.ijang', kind: 'resident', combat_profile_id: 'resident_combat_profile.ijang' },
]

const PROFILES = [
  {
    id: 'resident_combat_profile.yeongsun',
    kind: 'resident_combat_profile',
    retreat_reward_bundle_id: 'reward_bundle.yeongsun_retreat',
    kill_reward_bundle_id: 'reward_bundle.yeongsun_kill',
  },
  {
    id: 'resident_combat_profile.ijang',
    kind: 'resident_combat_profile',
    retreat_reward_bundle_id: 'reward_bundle.ijang_retreat',
    kill_reward_bundle_id: 'reward_bundle.broken',
  },
]

const BUNDLES = [
  {
    id: 'reward_bundle.yeongsun_retreat',
    kind: 'reward_bundle',
    entries: [
      { resource_kind: 'money', resource_id: 'currency.money', quantity: 30 },
      { resource_kind: 'material', resource_id: 'material.rope', quantity: 2 },
    ],
  },
  {
    id: 'reward_bundle.yeongsun_kill',
    kind: 'reward_bundle',
    entries: [{ resource_kind: 'crop', resource_id: 'crop.radish', quantity: 3 }],
  },
  { id: 'reward_bundle.ijang_retreat', kind: 'reward_bundle', entries: [] },
  {
    // 수량이 0이라 지급할 수 없는 묶음
    id: 'reward_bundle.broken',
    kind: 'reward_bundle',
    entries: [{ resource_kind: 'money', resource_id: 'currency.money', quantity: 0 }],
  },
]

// DEC-RESIDENT-048 의 승인 값. cause 키는 important_action_count_subject 와 같다 —
// ending_conditions.csv 가 같은 행동을 그 키로 가리키므로 별칭을 만들지 않는다.
const FEAR = {
  threat_selected: 1,
  surrender_retreat_reward: 3,
  resident_killed: 6,
}

function newResident(id) {
  return {
    residentId: id,
    resolved: false,
    finalOutcome: null,
    lifeState: 'alive',
    allegiance: 'hostile',
    relationship: 'unformed',
    scenarioId: null,
    revealedStoryInfoIds: [],
    surrenderOffered: false,
    surrenderChoice: null,
    rewardGranted: false,
    supportUsed: false,
  }
}

function newState() {
  return {
    residents: {
      'resident.yeongsun': newResident('resident.yeongsun'),
      'resident.ijang': newResident('resident.ijang'),
    },
    resources: { money: 0, crops: {}, materials: {}, throwables: {}, recoveries: {} },
    record: {
      fear: 0,
      importantActions: {
        empathy_resolve: 0,
        resource_negotiation_resolve: 0,
        resource_negotiation_rejected: 0,
        threat_selected: 0,
        surrender_recruit: 0,
        surrender_retreat_reward: 0,
        surrender_resume_combat: 0,
        resident_killed: 0,
      },
      cropMastery: {},
      cropCraftConsumed: {},
      cropHarvested: {},
      unlockedRecipeIds: [],
      journalEntries: [],
    },
  }
}

function setup(fearIncrements = FEAR) {
  const state = newState()
  const resolution = createResolution(state, {
    rewardBundles: BUNDLES,
    residents: RESIDENTS,
    combatProfiles: PROFILES,
    fearIncrements,
  })
  return { state, resolution }
}

// ── 최종 결과와 상태 조합 (DEC-RESIDENT-052) ──────────────────

test('결과 다섯 개가 각각 정해진 상태 조합을 확정한다', () => {
  const table = [
    ['empathy_resolve', 'alive', 'neutral', 'friendly'],
    ['resource_negotiation_resolve', 'alive', 'neutral', 'trade'],
    ['recruited', 'alive', 'recruited', 'companion'],
    ['retreated', 'alive', 'neutral', 'coercive'],
    ['killed', 'killed', 'hostile', 'severed'],
  ]

  for (const [outcome, life, allegiance, relationship] of table) {
    const { state, resolution } = setup()
    const result = resolution.resolve('resident.yeongsun', outcome)

    assert.equal(result.ok, true, `${outcome} 이 실패했다`)
    const r = state.residents['resident.yeongsun']
    assert.equal(r.resolved, true)
    assert.equal(r.finalOutcome, outcome)
    assert.equal(r.lifeState, life, `${outcome} 의 생존 상태`)
    assert.equal(r.allegiance, allegiance, `${outcome} 의 소속`)
    assert.equal(r.relationship, relationship, `${outcome} 의 관계`)
  }
})

test('최종 결과는 한 번만 확정된다', () => {
  const { state, resolution } = setup()

  assert.equal(resolution.resolve('resident.yeongsun', 'recruited').ok, true)
  const second = resolution.resolve('resident.yeongsun', 'killed')

  assert.equal(second.ok, false)
  assert.equal(second.reason, 'already_resolved')
  // 덮어쓰이지 않아야 한다
  assert.equal(state.residents['resident.yeongsun'].finalOutcome, 'recruited')
  assert.equal(state.residents['resident.yeongsun'].relationship, 'companion')
})

test('런 상태에 없는 주민은 해결하지 않는다', () => {
  const { resolution } = setup()
  const result = resolution.resolve('resident.ghost', 'killed')
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'unknown_resident')
})

// ── 보상 (DEC-RESIDENT-042) ──────────────────────────────────

test('퇴각 보상을 묶음 그대로 지급한다', () => {
  const { state, resolution } = setup()
  const result = resolution.resolve('resident.yeongsun', 'retreated')

  assert.equal(result.ok, true)
  assert.equal(result.value.rewardBundleId, 'reward_bundle.yeongsun_retreat')
  assert.equal(state.resources.money, 30)
  assert.equal(state.resources.materials['material.rope'], 2)
  assert.equal(state.residents['resident.yeongsun'].rewardGranted, true)
})

test('처치는 처치 보상을, 퇴각은 퇴각 보상을 쓴다', () => {
  const { state, resolution } = setup()
  resolution.resolve('resident.yeongsun', 'killed')

  assert.equal(state.resources.crops['crop.radish'], 3)
  assert.equal(state.resources.money, 0, '퇴각 보상이 잘못 나갔다')
})

test('공감·협상·영입에는 보상이 없다', () => {
  for (const outcome of ['empathy_resolve', 'resource_negotiation_resolve', 'recruited']) {
    const { state, resolution } = setup()
    const result = resolution.resolve('resident.yeongsun', outcome)

    assert.equal(result.value.rewardBundleId, null, `${outcome} 에 보상이 붙었다`)
    assert.equal(state.resources.money, 0)
    assert.equal(state.residents['resident.yeongsun'].rewardGranted, false)
  }
})

test('보상 수량이 잘못되면 자원도 주민 상태도 바뀌지 않는다', () => {
  const { state, resolution } = setup()
  const result = resolution.resolve('resident.ijang', 'killed')

  assert.equal(result.ok, false)
  assert.equal(result.reason, 'reward_quantity_invalid')

  // 절반만 반영되지 않았는가 — 여기가 이 테스트의 요점이다
  assert.equal(state.resources.money, 0)
  assert.equal(state.residents['resident.ijang'].resolved, false)
  assert.equal(state.residents['resident.ijang'].finalOutcome, null)
  assert.equal(state.residents['resident.ijang'].relationship, 'unformed')
  assert.equal(state.record.importantActions.resident_killed, 0)
  assert.equal(state.record.fear, 0)
})

test('보상 묶음이 승인 데이터에 없으면 아무것도 바꾸지 않는다', () => {
  const state = newState()
  const resolution = createResolution(state, {
    rewardBundles: [],
    residents: RESIDENTS,
    combatProfiles: PROFILES,
    fearIncrements: FEAR,
  })

  const result = resolution.resolve('resident.yeongsun', 'retreated')
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'reward_data_missing')
  assert.equal(state.residents['resident.yeongsun'].resolved, false)
})

test('빈 보상 묶음도 정상 해결이다', () => {
  const { state, resolution } = setup()
  const result = resolution.resolve('resident.ijang', 'retreated')

  assert.equal(result.ok, true)
  assert.equal(result.value.rewardBundleId, 'reward_bundle.ijang_retreat')
  assert.equal(state.residents['resident.ijang'].rewardGranted, true)
})

// ── 공포도 (DEC-RESIDENT-046) ────────────────────────────────

test('위협·퇴각·처치만 공포도를 올린다', () => {
  const cases = [
    ['empathy_resolve', 0],
    ['resource_negotiation_resolve', 0],
    ['recruited', 0],
    ['retreated', FEAR.surrender_retreat_reward],
    ['killed', FEAR.resident_killed],
  ]

  for (const [outcome, expected] of cases) {
    const { state, resolution } = setup()
    resolution.resolve('resident.yeongsun', outcome)
    assert.equal(state.record.fear, expected, `${outcome} 의 공포도`)
  }
})

test('위협 선택은 공포도만 올리고 조우를 해결하지 않는다', () => {
  const { state, resolution } = setup()
  const { fearDelta } = resolution.recordThreat('resident.yeongsun')

  assert.equal(fearDelta, FEAR.threat_selected)
  assert.equal(state.record.fear, FEAR.threat_selected)
  assert.equal(state.record.importantActions.threat_selected, 1)
  assert.equal(state.residents['resident.yeongsun'].resolved, false)
  assert.equal(state.residents['resident.yeongsun'].finalOutcome, null)
})

test('공포도는 누적되고 감소하지 않는다', () => {
  const { state, resolution } = setup()

  resolution.recordThreat('resident.yeongsun')
  resolution.recordThreat('resident.yeongsun')
  resolution.resolve('resident.yeongsun', 'killed')
  resolution.resolve('resident.ijang', 'retreated')

  assert.equal(state.record.fear, FEAR.threat_selected * 2 + FEAR.resident_killed + FEAR.surrender_retreat_reward)
})

test('증가량이 미승인이면 공포도만 멈추고 나머지는 진행한다', () => {
  // DEC-RESIDENT-048 이 보류인 동안의 동작. 임시 기본값을 넣지 않는다.
  const { state, resolution } = setup(null)
  const result = resolution.resolve('resident.yeongsun', 'killed')

  assert.equal(result.ok, true)
  assert.equal(result.value.fearPending, true, '미승인 표시가 꺼져 있다')
  assert.equal(result.value.fearDelta, 0)
  assert.equal(state.record.fear, 0)

  // 값과 무관한 처리는 그대로 됐는가
  assert.equal(state.residents['resident.yeongsun'].finalOutcome, 'killed')
  assert.equal(state.residents['resident.yeongsun'].relationship, 'severed')
  assert.equal(state.record.importantActions.resident_killed, 1)
  assert.equal(state.resources.crops['crop.radish'], 3)
})

// ── 중요 행동과 재등장 방지 (DEC-CONTENT-011, DEC-RESIDENT-043) ──

test('결과마다 대응하는 중요 행동을 하나씩 센다', () => {
  const pairs = [
    ['empathy_resolve', 'empathy_resolve'],
    ['resource_negotiation_resolve', 'resource_negotiation_resolve'],
    ['recruited', 'surrender_recruit'],
    ['retreated', 'surrender_retreat_reward'],
    ['killed', 'resident_killed'],
  ]

  for (const [outcome, action] of pairs) {
    const { state, resolution } = setup()
    resolution.resolve('resident.yeongsun', outcome)
    assert.equal(state.record.importantActions[action], 1, `${outcome} → ${action}`)
  }
})

test('투항 거부와 협상 거절은 최종 결과가 아니다', () => {
  const { state, resolution } = setup()

  resolution.recordSurrenderResumed('resident.yeongsun')
  resolution.recordNegotiationRejected('resident.yeongsun')

  assert.equal(state.record.importantActions.surrender_resume_combat, 1)
  assert.equal(state.record.importantActions.resource_negotiation_rejected, 1)
  assert.equal(state.record.fear, 0, '둘 다 공포도를 올리지 않는다')
  assert.equal(state.residents['resident.yeongsun'].resolved, false)
})

test('해결된 주민은 다시 적대로 등장하지 않는다', () => {
  const { resolution } = setup()

  assert.equal(resolution.canAppearAsHostile('resident.yeongsun'), true)
  resolution.resolve('resident.yeongsun', 'recruited')
  assert.equal(resolution.canAppearAsHostile('resident.yeongsun'), false)

  // 영입이 아니라 처치여도 마찬가지다
  assert.equal(resolution.canAppearAsHostile('resident.ijang'), true)
  resolution.resolve('resident.ijang', 'retreated')
  assert.equal(resolution.canAppearAsHostile('resident.ijang'), false)
})
