// 엔딩 화면 (DEC-UI-023, DEC-UI-014, DEC-CONTENT-011)
//
// 마지막 습격의 조우 결과에서 넘어온다. 시스템이 엔딩을 먼저 확정한 뒤에만 열린다.
//
// ── 무엇을 표시하나 (DEC-UI-023) ───────────────────────────
//
// 엔딩 제목, 확정된 엔딩 요약, 생성된 기록문 셋이다.
//   - 제목과 요약은 승인 데이터(`endings.csv`)에서 온다. 화면이 만들지 않는다.
//   - 기록문은 LLM 이 쓰거나 승인된 `fallback_record_text` 다. **둘을 시각적으로
//     구분하지 않는다** — 그래서 `EndingRecordView` 에 폴백 여부가 없다.
//   - 생성 중에는 이 화면 안에서 대기 표시만 한다. 재시도 중이라는 사실은 노출하지
//     않는다 (DEC-UI-024).
//
// **기록문을 다시 생성하는 입력을 두지 않는다** (DEC-UI-023).
// **지난 일지를 회고로 다시 보여주지 않는다** (DEC-UI-028).
//
// ── 공포도는 개발 빌드에서만 ───────────────────────────────
//
// `DEC-RESIDENT-047` 이 "엔딩 화면에서도 제출 빌드에서는 공포도 수치와 구간 이름을
// 표시하지 않는다"로 확정했다. 제출 빌드에서는 `fear` 가 null 이고 이 화면은 그때
// 구획 자체를 만들지 않는다 — 조우 결과와 같은 방식이다.
//
// 런 실패 화면과 클래스도 파일도 공유하지 않는다 (DEC-UI-014, DEC-UI-023).

import './layout.css'

/**
 * 기록문 영역의 상태.
 *
 * 폴백인지 아닌지가 없다. `DEC-UI-023` 과 `DEC-UI-024` 가 둘 다 구분하지 말라고
 * 확정했으므로 **화면이 그 사실을 알 필요가 없다.** 받지 않으면 실수로 구분할 수도 없다.
 */
export type EndingRecordView = { state: 'pending' } | { state: 'ready'; text: string }

/** 개발 빌드 전용 공포도 표시 (DEC-RESIDENT-047). 제출 빌드에서는 view.fear 가 null 이다 */
export interface EndingFearView {
  total: number
  /** fear_bands.display_name. 구간을 못 찾았으면 null */
  bandName: string | null
}

export interface EndingView {
  /** endings.ending_title */
  title: string
  /** endings.ending_summary */
  summary: string
  record: EndingRecordView
  fear: EndingFearView | null
}

export interface EndingHandlers {
  /**
   * 타이틀로 돌아간다. **입력은 이것 하나뿐이다.**
   * 기록문 재생성도(DEC-UI-023), 런 재시작도(DEC-UI-027) 두지 않는다.
   */
  onReturnToTitle(): void
}

export interface EndingScreen {
  render(view: EndingView): void
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
 * 진행 입력과 대기 표시 문구.
 *
 * `DEC-UI-029` 의 라벨 갈래다 — 이 화면에는 입력이 하나뿐이라 문구를 바꿔도
 * 플레이어가 고를 것이 달라지지 않는다.
 */
const RETURN_LABEL = '타이틀로'
const RECORD_PENDING_LABEL = '기록을 남기는 중…'

export function createEnding(container: HTMLElement, handlers: EndingHandlers): EndingScreen {
  const root = el('div', 'ending')
  root.hidden = true

  const panel = el('div', 'ending__panel')

  const title = el('h1', 'ending__title')
  const summary = el('p', 'ending__summary')
  const record = el('p', 'ending__record')

  // 개발 빌드에서만 붙였다 뗀다. 제출 빌드에서는 DOM 에 존재하지도 않는다.
  const fear = el('p', 'ending__fear')

  const returnButton = el('button', 'ending__return', RETURN_LABEL)
  returnButton.type = 'button'
  returnButton.addEventListener('click', () => handlers.onReturnToTitle())

  panel.append(title, summary, record, returnButton)
  root.appendChild(panel)
  container.appendChild(root)

  return {
    render(view) {
      title.textContent = view.title
      summary.textContent = view.summary

      // 대기 표시와 완성 기록문이 같은 자리를 쓴다 (DEC-UI-023).
      record.textContent =
        view.record.state === 'pending' ? RECORD_PENDING_LABEL : view.record.text
      record.classList.toggle('ending__record--pending', view.record.state === 'pending')

      if (view.fear === null) {
        fear.remove()
        return
      }

      fear.textContent = `[개발] 공포도 ${view.fear.total} · ${view.fear.bandName ?? '구간 없음'}`
      if (fear.parentElement === null) panel.insertBefore(fear, returnButton)
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
