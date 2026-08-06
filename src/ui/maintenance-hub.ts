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

import { createTooltip } from './tooltip.ts'
import type { TooltipStat } from './tooltip.ts'
import './layout.css'

export type HubPopupId = 'sell' | 'buy' | 'craft' | 'quickslots'

/**
 * 보관함 한 줄.
 *
 * `DEC-UI-021` 이 항목마다 이름·수량과 함께 설명·수치를 요구하는데, 상시로 요구하는
 * 것은 **네 분류의 구분 표시**까지다. 설명과 수치는 마우스를 올렸을 때 뜨는 안내로
 * 간다 (아트 디렉션 14.8).
 *
 * 이름은 아직 칸에 남겨 둔다. 14.8 은 "칸에는 아이콘과 수량 배지만" 이지만
 * `icon` 구간이 비어 있어(C단계) 이름까지 빼면 칸이 숫자만 남는다.
 * 아이콘이 오면 이름을 빼는 것은 CSS 한 줄이다.
 */
export interface InventoryRow {
  id: string
  name: string
  count: number
  /** 승인 데이터의 player_description. 작물처럼 열이 없으면 비운다 */
  description?: string
  /** 승인 데이터에서 읽은 수치. 설명 문장에서 읽지 않는다 */
  stats?: readonly TooltipStat[]
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

  /**
   * 입력을 소유하고 있는가 (DEC-UI-026).
   *
   * **표시와 입력은 다르다.** 일시정지가 겹치면 가장 위가 입력을 독점하고 아래
   * 층위는 *표시만* 남는다. 그래서 `hide()` 가 아니라 이것으로 끈다 — 8/5 플레이
   * 테스트에서 브라우저 저장 대화상자로 포커스를 잃자 대화창이 통째로 사라졌고,
   * 일시정지 화면이 아직 뼈대라 왜 사라졌는지 알 수단이 없었다.
   */
  setInteractive(interactive: boolean): void
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

  const tooltip = createTooltip(root)

  /**
   * 지금 화면에 있는 줄. 안내가 뜰 때 **여기서 다시 읽는다** — 붙일 때 값으로
   * 굳히면 사고 판 뒤에도 옛 수량이 나온다.
   */
  const latestRows = new Map<string, InventoryRow>()
  const countNodes = new Map<string, HTMLElement>()
  /** 목록 구성이 바뀔 때만 다시 만든다 */
  let builtSignature = ''

  /**
   * 보관함을 그린다.
   *
   * **줄을 매 프레임 다시 만들지 않는다.** 커서 아래에서 노드가 갈리면
   * `mouseleave` 가 오지 않아 안내가 떠 있는 채로 남고, 수량이 바뀔 때마다
   * 안내가 깜빡인다. 구성이 바뀔 때만 새로 만들고 평소에는 수량만 고친다.
   */
  function renderInventory(inventory: InventoryView): void {
    const signature = GROUPS.map(
      (g) => `${g.key}:${inventory[g.key].map((r) => r.id).join(',')}`,
    ).join('|')

    if (signature !== builtSignature) {
      builtSignature = signature
      countNodes.clear()
      tooltip.hide()

      for (const group of GROUPS) {
        const list = groupNodes.get(group.key)
        if (list === undefined) continue
        list.replaceChildren()

        const rows = inventory[group.key]
        if (rows.length === 0) {
          list.appendChild(el('div', 'hub__inventory-row hub__inventory-row--empty', '없음'))
          continue
        }

        for (const row of rows) {
          const node = el('div', 'hub__inventory-row')
          const count = el('span', 'hub__count')
          node.append(el('span', undefined, row.name), count)

          // 이름·설명·수치는 안내로 간다 (아트 디렉션 14.8).
          // 내용은 뜰 때 계산한다 — 수량이 바뀌어도 최신값이 나온다.
          tooltip.bind(node, () => {
            const latest = latestRows.get(row.id)
            if (latest === undefined) return null
            return {
              name: latest.name,
              description: latest.description,
              stats: [{ label: '보유', value: String(latest.count) }, ...(latest.stats ?? [])],
            }
          })

          list.appendChild(node)
          countNodes.set(row.id, count)
        }
      }
    }

    latestRows.clear()
    for (const group of GROUPS) {
      for (const row of inventory[group.key]) {
        latestRows.set(row.id, row)
        const count = countNodes.get(row.id)
        if (count !== undefined) count.textContent = String(row.count)
      }
    }
  }

  return {
    render(view) {
      title.textContent = `${view.dayNumber}일차 정비`
      // 문구가 없으면 비워 둔다. 임시 문구를 채우지 않는다 (DEC-RUN-011)
      raidNotice.textContent = view.raidNoticeLabel ?? ''
      moneyValue.textContent = String(view.money)
      finish.textContent = view.finishLabel

      renderInventory(view.inventory)
    },

    setPopup(node) {
      // 팝업이 열리고 닫힐 때 보관함 위에 떠 있던 안내를 지운다
      tooltip.hide()
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
      tooltip.hide()
      popupLayer.replaceChildren()
      popupLayer.hidden = true
    },

    setInteractive(interactive) {
      // 입력만 끈다. 표시는 그대로 남는다 (DEC-UI-026).
      root.classList.toggle('is-inert', !interactive)
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
  // 팝업 닫기는 정비 허브 안의 버튼이다. 8/5까지 필드 HUD 의 아이콘 버튼 클래스를
  // 빌려 썼는데, A1 에서 HUD 쪽이 톱니바퀴 그림 한 장으로 바뀌면서 규칙이 갈렸다.
  // `asset.ui.close_button` 은 B단계라 파일이 아직 없다 (schema/enums.json).
  const closeButton = el('button', 'hub__close', '닫기')
  closeButton.type = 'button'
  closeButton.addEventListener('click', onClose)
  header.append(el('div', 'hub__popup-title', titleText), closeButton)

  const body = el('div', 'hub__popup-body')
  const footer = el('div', 'hub__popup-footer')
  root.append(header, body, footer)

  return { root, body, footer }
}

export { el as createElement }
