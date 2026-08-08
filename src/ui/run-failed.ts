// 런 실패 화면 (DEC-UI-023, DEC-UI-014, DEC-RUN-008)
//
// 재배·정비·습격 어디서든 체력이 0이 되면 진행 중인 화면과 무관하게 여기로 온다.
//
// ── 이 화면이 표시하지 않는 것 ─────────────────────────────
//
// `DEC-UI-023` 이 열거해서 금지했다. **엔딩 제목·엔딩 요약·기록문·대표 작물·런 통계**
// 를 넣지 않는다. 이유도 같은 결정에 적혀 있다 — 체력 0으로 실패한 런에는 엔딩 판정과
// 기록문 생성을 아예 실행하지 않기 때문이다. 없는 것을 화면이 지어낼 수 없다.
//
// 그래서 여기 있는 것은 셋뿐이다. 실패했다는 사실, 도달한 일차, 타이틀로 돌아가는 입력.
//
// ── 엔딩 화면과 클래스도 파일도 공유하지 않는다 ────────────
//
// `DEC-UI-014` 와 `DEC-UI-023` 이 둘 다 "분리해 구현하고 공유 템플릿으로 묶지 않는다"
// 로 확정했다. 지금 두 화면이 닮아 보이는 것은 둘 다 단순해서일 뿐이고, 묶으면
// 위 금지 목록이 엔딩 쪽 규칙에 섞여 들어간다.

import { applyHanjiPanel } from './panel.ts'
import './layout.css'

export interface RunFailedView {
  /** 실패한 시점에 도달해 있던 일차 (DEC-UI-023) */
  dayNumber: number
}

export interface RunFailedHandlers {
  /**
   * 타이틀로 돌아간다. **입력은 이것 하나뿐이다** (DEC-UI-023).
   * 런을 처음부터 다시 시작하는 별도 입력을 두지 않는다 (DEC-UI-027).
   */
  onReturnToTitle(): void
}

export interface RunFailedScreen {
  render(view: RunFailedView): void
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
 * 실패 사실과 진행 입력 문구.
 *
 * `DEC-UI-029` 의 구분 기준은 **그 문구를 바꾸면 플레이어의 선택이 달라지는가** 다.
 * 이 화면에는 입력이 하나뿐이라 어떤 문구를 써도 고를 것이 달라지지 않는다.
 * 그래서 라벨 갈래로 보고 코드에 둔다.
 *
 * 경계에 있는 판단이다 — 습격 예고나 밤 결과 문구와 달리 이 둘을 담을 승인 테이블이
 * 아직 없고, 만드는 것은 스키마 변경이다. 데이터 쪽으로 옮기기로 하면 이 두 상수와
 * `RunFailedView` 한 줄만 바뀐다.
 */
const FAILED_TEXT = '밭을 지키지 못했다.'
const RETURN_LABEL = '타이틀로'

/** 일차 숫자에 붙는 단위. 일차 시작 화면과 같은 이유로 코드에 둔다 */
const DAY_SUFFIX = '일차'

export function createRunFailed(
  container: HTMLElement,
  handlers: RunFailedHandlers,
): RunFailedScreen {
  const root = el('div', 'run-failed')
  root.hidden = true

  const panel = el('div', 'run-failed__panel')
  // 한지 판 (팀 결정 8/8 — CSS 로 뜨는 창은 전부 한지다)
  applyHanjiPanel(panel)
  const text = el('p', 'run-failed__text', FAILED_TEXT)
  const day = el('p', 'run-failed__day')

  const returnButton = el('button', 'run-failed__return', RETURN_LABEL)
  returnButton.type = 'button'
  returnButton.addEventListener('click', () => handlers.onReturnToTitle())

  panel.append(text, day, returnButton)
  root.appendChild(panel)
  container.appendChild(root)

  return {
    render(view) {
      day.textContent = `${view.dayNumber}${DAY_SUFFIX}`
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
