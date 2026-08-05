// 타이틀 화면 (DEC-UI-015, DEC-UI-014)
//
// 런의 시작점이고, 런 실패나 엔딩에서 돌아오는 곳이기도 하다.
//
// ── 입력이 하나뿐이다 (DEC-UI-015) ─────────────────────────
//
// **새 런을 시작하는 입력만 둔다.** 이어하기와 저장 슬롯을 두지 않는다고 확정했다.
// 그 결정이 다른 곳까지 정리했다 — 밤 결과 문구의 순환 선택이 후보에서 빠진 것도
// 런 사이에 진행 위치를 보관할 데가 없어서다 (DEC-CONTENT-018).
//
// **튜토리얼 건너뛰기는 여기 없다.** `DEC-UI-015` 가 "타이틀 또는 튜토리얼 시작
// 시점에 제공한다" 로 둘 중 하나를 고르게 했고 튜토리얼 화면 쪽을 골랐다 —
// 안내 문구가 데이터 대기라 그 화면이 지금은 건너뛰기만 있는 상태이기 때문이다.
//
// 이 파일은 화면만 만든다. 런 상태를 새로 만드는 것은 호출하는 쪽이 한다 (로드맵 9-5).

import './layout.css'

export interface TitleHandlers {
  /** 새 런을 시작한다. **입력은 이것 하나뿐이다** (DEC-UI-015) */
  onStart(): void
}

export interface TitleScreen {
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
 * 게임 제목과 시작 입력.
 *
 * 제목은 게임 데이터가 아니라 제품 이름이라 코드에 둔다. 로고 에셋(`asset.logo.*`)
 * 으로 바뀔 자리이며 그 교체는 아트 통합에서 한다 (로드맵 8번).
 *
 * `시작` 은 `DEC-UI-029` 의 라벨 갈래다 — 이 화면에는 입력이 하나뿐이라 문구를
 * 바꿔도 플레이어가 고를 것이 달라지지 않는다.
 */
const GAME_TITLE = '밭두렁난투'
const START_LABEL = '시작'

export function createTitle(container: HTMLElement, handlers: TitleHandlers): TitleScreen {
  const root = el('div', 'title')
  root.hidden = true

  const panel = el('div', 'title__panel')
  const heading = el('h1', 'title__name', GAME_TITLE)

  const startButton = el('button', 'title__start', START_LABEL)
  startButton.type = 'button'
  startButton.addEventListener('click', () => handlers.onStart())

  panel.append(heading, startButton)
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
