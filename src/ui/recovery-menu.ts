// 회복 퀵메뉴 (DEC-UI-037, DEC-INPUT-008, DEC-RESOURCE-017)
//
// ── 여는 방법이 곧 닫는 방법이다 ───────────────────────────
//
// `Q` 를 **길게 누르는 동안에만** 열리고 손을 떼면 닫힌다 (DEC-UI-037). 그래서
// 닫기 버튼이 없다. 항목을 마우스로 고르고 `Q` 를 놓으면 **선택만 바뀌고 즉시
// 소비하지 않는다** (DEC-INPUT-008) — 이 화면은 사용을 시작하지 않는다.
//
// ── 목록에 담기는 것 ───────────────────────────────────────
//
// 실제 보유 수량이 1개 이상인 회복 가능 항목만이다. 순서는 제작 회복 아이템 먼저,
// 생식 가능한 수확물 뒤, 각 묶음 안에서 ID 오름차순이며 **자동 선택도 같은 순서를
// 쓴다** (DEC-UI-037). 목록을 만드는 곳은 `systems/recovery.ts` 하나다 — 두 벌이면
// 화면에서 고르는 순서와 자동으로 고르는 순서가 갈린다.
//
// 각 항목에 이름과 현재 수량, **승인 데이터에서 읽은 회복량**을 표시한다.
//
// ── 느려진 상태를 알리는 것이 지금 없다 ────────────────────
//
// `DEC-INPUT-008` 이 퀵메뉴 중에는 게임 전체 속도를 크게 낮추라고 했고
// `DEC-UI-037` 이 "느려진 상태임을 알 수 있게 한다" 고 했다. 그 표시는
// `시간이 느리게 흐른다` 한 줄이었는데 **2026-08-10 에 담당자 판단으로 뺐다.**
// 지금 그 조항은 구현이 없다 — 경위는 `OPEN_HINT` 주석에 적었다.
//
// 감속 자체는 화면 매니저가 건다 (`syncSimulation`).

import { applyHanjiPanel } from './panel.ts'
import './layout.css'

export interface RecoveryMenuItem {
  id: string
  displayName: string
  /** 승인 데이터에서 읽은 회복량 (DEC-UI-037) */
  healAmount: number
  held: number
}

export interface RecoveryMenuView {
  items: readonly RecoveryMenuItem[]
  /** 지금 선택된 항목. 명확히 강조한다 (DEC-UI-037) */
  selectedId: string | null
}

export interface RecoveryMenuHandlers {
  /** 마우스로 항목을 골랐다. **선택만 바꾸고 소비하지 않는다** (DEC-INPUT-008) */
  onSelect(itemId: string): void
}

export interface RecoveryMenu {
  render(view: RecoveryMenuView): void
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

/*
  아래 셋은 `DEC-UI-029` 의 라벨 갈래다 — 목록의 이름·수량·회복량은 승인
  데이터에서 오고, 이것들은 상태나 조작을 가리킬 뿐 선택을 바꾸지 않는다.
*/

/**
 * 이 창이 무엇인지 (8/10).
 *
 * 8/9까지 제목 없이 안내줄 하나로 시작했다. **무엇을 하는 창인지 말하지 않아서**
 * 마우스로 칸을 눌러 연 사람이 자기가 무엇을 고르는 중인지 알 수 없었다.
 */
const MENU_TITLE = '회복 아이템 변경'

/**
 * 다른 여는 방법을 알린다 (`DEC-UI-037`).
 *
 * 칸을 눌러 연 사람은 `Q` 길게 누르기라는 다른 길을 알 방법이 없었다 —
 * 확정문이 여는 법을 둘로 정했는데 화면은 하나도 말하지 않고 있었다.
 *
 * ── 느림 표시가 화면에서 빠졌다 (2026-08-10, 담당자 판단) ──
 *
 * 8/10 까지 이 줄이 `시간이 느리게 흐른다` 였고 그것이 `DEC-UI-037` 의
 * *"퀵메뉴가 열려 있는 동안 화면이 느려진 상태임을 알 수 있게 한다"* 를
 * 지키는 **유일한 수단**이었다. 담당자가 문구를 빼기로 정해서 지금 그 조항은
 * 구현이 없다.
 *
 * 이 창은 배경도 덮지 않는다(`layout.css` — *"느려진 필드가 보여야 한다"*)
 * 라서 대신 알리는 것도 없다. 되살리려면 글자 말고 화면 효과로 주는 편이
 * 낫다 — 확정문은 "알 수 있게 한다" 이지 "글자로 알린다" 가 아니다.
 */
const OPEN_HINT = 'Q를 길게 눌러서도 열린다'

const EMPTY_TEXT = '쓸 수 있는 회복 아이템이 없다'

export function createRecoveryMenu(
  container: HTMLElement,
  handlers: RecoveryMenuHandlers,
): RecoveryMenu {
  const root = el('div', 'recovery-menu')
  root.hidden = true

  const panel = el('div', 'recovery-menu__panel')
  // 한지 판 (팀 결정 8/8 — CSS 로 뜨는 창은 전부 한지다)
  applyHanjiPanel(panel)
  const title = el('h2', 'recovery-menu__title', MENU_TITLE)
  const notice = el('p', 'recovery-menu__notice', OPEN_HINT)
  const list = el('div', 'recovery-menu__list')

  panel.append(title, notice, list)
  root.appendChild(panel)
  container.appendChild(root)

  /**
   * 목록이 바뀔 때만 다시 만든다. 매 프레임 새로 만들면 클릭이 발밑에서 사라진다.
   *
   * **초기값이 `null` 이다.** 빈 문자열로 두면 목록이 비었을 때(서명도 `''`)
   * "안 바뀌었다" 로 읽혀 `쓸 수 있는 회복 아이템이 없다` 가 영영 안 그려진다.
   */
  let builtSignature: string | null = null

  return {
    render(view) {
      const signature = view.items.map((i) => `${i.id}:${i.held}`).join(',')
      if (signature !== builtSignature) {
        builtSignature = signature
        list.replaceChildren()

        if (view.items.length === 0) {
          list.appendChild(el('p', 'recovery-menu__empty', EMPTY_TEXT))
        }

        for (const item of view.items) {
          const row = el('button', 'recovery-menu__item')
          row.type = 'button'
          row.dataset.itemId = item.id

          row.append(
            el('span', 'recovery-menu__name', item.displayName),
            // 수량과 회복량 둘 다 승인 데이터에서 온다 (DEC-UI-037)
            el('span', 'recovery-menu__held', `보유 ${item.held}`),
            el('span', 'recovery-menu__heal', `회복 ${item.healAmount}`),
          )
          row.addEventListener('click', () => handlers.onSelect(item.id))
          list.appendChild(row)
        }
      }

      // 강조는 매번 맞춘다. 목록이 그대로여도 선택은 바뀔 수 있다.
      for (const row of list.children) {
        if (!(row instanceof HTMLElement) || row.dataset.itemId === undefined) continue
        row.classList.toggle(
          'recovery-menu__item--selected',
          row.dataset.itemId === view.selectedId,
        )
      }
    },

    show() {
      root.hidden = false
    },

    hide() {
      root.hidden = true
      // 다음에 열릴 때 이전 목록이 한 프레임 비치지 않게 한다
      builtSignature = null
      list.replaceChildren()
    },

    destroy() {
      root.remove()
    },
  }
}
