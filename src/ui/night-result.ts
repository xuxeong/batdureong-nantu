// 밤 결과 화면 (DEC-RUN-015, DEC-UI-023, DEC-UI-014)
//
// 습격이 없는 날 정비를 종료(`아침까지 잔다`)하면 셔터를 걷지 않은 채 이 화면으로
// 전환한다. 조우 결과와 같은 층위이고 **하루에 하나만** 나타난다.
//
// ── 이 화면이 표시하지 않는 것 ─────────────────────────────
//
// `DEC-UI-023` 이 "밤 결과에는 승인된 고정 문구만 표시한다"고 확정했다. 그날의
// 수확량·자원 변화·조우 결과 같은 실제 플레이 기록을 넣지 않는다. 일차 숫자도 넣지
// 않았다 — 확정 문구가 "고정 문구만"이라 진행 정보를 덧붙일 근거가 없다.
// HUD 가 일차를 이미 표시하므로 화면에서 사라지는 정보도 아니다.
//
// ── 문구를 고르는 방식이 아직 없다 (DEC-CONTENT-018 보류) ──
//
// `DEC-RUN-015` 는 "고정 문구의 실제 목록과 선택 방식은 후속 콘텐츠 기획에서 정한다"
// 로 남겨 두었고 그 후속이 `DEC-CONTENT-018`(보류)이다. 그래서 승인 행이 여럿이면
// 코드가 고를 근거가 없다. 첫 행을 쓰거나 무작위로 뽑으면 그 순간 코드가 보류 결정을
// 대신 확정하는 것이 된다 (AGENTS.md 2절). 아래 `selectNightResultText()` 는
// **행이 정확히 하나일 때만** 문구를 돌려주고, 그 외에는 이유를 돌려준다.
//
// 이 파일은 화면만 만든다. 흐름 전진은 호출하는 쪽이 한다.

import type { NightResultText } from '../data/types.ts'
import './layout.css'

export interface NightResultView {
  /** night_result_texts.text. 승인 문구를 그대로 쓴다 */
  text: string
}

export interface NightResultHandlers {
  /**
   * 다음 일차로 넘어가는 진행 입력. **하나뿐이다** (DEC-UI-023).
   * 뒤로 가거나 다시 보는 수단을 두지 않는다.
   */
  onContinue(): void
}

export interface NightResultScreen {
  render(view: NightResultView): void
  show(): void
  hide(): void
  destroy(): void
}

export type NightResultSelection =
  | { ok: true; text: string }
  | { ok: false; reason: string }

/**
 * 승인된 밤 결과 문구를 고른다.
 *
 * 행이 정확히 하나일 때만 성공한다. 0행이면 표시할 승인 문구가 없는 것이고,
 * 2행 이상이면 **선택 방식이 미확정**이라 코드가 고를 수 없다 (DEC-CONTENT-018 보류).
 * 둘 다 데이터 오류로 올려 화면에 드러낸다 (DEC-UI-024, AGENTS.md 6절).
 */
export function selectNightResultText(
  rows: readonly NightResultText[] | undefined,
): NightResultSelection {
  const approved = rows ?? []

  if (approved.length === 0) {
    return {
      ok: false,
      reason:
        'night_result_texts 에 승인 행이 없다. 밤 결과는 승인된 고정 문구만 ' +
        '표시하므로 코드가 문장을 만들지 않는다 (DEC-RUN-015)',
    }
  }

  if (approved.length > 1) {
    return {
      ok: false,
      reason:
        `night_result_texts 승인 행이 ${approved.length} 개다. 여러 문구 중 무엇을 ` +
        '고를지가 DEC-CONTENT-018 보류라 코드가 고를 근거가 없다. 한 행만 승인하거나 ' +
        '선택 방식을 확정한다',
    }
  }

  return { ok: true, text: approved[0].text }
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
 * 진행 버튼 문구.
 *
 * **근거 없이 고른 값이다.** `DEC-RUN-006` 이 정비 종료 버튼의 두 문구를 정한 것과
 * 달리, 결과 화면의 진행 입력 문구를 정한 확정 DEC 가 없다. `main.ts` 주석이 이미
 * `확인` 을 전제로 적혀 있어 거기 맞췄다. 확정되면 이 상수만 바꾼다.
 */
const CONTINUE_LABEL = '확인'

export function createNightResult(
  container: HTMLElement,
  handlers: NightResultHandlers,
): NightResultScreen {
  const root = el('div', 'night-result')
  root.hidden = true

  const panel = el('div', 'night-result__panel')
  const text = el('p', 'night-result__text')

  const continueButton = el('button', 'night-result__continue', CONTINUE_LABEL)
  continueButton.type = 'button'
  continueButton.addEventListener('click', () => handlers.onContinue())

  panel.append(text, continueButton)
  root.appendChild(panel)
  container.appendChild(root)

  return {
    render(view) {
      text.textContent = view.text
    },

    show() {
      root.hidden = false
    },

    hide() {
      root.hidden = true
    },

    destroy() {
      root.remove()
    },
  }
}
