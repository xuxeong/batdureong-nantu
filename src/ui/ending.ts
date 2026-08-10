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

import { CUTSCENE_GLOBAL_FALLBACK, UI_ASSET, assetCssUrl } from '../render/assets.ts'
import { applyHanjiPanel } from './panel.ts'
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
  /**
   * 이 엔딩의 컷신 `asset.cutscene.*` — `endings.json` 의 `assets.cutscene` 이다
   * (연결 행은 8/10 에 승인됐다). **안 넘기면 공용 폴백 컷신이 배경이 된다** —
   * 화면은 자기가 어느 엔딩인지 모르므로 고르는 것은 부르는 쪽 몫이다.
   *
   * 옵셔널인 이유: 이 값을 채우는 곳이 main.ts(A 구역)라 8/10 폴리싱 분배상
   * 이 파일에서 채울 수 없다. 한 줄(`cutsceneAsset: ending.assets?.cutscene`)이
   * 인계 대상이다.
   */
  cutsceneAsset?: string | null
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

  // ── A8 목업 배치 (8/10) ──────────────────────────
  //
  // 대자보 그림이 있으면 한지 판을 버리고 목업대로 편다 — 왼쪽에 제목·요약,
  // 오른쪽 대자보의 흰 종이 위에 기록문이 **적힌다.** 판 안에 글이 뜨는 것과
  // 대자보에 글이 적히는 것은 다른 화면이다 (담당자 8/10 — "대자보에 적히도록").
  //
  // 그림이 없으면 기존 한지 판이 플레이스홀더로 남는다.
  const boardUrl = assetCssUrl(UI_ASSET.endingRecordBoard)
  if (boardUrl !== null) {
    root.classList.add('ending--board')
    root.style.setProperty('--ending-board', boardUrl)
  } else {
    // 한지 판 (팀 결정 8/8 — CSS 로 뜨는 창은 전부 한지다)
    applyHanjiPanel(panel)
  }

  const title = el('h1', 'ending__title')
  const summary = el('p', 'ending__summary')
  const record = el('p', 'ending__record')

  // 개발 빌드에서만 붙였다 뗀다. 제출 빌드에서는 DOM 에 존재하지도 않는다.
  const fear = el('p', 'ending__fear')

  const returnButton = el('button', 'ending__return', RETURN_LABEL)
  returnButton.type = 'button'
  // 대자보 배치에서는 목업의 나무 팻말이다 (A8 왼쪽 아래)
  if (boardUrl !== null) {
    const signUrl = assetCssUrl(UI_ASSET.buttonNormal)
    if (signUrl !== null) returnButton.style.setProperty('--ending-button-image', signUrl)
  }
  returnButton.addEventListener('click', () => handlers.onReturnToTitle())

  panel.append(title, summary, record, returnButton)
  root.appendChild(panel)
  container.appendChild(root)

  return {
    render(view) {
      // 컷신이 배경이다 (8/9 폴리싱 — 목업의 "cutscene 이 bg 비슷한 역할").
      // 엔딩별 그림이 안 넘어오면 공용 폴백 컷신으로 떨어진다. 그것마저 없으면
      // 클래스가 안 붙고 기존 어두운 배경이 남는다.
      const cutsceneUrl =
        assetCssUrl(view.cutsceneAsset) ?? assetCssUrl(CUTSCENE_GLOBAL_FALLBACK)
      root.classList.toggle('ending--has-art', cutsceneUrl !== null)
      if (cutsceneUrl !== null) root.style.setProperty('--ending-cutscene', cutsceneUrl)

      title.textContent = view.title
      summary.textContent = view.summary

      // 대기 표시와 완성 기록문이 같은 자리를 쓴다 (DEC-UI-023).
      record.textContent =
        view.record.state === 'pending' ? RECORD_PENDING_LABEL : view.record.text
      record.classList.toggle('ending__record--pending', view.record.state === 'pending')

      /*
        기록문이 오는 동안 타이틀로 못 돌아가게 한다.

        아침 일지와 달리 여기서 넘어가면 **런이 끝난다.** 다시 볼 방법이 없으므로
        기다리지 않고 누르면 그 판의 엔딩 기록문을 영영 못 본다.

        생성 실패도 승인된 `fallback_record_text` 로 즉시 `ready` 가 되므로
        (`DEC-CONTENT-011`) 잠기는 것은 생성이 진행 중인 동안뿐이다.
      */
      returnButton.disabled = view.record.state === 'pending'

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
