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

import { assetCssUrl, UI_ASSET } from '../render/assets.ts'
import { createTooltip } from './tooltip.ts'
import type { TooltipStat } from './tooltip.ts'
import { createIcon } from './icon.ts'
import './layout.css'

/**
 * 습격 예고 표지 세 종 (아트 디렉션 12.5.3 B3, DEC-RUN-011).
 *
 * 판이 그림 자리와 문구 자리로 나뉘어 있어 그림은 종류마다 다르고 문구는
 * `hud_label` 을 코드가 옆칸에 얹는다. **재배 HUD 는 이 판을 쓰지 않는다** —
 * 거기는 `signboard` 아래칸에 문구만 넣고 구분은 색이 한다.
 */
const RAID_NOTICE_ASSET: Record<string, string> = {
  none: UI_ASSET.raidNoticeNone,
  raid: UI_ASSET.raidNoticeRaid,
  final_raid: UI_ASSET.raidNoticeFinal,
}

export type HubPopupId = 'sell' | 'buy' | 'craft' | 'quickslots'

/**
 * 보관함 한 줄.
 *
 * `DEC-UI-021` 이 항목마다 이름·수량과 함께 설명·수치를 요구하는데, 상시로 요구하는
 * 것은 **네 분류의 구분 표시**까지다. 설명과 수치는 마우스를 올렸을 때 뜨는 안내로
 * 간다 (아트 디렉션 14.8).
 *
 * **아이콘이 있으면 이름을 빼고 없으면 남긴다** (14.8 — 칸에는 아이콘과 수량 배지만).
 * 그림이 아직 없는 항목까지 이름을 빼면 그 줄이 숫자만 남아 무엇인지 알 수 없다.
 */
export interface InventoryRow {
  id: string
  name: string
  count: number
  /** `asset.icon.*`. 없으면 이름을 대신 보여준다 */
  icon?: string
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
  /**
   * 그날 밤의 습격 종류. 표지 판의 **그림**을 고른다 (DEC-RUN-011).
   *
   * `raidNoticeLabel` 과 따로 받는다 — 문구는 승인 데이터에서 오고 그림은 세 종의
   * 고정 UI 에셋이라 출처가 다르다. 문구가 없어도 그림은 나올 수 있다.
   */
  raidType: string
  /** 하단 진행 버튼 문구는 DEC-RUN-006 이 정한 두 가지다 */
  finishLabel: string
  /**
   * 정비를 끝낼 수 있는가. **튜토리얼 중에는 false 다.**
   *
   * 튜토리얼은 `syncTutorial()` 이 정비 안내 차례에 이 허브를 열지만, 흐름상
   * 아직 `tutorial` 단계이고 그 단계는 `confirm` 만 받는다 (`scenes/flow.ts`).
   * 종료 버튼을 누르면 `maintenance_finished` 가 처리할 수 없는 입력으로 떨어져
   * **오류가 나고 화면이 필드 바탕색만 남은 빈 초록으로 변한다** (8/8).
   *
   * 튜토리얼을 벗어나는 길은 `DEC-UI-030` 이 정한 `건너뛰고 시작` 하나다.
   * 종료 버튼은 설계에 없는 두 번째 탈출구다.
   *
   * **비활성이 아니라 숨긴다.** 튜토리얼에는 "정비를 끝낸다" 는 개념 자체가
   * 없다 — 흐름이 아직 `tutorial` 단계이고 다음으로 가는 것은 안내를 다 밟는
   * 것뿐이다. 아래 `lockedPopups` 와 기준이 갈리는 지점이다:
   * **아직 없는 것은 숨기고, 지금만 못 쓰는 것은 비활성으로 둔다.**
   */
  canFinish: boolean
  /**
   * 지금 열 수 없는 기능. 튜토리얼이 쓰지 않는 것을 막는다.
   *
   * **판매가 여기 들어간다.** 튜토리얼에는 판매 안내가 없는데(`sell_crop` 행을
   * 8/6 에 뺐다) 버튼은 살아 있어서, 플레이어가 수확물을 팔아 버리면 제작 재료가
   * 없어져 `craft_item` 안내를 완료할 수 없다. **8/6 에 "45% 막힘" 으로 잡았던
   * 바로 그 구멍이 화면 쪽에 남아 있었다** — 데이터에서 판매 단계를 뺀 것으로는
   * 플레이어가 스스로 파는 것을 막지 못한다.
   */
  lockedPopups: readonly HubPopupId[]
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

  // 배경은 닫힌 미닫이문 두 짝이다 (A3 목업, 아트 디렉션 12.5.5). 둘 다 있어야
  // 화면이 채워지므로 한 장만 와 있으면 아트 없는 쪽으로 떨어진다.
  const shutterLeft = assetCssUrl(UI_ASSET.shutterLeft)
  const shutterRight = assetCssUrl(UI_ASSET.shutterRight)
  const hasArt = shutterLeft !== null && shutterRight !== null
  if (hasArt) {
    root.classList.add('hub--has-art')
    root.style.setProperty('--hub-shutter-left', shutterLeft)
    root.style.setProperty('--hub-shutter-right', shutterRight)
  }

  /** 있으면 CSS 변수로 걸어 준다. 없으면 `layout.css` 의 플레이스홀더가 남는다 */
  function paint(node: HTMLElement, variable: string, assetId: string): void {
    const url = assetCssUrl(assetId)
    if (url !== null) node.style.setProperty(variable, url)
  }

  // ── 좌측: 보관함 상시 영역 + 소지금 ──────────────
  const inventory = el('div', 'hub__inventory')
  paint(inventory, '--hub-panel-border', UI_ASSET.panelBorder)
  paint(inventory, '--hub-panel-texture', UI_ASSET.panelTexture)

  // 소지금 틀에는 엽전 그림이 이미 들어 있다 (B2). 그래서 `소지금` 글자를 빼고
  // 숫자만 얹는다 — 그림이 없을 때만 글자가 무엇인지 알려준다.
  const money = el('div', 'hub__money')
  paint(money, '--hub-money-plate', UI_ASSET.moneyPlate)
  const moneyLabel = el('span', 'hub__money-label', '소지금')
  const moneyValue = el('span', 'hub__count')
  money.append(moneyLabel, moneyValue)
  const groupNodes = new Map<keyof InventoryView, HTMLElement>()
  inventory.appendChild(money)
  for (const group of GROUPS) {
    const wrap = el('div', 'hub__inventory-group')
    wrap.appendChild(el('div', 'hub__inventory-title', group.title))
    // 클래스를 준다. 아트가 붙으면 이 목록만 격자가 되고 분류 제목은 아니다
    const list = el('div', 'hub__inventory-list')
    wrap.appendChild(list)
    inventory.appendChild(wrap)
    groupNodes.set(group.key, list)
  }

  // ── 우측: 제목·습격 예고 + 기능 버튼 ─────────────
  const main = el('div', 'hub__main')
  const header = el('div', 'hub__header')
  const title = el('div', 'hub__title')
  // 표지의 그림 자리와 문구 자리를 나눈다 (B3). 그림은 판이 들고 문구만 얹는다.
  const raidNotice = el('div', 'hub__raid-notice')
  const raidNoticePlate = el('div', 'hub__raid-plate')
  const raidNoticeText = el('div', 'hub__raid-text')
  raidNotice.append(raidNoticePlate, raidNoticeText)
  header.append(title, raidNotice)

  const buttons = el('div', 'hub__buttons')
  /** 잠긴 기능을 매 프레임 다시 만들지 않고 여기서 상태만 바꾼다 */
  const buttonNodes = new Map<HubPopupId, HTMLButtonElement>()
  for (const spec of BUTTONS) {
    const button = el('button', 'hub__button', spec.label) as HTMLButtonElement
    button.type = 'button'
    paint(button, '--hub-button-image', UI_ASSET.buttonNormal)
    button.addEventListener('click', () => handlers.openPopup(spec.id))
    buttons.appendChild(button)
    buttonNodes.set(spec.id, button)
  }
  main.append(header, buttons)

  // ── 하단: 진행 버튼 (DEC-RUN-006) ────────────────
  // 별도의 확인 창을 두지 않는다. 문구가 다음에 일어날 일을 이미 알린다 (DEC-UI-020).
  const finish = el('button', 'hub__finish')
  finish.type = 'button'
  paint(finish, '--hub-button-image', UI_ASSET.buttonNormal)
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

          // 칸 그림은 배지가 붙은 것과 아닌 것 두 장이다 (B2). 아트 디렉션이
          // "두 아이템 칸은 배지 말고는 완전히 같다" 로 못 박았으므로 배지를
          // 따로 얹지 않고 **그림을 바꾼다**. 크기가 105×107 대 111×113 으로
          // 다른 것은 배지가 칸 밖으로 물려 나온 만큼이다.
          paint(node, '--hub-slot-image', UI_ASSET.itemSlotBadge)

          // 아이콘이 있으면 이름을 빼고 수량 배지만 남긴다 (14.8).
          // 없으면 이름이 그 자리를 대신한다 — 빈 칸을 두지 않는다.
          const icon = createIcon(row.icon)
          if (icon === null) node.appendChild(el('span', 'hub__slot-name', row.name))
          else node.appendChild(icon)
          node.appendChild(count)

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
      raidNoticeText.textContent = view.raidNoticeLabel ?? ''

      // 판 그림은 세 종 중 하나다. 알 수 없는 종류면 판을 그리지 않는다 —
      // 틀린 그림은 없는 그림보다 나쁘다 (조용한 밤인데 불이 보이면 안 된다).
      const plate = assetCssUrl(RAID_NOTICE_ASSET[view.raidType])
      raidNoticePlate.hidden = plate === null
      if (plate !== null) raidNoticePlate.style.setProperty('--hub-raid-plate', plate)
      moneyValue.textContent = String(view.money)
      finish.textContent = view.finishLabel
      // 튜토리얼 중에는 정비를 끝낼 수 없다 (`HubView.canFinish` 주석)
      finish.hidden = !view.canFinish

      // 잠긴 기능은 회색으로 남긴다. 비활성 그림이 있으면 같이 바꾼다.
      for (const [id, button] of buttonNodes) {
        const locked = view.lockedPopups.includes(id)
        button.disabled = locked
        paint(
          button,
          '--hub-button-image',
          locked ? UI_ASSET.buttonDisabled : UI_ASSET.buttonNormal,
        )
      }

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
  const borderUrl = assetCssUrl(UI_ASSET.panelBorder)
  if (borderUrl !== null) {
    root.style.setProperty('--hub-panel-border', borderUrl)
    root.classList.add('hub__popup--has-art')
  }
  const textureUrl = assetCssUrl(UI_ASSET.panelTexture)
  if (textureUrl !== null) root.style.setProperty('--hub-panel-texture', textureUrl)

  const header = el('div', 'hub__popup-header')
  // 팝업 닫기는 정비 허브 안의 버튼이다. 8/5까지 필드 HUD 의 아이콘 버튼 클래스를
  // 빌려 썼는데, A1 에서 HUD 쪽이 톱니바퀴 그림 한 장으로 바뀌면서 규칙이 갈렸다.
  // 8/8 에 `asset.ui.close_button` 을 붙였다 — 글자가 남아 있는 것은 그림이 없을
  // 때의 플레이스홀더이자 읽는 사람을 위한 이름이고, 그림이 있으면 CSS 가 숨긴다.
  const closeButton = el('button', 'hub__close', '닫기')
  closeButton.type = 'button'
  const closeUrl = assetCssUrl(UI_ASSET.closeButton)
  if (closeUrl !== null) {
    closeButton.style.setProperty('--hub-close-image', closeUrl)
    closeButton.classList.add('hub__close--has-art')
  }
  closeButton.addEventListener('click', onClose)
  header.append(el('div', 'hub__popup-title', titleText), closeButton)

  const body = el('div', 'hub__popup-body')
  const footer = el('div', 'hub__popup-footer')
  root.append(header, body, footer)

  return { root, body, footer }
}

export { el as createElement }
