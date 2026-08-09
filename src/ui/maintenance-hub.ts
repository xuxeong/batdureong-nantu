// 정비 허브 (DEC-UI-020, DEC-UI-034, DEC-RUN-006)
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
import { applyHanjiPanel } from './panel.ts'
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
 * `DEC-UI-034` 이 항목마다 이름·수량과 함께 설명·수치를 요구하는데, 상시로 요구하는
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

/** 보관함 네 분류 (DEC-UI-034) */
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
  /**
   * 지금 열려 있는 팝업. 없으면 null.
   *
   * **어느 기능을 보고 있는지 버튼에서 알 수 있어야 한다.** 8/8 플레이 테스트에서
   * *"판매·구매·제작 중 무엇이 선택됐는지 아래까지 스크롤해야 안다"* 가 나왔다.
   * 팝업 제목이 있긴 하지만 그건 팝업 안이고, 버튼 줄만 보고는 구분이 없었다.
   */
  openPopup: HubPopupId | null
}

export interface HubHandlers {
  openPopup(popup: HubPopupId): void
  finish(): void
  /**
   * 일시정지·설정을 연다. 필드 HUD 의 같은 버튼과 같은 화면이다.
   *
   * `DEC-UI-020` 이 정비 허브의 항목으로 열거하지 않은 입력이다 — 위 `pauseButton`
   * 주석 참고.
   */
  onPause(): void
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
  // 넷 다 두 글자다. 탭이 좁아 `퀵슬롯 편성` 만 두 줄로 접혀서 줄을 맞췄다 (8/8).
  // 무엇을 편성하는지는 팝업 왼쪽 판의 제목(`투척 퀵슬롯 편성`)이 말한다.
  { id: 'quickslots', label: '편성' },
]

/** 보관함 판 머리의 팻말 문구. `DEC-UI-029` 의 라벨 갈래다 — 영역 이름일 뿐이다 */
const INVENTORY_HEADING = '보관함'

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
  //
  // **CSS 배경이 아니라 요소 두 개다** (8/9). 정비에 들어올 때 이 문짝이
  // 재배 필드 위로 닫히는 연출을 해야 하는데, 배경은 움직일 수 없다. 화면이
  // 뜰 때마다 문이 닫히고(260ms) 그다음 UI 가 양옆에서 미끄러져 들어온다 —
  // 붙였다 떼는 것이 아니라 CSS 애니메이션이라 다시 뜰 때마다 저절로 돈다.
  const shutterLeft = assetCssUrl(UI_ASSET.shutterLeft)
  const shutterRight = assetCssUrl(UI_ASSET.shutterRight)
  const hasArt = shutterLeft !== null && shutterRight !== null
  if (hasArt) {
    root.classList.add('hub--has-art')
    const doorLeft = el('div', 'hub__door hub__door--left')
    doorLeft.style.setProperty('--shutter-image', shutterLeft)
    const doorRight = el('div', 'hub__door hub__door--right')
    doorRight.style.setProperty('--shutter-image', shutterRight)
    // 다른 자식보다 먼저 넣는다 — 문이 모든 UI 의 뒤에 깔려야 한다
    root.append(doorLeft, doorRight)
  }

  /** 있으면 CSS 변수로 걸어 준다. 없으면 `layout.css` 의 플레이스홀더가 남는다 */
  function paint(node: HTMLElement, variable: string, assetId: string): void {
    const url = assetCssUrl(assetId)
    if (url !== null) node.style.setProperty(variable, url)
  }

  // ── 좌측: 보관함 상시 영역 + 소지금 ──────────────
  const inventory = el('div', 'hub__inventory')
  // 판 그림은 공용 헬퍼가 붙인다. 9-slice 를 화면마다 복사하지 않는다 (ui/panel.ts)
  applyHanjiPanel(inventory)

  // 소지금 틀에는 엽전 그림이 이미 들어 있다 (B2). 그래서 `소지금` 글자를 빼고
  // 숫자만 얹는다 — 그림이 없을 때만 글자가 무엇인지 알려준다.
  const money = el('div', 'hub__money')
  paint(money, '--hub-money-plate', UI_ASSET.moneyPlate)
  const moneyLabel = el('span', 'hub__money-label', '소지금')
  const moneyValue = el('span', 'hub__count')
  money.append(moneyLabel, moneyValue)

  /**
   * 일시정지·설정 (A3 목업의 우측 상단 톱니바퀴).
   *
   * **`DEC-UI-020` 이 정비 허브의 항목으로 열거하지 않았다.** 같은 확정문이
   * *"`Esc` 는 팝업을 닫지 않고 일시정지를 연다"* 로 정비 중 일시정지는 정해
   * 뒀는데, 마우스로 들어가는 수단은 정하지 않았다. 필드 HUD 에는 있고
   * (`DEC-UI-033`) 정비에는 없어 비대칭이라 목업 기준으로 넣었다 —
   * **결정로그에 근거가 없는 항목이므로 확인이 필요하다.**
   *
   * 여는 것은 필드 HUD 의 그 버튼과 같은 화면이다. 새 설정 화면을 만들지 않는다.
   */
  const pauseButton = el('button', 'hub__pause', '일시정지')
  pauseButton.type = 'button'
  pauseButton.setAttribute('aria-label', '일시정지')
  paint(pauseButton, '--hub-pause-image', UI_ASSET.settingsButton)
  pauseButton.addEventListener('click', () => handlers.onPause())

  // 보관함 제목 표지 (A3 목업). 판 위쪽 테두리에 물려 있는 팻말이다
  const heading = el('div', 'hub__inventory-heading', INVENTORY_HEADING)
  paint(heading, '--hub-button-image', UI_ASSET.buttonNormal)
  inventory.appendChild(heading)

  const groupNodes = new Map<keyof InventoryView, HTMLElement>()
  for (const group of GROUPS) {
    const wrap = el('div', 'hub__inventory-group')
    wrap.appendChild(el('div', 'hub__inventory-title', group.title))
    // 클래스를 준다. 아트가 붙으면 이 목록만 격자가 되고 분류 제목은 아니다
    const list = el('div', 'hub__inventory-list')
    wrap.appendChild(list)
    inventory.appendChild(wrap)
    groupNodes.set(group.key, list)
  }

  // ── 좌측 상단: 습격 예고 ─────────────────────────
  //
  // **판의 배치·크기는 최수정 담당이다** (작업 16번). 8/8 QA 가 세 화면(재배·정비·
  // 습격)의 예고 표시를 한 판으로 통일하기로 했고 그 일을 한 사람이 맡는다.
  //
  // 여기서 한 것은 A3 목업의 자리(좌측 상단)로 옮긴 것뿐이다 — 아래 `.hub__money`
  // 가 목업대로 우측 상단으로 가면서 이 판이 있던 우측 헤더가 없어졌기 때문이다.
  // **그림 자리와 문구 자리를 나눈 구조는 그대로 뒀다.** QA 는 560×101 한 장을
  // 컨테이너 배경으로 쓰고 텍스트 둘을 얹으라고 했는데, 그 변경이 16번의 내용이다.
  //
  // 일차도 여기 들어온다. QA 가 판의 오른쪽을 세로 두 칸으로 나눠 왼쪽에 일차,
  // 오른쪽에 `hud_label` 을 넣기로 했다. 8/8까지 일차는 `${n}일차 정비` 라는
  // 별개의 제목이었는데, 목업에 그 글자가 없고 판 안에 자리가 생겼다.
  const raidNotice = el('div', 'hub__raid-notice')
  const raidNoticePlate = el('div', 'hub__raid-plate')
  const title = el('div', 'hub__title')
  const raidNoticeText = el('div', 'hub__raid-text')
  raidNotice.append(raidNoticePlate, title, raidNoticeText)

  // ── 우측 상단: 소지금 · 일시정지 ─────────────────
  const topRight = el('div', 'hub__top-right')
  topRight.append(money, pauseButton)

  // ── 기능 버튼 넷 (DEC-UI-020) ────────────────────
  // 목업은 팝업 왼쪽 바깥에 세로로 붙인다. 지금 보고 있는 기능이 어느 것인지
  // 버튼 줄에서 알 수 있어야 하므로 순서와 자리를 고정한다.
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

  // ── 하단: 진행 버튼 (DEC-RUN-006) ────────────────
  // 별도의 확인 창을 두지 않는다. 문구가 다음에 일어날 일을 이미 알린다 (DEC-UI-020).
  const finish = el('button', 'hub__finish')
  finish.type = 'button'
  paint(finish, '--hub-button-image', UI_ASSET.buttonNormal)

  /**
   * 종료를 누르면 UI 가 먼저 미끄러져 나가고 그다음 진행한다 (8/9 플로우 —
   * "정비 UI들이 슬라이딩으로 퇴장하고" 문이 열리거나 밤 결과가 올라온다).
   *
   * 문짝은 남는다 — 습격이면 그 자리에서 문이 열리고(shutter.openOver),
   * 조용한 밤이면 밤 결과의 창호지 배경이 같은 그림으로 이어진다.
   */
  const EXIT_MS = 280
  let leaving = false
  finish.addEventListener('click', () => {
    if (leaving) return
    const animated =
      root.classList.contains('hub--has-art') &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!animated) {
      handlers.finish()
      return
    }
    leaving = true
    root.classList.add('hub--leaving')
    window.setTimeout(() => handlers.finish(), EXIT_MS)
  })

  // ── 팝업 층 ─────────────────────────────────────
  const popupLayer = el('div', 'hub__popup-layer')
  popupLayer.hidden = true

  root.append(raidNotice, topRight, inventory, buttons, finish, popupLayer)
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
      // 판 안의 왼쪽 칸이라 `정비` 를 빼고 일차만 쓴다 (8/8 QA)
      title.textContent = `${view.dayNumber}일차`
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
      // 열려 있는 기능은 눌린 채로 둔다 — 어느 것을 보고 있는지 버튼에서 알린다.
      for (const [id, button] of buttonNodes) {
        const locked = view.lockedPopups.includes(id)
        button.disabled = locked
        button.classList.toggle('hub__button--open', view.openPopup === id)
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
      // 숨김 → 표시로 바뀌는 순간에만 초기화한다. 렌더 루프가 매 프레임 부르므로
      // 조건 없이 지우면 퇴장 애니메이션이 도는 중에 끊긴다.
      if (root.hidden) {
        leaving = false
        root.classList.remove('hub--leaving')
      }
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
 * 팝업 껍데기. 제목과 두 칸만 만든다.
 *
 * ── 닫기 버튼이 없다 (2026-08-08 확정) ──
 *
 * **팝업이 항상 하나 열려 있고 기능 버튼 넷이 그것을 갈아 끼운다.** 그러면
 * "닫힌 상태" 가 없으므로 닫을 것도 없다. A3 목업에는 X 가 있었지만 탭이 그
 * 역할을 대신하게 되면서 빠졌다 (`DEC-UI-020` 의 닫기 조항도 함께 정리된다).
 *
 * ── 아트가 붙으면 한지 판 **두 장**이 된다 (A3 목업) ──
 *
 * 왼쪽 판이 `body`(목록·상세), 오른쪽 판이 `footer`(수량·총액·실행)다.
 * **반환 형태는 바뀌지 않는다** — 세 모달이 이미 그 경계로 나눠 담고 있었고
 * 목업의 두 판이 마침 같은 경계다. 그래서 판매·구매·제작·편성은 담는 자리를
 * 안 옮겼다.
 *
 * 껍데기 자신은 판이 아니다. 자리만 잡고 배경은 두 판이 각자 받는다.
 */
export function createPopupShell(titleText: string): {
  root: HTMLElement
  body: HTMLElement
  footer: HTMLElement
} {
  const root = el('div', 'hub__popup')

  // 아트가 붙으면 이 줄을 그리지 않는다 — 열린 탭이 이미 같은 말을 하고 있다.
  // 그림이 없을 때만 무슨 팝업인지 알려주는 자리로 남는다.
  const header = el('div', 'hub__popup-header')
  header.append(el('div', 'hub__popup-title', titleText))

  const body = el('div', 'hub__popup-body')
  const footer = el('div', 'hub__popup-footer')

  // 두 판이 각자 그림을 받는다. 둘 다 붙어야 2단 배치가 성립하므로 한쪽만
  // 성공하면 아트 없는 쪽으로 떨어진다 — 판 하나만 종이인 화면을 만들지 않는다.
  if (applyHanjiPanel(body) && applyHanjiPanel(footer)) {
    root.classList.add('hub__popup--has-art')
  }

  root.append(header, body, footer)

  return { root, body, footer }
}

export { el as createElement }
