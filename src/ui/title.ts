// 타이틀 화면 (DEC-UI-030, DEC-UI-014)
//
// 런의 시작점이고, 런 실패나 엔딩에서 돌아오는 곳이기도 하다.
//
// ── 입력이 하나뿐이다 (DEC-UI-030) ─────────────────────────
//
// **새 런을 시작하는 입력만 둔다.** 이어하기와 저장 슬롯을 두지 않는다고 확정했다.
// 그 결정이 다른 곳까지 정리했다 — 밤 결과 문구의 순환 선택이 후보에서 빠진 것도
// 런 사이에 진행 위치를 보관할 데가 없어서다 (DEC-CONTENT-018).
//
// **튜토리얼 건너뛰기는 여기 없다.** `DEC-UI-030` 가 "타이틀 또는 튜토리얼 시작
// 시점에 제공한다" 로 둘 중 하나를 고르게 했고 튜토리얼 화면 쪽을 골랐다 —
// 안내 문구가 데이터 대기라 그 화면이 지금은 건너뛰기만 있는 상태이기 때문이다.
//
// 이 파일은 화면만 만든다. 런 상태를 새로 만드는 것은 호출하는 쪽이 한다 (로드맵 9-5).
//
// ── 목업의 버튼 셋 중 하나만 있다 ──────────────────────────
//
// 아트 디렉션 A0 목업(전성민 8/8)에는 `게임 시작`·`게임 종료` 팻말 두 장과 우측 상단
// 설정 버튼이 그려져 있다. **여기 있는 것은 `게임 시작` 하나뿐이다.**
// `DEC-UI-030` 이 *"타이틀 화면에는 새 런을 시작하는 입력만 둔다"* 로 확정했고,
// 나머지 둘을 넣으면 그 확정문을 코드가 어기는 셈이 된다 (`AGENTS.md` 5절).
//
// 자리는 비워 두었다 — 아래 `--title-sign-bottom-y` 가 두 번째 받침의 실측 좌표이고,
// 배경 그림의 기둥에는 받침이 두 개 그려져 있다. DEC 가 바뀌면 팻말 한 장과
// 핸들러 하나를 더하는 것으로 끝난다.

import { assetCssUrl, UI_ASSET } from '../render/assets.ts'
import './layout.css'

export interface TitleHandlers {
  /** 새 런을 시작한다. **입력은 이것 하나뿐이다** (DEC-UI-030) */
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
 * 제목은 게임 데이터가 아니라 제품 이름이라 코드에 둔다. 로고 그림이 있으면
 * 그것이 대신 서고, 없으면 이 글자가 플레이스홀더로 남는다.
 *
 * `게임 시작` 은 `DEC-UI-029` 의 라벨 갈래다 — 이 화면에는 입력이 하나뿐이라 문구를
 * 바꿔도 플레이어가 고를 것이 달라지지 않는다. 목업의 팻말 글자와 맞췄다.
 */
const GAME_TITLE = '밭두렁난투'
const START_LABEL = '게임 시작'

/**
 * 팻말이 흔들리는 시간. `layout.css` 의 `title-sign-shake` 와 같은 값이어야 한다.
 *
 * `animationend` 를 기다리는 것이 원칙이지만 그것만 믿으면 애니메이션이 어떤 이유로든
 * 안 돌 때 게임에 못 들어간다. 그래서 이 시간이 지나면 무조건 진행한다.
 */
const SHAKE_MS = 360

export function createTitle(container: HTMLElement, handlers: TitleHandlers): TitleScreen {
  const root = el('div', 'title')
  root.hidden = true

  // 배경과 로고가 오면 A0 배치로 바꾼다. 없으면 기존 가운데 판이 그대로 남는다
  // (`AGENTS.md` 6절 — 실제 아트가 없으면 명확한 플레이스홀더를 쓴다).
  const backgroundUrl = assetCssUrl(UI_ASSET.bgTitle)
  const logoUrl = assetCssUrl(UI_ASSET.logoTitle)
  const signUrl = assetCssUrl(UI_ASSET.buttonNormal)
  const hasArt = backgroundUrl !== null && logoUrl !== null

  const startButton = el('button', 'title__start', START_LABEL)
  startButton.type = 'button'

  if (hasArt) {
    root.classList.add('title--has-art')
    root.style.setProperty('--title-background', backgroundUrl)

    const logo = el('div', 'title__logo')
    logo.style.setProperty('--title-logo-image', logoUrl)
    // 로고는 글자 그림이라 대체 텍스트가 있어야 읽는 사람이 무슨 화면인지 안다
    logo.role = 'img'
    logo.ariaLabel = GAME_TITLE

    if (signUrl !== null) startButton.style.setProperty('--title-sign-image', signUrl)

    root.append(logo, startButton)
  } else {
    const panel = el('div', 'title__panel')
    panel.append(el('h1', 'title__name', GAME_TITLE), startButton)
    root.appendChild(panel)
  }

  container.appendChild(root)

  /** 흔드는 중인가. 연출 도중 두 번 눌러 런이 두 번 시작되는 것을 막는다 */
  let entering = false
  let timer: number | null = null

  function finish(): void {
    if (!entering) return
    entering = false
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
    startButton.classList.remove('title__start--shaking')
    handlers.onStart()
  }

  startButton.addEventListener('click', () => {
    if (entering) return
    entering = true

    // 흔들림을 꺼 달라고 한 사람에게는 흔들지 않고 바로 들어간다.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      finish()
      return
    }

    startButton.classList.add('title__start--shaking')
    startButton.addEventListener('animationend', finish, { once: true })
    timer = window.setTimeout(finish, SHAKE_MS + 120)
  })

  return {
    show() {
      // 엔딩·런 실패에서 돌아오는 곳이기도 하다. 지난번 연출 상태가 남아 있으면
      // 버튼이 눌리지 않는다.
      entering = false
      if (timer !== null) {
        window.clearTimeout(timer)
        timer = null
      }
      startButton.classList.remove('title__start--shaking')
      root.hidden = false
    },

    hide() {
      root.hidden = true
    },

    destroy() {
      if (timer !== null) window.clearTimeout(timer)
      root.remove()
    },
  }
}
