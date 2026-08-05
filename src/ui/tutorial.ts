// 튜토리얼 화면 (DEC-UI-015, DEC-RUN-003, DEC-CONTENT-023)
//
// ── 지금은 껍데기다. 그 사실을 화면이 말한다 ───────────────
//
// `DEC-UI-015` 가 **안내 문구를 코드에 두지 못하게** 확정했다 —
// `DEC-CONTENT-021` 이 정한 화면 고정 문구와 같은 방식으로 콘텐츠 데이터에서
// 공급한다. 그 테이블이 `tutorial_steps.csv` 인데 아직 작성 전이다
// (승인 CSV 38종 중 미작성 둘 중 하나).
//
// 그래서 이 화면은 **안내 없이 건너뛰기만** 제공한다. 임시 문구를 지어 넣지
// 않는다 — 넣으면 데이터가 왔을 때 두 벌이 되고, 어느 쪽이 승인본인지 흐려진다.
//
// **그래도 화면을 만든다.** 흐름에 `tutorial` 단계가 있으므로 넘길 수단이 없으면
// 완주가 여기서 끊긴다. 8/5까지는 개발 통로(`devSkipToFarming()`)가 대신 넘겼다.
//
// ── 데이터가 오면 채울 것 (DEC-UI-015) ─────────────────────
//
//   - 재배 → 전투 → 정비 순서로 안내하고, 각 안내는 해당 조작을 **실제로 성공하면**
//     다음으로 넘어간다 (`completion_key` 일곱 개를 코드가 판정한다, DEC-CONTENT-023)
//   - 남은 시간이나 제한을 표시하지 않는다
//   - 진행도는 현재 몇 번째 안내인지 알 수 있는 수준으로만 표시한다
//
// 튜토리얼은 본 런과 시간·체력·자원을 공유하지 않는다 (DEC-RUN-003). 종료할 때
// 그 사실을 알린다 — 아래 `NOTICE_TEXT` 가 그것이고, 이건 안내 문구가 아니라
// 시스템 규칙을 알리는 고정 문장이라 데이터 쪽으로 빼지 않았다.

import './layout.css'

export interface TutorialHandlers {
  /**
   * 튜토리얼을 건너뛰고 1일차로 간다 (DEC-UI-015).
   *
   * `DEC-UI-015` 는 "타이틀 또는 튜토리얼 시작 시점에 제공한다" 로 둘 중 하나를
   * 고르게 했고 이쪽을 골랐다 — 안내가 데이터 대기라 지금 이 화면에는 이 입력밖에
   * 없기 때문이다. 타이틀에 두면 타이틀의 "입력 하나" 규칙과 겹친다.
   */
  onSkip(): void
}

export interface TutorialScreen {
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

/** 튜토리얼 자원이 본 런에 반영되지 않는다는 알림 (DEC-UI-015, DEC-RUN-003) */
const NOTICE_TEXT = '튜토리얼에서 얻거나 쓴 것은 본 런에 넘어오지 않는다.'

/** 안내 문구가 승인 데이터 대기라는 사실. 임시 안내를 지어 넣지 않는다 */
const PENDING_TEXT = '안내 문구는 승인 데이터에서 온다. 아직 준비되지 않았다.'

const SKIP_LABEL = '건너뛰고 시작'

export function createTutorial(
  container: HTMLElement,
  handlers: TutorialHandlers,
): TutorialScreen {
  const root = el('div', 'tutorial')
  root.hidden = true

  const panel = el('div', 'tutorial__panel')
  const pending = el('p', 'tutorial__pending', PENDING_TEXT)
  const notice = el('p', 'tutorial__notice', NOTICE_TEXT)

  const skipButton = el('button', 'tutorial__skip', SKIP_LABEL)
  skipButton.type = 'button'
  skipButton.addEventListener('click', () => handlers.onSkip())

  panel.append(pending, notice, skipButton)
  root.appendChild(panel)
  container.appendChild(root)

  return {
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
