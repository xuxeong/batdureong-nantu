// 화면 매니저 (DEC-UI-014).
//
// **화면은 평평한 목록이 아니다.** 세 층위로 나눠 관리한다.
//
//   독립 화면   타이틀 / 이름 입력 / 튜토리얼 / 일차 시작 / 조우 결과 / 밤 결과
//               / 런 실패 / 엔딩 / 데이터 오류      ← 한 번에 하나. 필드를 덮는다
//   베이스      필드 하나. `재배 모드`와 `습격 모드`로 동작한다
//   오버레이    정비 허브(셔터) / 전투 전 대화 / 투항 대화 / 회복 퀵메뉴 / 일시정지
//               ← 필드 위에 뜬다. 캔버스는 살아 있고 시뮬레이션만 멈춘다
//
// 정비는 별도 화면 전환이 아니라 셔터가 필드를 덮고 그 위에 올라오는 오버레이다.
// 전투 전 대화와 투항 대화도 필드(습격 모드) 위 오버레이다.
//
// 중첩 UI의 표시 우선순위(`DEC-UI-026`)는 보류다. 잠금 스택을 임의로 설계하지 않고
// **"오버레이가 열려 있으면 필드 정지"** 규칙만 구현한다 (개발 로드맵 9-2).

import type { EventBus, FieldMode, OverlayId, ScreenId } from '../core/events.ts'
import type { GameLoop } from '../core/loop.ts'
import { advance, INITIAL_STEP, isFlowError } from './flow.ts'
import type { FlowContext, FlowInput, FlowStep } from './flow.ts'

/** 필수 화면이라 `Esc`로 닫을 수 없다 (DEC-UI-014) */
const MANDATORY_OVERLAYS: ReadonlySet<OverlayId> = new Set([
  'precombat_dialogue',
  'surrender_dialogue',
])

/** 흐름 단계가 어느 층위로 나타나는가 */
type Presentation =
  | { layer: 'screen'; screen: ScreenId }
  | { layer: 'field'; mode: FieldMode; overlay?: OverlayId }

function presentationOf(step: FlowStep): Presentation {
  switch (step.at) {
    case 'title':
      return { layer: 'screen', screen: 'title' }
    case 'name_input':
      return { layer: 'screen', screen: 'name_input' }
    case 'tutorial':
      return { layer: 'screen', screen: 'tutorial' }
    case 'day_start':
      return { layer: 'screen', screen: 'day_start' }
    case 'farming':
      return { layer: 'field', mode: 'farming' }
    // 정비는 재배 필드 위에 셔터가 덮이는 오버레이다. 필드는 그대로 살아 있다.
    case 'maintenance':
      return { layer: 'field', mode: 'farming', overlay: 'maintenance_hub' }
    // 습격 모드에 진입하면 곧이어 전투 전 대화가 오버레이로 열린다.
    case 'raid':
      return { layer: 'field', mode: 'raid', overlay: 'precombat_dialogue' }
    case 'encounter_result':
      return { layer: 'screen', screen: 'encounter_result' }
    case 'night_result':
      return { layer: 'screen', screen: 'night_result' }
    case 'ending':
      return { layer: 'screen', screen: 'ending' }
    case 'run_failed':
      return { layer: 'screen', screen: 'run_failed' }
  }
}

export interface SceneManager {
  step(): FlowStep
  currentScreen(): ScreenId | null
  currentFieldMode(): FieldMode | null
  openOverlays(): OverlayId[]

  /** 흐름을 전진시킨다. 규칙상 갈 수 없으면 데이터 오류 화면으로 보낸다 */
  send(input: FlowInput): void

  openOverlay(overlay: OverlayId): void
  closeOverlay(overlay: OverlayId): void

  /**
   * `Esc`. 어떤 화면에서도 일시정지를 연다.
   * 필수 대화 중이라면 대화는 그대로 둔 채 일시정지만 겹친다 (DEC-UI-014).
   */
  handleEscape(): void

  /** 승인 데이터가 로드된 뒤 흐름 판단 근거를 갈아끼운다 */
  setContext(ctx: FlowContext): void

  /**
   * **개발 전용.** 흐름을 건너뛰고 필드만 띄운다.
   *
   * 시작 화면은 타이틀이고 필드 입력은 재배·습격 단계에서만 열린다 (DEC-INPUT-009).
   * 그런데 `run_schedules` 승인 행이 없어 정상 흐름으로는 재배 단계까지 갈 수 없다.
   * 그래서 필드 렌더·입력·카메라를 눈으로 확인할 방법이 없다.
   *
   * 가짜 습격 일정을 만들어 뚫지 않는다 (로드맵 3-1). 대신 이 통로를 명시적으로 부른다 —
   * `usePlaceholderStats()`와 같은 취급이다. 폴백이 아니라 선언이고, 부르지 않으면
   * 존재하지 않는다. **승인 데이터가 들어오면 호출부를 지운다.**
   *
   * `step`은 건드리지 않는다. 이건 런의 상태가 아니라 화면 미리보기다.
   */
  enterFieldPreview(mode: FieldMode): void
}

/**
 * 승인 데이터가 아직 없을 때의 흐름 근거.
 *
 * 임시 일정을 지어내지 않는다. 일차로 넘어가려는 순간 데이터 오류로 보고한다
 * (AGENTS.md 6절 — 누락을 코드 기본값으로 숨기지 않는다).
 */
const NO_SCHEDULE: FlowContext = {
  totalDays: 0,
  raidTypeOf: () => undefined,
}

export function createSceneManager(bus: EventBus, loop: GameLoop): SceneManager {
  let step: FlowStep = INITIAL_STEP
  let ctx: FlowContext = NO_SCHEDULE

  let screen: ScreenId | null = null
  let fieldMode: FieldMode | null = null
  const overlays: OverlayId[] = []

  function syncSimulation(): void {
    // 오버레이가 하나라도 열려 있으면 필드 시뮬레이션을 멈춘다.
    // 정지 대상은 이동·조준·공격·상호작용 입력, 주민 AI, 투사체, 상태이상 틱이다.
    if (overlays.length > 0) {
      loop.pause('dialogue')
      return
    }
    // 'dialogue' 사유만 지우면 안 된다. 포커스 이탈은 루프가 'focus_lost' 를 따로 걸고
    // 그것을 지우는 곳이 여기밖에 없어서, 알트탭 한 번이면 필드가 영구히 멈춘다.
    // 오버레이가 전부 닫혔다는 것은 곧 일시정지 화면도 닫혔다는 뜻이고,
    // 일시정지 화면이 포커스 이탈의 재개 경로다 (DEC-INPUT-009, DEC-UI-014).
    loop.resumeAll()
  }

  function enterScreen(next: ScreenId): void {
    if (fieldMode !== null) {
      fieldMode = null
      bus.emit('field.exited', {})
    }
    screen = next
    bus.emit('screen.changed', { screen: next })
  }

  function enterField(mode: FieldMode): void {
    screen = null
    if (fieldMode !== mode) {
      fieldMode = mode
      bus.emit('field.entered', { mode })
    }
  }

  function closeAllOverlays(): void {
    while (overlays.length > 0) {
      const closed = overlays.pop() as OverlayId
      bus.emit('overlay.closed', { overlay: closed })
    }
  }

  function apply(next: FlowStep): void {
    step = next
    // 층위가 바뀔 때 이전 오버레이를 남기지 않는다. 일시정지도 같이 닫힌다 —
    // 화면이 바뀌었는데 이전 화면의 일시정지가 떠 있으면 입력 소유가 어긋난다.
    closeAllOverlays()

    const view = presentationOf(next)
    if (view.layer === 'screen') {
      enterScreen(view.screen)
    } else {
      enterField(view.mode)
      if (view.overlay) pushOverlay(view.overlay)
    }
    syncSimulation()
  }

  function pushOverlay(overlay: OverlayId): void {
    if (overlays.includes(overlay)) return
    overlays.push(overlay)
    bus.emit('overlay.opened', { overlay })
  }

  function reportFlowError(message: string): void {
    closeAllOverlays()
    enterScreen('data_error')
    syncSimulation()
    bus.emit('data.error', { summary: '런 흐름을 진행할 수 없다', detail: message })
  }

  // 포커스를 잃으면 일시정지 오버레이를 연다 (DEC-INPUT-009).
  // 자동 재개는 하지 않는다 — 재개 확인 절차는 DEC-UI-022 가 보류다.
  bus.on('simulation.paused', () => {})

  const manager: SceneManager = {
    step: () => step,
    currentScreen: () => screen,
    currentFieldMode: () => fieldMode,
    openOverlays: () => [...overlays],

    send(input) {
      const result = advance(step, input, ctx)
      if (isFlowError(result)) {
        reportFlowError(result.error)
        return
      }
      apply(result)
    },

    openOverlay(overlay) {
      pushOverlay(overlay)
      syncSimulation()
    },

    closeOverlay(overlay) {
      const index = overlays.indexOf(overlay)
      if (index === -1) return
      overlays.splice(index, 1)
      bus.emit('overlay.closed', { overlay })
      syncSimulation()
    },

    handleEscape() {
      const top = overlays[overlays.length - 1]

      // 일시정지가 이미 떠 있으면 닫는다.
      if (top === 'pause') {
        manager.closeOverlay('pause')
        return
      }
      // 필수 대화는 Esc 로 닫지 않는다. 대화를 둔 채 일시정지만 겹친다.
      if (top !== undefined && !MANDATORY_OVERLAYS.has(top)) {
        manager.closeOverlay(top)
        return
      }
      manager.openOverlay('pause')
    },

    setContext(next) {
      ctx = next
    },

    enterFieldPreview(mode) {
      console.warn(
        '[개발 전용] 흐름을 건너뛰고 필드를 띄운다. run_schedules 승인 행이 없어 ' +
          '정상 흐름으로는 재배 단계에 갈 수 없기 때문이다. ' +
          '승인되면 enterFieldPreview() 호출을 지운다.',
      )
      closeAllOverlays()
      enterField(mode)
      syncSimulation()
    },
  }

  // 첫 화면을 실제로 반영한다. 생성만 하고 아무 이벤트도 안 나가면
  // UI 가 무엇을 그려야 할지 모른다.
  apply(INITIAL_STEP)

  return manager
}
