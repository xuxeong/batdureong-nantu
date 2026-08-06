// 투척 퀵슬롯 편성 팝업 (DEC-UI-021, DEC-RESOURCE-014·015, DEC-INPUT-006)
//
// 정비 허브의 내부 팝업이다. 편성은 **정비 단계에서만** 할 수 있는데, 이 팝업이
// 정비 허브 안에서만 열리므로 그 조건이 구조로 지켜진다 (DEC-INPUT-006).
//
// ── 이 파일이 지키는 것 ────────────────────────────────────
//
// **슬롯을 먼저 고르고 그다음 무기를 고른다** (DEC-UI-021). 끌어놓기를 쓰지 않는다.
// 그래서 무기 목록은 슬롯을 고르기 전에는 아예 만들지 않는다 — 목록을 먼저 띄우고
// 슬롯을 나중에 고르는 순서를 화면이 허용하면 그게 곧 다른 편성 방식이 된다.
//
// **퀵슬롯은 수량을 갖지 않는다** (DEC-RESOURCE-002, DEC-RESOURCE-014). 칸은 무기
// 종류만 무기 보관함에 연결하고, 화면에 보이는 수량은 전부 보관함에서 읽은 값이다.
// 그래서 슬롯에서 무기를 빼도 보관함 수량이 줄지 않는다 — 그 사실을 화면에 적는다.
//
// **수량이 0이어도 편성을 풀지 않는다** (DEC-RESOURCE-015). 편성은 유지한 채
// 사용 불가로만 구분해 표시한다. 같은 무기를 다시 제작하면 그 칸이 바로 살아난다.

import { createPopupShell, createElement as el } from './maintenance-hub.ts'
import { createIcon } from './icon.ts'
import './layout.css'

/** 칸 하나. 다섯 칸을 항상 모두 표시한다 (DEC-UI-021) */
export interface QuickslotSlotView {
  index: number
  /** 편성된 무기 ID. 빈 칸이면 null */
  weaponId: string | null
  /** 편성된 무기 이름. 빈 칸이면 null */
  weaponName: string | null
  /** 무기 보관함에서 읽은 수량. 0이면 사용 불가로 구분한다 (DEC-RESOURCE-015) */
  count: number
  /** 편성된 무기의 `asset.icon.*`. 없으면 이름이 그 자리를 대신한다 */
  icon?: string
}

/** 편성할 수 있는 무기 한 줄. 무기 보관함에 있는 것만 온다 */
export interface QuickslotWeaponView {
  id: string
  name: string
  count: number
  /**
   * 이미 다른 칸에 편성돼 있는가 (DEC-RESOURCE-014 — 중복 편성 금지).
   * true 면 목록에 **표시하되 고를 수 없게** 한다 (DEC-UI-021).
   */
  assignedElsewhere: boolean
  /** `asset.icon.*` */
  icon?: string
}

export interface QuickslotView {
  /** 길이 5 고정 (DEC-INPUT-006) */
  slots: readonly QuickslotSlotView[]
  weapons: readonly QuickslotWeaponView[]
}

export interface QuickslotHandlers {
  /** 편성하거나(`weaponId`) 비운다(`null`). 수량은 건드리지 않는다 */
  assign(slotIndex: number, weaponId: string | null): void
  close(): void
}

export interface QuickslotModal {
  readonly root: HTMLElement
  render(view: QuickslotView): void
}

export function createQuickslotModal(handlers: QuickslotHandlers): QuickslotModal {
  const { root, body, footer } = createPopupShell('투척 퀵슬롯 편성', handlers.close)

  /** 지금 고른 칸. 고르기 전에는 무기 목록을 만들지 않는다 (DEC-UI-021) */
  let selectedIndex: number | null = null

  const slotRow = el('div', 'hub__slots')
  const weaponList = el('div')
  body.append(slotRow, weaponList)

  // 슬롯에서 무기를 제거해도 무기 보관함의 수량이 줄지 않는다는 것을 알 수 있게 한다
  // (DEC-UI-021, DEC-RESOURCE-014). 제거 버튼 옆에 상시로 둔다.
  footer.append(
    el('div', 'hub__preview', '칸을 비워도 무기 보관함의 수량은 줄지 않는다.'),
  )

  const clearButton = el('button', 'hub__action', '칸 비우기') as HTMLButtonElement
  clearButton.type = 'button'
  clearButton.addEventListener('click', () => {
    if (selectedIndex === null) return
    handlers.assign(selectedIndex, null)
  })
  footer.appendChild(clearButton)

  /** 칸 다섯 개는 개수가 고정이라 매번 만들지 않고 재사용한다 */
  const slotNodes: { root: HTMLButtonElement; name: HTMLElement; count: HTMLElement }[] = []

  function ensureSlots(n: number): void {
    while (slotNodes.length < n) {
      const index = slotNodes.length
      const button = el('button', 'hub__slot') as HTMLButtonElement
      button.type = 'button'

      // 칸 번호는 `1~5` 입력과 같은 번호다 (DEC-INPUT-006)
      const label = el('div', 'hub__slot-index', String(index + 1))
      const name = el('div', 'hub__slot-name')
      const count = el('div', 'hub__row-sub')
      button.append(label, name, count)

      button.addEventListener('click', () => {
        selectedIndex = index
      })

      slotRow.appendChild(button)
      slotNodes.push({ root: button, name, count })
    }
  }

  /** 무기 목록은 고른 칸이 있을 때만 만든다. 구성이 바뀔 때만 다시 그린다 */
  let builtSignature = ''

  function buildWeapons(view: QuickslotView): void {
    const signature =
      selectedIndex === null
        ? ''
        : `${selectedIndex}#` +
          view.weapons.map((w) => `${w.id}:${w.count}:${w.assignedElsewhere ? 'x' : 'o'}`).join('|')
    if (signature === builtSignature) return
    builtSignature = signature

    weaponList.replaceChildren()
    if (selectedIndex === null) {
      weaponList.appendChild(
        el('div', 'hub__preview', '편성할 칸을 먼저 고른다.'),
      )
      return
    }

    weaponList.appendChild(el('div', 'hub__popup-group-title', '편성할 무기'))

    if (view.weapons.length === 0) {
      // 제작하기 전에는 무기 보관함이 비어 있다. 없는 것을 지어내지 않는다
      weaponList.appendChild(
        el('div', 'hub__inventory-row hub__inventory-row--empty', '무기 보관함이 비어 있다'),
      )
      return
    }

    for (const weapon of view.weapons) {
      const button = el('button', 'hub__row') as HTMLButtonElement
      button.type = 'button'
      const weaponIcon = createIcon(weapon.icon)
      if (weaponIcon !== null) button.appendChild(weaponIcon)
      button.append(
        el('div', 'hub__row-name', weapon.name),
        el('div', 'hub__row-sub', String(weapon.count)),
      )

      // 이미 다른 칸에 편성된 무기는 표시하되 고를 수 없다 (DEC-UI-021)
      if (weapon.assignedElsewhere) {
        button.disabled = true
        button.appendChild(el('div', 'hub__row-sub', '다른 칸'))
      } else {
        const slot = selectedIndex
        button.addEventListener('click', () => {
          if (slot === null) return
          handlers.assign(slot, weapon.id)
        })
      }

      weaponList.appendChild(button)
    }
  }

  return {
    root,

    render(view) {
      ensureSlots(view.slots.length)

      view.slots.forEach((slot, i) => {
        const node = slotNodes[i]
        if (node === undefined) return

        node.name.textContent = slot.weaponName ?? '비어 있음'
        node.count.textContent = slot.weaponId === null ? '' : String(slot.count)

        node.root.classList.toggle('hub__slot--selected', i === selectedIndex)
        // 빈 칸도 빈 상태로 표시한다 (DEC-UI-021)
        node.root.classList.toggle('hub__slot--empty', slot.weaponId === null)
        // 편성은 유지한 채 사용 불가로만 구분한다 (DEC-RESOURCE-015)
        node.root.classList.toggle(
          'hub__slot--unusable',
          slot.weaponId !== null && slot.count === 0,
        )
      })

      clearButton.disabled =
        selectedIndex === null || view.slots[selectedIndex]?.weaponId == null

      buildWeapons(view)
    },
  }
}
