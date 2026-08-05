// 데이터 오류 화면 (DEC-UI-024)
//
// 확정 내용 셋이다.
//
//   - 필수 데이터 누락 또는 검증 실패로 **부팅할 수 없으면** 이 화면을 표시한다.
//   - `DEC-UI-014` 의 화면 목록에 추가되는 항목이며 **정상 플레이 경로가 아니다.**
//   - 개발 빌드에서는 실패 원인을 상세히 표시하고, 제출 빌드에서는 공포도 수치를
//     숨기는 것과 같은 원칙으로 **일반 문구만** 표시한다.
//
// ── 부팅 실패에만 쓴다 ─────────────────────────────────────
//
// 플레이 도중에도 `data.error` 는 발생한다(습격 예고 문구가 없다든가). 그때는 이
// 화면을 띄우지 않는다 — 확정문이 "**부팅할 수 없으면**" 이라고 못박았고, 진행
// 중에 덮으면 그 시점의 런이 통째로 끊긴다. 그런 오류는 해당 자리를 비운 채
// 개발 빌드 콘솔로 나간다.
//
// ── 진행 입력을 두지 않는다 ────────────────────────────────
//
// 확정문에 재시도가 없고, 실제로 여기서 할 수 있는 것은 데이터를 고쳐 다시
// 빌드하는 것뿐이다. 다시 시도 버튼을 두면 눌러도 같은 실패가 나서, 고칠 수
// 있다는 인상만 준다.

import './layout.css'

export interface DataErrorDetail {
  summary: string
  detail: string
}

export interface DataErrorScreen {
  /**
   * 원인을 넘긴다. **제출 빌드에서는 무시된다** — 화면이 일반 문구만 그린다.
   * 그 판단을 부르는 쪽에 맡기지 않는다. 한 곳이라도 빠뜨리면 상세가 새어 나간다.
   */
  render(details: readonly DataErrorDetail[]): void
  show(): void
  hide(): void
  destroy(): void
}

const isDevBuild = import.meta.env.VITE_BUILD_MODE !== 'submission'

const TITLE = '데이터를 불러오지 못했다'

/**
 * 제출 빌드에서 보여 줄 일반 문구.
 *
 * 원인을 말하지 않는다. 심사자가 볼 화면이고, 파일 이름이나 검증 규칙 ID 는
 * 고칠 수 없는 사람에게 아무 정보도 아니다 (`DEC-UI-024`).
 */
const GENERAL_TEXT = '게임을 시작하는 데 필요한 데이터가 준비되지 않았다.'

/** 개발 빌드에서만 덧붙이는 안내. 조작만 가리키는 라벨이다 (DEC-UI-029) */
const DEV_HINT = 'npm run data:validate · npm run data:build 를 실행한 뒤 새로고침한다.'

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

export function createDataError(container: HTMLElement): DataErrorScreen {
  const root = el('div', 'data-error')
  root.hidden = true

  const panel = el('div', 'data-error__panel')
  panel.append(el('h1', 'data-error__title', TITLE), el('p', 'data-error__text', GENERAL_TEXT))

  // 상세 목록은 개발 빌드에서만 만든다. 만들어 두고 숨기면 DOM 에 남아
  // 제출 빌드에서도 읽을 수 있다.
  const list = isDevBuild ? el('ul', 'data-error__list') : null
  if (list !== null) {
    panel.append(list, el('p', 'data-error__hint', DEV_HINT))
  }

  root.appendChild(panel)
  container.appendChild(root)

  return {
    render(details) {
      if (list === null) return

      list.replaceChildren()
      for (const { summary, detail } of details) {
        const item = el('li', 'data-error__item')
        item.append(
          el('div', 'data-error__summary', summary),
          el('div', 'data-error__detail', detail),
        )
        list.appendChild(item)
      }
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
