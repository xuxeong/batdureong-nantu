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
// 중첩 UI의 우선순위와 입력 소유권은 `DEC-UI-026`이 확정했다.
//
//   - 동시에 열리는 오버레이는 **기능 오버레이 하나 + 일시정지 하나**뿐이다
//   - 일시정지는 **항상 가장 위**에 온다
//   - 가장 위 오버레이가 입력을 독점하고 그 아래는 표시만 한다
//   - `Esc` 한 번은 **한 층만** 처리한다
//   - 포커스 이탈로 일시정지가 열릴 때 회복 퀵메뉴가 열려 있으면 퀵메뉴를 닫는다

import type { EventBus, FieldMode, OverlayId, ScreenId } from '../core/events.ts'
import type { GameLoop } from '../core/loop.ts'
import { advance, INITIAL_STEP, isFlowError } from './flow.ts'
import type { FlowContext, FlowInput, FlowStep } from './flow.ts'

/**
 * `Esc`로 닫을 수 있는 오버레이 (DEC-UI-022).
 *
 * **금지 목록이 아니라 허용 목록이다.** 확정 문구가 "`Esc`로 닫을 수 있는 오버레이는
 * 회복 퀵메뉴뿐"이라 이 방향이 원문 그대로다. 금지 목록으로 두면 오버레이가 늘 때마다
 * 넣는 것을 잊고, 잊으면 "닫히면 안 되는 것이 닫히는" 쪽으로 틀린다.
 * 정비 허브가 실제로 그렇게 닫히고 있었다 — `DEC-RUN-006`은 하단 진행 버튼으로만
 * 종료한다고 정해 두었다.
 *
 * 일시정지는 여기 없다. 자기 자신을 닫는 경로가 따로 있다.
 */
const ESC_CLOSABLE_OVERLAYS: ReadonlySet<OverlayId> = new Set(['recovery_quickmenu'])

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
   * 지금 입력을 소유한 오버레이. 없으면 null 이고 그때는 필드가 입력을 갖는다.
   *
   * 가장 위 오버레이가 입력을 독점하고 그 아래 층위는 표시만 한다 (DEC-UI-026).
   * UI 는 이 값으로 자기 차례인지 판단한다 — 각자 "내가 열려 있나" 를 보면
   * 겹쳤을 때 둘 다 입력을 받는다.
   */
  inputOwner(): OverlayId | null

  /** 브라우저 포커스를 잃었을 때 (DEC-UI-022, DEC-UI-026) */
  handleFocusLost(): void
}

/**
 * 승인 데이터가 아직 없을 때의 흐름 근거.
 *
 * 임시 일정을 지어내지 않는다. 일차로 넘어가려는 순간 데이터 오류로 보고한다
 * (AGENTS.md 6절 — 누락을 코드 기본값으로 숨기지 않는다).
 */
/**
 * 회복 퀵메뉴가 열려 있는 동안의 게임 속도 (DEC-INPUT-008).
 *
 * **근거 없이 고른 값이다.** 확정문은 "크게 낮춘다" 로만 정했고 배율을 정한 DEC 가
 * 없다. 표현이지 게임 데이터가 아니므로 CSV 로 빼지 않는다 (로드맵 2절).
 * 0.15 는 2.5초짜리 회복을 고르는 동안 주민이 한 대도 못 때리는 정도다.
 */
const QUICKMENU_TIME_SCALE = 0.15

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
    // **회복 퀵메뉴만 예외다.** `DEC-INPUT-008` 이 퀵메뉴에 대해서만
    // *"플레이어, 적, 투사체, 전투 타이머를 포함한 게임 전체의 속도를 함께 크게
    // 낮춘다"* 로 정했다 — 정지가 아니라 감속이다. 다른 오버레이와 같이 멈추면
    // 그 확정문이 무의미해지고, 퀵메뉴를 여는 것이 곧 무적 시간이 된다.
    //
    // 일시정지가 겹쳐 있으면 정지가 이긴다. 일시정지는 항상 최상위다 (DEC-UI-026).
    const onlyQuickmenu =
      overlays.length === 1 && overlays[0] === 'recovery_quickmenu'

    if (onlyQuickmenu) {
      loop.resumeAll()
      loop.setTimeScale(QUICKMENU_TIME_SCALE)
      return
    }

    loop.setTimeScale(1)

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

  /**
   * 오버레이를 연다.
   *
   * **일시정지는 항상 마지막(가장 위)에 둔다** (DEC-UI-026). 단순 append 로 두면
   * 일시정지가 떠 있는 동안 대화가 열릴 때 대화가 위로 올라가고, 그러면
   * `handleEscape()` 와 입력 소유권이 둘 다 어긋난다. 지금 흐름에서는 그 순서가
   * 안 나오지만 8/4에 대화 모달이 붙으면 나올 수 있는 순서다.
   */
  function pushOverlay(overlay: OverlayId): void {
    if (overlays.includes(overlay)) return

    // 기능 오버레이 둘이 동시에 열리는 경우를 만들지 않는다 (DEC-UI-026).
    // 조용히 바꿔치기하면 아래 오버레이의 상태가 사라지고, 그 사라짐은 화면에서
    // "왜 갑자기 정비가 닫혔지" 로만 보인다. 열지 않고 알린다.
    if (overlay !== 'pause') {
      const open = overlays.find((o) => o !== 'pause')
      if (open !== undefined) {
        console.warn(
          `[화면] ${open} 이(가) 열려 있어 ${overlay} 를 열지 않았다. ` +
            '기능 오버레이는 동시에 하나뿐이다 (DEC-UI-026).',
        )
        return
      }
      // 일시정지 아래로 넣는다
      const pauseIndex = overlays.indexOf('pause')
      if (pauseIndex !== -1) {
        overlays.splice(pauseIndex, 0, overlay)
        bus.emit('overlay.opened', { overlay })
        return
      }
    }

    overlays.push(overlay)
    bus.emit('overlay.opened', { overlay })
  }

  function reportFlowError(message: string): void {
    closeAllOverlays()
    enterScreen('data_error')
    syncSimulation()
    bus.emit('data.error', { summary: '런 흐름을 진행할 수 없다', detail: message })
  }

  // 포커스를 잃으면 일시정지 오버레이를 연다 (DEC-INPUT-009, DEC-UI-022).
  // 포커스가 돌아와도 자동 재개하지 않는다. 플레이어가 직접 재개한다.
  bus.on('simulation.paused', () => {})

  const manager: SceneManager = {
    step: () => step,
    currentScreen: () => screen,
    currentFieldMode: () => fieldMode,
    openOverlays: () => [...overlays],
    inputOwner: () => overlays[overlays.length - 1] ?? null,

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
      // `Esc` 한 번은 한 층만 처리한다 (DEC-UI-026).
      // 확정문 순서를 그대로 옮긴다 — "회복 퀵메뉴가 열려 있으면 그것만 닫고,
      // 열려 있지 않으면 일시정지를 열거나 닫는다".
      for (const closable of ESC_CLOSABLE_OVERLAYS) {
        if (overlays.includes(closable)) {
          manager.closeOverlay(closable)
          return
        }
      }
      // 정비 허브·전투 전 대화·투항 대화는 Esc 로 닫지 않는다.
      // 그대로 둔 채 일시정지만 겹친다 (DEC-UI-022).
      if (overlays.includes('pause')) {
        manager.closeOverlay('pause')
        return
      }
      manager.openOverlay('pause')
    },

    handleFocusLost() {
      // 포커스를 잃어 일시정지가 자동으로 열릴 때 회복 퀵메뉴가 열려 있으면
      // 퀵메뉴를 닫는다 (DEC-UI-026). 선택된 회복 아이템은 런 상태에 있으므로
      // 여기서 건드리지 않아도 유지된다 (DEC-RESOURCE-017).
      manager.closeOverlay('recovery_quickmenu')
      manager.openOverlay('pause')
    },

    setContext(next) {
      ctx = next
    },

  }

  // 첫 화면을 실제로 반영한다. 생성만 하고 아무 이벤트도 안 나가면
  // UI 가 무엇을 그려야 할지 모른다.
  apply(INITIAL_STEP)

  return manager
}
