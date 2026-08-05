// 플레이어 일지 입력 테스트 (DEC-JOURNAL-001 ~ 003).
//
// 여기서 고정하는 것은 **"전날" 을 어떻게 재는가** 다. 누적값만 보면 3일차 일지가
// 1~2일차 일을 전부 어제 일처럼 말하고, 그건 화면에서 "일지가 이상하다" 로만 보인다.
// 기준점 스냅샷이 실제로 차이를 걸러내는지 확인한다.
//
// 승인 문구는 픽스처로 넘긴다. 코드에도 테스트에도 게임 데이터를 두지 않는다.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  buildJournalInput,
  fearDirection,
  selectJournalFallback,
} from '../src/llm/journal.ts'
import type { JournalInputSources } from '../src/llm/journal.ts'
import type { JournalFallback, Resident, RuntimeManifest, StoryInfo } from '../src/data/types.ts'
import type { JournalBaseline, ResidentRunState } from '../src/state/types.ts'

const manifest = {
  schema_version: 6,
  ending_input_schema_version: 1,
  ending_prompt_version: 1,
  journal_prompt_version: 3,
  files: [],
} as RuntimeManifest

function residentState(id: string, overrides: Partial<ResidentRunState> = {}): ResidentRunState {
  return {
    residentId: id,
    resolved: false,
    finalOutcome: null,
    lifeState: 'alive',
    allegiance: 'neutral',
    relationship: 'unformed',
    scenarioId: null,
    revealedStoryInfoIds: [],
    surrenderOffered: false,
    surrenderChoice: null,
    rewardGranted: false,
    supportUsed: false,
    ...overrides,
  }
}

function baselineOf(overrides: Partial<JournalBaseline> = {}): JournalBaseline {
  return {
    dayNumber: 1,
    fear: 0,
    resolvedResidentIds: [],
    harvestedTotal: 0,
    craftConsumedTotal: 0,
    ...overrides,
  }
}

function sourcesOf(overrides: Partial<JournalInputSources> = {}): JournalInputSources {
  return {
    manifest,
    playerName: '두렁',
    dayNumber: 2,
    baseline: baselineOf(),
    fear: 0,
    fearBand: null,
    residents: {},
    residentData: [],
    storyInfos: [],
    harvestedTotal: 0,
    craftConsumedTotal: 0,
    ...overrides,
  }
}

// ── 공포도 변화 방향 ────────────────────────────────────────

test('공포도가 오르면 up, 그대로면 same 이다', () => {
  assert.equal(fearDirection(5, 0), 'up')
  assert.equal(fearDirection(0, 0), 'same')
  assert.equal(fearDirection(7, 7), 'same')
})

test('감소는 지금 규칙으로 안 나오지만 비교는 down 을 낸다', () => {
  // 공포도는 감소하지 않는 누적값이다 (DEC-RESIDENT-046). 그래도 여기서
  // same 으로 뭉개면 규칙이 바뀌었을 때 조용히 틀린 폴백을 고른다.
  assert.equal(fearDirection(2, 9), 'down')
})

// ── 전날만 골라내기 ─────────────────────────────────────────

test('기준점에 이미 있던 주민은 전날 조우로 세지 않는다', () => {
  const input = buildJournalInput(
    sourcesOf({
      dayNumber: 3,
      baseline: baselineOf({ dayNumber: 2, resolvedResidentIds: ['resident.a'] }),
      residents: {
        'resident.a': residentState('resident.a', { resolved: true, finalOutcome: 'killed' }),
        'resident.b': residentState('resident.b', { resolved: true, finalOutcome: 'recruited' }),
        'resident.c': residentState('resident.c'),
      },
    }),
  )

  assert.deepEqual(
    input.yesterday_encounters.map((e) => e.resident_id),
    ['resident.b'],
  )
})

test('확인하지 않은 사연은 입력에 넣지 않는다', () => {
  const storyInfos = [
    { id: 'story_info.seen', ending_fact_text: '확인한 사실' },
    { id: 'story_info.hidden', ending_fact_text: '확인하지 않은 사실' },
  ] as StoryInfo[]

  const input = buildJournalInput(
    sourcesOf({
      residents: {
        'resident.a': residentState('resident.a', {
          resolved: true,
          revealedStoryInfoIds: ['story_info.seen'],
        }),
      },
      residentData: [{ id: 'resident.a', display_name: '영순' }] as Resident[],
      storyInfos,
    }),
  )

  assert.deepEqual(input.yesterday_encounters[0].revealed_facts, ['확인한 사실'])
  assert.equal(input.yesterday_encounters[0].display_name, '영순')
})

// ── 습격이 없던 날 ──────────────────────────────────────────

test('조우가 없던 날만 밭일 기록을 넘기고 누적이 아니라 차이를 넘긴다', () => {
  const input = buildJournalInput(
    sourcesOf({
      baseline: baselineOf({ harvestedTotal: 12, craftConsumedTotal: 4 }),
      harvestedTotal: 20,
      craftConsumedTotal: 4,
    }),
  )

  assert.deepEqual(input.quiet_day, { harvested: 8, craft_consumed: 0 })
})

test('조우가 있던 날은 밭일 기록을 넘기지 않는다', () => {
  const input = buildJournalInput(
    sourcesOf({
      residents: { 'resident.a': residentState('resident.a', { resolved: true }) },
      harvestedTotal: 20,
    }),
  )

  assert.equal(input.quiet_day, null)
})

// ── 넘기지 않기로 한 것 ─────────────────────────────────────

test('공포도 수치 자체는 입력에 없다', () => {
  const input = buildJournalInput(
    sourcesOf({
      fear: 9,
      fearBand: { id: 'fear_band.wariness', display_name: '경계' } as never,
    }),
  )

  assert.equal(input.fear.fear_band_id, 'fear_band.wariness')
  assert.equal(input.fear.change_direction, 'up')
  assert.ok(!('fear_score' in input.fear), '공포도 점수를 넘기면 DEC-JOURNAL-002 위반이다')
})

test('버전은 매니페스트에서 온다', () => {
  assert.equal(buildJournalInput(sourcesOf()).prompt_version, 3)
})

// ── 폴백 선택 ───────────────────────────────────────────────

const fallbacks = [
  { fear_band_id: 'fear_band.warmth', change_direction: 'up', fallback_journal_text: '온기·상승' },
  { fear_band_id: 'fear_band.warmth', change_direction: 'same', fallback_journal_text: '온기·유지' },
  { fear_band_id: 'fear_band.terror', change_direction: 'up', fallback_journal_text: '공포·상승' },
] as JournalFallback[]

test('구간과 방향이 둘 다 맞아야 고른다', () => {
  const picked = selectJournalFallback(fallbacks, 'fear_band.warmth', 'same')
  assert.equal(picked.ok && picked.text, '온기·유지')
})

test('덮지 않는 조합은 문장을 지어내지 않고 이유를 돌려준다', () => {
  const picked = selectJournalFallback(fallbacks, 'fear_band.terror', 'down')
  assert.equal(picked.ok, false)
})

test('공포도 구간을 못 찾으면 고르지 않는다', () => {
  const picked = selectJournalFallback(fallbacks, null, 'up')
  assert.equal(picked.ok, false)
})
