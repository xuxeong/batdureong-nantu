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
// ── 문구는 승인 행 중 무작위 하나다 (DEC-CONTENT-018, 8/5 확정) ──
//
// 8/4까지는 `DEC-CONTENT-018` 이 보류라 **행이 정확히 하나일 때만** 문구를 돌려주고
// 여럿이면 데이터 오류로 올렸다. 코드가 고르면 그 순간 보류 결정을 대신 확정하는
// 것이었기 때문이다. 8/5에 *"승인 문구 중 무작위"* 로 확정되면서 그 가드가 규칙과
// 반대가 됐다 — 이제 행을 늘리는 것이 정상이고 막으면 안 된다.
//
// **행 수와 무관하게 같은 규칙을 쓴다.** 한 행이면 그 행이 항상 뽑히므로 행이
// 늘거나 줄어도 코드를 고치지 않는다 (같은 결정).
//
// 순환은 후보에서 빠졌다. `DEC-UI-030` 가 이어하기와 저장 슬롯을 두지 않기로 확정해
// 런 사이에 진행 위치를 보관할 데가 없고, 매 런 처음으로 돌아가면 고정과 같아진다.
//
// 이 파일은 화면만 만든다. 흐름 전진은 호출하는 쪽이 한다.

import type { NightResultText } from '../data/types.ts'
import { applyHanjiPanel } from './panel.ts'
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
 * 승인된 밤 결과 문구 중 하나를 무작위로 고른다 (DEC-CONTENT-018).
 *
 * **부르는 쪽이 화면을 열 때 한 번만 부른다.** 같은 화면이 열려 있는 동안 다시
 * 고르지 않는다는 것이 확정 규칙이라, 이 함수를 매 프레임 부르면 문구가 깜빡인다.
 *
 * 0행이면 실패다. 밤 결과는 승인된 고정 문구만 표시하므로 코드가 문장을 만들지
 * 않는다 (DEC-RUN-015). 데이터 오류로 올려 화면에 드러낸다 (DEC-UI-024).
 *
 * @param random 0 이상 1 미만. 테스트에서 고정하려고 받는다
 */
export function selectNightResultText(
  rows: readonly NightResultText[] | undefined,
  random: () => number = Math.random,
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

  // 행이 하나면 그 행이 항상 뽑힌다. 그래서 행 수로 갈래를 나누지 않는다.
  const index = Math.min(approved.length - 1, Math.floor(random() * approved.length))
  return { ok: true, text: approved[index].text }
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
  // 한지 판 (팀 결정 8/8 — CSS 로 뜨는 창은 전부 한지다)
  applyHanjiPanel(panel)
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
