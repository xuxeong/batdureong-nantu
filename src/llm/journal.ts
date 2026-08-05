// 플레이어 일지 — LLM 입력 구성과 요청 (DEC-JOURNAL-001 ~ 004)
//
// ── 이 파일이 지키는 것 ────────────────────────────────────
//
// **엔딩과 분리된 시스템이다** (DEC-JOURNAL-004). `llm/ending.ts` 와 모양이 닮았지만
// 입력 규칙도 프롬프트 버전도 폴백 원본도 다르다. 공통 함수로 묶지 않는다 — 묶으면
// 한쪽 규칙을 고칠 때 다른 쪽이 같이 움직인다.
//
// **입력은 DEC-JOURNAL-002 가 열거한 확정 사실로 한정한다.** 여기에 필드를 더하는 것은
// 구현 편의가 아니라 입력 규격 변경이다. 특히 다음은 넣지 않는다 —
//   확인하지 않은 사연, 숨겨진 원본(`source_fact_text`), 전체 습격 일정,
//   공포도 수치 자체, 체력·소지금·보관함.
//
// **일지 실패는 일차 진행을 막지 않는다** (DEC-JOURNAL-003). 어떤 실패든 승인된
// `journal_fallbacks.csv` 문구로 끝나고, 폴백을 정상 생성분과 시각적으로 구분하지
// 않는다 (DEC-UI-028) — 그 판단은 화면이 하고 여기서는 사실만 돌려준다.
//
// ── 입력 스키마 버전이 없다 ────────────────────────────────
//
// 엔딩 입력에는 `ending_input_schema_version` 이 있는데(DEC-CONTENT-011 이 열거했다)
// 일지 입력에는 대응하는 버전이 `schema_manifest.json` 에 없다. DEC-JOURNAL-002 도
// 버전 필드를 요구하지 않는다. **여기서 새로 만들지 않는다** — 매니페스트에 열을
// 늘리는 것은 스키마 변경이라 보고 대상이다 (AGENTS.md 6절).
// 프롬프트 버전만 넣는다. 그것은 이미 매니페스트에 있다.

import type {
  FearBand,
  JournalChangeDirection,
  JournalFallback,
  Resident,
  RuntimeManifest,
  StoryInfo,
} from '../data/types.ts'
import type { JournalBaseline, ResidentRunState } from '../state/types.ts'

export interface JournalInputSources {
  manifest: RuntimeManifest
  playerName: string
  /** 이 일지를 보여주는 일차. 전날은 `dayNumber - 1` 이다 */
  dayNumber: number
  /** 전날 아침 이후로 무엇이 달라졌는지 재는 기준점 */
  baseline: JournalBaseline
  fear: number
  fearBand: FearBand | null
  residents: Record<string, ResidentRunState>
  residentData: readonly Resident[]
  storyInfos: readonly StoryInfo[]
  harvestedTotal: number
  craftConsumedTotal: number
}

/** DEC-JOURNAL-002 가 열거한 최상위 필드. 여기에 필드를 더하면 입력 규격 변경이다 */
export interface JournalInput {
  prompt_version: number
  player_name: string
  day_number: number
  fear: {
    /** 구간과 방향만 넘긴다. 수치 자체는 넘기지 않는다 (DEC-JOURNAL-002) */
    fear_band_id: string | null
    fear_band_display_name: string | null
    change_direction: JournalChangeDirection
  }
  /** 전날 조우가 끝난 주민. 없으면 빈 배열이며 그날은 습격이 없던 날이다 */
  yesterday_encounters: Array<{
    resident_id: string
    display_name: string
    final_outcome: string | null
    relationship: string
    /** 플레이어가 실제로 확인한 사연의 ending_fact_text 만 (DEC-CONTENT-017) */
    revealed_facts: string[]
  }>
  /** 습격이 없던 날의 확정 플레이 기록. 습격이 있었으면 null */
  quiet_day: {
    harvested: number
    craft_consumed: number
  } | null
}

/**
 * 공포도가 전날보다 올랐는가.
 *
 * **`down` 은 지금 규칙으로는 나오지 않는다.** 공포도는 감소하지 않는 누적 정수이기
 * 때문이다 (DEC-RESIDENT-046). 그런데 `journal_fallbacks.csv` 에는 구간마다 `down`
 * 행이 승인돼 있다 (DEC-JOURNAL-003 이 세 방향을 요구했다). 데이터가 시스템보다
 * 넓은 상태이며 그 자체가 오류는 아니다 — 여기서 `down` 을 지어내지 않고, 감소가
 * 실제로 들어오면 그때 정상 동작하도록 비교만 그대로 둔다.
 */
export function fearDirection(current: number, previous: number): JournalChangeDirection {
  if (current > previous) return 'up'
  if (current < previous) return 'down'
  return 'same'
}

export function buildJournalInput(sources: JournalInputSources): JournalInput {
  const nameById = new Map(sources.residentData.map((r) => [r.id, r.display_name]))
  const factById = new Map(sources.storyInfos.map((i) => [i.id, i.ending_fact_text]))
  const known = new Set(sources.baseline.resolvedResidentIds)

  // 전날 새로 해결된 주민만이다. 그 전에 끝난 조우는 이미 지난 일지가 다뤘다.
  const yesterday = Object.values(sources.residents).filter(
    (r) => r.resolved && !known.has(r.residentId),
  )

  return {
    // 버전은 매니페스트가 단일 원본이다. 코드에 숫자를 쓰지 않는다 (DEC-PIPELINE-012)
    prompt_version: sources.manifest.journal_prompt_version,
    player_name: sources.playerName,
    day_number: sources.dayNumber,

    fear: {
      fear_band_id: sources.fearBand?.id ?? null,
      fear_band_display_name: sources.fearBand?.display_name ?? null,
      change_direction: fearDirection(sources.fear, sources.baseline.fear),
    },

    yesterday_encounters: yesterday.map((r) => ({
      resident_id: r.residentId,
      display_name: nameById.get(r.residentId) ?? r.residentId,
      final_outcome: r.finalOutcome,
      relationship: r.relationship,
      // **확인한 정보만** 넣는다. 확인하지 않은 사연은 존재하지 않는 것으로 다룬다.
      revealed_facts: r.revealedStoryInfoIds
        .map((id) => factById.get(id))
        .filter((text): text is string => typeof text === 'string' && text.length > 0),
    })),

    // 조우가 하나도 없던 날만 밭일 기록을 넘긴다 (DEC-JOURNAL-002).
    // 습격이 있던 날은 그날의 사건이 이미 조우 쪽에 있다.
    quiet_day:
      yesterday.length > 0
        ? null
        : {
            harvested: sources.harvestedTotal - sources.baseline.harvestedTotal,
            craft_consumed: sources.craftConsumedTotal - sources.baseline.craftConsumedTotal,
          },
  }
}

export type FallbackSelection =
  | { ok: true; text: string }
  | { ok: false; reason: string }

/**
 * 폴백 일지를 고른다 — 공포도 구간 × 변화 방향 (DEC-JOURNAL-003).
 *
 * 못 찾으면 문장을 지어내지 않고 이유를 돌려준다. 승인 데이터가 덮지 않는 조합을
 * 코드가 메우면 그 순간 코드가 콘텐츠를 확정하는 것이 된다 (AGENTS.md 6절).
 */
export function selectJournalFallback(
  rows: readonly JournalFallback[] | undefined,
  fearBandId: string | null,
  direction: JournalChangeDirection,
): FallbackSelection {
  if (fearBandId === null) {
    return {
      ok: false,
      reason:
        '현재 공포도가 어느 구간에도 들지 않아 폴백 일지를 고를 수 없다. ' +
        'fear_bands 승인 행이 0 부터 상한 없이 이어지는지 확인한다',
    }
  }

  const matched = (rows ?? []).filter(
    (row) => row.fear_band_id === fearBandId && row.change_direction === direction,
  )

  if (matched.length === 0) {
    return {
      ok: false,
      reason: `journal_fallbacks 에 ${fearBandId} × ${direction} 승인 행이 없다`,
    }
  }

  if (matched.length > 1) {
    // 고유키가 (fear_band_id, change_direction) 이라 검증기가 이미 막는다.
    // 여기 오면 검증을 거치지 않은 데이터를 읽은 것이므로 조용히 첫 행을 쓰지 않는다.
    return {
      ok: false,
      reason:
        `journal_fallbacks 의 ${fearBandId} × ${direction} 승인 행이 ${matched.length} 개다. ` +
        '이 조합은 고유해야 한다',
    }
  }

  return { ok: true, text: matched[0].fallback_journal_text }
}

export interface JournalResult {
  text: string
  /** LLM 생성이 실패해 폴백 문구를 썼는가 (DEC-JOURNAL-003) */
  usedFallback: boolean
  generatorModelId: string | null
  retryCount: number
}

/**
 * 일지를 받아 온다. **실패해도 예외를 던지지 않는다.**
 *
 * 재시도 1회는 서버리스 함수가 같은 입력으로 수행한다 (DEC-JOURNAL-003).
 * 클라이언트가 입력을 다시 만들면 그 사이에 사실이 달라져 "같은 입력" 이 깨진다.
 *
 * 호출자는 이 함수가 항상 표시 가능한 문장을 돌려준다고 믿어도 된다.
 */
export async function requestJournal(
  input: JournalInput,
  fallbackText: string,
): Promise<JournalResult> {
  const fallback = (): JournalResult => ({
    text: fallbackText,
    usedFallback: true,
    generatorModelId: null,
    retryCount: 0,
  })

  let response: Response
  try {
    response = await fetch('/api/journal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
  } catch {
    return fallback()
  }

  if (!response.ok) return fallback()

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return fallback()
  }

  const data = body as {
    ok?: boolean
    journalText?: unknown
    generatorModelId?: unknown
    retryCount?: unknown
  }

  if (data.ok !== true || typeof data.journalText !== 'string' || data.journalText.length === 0) {
    return fallback()
  }

  return {
    text: data.journalText,
    usedFallback: false,
    generatorModelId: typeof data.generatorModelId === 'string' ? data.generatorModelId : null,
    retryCount: typeof data.retryCount === 'number' ? data.retryCount : 0,
  }
}
