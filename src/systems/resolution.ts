// 조우 해결 — 최종 결과 확정, 관계·공포도 누적, 보상 지급 (로드맵 8/4 최수정)
//
// DEC-RESIDENT-052 · DEC-RESIDENT-012 · DEC-RESIDENT-042 · DEC-RESIDENT-043 ·
// DEC-RESIDENT-046 · DEC-CONTENT-022
//
// ── 이 파일이 지키는 것 ────────────────────────────────────
//
// **최종 결과는 조우가 해결되는 순간 정확히 한 번 확정하고 이후 바꾸지 않는다**
// (DEC-RESIDENT-052). 두 번째 호출은 조용히 덮어쓰지 않고 실패로 돌려준다.
// 조용히 덮어쓰면 "투항을 수락했는데 엔딩에서는 처치로 나온" 같은 결과가 나오고,
// 그건 런이 끝난 뒤에야 드러난다.
//
// **보상과 상태 변경은 하나의 처리다** (DEC-RESIDENT-042). 자원 묶음을 전부 검증한
// 뒤에 적용하며, 검증에 실패하면 자원도 주민 상태도 건드리지 않는다. 절반만 반영되면
// "보상은 받았는데 조우는 안 끝난" 상태가 된다.
//
// ── 공포도 증가량이 아직 없다 (DEC-RESIDENT-048 보류) ──────
//
// `DEC-RESIDENT-046` 이 위협은 적게, 퇴각은 중간, 처치는 높게 올린다고 확정했지만
// **실제 수치는 어느 승인 CSV 에도 없다.** 048 이 그 값을 정하는 보류 결정이다.
//
// 임시 기본값을 넣지 않는다 (AGENTS.md 6절). 대신 `fearIncrements` 가 null 이면
// 공포도만 누적하지 않고 결과에 `fearPending` 을 켜서 호출자가 표시하게 한다.
// 나머지 처리(관계·소속·보상·중요 행동)는 값과 무관하므로 그대로 진행한다 —
// 여기서 통째로 막으면 8/5 완주가 048 하나에 걸린다.

import type {
  FinalOutcome,
  Resident,
  ResidentCombatProfile,
  RewardBundle,
  SurrenderChoiceFunction,
} from '../data/types.ts'
import type {
  ResidentAllegiance,
  ResidentLifeState,
  ResidentRunState,
  RelationshipState,
  Resources,
  RunRecord,
} from '../state/types.ts'

/** 공포도를 올리는 행동 (DEC-RESIDENT-046) */
export type FearCause = 'threat' | 'retreat' | 'kill'

/**
 * 행동별 공포도 증가량. `DEC-RESIDENT-048` 이 확정되면 승인 CSV 에서 온다.
 * 코드에 숫자를 쓰지 않는다 (DEC-PIPELINE-016).
 */
export type FearIncrements = Readonly<Record<FearCause, number>>

export interface ResolutionData {
  rewardBundles: readonly RewardBundle[]
  /** 보상 묶음은 주민이 아니라 전투 프로필이 들고 있다 (DEC-CONTENT-008) */
  residents: readonly Resident[]
  combatProfiles: readonly ResidentCombatProfile[]
  /** 미승인이면 null. 그때는 공포도만 누적되지 않는다 (파일 머리말) */
  fearIncrements: FearIncrements | null
}

export interface ResolutionState {
  residents: Record<string, ResidentRunState>
  resources: Resources
  record: RunRecord
}

export interface ResolveOutcome {
  residentId: string
  finalOutcome: FinalOutcome
  /** 실제로 지급한 보상 묶음. 보상이 없는 결과면 null */
  rewardBundleId: string | null
  /** 이번 처리로 오른 공포도. 증가량 미승인이면 0 */
  fearDelta: number
  /**
   * 공포도를 올려야 했는데 증가량이 없어 못 올렸는가.
   * true 면 호출자가 개발 빌드에 표시한다 (DEC-RESIDENT-048 대기).
   */
  fearPending: boolean
}

export type ResolveResult =
  | { ok: true; value: ResolveOutcome }
  | { ok: false; reason: ResolveFailure }

export type ResolveFailure =
  /** 이미 해결된 조우다. 최종 결과는 한 번만 확정한다 (DEC-RESIDENT-052) */
  | 'already_resolved'
  /** 런 상태에 없는 주민이다 */
  | 'unknown_resident'
  /** 보상 묶음이나 그 항목이 승인 데이터에 없다 */
  | 'reward_data_missing'
  /** 보상 수량이 1 이상의 정수가 아니다 */
  | 'reward_quantity_invalid'

export interface Resolution {
  /**
   * 조우를 해결하고 최종 결과를 확정한다.
   * 관계·소속·생존 상태 변경, 중요 행동 기록, 공포도 누적, 보상 지급이
   * **전부 적용되거나 아무것도 적용되지 않는다.**
   */
  resolve(residentId: string, outcome: FinalOutcome): ResolveResult

  /**
   * 위협·대립 선택. 조우 해결이 아니라 중요 행동이다 (DEC-RESIDENT-052).
   * 공포도만 오르고 최종 결과는 확정하지 않는다.
   */
  recordThreat(residentId: string): { fearDelta: number; fearPending: boolean }

  /** 자원 협상이 성격 프로필에 막힌 것. 공포도는 오르지 않는다 */
  recordNegotiationRejected(residentId: string): void

  /**
   * 투항 대화에서 무엇을 골랐는지 남긴다 (DEC-RESIDENT-042).
   *
   * 최종 결과와 별개로 기록한다 — `resume_combat` 은 최종 결과가 아니고,
   * 거부 후 처치한 경우 "투항을 거부당한 뒤 죽었다" 가 엔딩 기록의 사실이 된다.
   */
  recordSurrenderChoice(residentId: string, choice: SurrenderChoiceFunction): void

  /** 투항 거부·전투 재개. 중요 행동이며 공포도는 오르지 않는다 (DEC-RESIDENT-046) */
  recordSurrenderResumed(residentId: string): void

  /**
   * 이 주민을 적대 주민으로 등장시킬 수 있는가 (DEC-RESIDENT-043).
   * 해결된 주민은 같은 런에서 다시 적대로 나오지 않는다.
   */
  canAppearAsHostile(residentId: string): boolean
}

/**
 * 최종 결과 하나가 확정하는 상태 조합 (DEC-RESIDENT-052).
 *
 * 이 표를 코드 여기저기에 흩지 않는다. 조합이 갈리면 "처치했는데 관계가 단절이
 * 아닌" 같은 상태가 만들어지고, 엔딩 판정이 그걸 그대로 읽는다.
 */
const OUTCOME_STATE: Readonly<
  Record<
    FinalOutcome,
    {
      lifeState: ResidentLifeState
      allegiance: ResidentAllegiance
      relationship: RelationshipState
      /** 이 결과가 세는 중요 행동 (DEC-CONTENT-011) */
      action: keyof RunRecord['importantActions']
      /** 공포도를 올리는 결과면 원인, 아니면 null (DEC-RESIDENT-046) */
      fearCause: FearCause | null
      /** 보상 묶음을 어느 필드에서 찾는가 (DEC-RESIDENT-042) */
      rewardField: keyof Pick<
        ResidentCombatProfile,
        'retreat_reward_bundle_id' | 'kill_reward_bundle_id'
      > | null
    }
  >
> = {
  empathy_resolve: {
    lifeState: 'alive',
    allegiance: 'neutral',
    relationship: 'friendly',
    action: 'empathy_resolve',
    fearCause: null,
    rewardField: null,
  },
  resource_negotiation_resolve: {
    lifeState: 'alive',
    allegiance: 'neutral',
    relationship: 'trade',
    action: 'resource_negotiation_resolve',
    fearCause: null,
    rewardField: null,
  },
  recruited: {
    lifeState: 'alive',
    allegiance: 'recruited',
    relationship: 'companion',
    action: 'surrender_recruit',
    fearCause: null,
    rewardField: null,
  },
  retreated: {
    lifeState: 'alive',
    allegiance: 'neutral',
    relationship: 'coercive',
    action: 'surrender_retreat_reward',
    fearCause: 'retreat',
    rewardField: 'retreat_reward_bundle_id',
  },
  killed: {
    lifeState: 'killed',
    allegiance: 'hostile',
    relationship: 'severed',
    action: 'resident_killed',
    fearCause: 'kill',
    rewardField: 'kill_reward_bundle_id',
  },
}

/** 보상 한 항목을 적용할 보관함을 고른다 (DEC-CONTENT-010) */
function grantEntry(
  resources: Resources,
  kind: string,
  id: string,
  quantity: number,
): void {
  if (kind === 'money') {
    resources.money += quantity
    return
  }

  const store =
    kind === 'crop'
      ? resources.crops
      : kind === 'material'
        ? resources.materials
        : kind === 'throwable_weapon'
          ? resources.throwables
          : resources.recoveries

  store[id] = (store[id] ?? 0) + quantity
}

function isPositiveInteger(n: number): boolean {
  return Number.isInteger(n) && n > 0
}

export function createResolution(
  state: ResolutionState,
  data: ResolutionData,
): Resolution {
  const bundleById = new Map(data.rewardBundles.map((b) => [b.id, b]))
  const profileById = new Map(data.combatProfiles.map((p) => [p.id, p]))
  // 주민 → 전투 프로필. 승인 주민과 승인 전투 프로필은 1:1 이다 (DEC-CONTENT-008)
  const profileByResident = new Map<string, ResidentCombatProfile>()
  for (const resident of data.residents) {
    const profile = profileById.get(resident.combat_profile_id)
    if (profile !== undefined) profileByResident.set(resident.id, profile)
  }

  function fearFor(cause: FearCause | null): { delta: number; pending: boolean } {
    if (cause === null) return { delta: 0, pending: false }
    if (data.fearIncrements === null) return { delta: 0, pending: true }
    return { delta: data.fearIncrements[cause], pending: false }
  }

  function applyFear(cause: FearCause | null): { fearDelta: number; fearPending: boolean } {
    const { delta, pending } = fearFor(cause)
    // 감소하지 않는 누적값이다 (DEC-RESIDENT-046)
    state.record.fear += delta
    return { fearDelta: delta, fearPending: pending }
  }

  return {
    resolve(residentId, outcome) {
      const resident = state.residents[residentId]
      if (resident === undefined) return { ok: false, reason: 'unknown_resident' }

      // 최종 결과는 한 번만 확정한다 (DEC-RESIDENT-052).
      // 중복 입력으로 보상이 두 번 나가는 것을 여기서 막는다 (DEC-RESIDENT-042).
      if (resident.resolved) return { ok: false, reason: 'already_resolved' }

      const spec = OUTCOME_STATE[outcome]

      // ── 검증 단계. 여기서는 아무것도 바꾸지 않는다 ──────────
      let bundle: RewardBundle | null = null

      if (spec.rewardField !== null && !resident.rewardGranted) {
        const profile = profileByResident.get(residentId)
        if (profile === undefined) return { ok: false, reason: 'reward_data_missing' }

        const bundleId = profile[spec.rewardField]
        const found = bundleById.get(bundleId)
        if (found === undefined) return { ok: false, reason: 'reward_data_missing' }

        // 보상 처리 전 모든 자원 ID와 수량을 검증한다 (DEC-RESIDENT-042).
        // 한 항목이라도 어긋나면 묶음 전체를 지급하지 않는다.
        for (const entry of found.entries ?? []) {
          if (!isPositiveInteger(entry.quantity)) {
            return { ok: false, reason: 'reward_quantity_invalid' }
          }
          if (entry.resource_id.length === 0) {
            return { ok: false, reason: 'reward_data_missing' }
          }
        }

        bundle = found
      }

      // ── 적용 단계. 여기서부터 되돌리지 않는다 ──────────────
      if (bundle !== null) {
        for (const entry of bundle.entries ?? []) {
          grantEntry(state.resources, entry.resource_kind, entry.resource_id, entry.quantity)
        }
        // 한 주민의 대가·처치 보상은 한 런에서 한 번만 지급한다 (DEC-RESIDENT-042)
        resident.rewardGranted = true
      }

      resident.resolved = true
      resident.finalOutcome = outcome
      resident.lifeState = spec.lifeState
      resident.allegiance = spec.allegiance
      resident.relationship = spec.relationship

      state.record.importantActions[spec.action] += 1
      const { fearDelta, fearPending } = applyFear(spec.fearCause)

      return {
        ok: true,
        value: {
          residentId,
          finalOutcome: outcome,
          rewardBundleId: bundle?.id ?? null,
          fearDelta,
          fearPending,
        },
      }
    },

    recordThreat(residentId) {
      state.record.importantActions.threat_selected += 1
      // 위협은 조우를 해결하지 않으므로 주민 상태를 바꾸지 않는다 (DEC-RESIDENT-052).
      // 존재하지 않는 주민이어도 전역 기록은 남긴다 — 기록을 빠뜨리는 쪽이 더 나쁘다.
      void residentId
      return applyFear('threat')
    },

    recordNegotiationRejected(residentId) {
      state.record.importantActions.resource_negotiation_rejected += 1
      void residentId
    },

    recordSurrenderChoice(residentId, choice) {
      const resident = state.residents[residentId]
      if (resident === undefined) return
      resident.surrenderChoice = choice
    },

    recordSurrenderResumed(residentId) {
      // 투항 거부는 중요 행동이고 최종 결과가 아니다 (DEC-RESIDENT-052).
      // 이후 실제로 처치했을 때만 killed 를 확정한다.
      state.record.importantActions.surrender_resume_combat += 1
      void residentId
    },

    canAppearAsHostile(residentId) {
      const resident = state.residents[residentId]
      if (resident === undefined) return true
      // 영입·중립·처치로 해결된 주민은 다시 적대로 등장하지 않는다 (DEC-RESIDENT-043).
      // 영입 주민은 아군 지원으로만 나온다.
      return !resident.resolved
    },
  }
}
