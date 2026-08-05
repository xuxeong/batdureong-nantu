// 튜토리얼 안내 (DEC-UI-030, DEC-RUN-003, DEC-CONTENT-025)
//
// ── 독립 화면이 아니라 필드 위 안내다 ─────────────────────
//
// `DEC-UI-030` 과 `DEC-RUN-003` 이 *"각 안내는 해당 조작을 **실제로 성공하면**
// 다음으로 넘어간다"* 로 확정했다. 글자만 있는 화면에서는 심을 밭도 팔 상점도
// 없으므로, 튜토리얼은 **재배 필드 위에 안내가 얹힌 상태**다.
//
// 개발 로드맵 3-2 는 튜토리얼을 독립 화면으로 분류했는데 그건 8/1에 쓴 것이고
// 튜토리얼의 조작 조건이 정해지기 전이다. `DEC-UI-014` 는 화면 목록에 이름만
// 올렸을 뿐 필드를 못 쓴다고 하지 않았다.
//
// ── `scenes` 오버레이로 등록하지 않는다 ────────────────────
//
// 등록하면 `syncSimulation()` 이 필드를 멈춘다. 그러면 심어도 자라지 않고 안내를
// 영영 넘길 수 없다. 정비 허브 안쪽 팝업이 오버레이가 아닌 것과 같은 이유다
// (`DEC-UI-020`, 로드맵 8/4).
//
// 그래서 **입력을 가로채지 않는다.** 판 전체는 `pointer-events: none` 이고
// 버튼만 되살린다 — 안내가 밭 클릭을 먹으면 조작을 성공할 수 없다.
//
// ── 표시하지 않는 것 ───────────────────────────────────────
//
//   - 남은 시간이나 제한 (`DEC-UI-030`, `DEC-RUN-003` — 시간제한이 없다)
//   - 진행도는 "현재 몇 번째인지 알 수 있는 수준" 까지만. 남은 개수를 강조하거나
//     막대로 그리지 않는다

import './layout.css'

export interface TutorialView {
  /** `guide_text`. 승인 데이터에서만 온다 (DEC-UI-030) */
  guideText: string
  /** 1부터 */
  position: number
  total: number
}

export interface TutorialHandlers {
  /**
   * 튜토리얼 전체를 건너뛴다 (DEC-UI-030).
   *
   * 확정문이 "타이틀 또는 튜토리얼 시작 시점" 중 하나를 고르게 했고 이쪽을 골랐다 —
   * 타이틀에 두면 타이틀의 "입력 하나" 규칙과 겹친다.
   */
  onSkip(): void
  /** 종료 알림을 읽고 1일차로 간다 */
  onContinue(): void
}

export interface TutorialScreen {
  render(view: TutorialView): void
  /**
   * 마지막 안내까지 끝났음을 알린다 (DEC-UI-030, DEC-RUN-003).
   *
   * *"튜토리얼에서 얻거나 쓴 자원이 본 런에 반영되지 않는다는 것을 튜토리얼
   * 종료 시 알린다"* — 그래서 이건 안내가 아니라 종료 알림이고 진행 입력이 하나 있다.
   */
  showFinished(): void
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

/** 튜토리얼 자원이 본 런에 반영되지 않는다는 알림 (DEC-UI-030, DEC-RUN-003) */
const NOTICE_TEXT = '튜토리얼에서 얻거나 쓴 것은 본 런에 넘어오지 않는다.'

/**
 * 아래 셋은 `DEC-UI-029` 의 두 번째 갈래다 — 누르면 무엇이 되는지 외에 아무
 * 정보도 담지 않는다. 안내 문구(`guide_text`)만 승인 데이터에서 온다.
 */
const SKIP_LABEL = '건너뛰고 시작'
const FINISHED_TITLE = '튜토리얼 끝'
const CONTINUE_LABEL = '1일차 시작'

export function createTutorial(
  container: HTMLElement,
  handlers: TutorialHandlers,
): TutorialScreen {
  const root = el('div', 'tutorial')
  root.hidden = true

  // ── 진행 중 안내 ────────────────────────────────
  const guide = el('div', 'tutorial__guide')
  const progress = el('div', 'tutorial__progress')
  const text = el('p', 'tutorial__text')

  const skipButton = el('button', 'tutorial__skip', SKIP_LABEL)
  skipButton.type = 'button'
  skipButton.addEventListener('click', () => handlers.onSkip())

  guide.append(progress, text)
  // 건너뛰기는 안내판 밖이다 — 판 안에 두면 밭을 향한 좌클릭 자리를 차지한다
  root.appendChild(skipButton)

  // ── 종료 알림 ───────────────────────────────────
  const finished = el('div', 'tutorial__finished')
  const continueButton = el('button', 'tutorial__continue', CONTINUE_LABEL)
  continueButton.type = 'button'
  continueButton.addEventListener('click', () => handlers.onContinue())
  finished.append(
    el('h2', 'tutorial__finished-title', FINISHED_TITLE),
    el('p', 'tutorial__notice', NOTICE_TEXT),
    continueButton,
  )
  finished.hidden = true

  root.append(guide, finished)
  container.appendChild(root)

  return {
    render(view) {
      // 진행도는 몇 번째인지까지만 (DEC-UI-030). 막대나 남은 개수를 그리지 않는다.
      progress.textContent = `${view.position} / ${view.total}`
      text.textContent = view.guideText

      guide.hidden = false
      finished.hidden = true
      skipButton.hidden = false
      root.hidden = false
    },

    showFinished() {
      guide.hidden = true
      finished.hidden = false
      // 끝난 뒤에는 건너뛸 것이 없다. 남겨 두면 종료 알림 위에 떠 있다.
      skipButton.hidden = true
      root.hidden = false
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
