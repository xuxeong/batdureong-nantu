// 이름 입력 화면 (DEC-UI-030, DEC-UI-025)
//
// 여기서 받은 값이 런 상태의 `playerName` 이 되고, 엔딩 기록문과 일지 LLM 입력에
// `player_name` 으로 들어간다 (DEC-CONTENT-011, DEC-JOURNAL-002). 그래서 이 화면이
// 없는 동안은 **이름 없는 일지**가 생성되고 있었다.
//
// ── 확정된 제약 (DEC-UI-030) ───────────────────────────────
//
//   - 키보드로 입력한다. `DEC-UI-025` 의 마우스 전용 규칙에서 **제외**된다
//   - 이름이 비어 있으면 다음으로 진행할 수 없다
//   - 최대 길이를 제한한다
//   - 줄바꿈을 허용하지 않는다
//
// 그래서 `textarea` 가 아니라 `input` 이다 — 줄바꿈을 막는 규칙을 코드로 지키는
// 것보다 그것을 표현할 수 없는 요소를 쓰는 편이 어긋날 여지가 없다.
//
// ── 이름은 인용된 데이터다 ─────────────────────────────────
//
// 플레이어 이름은 LLM 프롬프트에 들어가지만 **지시로 읽지 않는 것은 시스템
// 지시문이 맡는다** (`schema/*_prompt_system.md`). 여기서 내용을 걸러내지 않는다 —
// 화면이 조용히 지우면 플레이어가 입력한 것과 기록된 것이 달라진다.

import { applyHanjiPanel } from './panel.ts'
import './layout.css'

export interface NameInputHandlers {
  /** 이름을 확정하고 다음으로 넘어간다. 비어 있으면 부르지 않는다 */
  onConfirm(name: string): void
}

export interface NameInputScreen {
  show(): void
  hide(): void
  destroy(): void
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className !== undefined) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/**
 * 최대 길이.
 *
 * **근거 없이 고른 값이다.** `DEC-UI-030` 는 "최대 길이를 제한한다" 고만 했고
 * 숫자를 정한 확정 DEC 가 없다. 게임 데이터(가격·확률·시간)가 아니라 입력 제약이라
 * 승인 CSV 로 빼지 않았다. 12 로 둔 이유는 플레이어 카드의 이름 자리와 일지 문장
 * 안에서 읽히는 길이라서다 (아트 디렉션 14.2). 확정되면 이 상수만 바꾼다.
 */
const MAX_NAME_LENGTH = 12

/**
 * 안내와 진행 입력 문구.
 *
 * `DEC-UI-029` 기준으로 갈래가 갈린다. 진행 버튼은 라벨이지만 **안내문은 정보를
 * 담는다** — 다만 이 화면에는 고를 것이 없고(입력 하나, 진행 하나) 문구를 바꿔도
 * 플레이어의 선택이 달라지지 않으므로 라벨 갈래로 봤다. 담을 승인 테이블도 없다.
 */
const PROMPT_TEXT = '이 밭을 지킬 사람의 이름'
const CONFIRM_LABEL = '확인'

export function createNameInput(
  container: HTMLElement,
  handlers: NameInputHandlers,
): NameInputScreen {
  const root = el('div', 'name-input')
  root.hidden = true

  const panel = el('div', 'name-input__panel')
  // 한지 판 (팀 결정 8/8 — CSS 로 뜨는 창은 전부 한지다)
  applyHanjiPanel(panel)
  const prompt = el('p', 'name-input__prompt', PROMPT_TEXT)

  // 줄바꿈을 표현할 수 없는 요소를 쓴다 (DEC-UI-030)
  const field = el('input', 'name-input__field')
  field.type = 'text'
  field.maxLength = MAX_NAME_LENGTH
  field.autocomplete = 'off'
  field.spellcheck = false

  const confirmButton = el('button', 'name-input__confirm', CONFIRM_LABEL)
  confirmButton.type = 'button'

  /** 이름이 비어 있으면 진행할 수 없다 (DEC-UI-030) */
  function trimmed(): string {
    return field.value.trim()
  }

  function syncEnabled(): void {
    confirmButton.disabled = trimmed().length === 0
  }

  function confirm(): void {
    const name = trimmed()
    // 버튼이 꺼져 있어도 Enter 로 들어올 수 있다. 두 경로가 같은 검사를 지난다.
    if (name.length === 0) return
    handlers.onConfirm(name)
  }

  field.addEventListener('input', syncEnabled)
  field.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return
    // 이 화면은 마우스 전용 규칙에서 빠져 있다 (DEC-UI-025). Enter 로도 넘어간다.
    event.preventDefault()
    confirm()
  })
  confirmButton.addEventListener('click', confirm)

  panel.append(prompt, field, confirmButton)
  root.appendChild(panel)
  container.appendChild(root)

  syncEnabled()

  return {
    show() {
      root.hidden = false
      // 새 런마다 처음부터 받는다. 이어하기가 없으므로 남은 값을 되살릴 이유가 없다
      field.value = ''
      syncEnabled()
      // 키보드 입력 화면이므로 바로 칠 수 있어야 한다
      field.focus()
    },

    hide() {
      root.hidden = true
    },

    destroy() {
      root.remove()
    },
  }
}
