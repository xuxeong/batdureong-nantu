// 상점 모달 — 판매·구매 (DEC-UI-005, DEC-RESOURCE-007·008·009·011·013)
//
// 정비 허브의 내부 팝업이다. `DEC-UI-020` 이 정한 대로 허브 안에서만 열리고
// 닫기 버튼으로만 닫힌다 (ui/maintenance-hub.ts).
//
// 판매와 구매를 한 파일에서 `mode` 로 가른다. `DEC-UI-005` 가 둘을 하나의 결정으로
// 묶어 같은 규칙(보유·단가·총액·거래 후 잔량·비활성 조건)을 요구하기 때문이다.
// 다른 점은 세 가지뿐이라 그것만 갈라 둔다 — 무엇을 세는가, 무엇이 남는가, 버튼 이름.
//
// ── 이 파일이 지키는 것 ────────────────────────────────────
//
// **선택과 실행을 분리한다** (DEC-UI-005, DEC-RESOURCE-013). 행을 고르는 것만으로는
// 아무 일도 일어나지 않고, 수량을 정하고 실행 버튼을 눌러야 한 건의 거래가 확정된다.
// 장바구니를 만들지 않는다 — 여러 종류를 모아 한 번에 확정하는 것은 금지다.
//
// **불가능한 거래는 실행 버튼을 끈다.** 보유를 넘는 판매, 소지금을 넘는 구매,
// 1 미만이거나 정수가 아닌 수량이 대상이다. 눌러 보고 거절당하는 경로를 만들지 않는다.
//
// 판정과 자원 변경은 여기서 하지 않는다. `systems/economy.ts` 가 원자적으로 처리하고
// 이 파일은 그 결과를 그린다.

import { createPopupShell, createElement as el } from './maintenance-hub.ts'
import './layout.css'

export type ShopMode = 'sell' | 'buy'

export interface ShopItemView {
  id: string
  name: string
  /** 판매가 또는 구매가. 승인 데이터에서 온다 (DEC-RESOURCE-012) */
  unitPrice: number
  /**
   * 현재 보유 수량.
   *
   * 판매에서는 팔 수 있는 상한이고, 구매에서는 이미 가진 양이다. 구매 상한은
   * 재고가 아니라 소지금이 정한다 — 상점 재고는 무제한이다 (DEC-RESOURCE-009).
   */
  held: number
}

export interface ShopView {
  money: number
  /** 목록은 열려 있는 동안 고정이다. 수량 0인 것도 표시하되 거래만 막는다 */
  items: readonly ShopItemView[]
}

export interface ShopHandlers {
  /**
   * 거래를 확정한다. 자원 변경은 `economy` 가 이미 끝낸 뒤 결과만 돌아온다.
   *
   * 버튼이 켜져 있으면 성공하는 것이 정상이다. 그런데도 실패하면 화면과 상태가
   * 어긋난 것이므로 조용히 넘기지 않고 알린다 (DEC-RESOURCE-013 — 버튼을 누르는
   * 순간 현재 소지금과 보유 수량을 다시 검증한다).
   */
  submit(itemId: string, quantity: number): { ok: boolean; reason: string | null }
  close(): void
}

export interface ShopModal {
  /** 허브 팝업 층에 그대로 넣는다 */
  readonly root: HTMLElement
  render(view: ShopView): void
}

/** 모드가 가르는 것 전부. 이 표 밖에서 mode 를 다시 분기하지 않는다 */
const MODE: Readonly<
  Record<
    ShopMode,
    {
      title: string
      action: string
      /** 목록 행의 보조 설명 */
      heldLabel: string
      /** 거래 후 무엇이 남는지 (DEC-UI-005) */
      remainderLabel: string
    }
  >
> = {
  sell: {
    title: '판매',
    action: '판매',
    heldLabel: '보유',
    // 판매 실행 전에 거래 후 남는 수확물 수량을 표시한다
    remainderLabel: '거래 후 보유',
  },
  buy: {
    title: '구매',
    action: '구매',
    heldLabel: '보유',
    // 구매 실행 전에 거래 후 남는 소지금을 표시한다
    remainderLabel: '거래 후 소지금',
  },
}

export function createShopModal(
  mode: ShopMode,
  handlers: ShopHandlers,
): ShopModal {
  const spec = MODE[mode]
  const { root, body, footer } = createPopupShell(spec.title, handlers.close)

  /** 지금 고른 품목. 고르지 않았으면 null — 그때는 실행 버튼이 꺼져 있다 */
  let selectedId: string | null = null
  /**
   * 거래 처리 중인가 (DEC-UI-005, DEC-RESOURCE-013 — 중복 입력 차단).
   *
   * `economy` 가 동기라 실제로는 한 프레임도 안 걸린다. 그래도 플래그를 두는 이유는
   * 확정문이 요구하기도 하고, 나중에 확인 연출이나 비동기가 끼어도 이 자리가
   * 이미 있기 때문이다. 없으면 그때 가서 두 번 눌리는 버그로 발견된다.
   */
  let busy = false
  /** 실패했을 때만 한 줄. 성공하면 지운다 */
  let notice: string | null = null

  // ── 목록 ─────────────────────────────────────────
  const list = el('div')
  body.appendChild(list)

  /** 행은 목록이 바뀔 때만 다시 만든다. 매 프레임 새로 만들면 클릭이 씹힌다 */
  const rows = new Map<string, { button: HTMLButtonElement; held: HTMLElement }>()
  let builtIds = ''

  function buildRows(items: readonly ShopItemView[]): void {
    const signature = items.map((i) => i.id).join('|')
    if (signature === builtIds) return
    builtIds = signature

    list.replaceChildren()
    rows.clear()

    for (const item of items) {
      const button = el('button', 'hub__row') as HTMLButtonElement
      button.type = 'button'

      // 거래 대상의 단가와 현재 보유 수량을 함께 표시한다 (DEC-UI-005)
      const name = el('div', 'hub__row-name', item.name)
      const price = el('div', 'hub__row-sub', `단가 ${item.unitPrice}`)
      const held = el('div', 'hub__row-sub')
      button.append(name, price, held)

      // 고르는 것만으로는 거래가 발생하지 않는다 (DEC-RESOURCE-013)
      button.addEventListener('click', () => {
        selectedId = item.id
        notice = null
        // 품목이 바뀌면 수량을 1로 되돌린다. 앞 품목에 맞춰 넣은 큰 수가
        // 그대로 남아 있으면 다음 품목에서 곧바로 비활성 상태가 된다.
        quantity.value = '1'
      })

      list.appendChild(button)
      rows.set(item.id, { button, held })
    }
  }

  // ── 바닥: 수량 · 미리보기 · 실행 ─────────────────
  const qtyWrap = el('div', 'hub__qty')
  const quantity = el('input') as HTMLInputElement
  quantity.type = 'number'
  quantity.min = '1'
  quantity.step = '1'
  quantity.value = '1'
  qtyWrap.append(el('span', 'hub__row-sub', '수량'), quantity)

  const preview = el('div', 'hub__preview')

  const action = el('button', 'hub__action', spec.action) as HTMLButtonElement
  action.type = 'button'

  footer.append(qtyWrap, preview, action)

  /** 입력칸의 현재 값. 1 이상의 정수가 아니면 null */
  function requestedQuantity(): number | null {
    const parsed = Number(quantity.value)
    if (!Number.isInteger(parsed) || parsed < 1) return null
    return parsed
  }

  action.addEventListener('click', () => {
    if (busy) return
    const id = selectedId
    const amount = requestedQuantity()
    if (id === null || amount === null) return

    busy = true
    action.disabled = true
    try {
      const result = handlers.submit(id, amount)
      // 성공하면 자원이 이미 바뀌었고 다음 render 가 새 수량을 그린다.
      // 수량 입력은 1로 되돌린다 — 방금 판 만큼이 그대로 남아 있으면
      // 다음 거래에서 실수로 같은 양을 한 번 더 확정하기 쉽다.
      notice = result.ok ? null : '거래를 확정하지 못했다'
      if (result.ok) quantity.value = '1'
    } finally {
      busy = false
    }
  })

  return {
    root,

    render(view) {
      buildRows(view.items)

      const selected = view.items.find((item) => item.id === selectedId) ?? null
      // 목록에서 사라진 품목이 선택된 채로 남지 않게 한다
      if (selected === null) selectedId = null

      for (const item of view.items) {
        const row = rows.get(item.id)
        if (row === undefined) continue
        row.held.textContent = `${spec.heldLabel} ${item.held}`
        row.button.classList.toggle('hub__row--selected', item.id === selectedId)
      }

      const amount = requestedQuantity()
      const total = selected === null || amount === null ? null : selected.unitPrice * amount

      // 거래를 실행할 수 있는가 (DEC-UI-005).
      // 판매는 보유 수량이, 구매는 소지금이 상한이다.
      // 재고는 상한이 아니다 — 조합 재료 재고는 무제한이다 (DEC-RESOURCE-009).
      const allowed =
        selected !== null &&
        amount !== null &&
        total !== null &&
        (mode === 'sell' ? amount <= selected.held : total <= view.money)

      action.disabled = !allowed || busy

      if (selected === null) {
        preview.textContent = '품목을 고른다'
      } else if (amount === null) {
        preview.textContent = '수량은 1 이상의 정수여야 한다'
      } else {
        // 총액과 거래 후 남는 것을 실행 전에 보여준다 (DEC-UI-005)
        const remainder =
          mode === 'sell' ? selected.held - amount : view.money - (total ?? 0)
        preview.textContent =
          `${selected.name} ${amount}개 · 총액 ${total} · ` +
          `${spec.remainderLabel} ${remainder}`
      }

      if (notice !== null) preview.textContent = notice
    },
  }
}
