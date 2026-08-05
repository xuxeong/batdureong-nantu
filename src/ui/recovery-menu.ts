// 회복 퀵메뉴 (DEC-UI-001, DEC-INPUT-008, DEC-RESOURCE-017)
//
// ── 여는 방법이 곧 닫는 방법이다 ───────────────────────────
//
// `Q` 를 **길게 누르는 동안에만** 열리고 손을 떼면 닫힌다 (DEC-UI-001). 그래서
// 닫기 버튼이 없다. 항목을 마우스로 고르고 `Q` 를 놓으면 **선택만 바뀌고 즉시
// 소비하지 않는다** (DEC-INPUT-008) — 이 화면은 사용을 시작하지 않는다.
//
// ── 목록에 담기는 것 ───────────────────────────────────────
//
// 실제 보유 수량이 1개 이상인 회복 가능 항목만이다. 순서는 제작 회복 아이템 먼저,
// 생식 가능한 수확물 뒤, 각 묶음 안에서 ID 오름차순이며 **자동 선택도 같은 순서를
// 쓴다** (DEC-UI-001). 목록을 만드는 곳은 `systems/recovery.ts` 하나다 — 두 벌이면
// 화면에서 고르는 순서와 자동으로 고르는 순서가 갈린다.
//
// 각 항목에 이름과 현재 수량, **승인 데이터에서 읽은 회복량**을 표시한다.
//
// ── 느려진 상태를 알린다 ───────────────────────────────────
//
// `DEC-INPUT-008` 이 퀵메뉴 중에는 게임 전체 속도를 크게 낮추라고 했고
// `DEC-UI-001` 이 "느려진 상태임을 알 수 있게 한다" 고 했다. 그 표시가 아래
// `SLOW_NOTICE` 다 — 감속 자체는 화면 매니저가 건다 (`syncSimulation`).

import './layout.css'

export interface RecoveryMenuItem {
  id: string
  displayName: string
  /** 승인 데이터에서 읽은 회복량 (DEC-UI-001) */
  healAmount: number
  held: number
}

export interface RecoveryMenuView {
  items: readonly RecoveryMenuItem[]
  /** 지금 선택된 항목. 명확히 강조한다 (DEC-UI-001) */
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

/**
 * 화면 문구.
 *
 * `DEC-UI-029` 의 라벨 갈래다 — 목록의 이름·수량·회복량은 승인 데이터에서 오고,
 * 아래 둘은 상태를 가리킬 뿐 플레이어의 선택을 바꾸지 않는다.
 */
const SLOW_NOTICE = '시간이 느리게 흐른다'
const EMPTY_TEXT = '쓸 수 있는 회복 아이템이 없다'

export function createRecoveryMenu(
  container: HTMLElement,
  handlers: RecoveryMenuHandlers,
): RecoveryMenu {
  const root = el('div', 'recovery-menu')
  root.hidden = true

  const panel = el('div', 'recovery-menu__panel')
  const notice = el('p', 'recovery-menu__notice', SLOW_NOTICE)
  const list = el('div', 'recovery-menu__list')

  panel.append(notice, list)
  root.appendChild(panel)
  container.appendChild(root)

  /** 목록이 바뀔 때만 다시 만든다. 매 프레임 새로 만들면 클릭이 발밑에서 사라진다 */
  let builtSignature = ''

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
            // 수량과 회복량 둘 다 승인 데이터에서 온다 (DEC-UI-001)
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
      builtSignature = ''
      list.replaceChildren()
    },

    destroy() {
      root.remove()
    },
  }
}
