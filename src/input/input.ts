// 입력 계층 (DEC-INPUT-001 ~ 009, 012).
//
// 여기서 하는 일은 두 가지뿐이다.
//
//   1. 브라우저 이벤트를 게임 행동으로 바꾼다 (배치표는 bindings.ts)
//   2. 지금 입력을 받아도 되는지 판단한다
//
// 여기서 하지 않는 일: 이동 계산, 공격 판정, 자원 소비.
// 그건 전부 시스템 쪽이다. 입력은 "무엇을 눌렀나"만 알려준다.
//
// 보류라서 구현하지 않는 것:
//   DEC-INPUT-010 회피·대시·달리기
//   DEC-INPUT-011 투척 무기 연속 발사 — 왼쪽 클릭 1회당 투척 1회다 (DEC-INPUT-005)

import {
  KEY_BINDINGS,
  MOUSE_BINDINGS,
  QUICKSLOT_KEYS,
  RECOVER_LONG_PRESS_MS,
} from './bindings.ts'
import type { InputAction } from './bindings.ts'

/** 8방향 이동 입력. 정규화되어 있어 대각선도 크기가 1이다 (DEC-INPUT-002) */
export interface MoveVector {
  x: number
  y: number
}

export interface InputEvents {
  /** `E` (DEC-INPUT-003) */
  onInteract?(): void
  /** 왼쪽 클릭. 클릭 1회당 한 번만 온다 (DEC-INPUT-005) */
  onThrow?(): void
  /** 오른쪽 클릭 (DEC-INPUT-004) */
  onSickle?(): void
  /** `1~5` 직접 선택 (DEC-INPUT-006) */
  onQuickslotSelect?(index: number): void
  /** 휠. 수량이 남은 무기만 순환하는 것은 시스템 쪽 판단이다 */
  onQuickslotCycle?(direction: 1 | -1): void
  /**
   * `Q` 짧게.
   *
   * 회복 중이 아니면 사용 시작(`DEC-INPUT-008`), 회복 게이지가 진행 중이면
   * 자발적 취소다(`DEC-INPUT-012`). **어느 쪽인지는 입력이 판단하지 않는다** —
   * 진행 상태를 아는 것은 시스템이고, 입력은 "짧게 눌렸다"만 알린다.
   * 자발적 취소는 아이템을 소비하지 않고 선택도 유지한다.
   */
  onRecoverShortPress?(): void
  /** `Q` 길게 — 회복 퀵메뉴 열기 */
  onRecoverMenuOpen?(): void
  /** `Q` 뗌 — 퀵메뉴가 열려 있었으면 선택만 확정하고 소비하지 않는다 */
  onRecoverMenuClose?(): void
  /** `Esc` (DEC-INPUT-009, DEC-UI-014) */
  onEscape?(): void
}

export interface InputState {
  /** 현재 이동 입력 */
  move(): MoveVector
  /** 마우스 커서 방향(라디안). 투척·낫의 기준이다 (DEC-INPUT-002) */
  aimAngle(): number

  /**
   * 필드 입력 잠금.
   *
   * 재배·습격 단계에서만 이동과 전투 입력을 받는다. 대화·정비·결과·엔딩 화면에서는
   * 잠근다 (DEC-INPUT-009). 잠겨 있어도 `Esc`는 계속 받는다 — 어떤 화면에서도
   * 일시정지를 열 수 있어야 한다 (DEC-UI-014).
   */
  setFieldLocked(locked: boolean): void
  fieldLocked(): boolean

  /** 이벤트 구독 해제 */
  dispose(): void
}

/**
 * @param target 조준 좌표를 계산할 캔버스. 커서 위치를 이 요소 기준으로 읽는다
 */
export function createInput(
  target: HTMLElement,
  events: InputEvents,
  now: () => number = () => performance.now(),
): InputState {
  const held = new Set<InputAction>()
  let locked = false
  let angle = 0

  // Q 를 누른 시각. 뗄 때 짧게/길게를 가른다.
  let recoverPressedAt: number | null = null
  let recoverMenuOpen = false
  let recoverLongPressTimer = 0

  function actionOf(event: KeyboardEvent): InputAction | undefined {
    return KEY_BINDINGS[event.code]
  }

  function handleKeyDown(event: KeyboardEvent): void {
    // 브라우저 기본 동작(스페이스 스크롤 등)과 겹치지 않게 우리가 쓰는 키만 막는다.
    const action = actionOf(event)
    const quickslotIndex = QUICKSLOT_KEYS.indexOf(event.code)

    if (action === 'escape') {
      event.preventDefault()
      events.onEscape?.()
      return
    }

    // Esc 를 제외한 모든 필드 입력은 잠금에 걸린다.
    if (locked) return
    if (event.repeat) return

    if (quickslotIndex !== -1) {
      event.preventDefault()
      events.onQuickslotSelect?.(quickslotIndex)
      return
    }
    if (action === undefined) return

    event.preventDefault()
    held.add(action)

    if (action === 'interact') {
      events.onInteract?.()
      return
    }

    if (action === 'recover') {
      recoverPressedAt = now()
      // 길게 누르는 도중에 퀵메뉴가 열려야 한다. 뗄 때까지 기다리면
      // "누르고 있는 동안 감속"이라는 규칙이 성립하지 않는다.
      recoverLongPressTimer = window.setTimeout(() => {
        recoverMenuOpen = true
        events.onRecoverMenuOpen?.()
      }, RECOVER_LONG_PRESS_MS)
    }
  }

  function handleKeyUp(event: KeyboardEvent): void {
    const action = actionOf(event)
    if (action === undefined) return
    held.delete(action)

    if (action !== 'recover') return

    window.clearTimeout(recoverLongPressTimer)
    const pressedAt = recoverPressedAt
    recoverPressedAt = null

    if (recoverMenuOpen) {
      // 퀵메뉴에서 손을 떼면 선택만 바뀌고 즉시 소비하지 않는다 (DEC-INPUT-008).
      recoverMenuOpen = false
      events.onRecoverMenuClose?.()
      return
    }
    // 잠긴 사이에 눌린 적이 없으면 무시한다.
    if (pressedAt === null || locked) return
    events.onRecoverShortPress?.()
  }

  function handleMouseDown(event: MouseEvent): void {
    if (locked) return
    const action = MOUSE_BINDINGS[event.button]
    if (action === undefined) return

    // 마우스가 HUD·버튼 위에 있으면 필드 클릭 공격이 발생하지 않게 한다 (DEC-INPUT-009).
    // DOM 오버레이(#ui)가 이벤트를 먼저 받으므로, 캔버스에서 시작한 것만 통과시킨다.
    if (event.target !== target) return

    event.preventDefault()
    if (action === 'throw') events.onThrow?.()
    if (action === 'sickle') events.onSickle?.()
  }

  function handleMouseMove(event: MouseEvent): void {
    const rect = target.getBoundingClientRect()
    // 화면 중앙 = 플레이어라고 가정하지 않는다. 카메라가 정해지면
    // src/render/camera.ts 의 변환을 거친 값으로 바꾼다 (로드맵 9-1).
    angle = Math.atan2(
      event.clientY - (rect.top + rect.height / 2),
      event.clientX - (rect.left + rect.width / 2),
    )
  }

  function handleWheel(event: WheelEvent): void {
    if (locked) return
    event.preventDefault()
    events.onQuickslotCycle?.(event.deltaY > 0 ? 1 : -1)
  }

  // 낫이 오른쪽 클릭이라 컨텍스트 메뉴를 막아야 한다 (DEC-INPUT-004).
  function handleContextMenu(event: MouseEvent): void {
    event.preventDefault()
  }

  // 포커스를 잃으면 눌린 키가 계속 눌린 것으로 남는다. 돌아왔을 때 혼자 걸어간다.
  /**
   * 눌려 있던 키와 진행 중인 롱프레스를 비운다.
   *
   * **회복 퀵메뉴가 열려 있는지는 건드리지 않는다.** 그게 `handleBlur()` 와 다른
   * 점이고, 그 차이가 8/5에 실제 버그였다 — 아래 `setFieldLocked` 주석 참고.
   */
  function clearHeldKeys(): void {
    held.clear()
    window.clearTimeout(recoverLongPressTimer)
    recoverPressedAt = null
  }

  function handleBlur(): void {
    clearHeldKeys()
    // 창이 포커스를 잃으면 손을 뗀 것과 같다. 퀵메뉴는 누르고 있는 동안만 열린다.
    if (recoverMenuOpen) {
      recoverMenuOpen = false
      events.onRecoverMenuClose?.()
    }
  }

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('blur', handleBlur)
  window.addEventListener('mousemove', handleMouseMove)
  target.addEventListener('mousedown', handleMouseDown)
  target.addEventListener('contextmenu', handleContextMenu)
  target.addEventListener('wheel', handleWheel, { passive: false })

  return {
    move() {
      if (locked) return { x: 0, y: 0 }

      const x = (held.has('move_right') ? 1 : 0) - (held.has('move_left') ? 1 : 0)
      // 화면 좌표계라 아래가 +y 다.
      const y = (held.has('move_down') ? 1 : 0) - (held.has('move_up') ? 1 : 0)
      if (x === 0 && y === 0) return { x: 0, y: 0 }

      // 대각선 이동속도를 직선과 같게 보정한다 (DEC-INPUT-002).
      // 여기서 정규화하지 않으면 시스템마다 각자 보정하다가 빠뜨린다.
      const length = Math.hypot(x, y)
      return { x: x / length, y: y / length }
    },

    aimAngle: () => angle,

    setFieldLocked(next) {
      locked = next
      // 잠기는 순간 눌려 있던 키를 비운다. 대화가 끝나자마자 이동이 이어지면 안 된다.
      //
      // **`handleBlur()` 를 부르면 안 된다.** 그건 퀵메뉴까지 닫는데, 회복 퀵메뉴가
      // 열리면 그 자체로 오버레이가 생겨 여기가 `true` 로 불린다 — 열리자마자
      // 같은 틱에 닫혔다 (8/5 담당자 플레이 테스트). 눌린 키만 비운다.
      if (next) clearHeldKeys()
    },

    fieldLocked: () => locked,

    dispose() {
      window.clearTimeout(recoverLongPressTimer)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('mousemove', handleMouseMove)
      target.removeEventListener('mousedown', handleMouseDown)
      target.removeEventListener('contextmenu', handleContextMenu)
      target.removeEventListener('wheel', handleWheel)
    },
  }
}
