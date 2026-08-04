// 엔딩 판정 — 공포도 구간·조건·우선순위·대표 작물 (DEC-CONTENT-011)
//
// 여기서 지키는 것은 "판정 순서" 다. 구간을 먼저 정하고 그 안에서 조건을 보는 것,
// 같은 우선순위가 겹치면 임의로 하나를 고르지 않는 것, 폴백이 기본값이 아니라
// 실패의 결과인 것. 순서가 어긋나면 다른 구간의 특별 엔딩이 새어 들어오고,
// 그건 런을 끝까지 돌려 봐야 드러난다.

import test from 'node:test'
import assert from 'node:assert/strict'

import { createEndingJudge } from '../src/systems/ending.ts'

const BANDS = [
  { id: 'fear_band.warmth', kind: 'fear_band', display_name: '온기', min_fear: 0, max_fear: 4 },
  { id: 'fear_band.wariness', kind: 'fear_band', display_name: '경계', min_fear: 5, max_fear: 11 },
  // 가장 높은 구간만 상한이 없다
  { id: 'fear_band.terror', kind: 'fear_band', display_name: '공포', min_fear: 12, max_fear: null },
]

const ENDINGS = [
  {
    id: 'ending.neighbors',
    fear_band_id: 'fear_band.warmth',
    selection_priority: 0,
    is_global_fallback: false,
    conditions: [],
  },
  {
    id: 'ending.new_family',
    fear_band_id: 'fear_band.warmth',
    selection_priority: 1,
    is_global_fallback: false,
    conditions: [
      {
        condition_type: 'important_action_count',
        subject_key: 'surrender_recruit',
        comparison: 'eq',
        target_value: '4',
      },
    ],
  },
  {
    id: 'ending.beyond_fence',
    fear_band_id: 'fear_band.wariness',
    selection_priority: 0,
    is_global_fallback: false,
    conditions: [],
  },
  {
    id: 'ending.silent_field',
    fear_band_id: 'fear_band.terror',
    selection_priority: 0,
    is_global_fallback: false,
    conditions: [],
  },
  {
    id: 'ending.global_fallback',
    fear_band_id: null,
    selection_priority: 0,
    is_global_fallback: true,
    conditions: [],
  },
]

const CROPS = [
  { id: 'crop.radish', kind: 'crop', display_name: '무', crop_attribute_id: 'crop_attribute.cold' },
  { id: 'crop.pepper', kind: 'crop', display_name: '고추', crop_attribute_id: 'crop_attribute.heat' },
]

const ATTRIBUTES = [
  {
    id: 'crop_attribute.cold',
    kind: 'crop_attribute',
    display_name: '냉',
    ending_prompt_summary: '차게 식히는 성질',
  },
  {
    id: 'crop_attribute.heat',
    kind: 'crop_attribute',
    display_name: '열',
    ending_prompt_summary: '태우는 성질',
  },
]

function judgeWith(overrides = {}, endings = ENDINGS) {
  const judge = createEndingJudge({
    fearBands: BANDS,
    endings,
    crops: CROPS,
    cropAttributes: ATTRIBUTES,
  })

  return judge.judge({
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
      ...overrides.record,
    },
    residents: overrides.residents ?? {},
  })
}

function resident(id, relationship, finalOutcome = null) {
  return { residentId: id, relationship, finalOutcome, resolved: true }
}

// ── 공포도 구간 (DEC-CONTENT-011) ────────────────────────────

test('최종 공포도가 구간 하나를 고른다', () => {
  const cases = [
    [0, 'fear_band.warmth'],
    [4, 'fear_band.warmth'],
    [5, 'fear_band.wariness'],
    [11, 'fear_band.wariness'],
    [12, 'fear_band.terror'],
    // 가장 높은 구간은 상한이 없다
    [9999, 'fear_band.terror'],
  ]

  for (const [fear, bandId] of cases) {
    const result = judgeWith({ record: { fear } })
    assert.equal(result.fearBand.id, bandId, `공포도 ${fear}`)
    assert.equal(result.fallbackReason, null)
  }
})

test('구간이 정해지면 그 구간의 엔딩만 후보다', () => {
  // 경계 구간인데 온기의 특별 엔딩 조건을 만족시켜 둔다
  const result = judgeWith({
    record: { fear: 7, importantActions: { surrender_recruit: 4 } },
  })

  assert.equal(result.ending.id, 'ending.beyond_fence')
  assert.notEqual(result.ending.id, 'ending.new_family', '다른 구간 엔딩이 새어 들어왔다')
})

// ── 우선순위와 조건 ──────────────────────────────────────────

test('조건을 만족하면 우선순위가 높은 특별 엔딩을 고른다', () => {
  const result = judgeWith({
    record: { fear: 2, importantActions: { surrender_recruit: 4 } },
  })

  assert.equal(result.ending.id, 'ending.new_family')
  assert.equal(result.fallbackReason, null)
})

test('조건을 하나라도 못 채우면 기본 엔딩으로 내려온다', () => {
  const result = judgeWith({
    record: { fear: 2, importantActions: { surrender_recruit: 3 } },
  })

  assert.equal(result.ending.id, 'ending.neighbors')
})

test('한 엔딩의 조건은 AND 다', () => {
  const endings = [
    ENDINGS[0],
    {
      ...ENDINGS[1],
      conditions: [
        {
          condition_type: 'important_action_count',
          subject_key: 'surrender_recruit',
          comparison: 'gte',
          target_value: '1',
        },
        {
          condition_type: 'important_action_count',
          subject_key: 'resident_killed',
          comparison: 'eq',
          target_value: '0',
        },
      ],
    },
    ENDINGS[4],
  ]

  // 첫 조건만 만족 — 특별 엔딩이 되면 안 된다
  const partial = judgeWith(
    { record: { fear: 1, importantActions: { surrender_recruit: 2, resident_killed: 1 } } },
    endings,
  )
  assert.equal(partial.ending.id, 'ending.neighbors')

  const both = judgeWith(
    { record: { fear: 1, importantActions: { surrender_recruit: 2, resident_killed: 0 } } },
    endings,
  )
  assert.equal(both.ending.id, 'ending.new_family')
})

test('같은 우선순위가 동시에 성립하면 임의로 고르지 않고 폴백한다', () => {
  const endings = [
    ENDINGS[0],
    ENDINGS[1],
    { ...ENDINGS[1], id: 'ending.rival', conditions: [] }, // 조건 없이 우선순위 1
    ENDINGS[4],
  ]

  const result = judgeWith(
    { record: { fear: 1, importantActions: { surrender_recruit: 4 } } },
    endings,
  )

  assert.equal(result.fallbackReason, 'priority_tie')
  assert.equal(result.ending.id, 'ending.global_fallback')
})

// ── 조건 유형 ───────────────────────────────────────────────

test('관계 수와 특정 주민 조건을 읽는다', () => {
  const residents = {
    'resident.a': resident('resident.a', 'friendly', 'empathy_resolve'),
    'resident.b': resident('resident.b', 'friendly', 'empathy_resolve'),
    'resident.c': resident('resident.c', 'severed', 'killed'),
  }

  const byCount = judgeWith(
    { record: { fear: 1 }, residents },
    [
      ENDINGS[0],
      {
        ...ENDINGS[1],
        conditions: [
          {
            condition_type: 'relationship_count',
            subject_key: 'friendly',
            comparison: 'gte',
            target_value: '2',
          },
        ],
      },
      ENDINGS[4],
    ],
  )
  assert.equal(byCount.ending.id, 'ending.new_family')

  const byResident = judgeWith(
    { record: { fear: 1 }, residents },
    [
      ENDINGS[0],
      {
        ...ENDINGS[1],
        conditions: [
          {
            condition_type: 'specific_resident_outcome',
            subject_key: 'resident.c',
            comparison: 'eq',
            target_value: 'killed',
          },
        ],
      },
      ENDINGS[4],
    ],
  )
  assert.equal(byResident.ending.id, 'ending.new_family')
})

// ── 대표 작물 (DEC-CONTENT-011) ──────────────────────────────

test('대표 작물은 숙련도 → 제작 소비 → 총수확 → ID 순으로 정해진다', () => {
  // 숙련도가 갈리면 거기서 끝난다
  const byMastery = judgeWith({
    record: {
      fear: 1,
      cropMastery: { 'crop.radish': 3, 'crop.pepper': 5 },
      cropHarvested: { 'crop.radish': 99 },
    },
  })
  assert.equal(byMastery.dominantCrop.cropId, 'crop.pepper')

  // 숙련도가 같으면 제작 소비로
  const byCraft = judgeWith({
    record: {
      fear: 1,
      cropMastery: { 'crop.radish': 3, 'crop.pepper': 3 },
      cropCraftConsumed: { 'crop.radish': 4, 'crop.pepper': 1 },
      cropHarvested: { 'crop.pepper': 99 },
    },
  })
  assert.equal(byCraft.dominantCrop.cropId, 'crop.radish')

  // 둘이 같으면 총수확으로
  const byHarvest = judgeWith({
    record: {
      fear: 1,
      cropMastery: { 'crop.radish': 1, 'crop.pepper': 1 },
      cropCraftConsumed: { 'crop.radish': 1, 'crop.pepper': 1 },
      cropHarvested: { 'crop.radish': 2, 'crop.pepper': 7 },
    },
  })
  assert.equal(byHarvest.dominantCrop.cropId, 'crop.pepper')

  // 셋 다 같으면 작물 ID 오름차순
  const byId = judgeWith({
    record: {
      fear: 1,
      cropMastery: { 'crop.radish': 1, 'crop.pepper': 1 },
    },
  })
  assert.equal(byId.dominantCrop.cropId, 'crop.pepper', 'crop.pepper < crop.radish')
})

test('아무것도 안 한 작물은 대표가 되지 않는다', () => {
  const result = judgeWith({ record: { fear: 1, cropHarvested: { 'crop.radish': 1 } } })
  assert.equal(result.dominantCrop.cropId, 'crop.radish')
})

test('숙련도·제작·수확이 모두 0이면 대표 작물이 없다', () => {
  const result = judgeWith({ record: { fear: 1 } })
  assert.equal(result.dominantCrop, null)

  // 0으로만 채워진 기록도 마찬가지다
  const zeros = judgeWith({
    record: { fear: 1, cropMastery: { 'crop.radish': 0 }, cropHarvested: { 'crop.pepper': 0 } },
  })
  assert.equal(zeros.dominantCrop, null)
})

test('대표 작물 조건은 대표 작물이 없으면 성립하지 않는다', () => {
  const endings = [
    ENDINGS[0],
    {
      ...ENDINGS[1],
      conditions: [
        {
          condition_type: 'dominant_crop_attribute',
          subject_key: null,
          comparison: 'eq',
          target_value: 'crop_attribute.heat',
        },
      ],
    },
    ENDINGS[4],
  ]

  const withCrop = judgeWith({ record: { fear: 1, cropMastery: { 'crop.pepper': 2 } } }, endings)
  assert.equal(withCrop.ending.id, 'ending.new_family')
  assert.equal(withCrop.dominantCrop.attributeId, 'crop_attribute.heat')

  const without = judgeWith({ record: { fear: 1 } }, endings)
  assert.equal(without.ending.id, 'ending.neighbors')
})

// ── 폴백은 실패의 결과다 ────────────────────────────────────

test('구간에 맞는 엔딩이 없으면 이유와 함께 폴백한다', () => {
  const endings = [ENDINGS[3], ENDINGS[4]] // 공포 구간 엔딩만 둔다
  const result = judgeWith({ record: { fear: 1 } }, endings)

  assert.equal(result.ending.id, 'ending.global_fallback')
  assert.equal(result.fallbackReason, 'no_candidate')
  // 구간 자체는 정해졌으므로 남겨 둔다 — 왜 폴백했는지 조사할 근거다
  assert.equal(result.fearBand.id, 'fear_band.warmth')
})

test('전역 폴백조차 없으면 엔딩이 null 이고 이유가 바뀐다', () => {
  const result = judgeWith({ record: { fear: 1 } }, [ENDINGS[3]])

  assert.equal(result.ending, null)
  assert.equal(result.fallbackReason, 'fallback_missing')
})

test('전역 폴백은 정상 판정의 후보가 아니다', () => {
  const result = judgeWith({ record: { fear: 1 } })
  assert.equal(result.ending.id, 'ending.neighbors')
  assert.equal(result.fallbackReason, null)
})
