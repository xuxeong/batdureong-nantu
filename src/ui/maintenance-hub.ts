// 정비 허브 (DEC-UI-020, DEC-UI-021, DEC-RUN-006)
//
// 화면 전환이 아니라 셔터가 필드를 덮고 그 위에 올라오는 오버레이다.
// 보관함은 상시 영역이고 기능 버튼은 넷이다 — 판매·구매·제작·투척 퀵슬롯 편성.
//
// **팝업은 이 허브의 내부 화면이지 DEC-UI-022 의 오버레이 층이 아니다.**
// 그래서 scenes 에 오버레이로 등록하지 않는다. 한 번에 하나만 열고 항상 같은 자리에 열며,
// 팝업 안의 닫기 버튼으로만 닫는다 — 바깥 클릭도 Esc 도 닫지 않는다 (Esc 는 일시정지).
//
// 이 파일은 화면만 만든다. 판정과 자원 변경은 economy.ts 가 한다.

import './layout.css'

export type HubPopupId = 'sell' | 'buy' | 'craft' | 'quickslots'

/** 보관함 한 줄 */
export interface InventoryRow {
  id: string
  name: string
  count: number
}

/** 보관함 네 분류 (DEC-UI-021) */
export interface InventoryView {
  crops: readonly InventoryRow[]
  materials: readonly InventoryRow[]
  throwables: readonly InventoryRow[]
  recoveries: readonly InventoryRow[]
}

export interface HubView {
  dayNumber: number
  money: number
  inventory: InventoryView
  /** raid_notices.hud_label. 데이터가 없으면 null (DEC-RUN-011) */
  raidNoticeLabel: string | null
  /** 하단 진행 버튼 문구는 DEC-RUN-006 이 정한 두 가지다 */
  finishLabel: string
}

export interface HubHandlers {
  openPopup(popup: HubPopupId): void
  finish(): void
}

export interface MaintenanceHub {
  render(view: HubView): void
  /** 팝업 본문을 통째로 갈아 끼운다. null 이면 닫는다 */
  setPopup(node: HTMLElement | null): void
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

const BUTTONS: { id: HubPopupId; label: string }[] = [
  { id: 'sell', label: '판매' },
  { id: 'buy', label: '구매' },
  { id: 'craft', label: '제작' },
  { id: 'quickslots', label: '퀵슬롯 편성' },
]

const GROUPS: { key: keyof InventoryView; title: string }[] = [
  { key: 'crops', title: '수확물' },
  { key: 'materials', title: '재료' },
  { key: 'throwables', title: '무기' },
  { key: 'recoveries', title: '소모품' },
]

export function createMaintenanceHub(
  container: HTMLElement,
  handlers: HubHandlers,
): MaintenanceHub {
  const root = el('div', 'hub')
  root.hidden = true

  // ── 좌측: 보관함 상시 영역 + 소지금 ──────────────
  const inventory = el('div', 'hub__inventory')
  const money = el('div', 'hub__money')
  const moneyLabel = el('span', undefined, '소지금')
  const moneyValue = el('span', 'hub__count')
  money.append(moneyLabel, moneyValue)
  const groupNodes = new Map<keyof InventoryView, HTMLElement>()
  inventory.appendChild(money)
  for (const group of GROUPS) {
    const wrap = el('div', 'hub__inventory-group')
    wrap.appendChild(el('div', 'hub__inventory-title', group.title))
    const list = el('div')
    wrap.appendChild(list)
    inventory.appendChild(wrap)
    groupNodes.set(group.key, list)
  }

  // ── 우측: 제목·습격 예고 + 기능 버튼 ─────────────
  const main = el('div', 'hub__main')
  const header = el('div', 'hub__header')
  const title = el('div', 'hub__title')
  const raidNotice = el('div', 'hub__raid-notice')
  header.append(title, raidNotice)

  const buttons = el('div', 'hub__buttons')
  for (const spec of BUTTONS) {
    const button = el('button', 'hub__button', spec.label)
    button.type = 'button'
    button.addEventListener('click', () => handlers.openPopup(spec.id))
    buttons.appendChild(button)
  }
  main.append(header, buttons)

  // ── 하단: 진행 버튼 (DEC-RUN-006) ────────────────
  // 별도의 확인 창을 두지 않는다. 문구가 다음에 일어날 일을 이미 알린다 (DEC-UI-020).
  const finish = el('button', 'hub__finish')
  finish.type = 'button'
  finish.addEventListener('click', () => handlers.finish())

  // ── 팝업 층 ─────────────────────────────────────
  const popupLayer = el('div', 'hub__popup-layer')
  popupLayer.hidden = true

  root.append(inventory, main, finish, popupLayer)
  container.appendChild(root)

  function renderGroup(key: keyof InventoryView, rows: readonly InventoryRow[]): void {
    const list = groupNodes.get(key)
    if (list === undefined) return
    list.replaceChildren()

    if (rows.length === 0) {
      list.appendChild(el('div', 'hub__inventory-row hub__inventory-row--empty', '없음'))
      return
    }
    for (const row of rows) {
      const node = el('div', 'hub__inventory-row')
      node.append(el('span', undefined, row.name), el('span', 'hub__count', String(row.count)))
      list.appendChild(node)
    }
  }

  return {
    render(view) {
      title.textContent = `${view.dayNumber}일차 정비`
      // 문구가 없으면 비워 둔다. 임시 문구를 채우지 않는다 (DEC-RUN-011)
      raidNotice.textContent = view.raidNoticeLabel ?? ''
      moneyValue.textContent = String(view.money)
      finish.textContent = view.finishLabel

      for (const group of GROUPS) renderGroup(group.key, view.inventory[group.key])
    },

    setPopup(node) {
      popupLayer.replaceChildren()
      if (node === null) {
        popupLayer.hidden = true
        return
      }
      popupLayer.appendChild(node)
      popupLayer.hidden = false
    },

    show() {
      root.hidden = false
    },

    hide() {
      root.hidden = true
      popupLayer.replaceChildren()
      popupLayer.hidden = true
    },

    destroy() {
      root.remove()
    },
  }
}

/**
 * 팝업 껍데기. 제목·본문·바닥과 닫기 버튼만 만든다.
 *
 * 닫기는 이 버튼 하나뿐이다 (DEC-UI-020). 바깥 클릭 핸들러를 붙이지 않는다.
 */
export function createPopupShell(
  titleText: string,
  onClose: () => void,
): { root: HTMLElement; body: HTMLElement; footer: HTMLElement } {
  const root = el('div', 'hub__popup')
  const header = el('div', 'hub__popup-header')
  const closeButton = el('button', 'hud__icon-button', '닫기')
  closeButton.type = 'button'
  closeButton.addEventListener('click', onClose)
  header.append(el('div', 'hub__popup-title', titleText), closeButton)

  const body = el('div', 'hub__popup-body')
  const footer = el('div', 'hub__popup-footer')
  root.append(header, body, footer)

  return { root, body, footer }
}

export { el as createElement }
