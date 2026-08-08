// 키 바인딩.
//
// `DEC-INPUT-001` — 키 바인딩 값을 코드 여러 곳에 흩어놓지 않고 한 설정에서 교체할 수 있게 한다.
// 그래서 이 파일이 유일한 배치표다. 다른 파일에 `'KeyE'` 같은 문자열이 나오면 안 된다.
//
// 이건 게임 데이터가 아니라 조작 설정이라 CSV로 빼지 않는다 (화면 배율과 같은 취급).
// 반대로 이동속도·낫 사거리·쿨타임은 여기 오지 않는다 — player_base_stats 에서 온다.

/** 게임이 처리하는 행동. 키가 아니라 의미로 다룬다 */
export type InputAction =
  | 'move_up'
  | 'move_down'
  | 'move_left'
  | 'move_right'
  /** 씨앗 심기·수확 등 밭의 문맥 상호작용 (DEC-INPUT-003) */
  | 'interact'
  /** 선택한 투척 무기 사용 (DEC-INPUT-004) */
  | 'throw'
  /** 낫 공격 (DEC-INPUT-004) */
  | 'sickle'
  /** 짧게: 회복 사용 시작 / 길게: 회복 퀵메뉴 (DEC-INPUT-008) */
  | 'recover'
  /** 일시정지 또는 열려 있는 보조 UI 닫기 (DEC-INPUT-009) */
  | 'escape'

/** KeyboardEvent.code → 행동 */
export const KEY_BINDINGS: Readonly<Record<string, InputAction>> = {
  KeyW: 'move_up',
  KeyS: 'move_down',
  KeyA: 'move_left',
  KeyD: 'move_right',
  KeyE: 'interact',
  KeyQ: 'recover',
  Escape: 'escape',
}

/** MouseEvent.button → 행동 */
export const MOUSE_BINDINGS: Readonly<Record<number, InputAction>> = {
  0: 'throw', // 왼쪽
  2: 'sickle', // 오른쪽
}

/**
 * 투척 퀵슬롯 직접 선택 키. `1~4`가 해당 위치의 무기를 고른다 (DEC-INPUT-013).
 * 퀵슬롯은 4칸 고정이므로 길이가 곧 칸 수다.
 *
 * **칸 수의 원본은 `state/types.ts` 의 `THROWABLE_QUICKSLOT_COUNT` 다.** 키는
 * 배치표인 이 파일이 들고 있어야 해서(`DEC-INPUT-001`) 두 곳으로 갈리는데,
 * 갈린 채 어긋나면 없는 칸을 가리키는 키가 생긴다. 그래서 개수를 맞췄는지
 * `tests/quickslot-count.test.ts` 가 확인한다.
 */
export const QUICKSLOT_KEYS: readonly string[] = ['Digit1', 'Digit2', 'Digit3', 'Digit4']

/**
 * `Q`를 길게 눌렀다고 판정하는 시간.
 *
 * `DEC-INPUT-008`은 "짧게 누르면 사용, 길게 누르면 퀵메뉴"만 확정했고 경계값은
 * 정하지 않았다. 이건 밸런스가 아니라 조작 반응성이라 QA에서 손으로 맞추는 값이며,
 * 여기 한 곳에만 둔다.
 */
export const RECOVER_LONG_PRESS_MS = 250
