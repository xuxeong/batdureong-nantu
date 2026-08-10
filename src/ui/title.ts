// 타이틀 화면 (DEC-UI-032, DEC-UI-014)
//
// 런의 시작점이고, 런 실패나 엔딩에서 돌아오는 곳이기도 하다.
//
// ── 입력이 둘이다 (DEC-UI-032) ─────────────────────────────
//
// **새 런을 시작하는 입력과 음량 설정, 둘만 둔다.** 이어하기·저장 슬롯·게임
// 종료는 두지 않는다 — 종료는 웹 탭에서 `window.close()` 가 동작하지 않아서
// 뺐고, 설정 팻말이 목업의 `게임 종료` 자리(두 번째 받침)를 대신 쓴다.
//
// 설정은 `DEC-UI-027` 이 정한 음량 항목만 연다. 새 설정 화면을 만들지 않는다 —
// 줄 세 개가 일시정지와 **같은 모듈**(ui/volume-panel.ts)이라 두 화면이 다른
// 조절을 갖게 될 수 없다.
//
// **튜토리얼 건너뛰기는 여기 없다.** `DEC-UI-032` 가 이어받은 확정문이 "타이틀
// 또는 튜토리얼 시작 시점에 제공한다" 로 둘 중 하나를 고르게 했고 튜토리얼
// 화면 쪽을 골랐다.
//
// 이 파일은 화면만 만든다. 런 상태를 새로 만드는 것은 호출하는 쪽이 한다 (로드맵 9-5).

import type { Mixer } from '../audio/mixer.ts'
import { assetCssUrl, UI_ASSET } from '../render/assets.ts'
import { applyHanjiPanel } from './panel.ts'
import { createVolumeRows, refreshVolumeRows } from './volume-panel.ts'
import './layout.css'

export interface TitleHandlers {
  /** 새 런을 시작한다 */
  onStart(): void
  /**
   * 음량 설정에 쓴다 (DEC-UI-032). 오디오가 없는 빌드에서는 넘기지 않고,
   * 그러면 설정 팻말 자체를 만들지 않는다 — 일시정지가 음량 버튼을 빼는 것과
   * 같은 규칙이다 (DEC-UI-027).
   */
  mixer?: Mixer
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
 * 목업의 `게임 종료` 팻말 자리를 대신 쓴다 (DEC-UI-032).
 *
 * `설정` 이 아니라 `음량 설정` 인 이유 (8/10) — 이 팻말이 여는 것은 음량뿐이라
 * (확정문이 "음량 조절 항목만 연다") 팻말이 그 사실을 미리 말하는 편이 낫다.
 * 판 안의 제목은 뺐다 — 팻말과 같은 말을 두 번 하게 된다.
 */
const SETTINGS_LABEL = '음량 설정'

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

  // ── 설정 — 음량 조절만 연다 (DEC-UI-032) ─────────
  //
  // 팻말을 다시 누르거나 판 밖을 누르면 닫힌다. 게임 시작을 누르면 그대로
  // 진입한다 — 설정이 열려 있다고 시작을 막을 이유가 없다.
  const settingsButton = el('button', 'title__settings', SETTINGS_LABEL)
  settingsButton.type = 'button'

  const volumePanel = el('div', 'title__volume')
  volumePanel.hidden = true

  const mixer = handlers.mixer
  if (mixer !== undefined) {
    const rows = createVolumeRows(mixer)
    // 제목 줄이 없다 — 팻말이 이미 `음량 설정` 이다 (8/10).
    volumePanel.append(rows)
    // 일시정지 창과 같은 한지 판 (8/10 — 어두운 판이 배경 위에서 튀었다)
    applyHanjiPanel(volumePanel)

    settingsButton.addEventListener('click', () => {
      volumePanel.hidden = !volumePanel.hidden
      // 열 때 손잡이를 mixer 현재값으로 다시 맞춘다 (8/10 — 일시정지에서
      // 바꾼 값이 여기 슬라이더에 안 보였다. 소리는 공유되는데 표시가 굳어 있었다)
      if (!volumePanel.hidden) refreshVolumeRows(rows, mixer)

      // 게임 시작과 같은 흔들림 (8/10). 시작과 달리 기다릴 것이 없어서
      // 판은 즉시 열리고 팻말만 흔들린다. 연타 시 다시 처음부터 흔들리도록
      // 클래스를 뗐다 붙인다 — reflow 강제가 그 사이에 있다.
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        settingsButton.classList.remove('title__start--shaking')
        void settingsButton.offsetWidth
        settingsButton.classList.add('title__start--shaking')
      }
    })

    /*
      판 밖을 누르면 닫는다.

      8/9 에는 설정 버튼·판에 stopPropagation 을 걸어 이 핸들러로부터 숨겼는데,
      **클릭이 버스 최상위(uiRoot)까지 안 올라가 버튼 클릭음이 안 났다** (8/10).
      전파를 끊는 대신 어디를 눌렀는지 보고 갈래를 정한다 — 소리 배선은
      uiRoot 에서 버튼 클릭 전부를 듣고 있어서 전파가 살아 있어야 한다.
    */
    root.addEventListener('click', (event) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (settingsButton.contains(target) || volumePanel.contains(target)) return
      volumePanel.hidden = true
    })
  }

  if (hasArt) {
    root.classList.add('title--has-art')
    root.style.setProperty('--title-background', backgroundUrl)

    const logo = el('div', 'title__logo')
    logo.style.setProperty('--title-logo-image', logoUrl)
    // 로고는 글자 그림이라 대체 텍스트가 있어야 읽는 사람이 무슨 화면인지 안다
    logo.role = 'img'
    logo.ariaLabel = GAME_TITLE

    if (signUrl !== null) {
      startButton.style.setProperty('--title-sign-image', signUrl)
      settingsButton.style.setProperty('--title-sign-image', signUrl)
    }

    root.append(logo, startButton)
    if (mixer !== undefined) root.append(settingsButton, volumePanel)
  } else {
    const panel = el('div', 'title__panel')
    panel.append(el('h1', 'title__name', GAME_TITLE), startButton)
    if (mixer !== undefined) panel.append(settingsButton, volumePanel)
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
      // 지난번에 열어 둔 음량 판이 그대로 떠 있으면 안 된다
      volumePanel.hidden = true
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
