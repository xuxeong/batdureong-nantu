// 런 흐름 (DEC-RUN-014, DEC-RUN-015).
//
// 순수 함수로 둔다. 캔버스·DOM·타이머를 모르고, 같은 입력에 같은 출력만 낸다.
// 습격일과 비습격일이 갈리는 지점이 여기 한 곳뿐이라 테스트로 고정할 수 있다.
//
// **`취침` 단계는 없다.** 습격 없는 날은 정비 종료(`아침까지 잔다`) → 밤 결과 → 다음 일차다.
// `조우 결과`와 `밤 결과`는 같은 층위이며 하루에 **하나만** 등장한다 (DEC-RUN-015).
// 폐기된 DEC-RUN-012/013 의 `일차 결과` 단계는 존재하지 않는다.

import type { RaidType } from '../data/types.ts'

/** 런이 지금 어디에 있는가 */
export type FlowStep =
  | { at: 'title' }
  | { at: 'name_input' }
  | { at: 'tutorial' }
  | { at: 'day_start'; day: number }
  | { at: 'farming'; day: number }
  | { at: 'maintenance'; day: number }
  /** 필드 습격 모드. 진입 직후 전투 전 대화가 오버레이로 열린다 */
  | { at: 'raid'; day: number }
  | { at: 'encounter_result'; day: number }
  | { at: 'night_result'; day: number }
  | { at: 'ending' }
  | { at: 'run_failed' }

/** 흐름을 전진시키는 사건 */
export type FlowInput =
  | { type: 'confirm' }
  | { type: 'farming_time_expired' }
  | { type: 'maintenance_finished'; intent: 'scout_field' | 'sleep_until_morning' }
  | { type: 'encounter_finished' }
  /** 체력 0. 어느 단계에서든 즉시 런 실패다 (DEC-RUN-008) */
  | { type: 'player_died' }
  /**
   * 일시정지에서 타이틀로 돌아간다 (DEC-UI-027).
   *
   * 확정문이 *"타이틀로 돌아가면 현재 런이 사라지므로 확인 절차를 둔다"* 로
   * 정했다. 일시정지는 어느 단계에서든 열리므로 이것도 단계를 가리지 않는다.
   * `player_died` 와 같은 자리에서 처리한다.
   *
   * **런을 처음부터 다시 시작하는 입력은 만들지 않는다.** 같은 확정문이 명시로
   * 금지했다 — 타이틀로 돌아간 뒤 새 런을 시작하는 것이 유일한 경로다.
   */
  | { type: 'abandon_run' }

/**
 * 흐름 판단에 필요한 승인 데이터.
 *
 * 일수와 습격 일정은 `run_schedules` / `run_schedule_days` 에서 온다.
 * 이 파일에 숫자를 두지 않는다 (DEC-PIPELINE-016).
 */
export interface FlowContext {
  totalDays: number
  /** 해당 일차의 습격 종류. 승인 데이터에 그 일차가 없으면 undefined */
  raidTypeOf(day: number): RaidType | undefined
}

/** 규칙대로 갈 수 없는 상태. 임의로 메우지 않고 데이터 오류로 올린다 */
export interface FlowError {
  error: string
}

export type FlowResult = FlowStep | FlowError

export function isFlowError(result: FlowResult): result is FlowError {
  return 'error' in result
}

/** 시작 지점 */
export const INITIAL_STEP: FlowStep = { at: 'title' }

export function advance(step: FlowStep, input: FlowInput, ctx: FlowContext): FlowResult {
  // 체력 0은 진행 중인 화면과 무관하게 즉시 런 실패다. 엔딩으로 가지 않는다.
  // (DEC-RUN-008, DEC-UI-014)
  if (input.type === 'player_died') {
    return { at: 'run_failed' }
  }

  // 타이틀 복귀도 단계를 가리지 않는다 (DEC-UI-027). 확인 절차는 화면이 이미
  // 거쳤으므로 여기서 다시 묻지 않는다 — 흐름은 무엇을 확인했는지 모른다.
  if (input.type === 'abandon_run') {
    return { at: 'title' }
  }

  switch (step.at) {
    case 'title':
      return input.type === 'confirm' ? { at: 'name_input' } : unexpected(step, input)

    case 'name_input':
      return input.type === 'confirm' ? { at: 'tutorial' } : unexpected(step, input)

    // 튜토리얼은 본 런과 시간·체력·자원을 공유하지 않는다 (DEC-RUN-003).
    // 자원 초기화는 런 시작 시점에 일어나며 흐름 판단과는 별개다.
    case 'tutorial':
      return input.type === 'confirm' ? startDay(1, ctx) : unexpected(step, input)

    case 'day_start':
      return input.type === 'confirm' ? { at: 'farming', day: step.day } : unexpected(step, input)

    // 재배 단계는 제한시간이 끝나면 자동 종료한다 (DEC-RUN-004).
    // DEC-RUN-005(조기 종료)는 보류라 다른 종료 조건을 만들지 않는다.
    case 'farming':
      return input.type === 'farming_time_expired'
        ? { at: 'maintenance', day: step.day }
        : unexpected(step, input)

    case 'maintenance': {
      if (input.type !== 'maintenance_finished') return unexpected(step, input)

      const raidType = ctx.raidTypeOf(step.day)
      if (raidType === undefined) {
        return { error: `${step.day}일차의 습격 일정이 승인 데이터에 없다` }
      }

      const isRaidDay = raidType !== 'none'
      // 종료 버튼은 그날의 습격 여부에 따라 하나만 나온다 (DEC-UI-014).
      // 어긋났다면 화면이 데이터와 다른 버튼을 띄운 것이므로 조용히 넘기지 않는다.
      if (isRaidDay !== (input.intent === 'scout_field')) {
        return {
          error:
            `${step.day}일차 습격 여부(${raidType})와 정비 종료 선택(${input.intent})이 맞지 않는다`,
        }
      }

      // 습격일: 셔터가 올라가고 필드(습격 모드)가 드러난다.
      // 비습격일: 셔터를 걷지 않은 채 밤 결과로 간다.
      return isRaidDay ? { at: 'raid', day: step.day } : { at: 'night_result', day: step.day }
    }

    case 'raid':
      return input.type === 'encounter_finished'
        ? { at: 'encounter_result', day: step.day }
        : unexpected(step, input)

    // 마지막 습격이면 엔딩 판정으로, 아니면 바로 다음 일차로 (DEC-RUN-015).
    case 'encounter_result': {
      if (input.type !== 'confirm') return unexpected(step, input)
      return ctx.raidTypeOf(step.day) === 'final_raid'
        ? { at: 'ending' }
        : startDay(step.day + 1, ctx)
    }

    case 'night_result':
      return input.type === 'confirm' ? startDay(step.day + 1, ctx) : unexpected(step, input)

    // 엔딩과 런 실패에서는 흐름이 더 전진하지 않는다.
    // 타이틀 복귀는 런 리셋을 동반하므로 흐름 전진이 아니라 새 런 시작으로 처리한다.
    case 'ending':
    case 'run_failed':
      return input.type === 'confirm' ? { at: 'title' } : unexpected(step, input)
  }
}

function startDay(day: number, ctx: FlowContext): FlowResult {
  if (day > ctx.totalDays) {
    // 마지막 날에 final_raid 가 있으면 엔딩으로 빠져나가므로 여기 오지 않는다.
    // 도달했다면 습격 일정에 final_raid 가 없다는 뜻이다.
    return { error: `${ctx.totalDays}일차까지인 일정에 final_raid 가 없어 ${day}일차로 넘어갔다` }
  }
  if (ctx.raidTypeOf(day) === undefined) {
    return { error: `${day}일차의 습격 일정이 승인 데이터에 없다` }
  }
  return { at: 'day_start', day }
}

function unexpected(step: FlowStep, input: FlowInput): FlowError {
  return { error: `${step.at} 단계에서 처리할 수 없는 입력: ${input.type}` }
}
