// 엔딩 기록문 — LLM 입력 구성과 요청 (DEC-CONTENT-011, DEC-JOURNAL-003)
//
// ── 이 파일이 지키는 것 ────────────────────────────────────
//
// **시스템이 확정한 사실만 넘긴다.** 입력에 넣을 필드는 DEC-CONTENT-011 이 열거했고
// 여기서 늘리지 않는다. 특히 다음은 절대 넣지 않는다 —
//   확인하지 않은 사연, 숨겨진 설정(`source_fact_text`), 대사 원문 전체,
//   전체 습격 일정, 현재 보관함, 시스템 프롬프트, API 설정.
//
// **LLM 실패가 엔딩 진행을 막지 않는다.** 실패하면 승인된 `fallback_record_text` 를
// 그대로 쓴다. 여기서 문장을 지어내지 않는다.
//
// 재시도는 서버리스 함수가 같은 입력으로 1회 수행한다. 클라이언트가 입력을 다시
// 만들면 그 사이에 사실이 달라질 수 있어 "동일한 확정 입력" 이 깨진다.

import type {
  Ending,
  FearBand,
  ImportantActionSubject,
  Resident,
  RuntimeManifest,
  StoryInfo,
} from '../data/types.ts'
import type { ResidentRunState, RunRecord } from '../state/types.ts'
import type { DominantCrop } from '../systems/ending.ts'

export interface EndingInputSources {
  manifest: RuntimeManifest
  playerName: string
  finalDay: number
  ending: Ending
  fearBand: FearBand | null
  dominantCrop: DominantCrop | null
  record: RunRecord
  residents: Record<string, ResidentRunState>
  residentData: readonly Resident[]
  storyInfos: readonly StoryInfo[]
}

/** DEC-CONTENT-011 이 열거한 최상위 필드. 여기에 필드를 더하면 입력 스키마 변경이다 */
export interface EndingInput {
  input_schema_version: number
  prompt_version: number
  player_name: string
  final_day: number
  ending: {
    ending_id: string
    ending_content_version: number
    ending_title: string
    ending_summary: string
    ending_prompt_direction: string
  }
  fear: {
    fear_score: number
    fear_band_id: string | null
    fear_band_display_name: string | null
    ending_prompt_summary: string | null
  }
  dominant_crop: {
    crop_id: string
    crop_display_name: string
    crop_attribute_id: string
    crop_attribute_display_name: string
    ending_prompt_summary: string
    mastery: number
    craft_consumed: number
    harvested: number
  } | null
  resident_summaries: Array<{
    resident_id: string
    display_name: string
    scenario_id: string | null
    /** 플레이어가 실제로 확인한 사연의 ending_fact_text 만 (DEC-CONTENT-017) */
    revealed_facts: string[]
    surrender_choice: string | null
    final_outcome: string | null
    life_state: string
    allegiance: string
    relationship: string
  }>
  important_action_counts: Record<ImportantActionSubject, number>
}

export function buildEndingInput(sources: EndingInputSources): EndingInput {
  const nameById = new Map(sources.residentData.map((r) => [r.id, r.display_name]))
  const factById = new Map(sources.storyInfos.map((i) => [i.id, i.ending_fact_text]))

  return {
    // 버전은 매니페스트가 단일 원본이다. 코드에 숫자를 쓰지 않는다 (DEC-PIPELINE-012)
    input_schema_version: sources.manifest.ending_input_schema_version,
    prompt_version: sources.manifest.ending_prompt_version,
    player_name: sources.playerName,
    final_day: sources.finalDay,

    ending: {
      ending_id: sources.ending.id,
      ending_content_version: sources.ending.content_version,
      ending_title: sources.ending.ending_title,
      ending_summary: sources.ending.ending_summary,
      ending_prompt_direction: sources.ending.ending_prompt_direction,
    },

    fear: {
      // 제출 빌드는 화면에 수치를 안 보여주지만 LLM 입력에는 점수와 구간 설명을
      // 함께 준다 (DEC-CONTENT-011). 화면 표시 규칙과 입력 규칙은 별개다.
      fear_score: sources.record.fear,
      fear_band_id: sources.fearBand?.id ?? null,
      fear_band_display_name: sources.fearBand?.display_name ?? null,
      ending_prompt_summary: sources.fearBand?.ending_prompt_summary ?? null,
    },

    dominant_crop:
      sources.dominantCrop === null
        ? null
        : {
            crop_id: sources.dominantCrop.cropId,
            crop_display_name: sources.dominantCrop.displayName,
            crop_attribute_id: sources.dominantCrop.attributeId,
            crop_attribute_display_name: sources.dominantCrop.attributeDisplayName,
            ending_prompt_summary: sources.dominantCrop.attributePromptSummary,
            mastery: sources.dominantCrop.mastery,
            craft_consumed: sources.dominantCrop.craftConsumed,
            harvested: sources.dominantCrop.harvested,
          },

    resident_summaries: Object.values(sources.residents).map((r) => ({
      resident_id: r.residentId,
      display_name: nameById.get(r.residentId) ?? r.residentId,
      scenario_id: r.scenarioId,
      // **확인한 정보만** 넣는다. 확인하지 않은 사연은 존재하지 않는 것으로 다룬다.
      revealed_facts: r.revealedStoryInfoIds
        .map((id) => factById.get(id))
        .filter((text): text is string => typeof text === 'string' && text.length > 0),
      surrender_choice: r.surrenderChoice,
      final_outcome: r.finalOutcome,
      life_state: r.lifeState,
      allegiance: r.allegiance,
      relationship: r.relationship,
    })),

    important_action_counts: { ...sources.record.importantActions },
  }
}

export interface EndingRecord {
  recordText: string
  usedFallback: boolean
  generatorModelId: string | null
  retryCount: number
}

/**
 * 기록문을 받아 온다. **실패해도 예외를 던지지 않는다.**
 *
 * 어떤 실패든 승인된 `fallback_record_text` 로 끝난다 (DEC-CONTENT-011).
 * 호출자는 이 함수가 항상 표시 가능한 문장을 돌려준다고 믿어도 된다.
 */
export async function requestEndingRecord(
  input: EndingInput,
  fallbackText: string,
): Promise<EndingRecord> {
  const fallback = (): EndingRecord => ({
    recordText: fallbackText,
    usedFallback: true,
    generatorModelId: null,
    retryCount: 0,
  })

  let response: Response
  try {
    response = await fetch('/api/ending', {
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
    recordText?: unknown
    generatorModelId?: unknown
    retryCount?: unknown
  }

  if (data.ok !== true || typeof data.recordText !== 'string' || data.recordText.length === 0) {
    return fallback()
  }

  return {
    recordText: data.recordText,
    usedFallback: false,
    generatorModelId: typeof data.generatorModelId === 'string' ? data.generatorModelId : null,
    retryCount: typeof data.retryCount === 'number' ? data.retryCount : 0,
  }
}
