// 엔딩 판정 — 공포도 구간, 조건, 우선순위, 대표 작물 (로드맵 8/4 최수정)
//
// DEC-CONTENT-011 · DEC-RESIDENT-046 · DEC-CONTENT-022
//
// ── 이 파일이 지키는 것 ────────────────────────────────────
//
// **시스템이 엔딩을 먼저 확정하고 LLM 은 기록문만 쓴다** (DEC-CONTENT-011).
// 여기서 나온 `ending_id` 는 LLM 응답과 무관하게 확정이며, LLM 이 실패해도
// 엔딩 진행을 막지 않는다. 이 파일은 LLM 을 부르지 않는다.
//
// **판정 순서를 바꾸지 않는다.** 공포도 구간 하나를 먼저 정하고, 그 구간의 엔딩 중
// 조건을 모두 만족하는 후보에서 `selection_priority` 가 가장 높은 것을 고른다.
// 조건을 먼저 보고 구간을 나중에 보면 다른 구간의 특별 엔딩이 새어 들어온다.
//
// **폴백은 판정 실패의 결과지 기본값이 아니다.** 후보를 못 찾거나 같은 우선순위가
// 동시에 성립하면 전역 폴백을 쓰되, 왜 그렇게 됐는지를 결과에 담아 보고한다.
// 조용히 폴백으로 떨어지면 콘텐츠 구멍이 정상 동작처럼 보인다.

import type {
  Crop,
  CropAttribute,
  Ending,
  EndingCondition,
  FearBand,
  ImportantActionSubject,
  RelationshipCountSubject,
} from '../data/types.ts'
import type { ResidentRunState, RunRecord } from '../state/types.ts'

export interface EndingData {
  fearBands: readonly FearBand[]
  endings: readonly Ending[]
  crops: readonly Crop[]
  cropAttributes: readonly CropAttribute[]
}

export interface EndingInput {
  record: RunRecord
  residents: Record<string, ResidentRunState>
}

/** 대표 작물. 셋 다 0이면 없음이다 (DEC-CONTENT-011) */
export interface DominantCrop {
  cropId: string
  displayName: string
  attributeId: string
  attributeDisplayName: string
  attributePromptSummary: string
  mastery: number
  craftConsumed: number
  harvested: number
}

export type EndingFallbackReason =
  /** 최종 공포도가 어느 승인 구간에도 들지 않았다 */
  | 'no_fear_band'
  /** 그 구간에 조건을 만족하는 엔딩이 없었다 */
  | 'no_candidate'
  /** 같은 우선순위가 동시에 성립했다 (DEC-CONTENT-011 은 데이터 오류로 정한다) */
  | 'priority_tie'
  /** 전역 폴백 엔딩 자체가 승인 데이터에 없다 */
  | 'fallback_missing'

export interface EndingJudgement {
  /** 확정된 엔딩. 전역 폴백조차 없으면 null 이고 그때는 화면이 데이터 오류를 띄운다 */
  ending: Ending | null
  fearBand: FearBand | null
  fearScore: number
  dominantCrop: DominantCrop | null
  /** 폴백을 썼으면 그 이유. 정상 판정이면 null */
  fallbackReason: EndingFallbackReason | null
}

export interface EndingJudge {
  judge(input: EndingInput): EndingJudgement
  /** 대표 작물만 따로 (조우 결과·일지에서도 쓴다) */
  dominantCrop(record: RunRecord): DominantCrop | null
}

/** 숫자 비교 (DEC-CONTENT-011) */
function compare(actual: number, comparison: string, target: number): boolean {
  if (comparison === 'eq') return actual === target
  if (comparison === 'gte') return actual >= target
  if (comparison === 'lte') return actual <= target
  return false
}

export function createEndingJudge(data: EndingData): EndingJudge {
  const cropById = new Map(data.crops.map((c) => [c.id, c]))
  const attributeById = new Map(data.cropAttributes.map((a) => [a.id, a]))

  /**
   * 최종 공포도가 속한 구간 (DEC-CONTENT-011).
   * 가장 높은 구간만 `max_fear` 가 비어 상한이 없다.
   */
  function bandFor(fear: number): FearBand | null {
    for (const band of data.fearBands) {
      if (fear < band.min_fear) continue
      if (band.max_fear !== null && fear > band.max_fear) continue
      return band
    }
    return null
  }

  function dominantCrop(record: RunRecord): DominantCrop | null {
    // 후보는 세 기록 중 하나라도 값이 있는 작물이다. 승인 작물 전체를 훑으면
    // 한 번도 만지지 않은 작물이 ID 오름차순 비교에서 대표가 될 수 있다.
    const ids = new Set([
      ...Object.keys(record.cropMastery),
      ...Object.keys(record.cropCraftConsumed),
      ...Object.keys(record.cropHarvested),
    ])

    const scored = [...ids]
      .map((id) => ({
        id,
        mastery: record.cropMastery[id] ?? 0,
        craft: record.cropCraftConsumed[id] ?? 0,
        harvest: record.cropHarvested[id] ?? 0,
      }))
      .filter((c) => c.mastery > 0 || c.craft > 0 || c.harvest > 0)

    // 모든 작물의 셋이 다 0이면 대표 작물 없음이다 (DEC-CONTENT-011)
    if (scored.length === 0) return null

    // 숙련도 → 제작 소비 → 총수확 → 작물 ID 오름차순 (DEC-CONTENT-011).
    // 판매량과 생식 수량은 우선순위에 직접 더하지 않는다.
    scored.sort((a, b) => {
      if (a.mastery !== b.mastery) return b.mastery - a.mastery
      if (a.craft !== b.craft) return b.craft - a.craft
      if (a.harvest !== b.harvest) return b.harvest - a.harvest
      return a.id.localeCompare(b.id)
    })

    const top = scored[0]
    const crop = cropById.get(top.id)
    if (crop === undefined) return null

    const attribute = attributeById.get(crop.crop_attribute_id)
    if (attribute === undefined) return null

    return {
      cropId: crop.id,
      displayName: crop.display_name,
      attributeId: attribute.id,
      attributeDisplayName: attribute.display_name,
      attributePromptSummary: attribute.ending_prompt_summary,
      mastery: top.mastery,
      craftConsumed: top.craft,
      harvested: top.harvest,
    }
  }

  /** 조건 하나 (DEC-CONTENT-011). 한 엔딩의 모든 조건은 AND 다 */
  function meets(
    condition: EndingCondition,
    input: EndingInput,
    crop: DominantCrop | null,
  ): boolean {
    const { condition_type: type, subject_key: subject, comparison, target_value: target } = condition
    const residents = Object.values(input.residents)

    switch (type) {
      case 'relationship_count': {
        const n = residents.filter(
          (r) => r.relationship === (subject as RelationshipCountSubject),
        ).length
        return compare(n, comparison, Number(target))
      }

      case 'important_action_count': {
        const n = input.record.importantActions[subject as ImportantActionSubject] ?? 0
        return compare(n, comparison, Number(target))
      }

      // 아래 넷은 eq 만 사용한다 (DEC-CONTENT-011)
      case 'specific_resident_relationship':
        return input.residents[subject ?? '']?.relationship === target

      case 'specific_resident_outcome':
        return input.residents[subject ?? '']?.finalOutcome === target

      case 'dominant_crop':
        return crop !== null && crop.cropId === target

      case 'dominant_crop_attribute':
        return crop !== null && crop.attributeId === target

      default:
        // 알 수 없는 조건 유형은 만족으로 처리하지 않는다. 스키마가 막고 있지만
        // 여기서 true 를 돌려주면 데이터 오류가 특별 엔딩으로 나타난다.
        return false
    }
  }

  function globalFallback(): Ending | null {
    return data.endings.find((e) => e.is_global_fallback) ?? null
  }

  function fallback(
    reason: EndingFallbackReason,
    band: FearBand | null,
    fear: number,
    crop: DominantCrop | null,
  ): EndingJudgement {
    const ending = globalFallback()
    return {
      ending,
      fearBand: band,
      fearScore: fear,
      dominantCrop: crop,
      fallbackReason: ending === null ? 'fallback_missing' : reason,
    }
  }

  return {
    dominantCrop,

    judge(input) {
      const fear = input.record.fear
      const crop = dominantCrop(input.record)

      const band = bandFor(fear)
      if (band === null) return fallback('no_fear_band', null, fear, crop)

      // 전역 폴백은 후보에 넣지 않는다. 판정 실패에만 쓴다 (DEC-CONTENT-011).
      const candidates = data.endings.filter(
        (e) => !e.is_global_fallback && e.fear_band_id === band.id,
      )

      const passed = candidates.filter((e) =>
        (e.conditions ?? []).every((c) => meets(c, input, crop)),
      )
      if (passed.length === 0) return fallback('no_candidate', band, fear, crop)

      const best = passed.reduce((a, b) =>
        b.selection_priority > a.selection_priority ? b : a,
      )

      // 같은 구간에서 같은 우선순위가 동시에 성립하면 데이터 오류다 (DEC-CONTENT-011).
      // 하나를 임의로 고르면 같은 플레이에서 다른 엔딩이 나올 수 있다.
      const tied = passed.filter((e) => e.selection_priority === best.selection_priority)
      if (tied.length > 1) return fallback('priority_tie', band, fear, crop)

      return {
        ending: best,
        fearBand: band,
        fearScore: fear,
        dominantCrop: crop,
        fallbackReason: null,
      }
    },
  }
}
