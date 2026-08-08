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
import { assetCssUrl, UI_ASSET } from '../render/assets.ts'
import { createTooltip } from './tooltip.ts'
import type { TooltipStat } from './tooltip.ts'
import { createIcon } from './icon.ts'
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

  /**
   * 설명과 수치. **상세창이 아니라 목록 안내로 간다** (아트 디렉션 14.9).
   *
   * `DEC-UI-005` 는 판매·구매에 보유 수량·단가·총액·거래 후 남는 값만 요구한다.
   * 설명과 수치는 요구하지 않지만 보관함·제작과 같은 자리에 두는 편이 일관된다.
   */
  description?: string
  stats?: readonly TooltipStat[]
  /** `asset.icon.*`. 목록 행과 상세 제목 앞에 붙는다 (14.9) */
  icon?: string
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
      /**
       * 수량 증감 위에 서는 물음 (A3 목업).
       *
       * `DEC-UI-029` 의 라벨 갈래다 — 무엇을 하는 자리인지만 가리키고 플레이어의
       * 선택을 바꾸는 정보가 없다. 판매·구매·제작이 같은 자리에 서로 다른 동사를
       * 쓰므로 모드마다 적는다.
       */
      prompt: string
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
    prompt: '몇 개 파시겠습니까?',
    heldLabel: '보유',
    // 판매 실행 전에 거래 후 남는 수확물 수량을 표시한다
    remainderLabel: '거래 후 보유',
  },
  buy: {
    title: '구매',
    action: '구매',
    prompt: '몇 개 사시겠습니까?',
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
  const { root, body, footer } = createPopupShell(spec.title)

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

  // ── 목록만 (8/8) ─────────────────────────────────
  //
  // **고른 품목의 상세를 따로 두지 않는다.** 8/8 에 목록 한 줄이 나무 칸 + 두 줄
  // (이름 / 엽전 단가 · 보유 n) 로 바뀌면서, 아래 상세창이 같은 셋을 한 번 더
  // 적고 있었다. 네 줄이 이미 다 말하고 있으므로 판이 그만큼 짧아지고 왼쪽 판에
  // 스크롤이 사라진다 — 품목이 넷뿐인 판매에서 스크롤바가 뜰 이유가 없었다.
  //
  // `DEC-UI-005` 가 요구하는 보유 수량·단가는 목록 줄이 계속 들고 있고, 총액과
  // 거래 후 남는 값은 오른쪽 판이 맡는다.
  const list = el('div')
  body.append(list)

  const tooltip = createTooltip(root)
  /** 안내가 뜰 때 최신 뷰에서 다시 읽는다 — 보유 수량이 거래마다 바뀐다 */
  let latest: readonly ShopItemView[] = []

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

      // ── 나무 칸 + 두 줄 (A3 목업, 8/8) ────────────────
      //
      // 왼쪽에 보관함과 같은 나무 칸을 두고 그림을 그 위에 올린다. 오른쪽은 두
      // 줄이다 — 윗줄이 이름, 아랫줄이 `엽전 단가   보유 n` 이다.
      //
      // 8/8까지 아이콘·이름·단가·보유가 한 줄에 나란히 있었다. 판이 좁아 넷이
      // 붙으면서 어느 숫자가 단가인지 읽히지 않았다.
      const slot = el('div', 'hub__row-slot')
      const slotUrl = assetCssUrl(UI_ASSET.itemSlot)
      if (slotUrl !== null) slot.style.setProperty('--hub-slot-image', slotUrl)
      const icon = createIcon(item.icon)
      if (icon !== null) slot.appendChild(icon)

      const name = el('div', 'hub__row-name', item.name)

      // 아랫줄. 엽전 그림이 오면 숫자 앞에 서고, 없으면 숫자만 남는다 —
      // 파일 반입 대기 중이라 지금은 후자다 (`render/assets.ts` 의 `coin` 주석).
      const price = el('div', 'hub__row-price')
      const coin = el('span', 'hub__coin')
      const coinUrl = assetCssUrl(UI_ASSET.coin)
      if (coinUrl !== null) coin.style.setProperty('--hub-coin-image', coinUrl)
      price.appendChild(coin)
      price.appendChild(el('span', 'hub__row-unit', String(item.unitPrice)))
      const held = el('span', 'hub__row-held')
      price.appendChild(held)

      const lines = el('div', 'hub__row-lines')
      lines.append(name, price)
      button.append(slot, lines)

      // 고르는 것만으로는 거래가 발생하지 않는다 (DEC-RESOURCE-013)
      button.addEventListener('click', () => {
        selectedId = item.id
        notice = null
        // 품목이 바뀌면 수량을 1로 되돌린다. 앞 품목에 맞춰 넣은 큰 수가
        // 그대로 남아 있으면 다음 품목에서 곧바로 비활성 상태가 된다.
        setAmount(1)
      })

      // 설명과 수치는 여기로 간다 (14.9). 뜰 때 최신 뷰에서 읽는다.
      tooltip.bind(button, () => {
        const now = latest.find((i) => i.id === item.id)
        if (now === undefined) return null
        return { name: now.name, description: now.description, stats: now.stats }
      })

      list.appendChild(button)
      rows.set(item.id, { button, held })
    }
  }

  // ── 바닥: 수량 · 미리보기 · 실행 ─────────────────
  //
  // **입력칸이 아니라 증감 버튼이다** (A3 목업, `asset.ui.step_plus`·`step_minus`).
  //
  // 8/8까지 `<input type="number">` 였는데 그것은 `DEC-UI-025` 위반이었다 —
  // *"1차 프로토타입의 화면 조작은 마우스로만 한다"* 이고, `DEC-UI-030` 이 예외로
  // 둔 것은 이름 입력 하나뿐이다. 숫자를 치려면 키보드가 있어야 하므로 마우스만으로는
  // 1 말고 다른 수량을 고를 수 없었다.
  let amount = 1

  const qtyWrap = el('div', 'hub__qty')
  const minus = el('button', 'hub__step hub__step--minus') as HTMLButtonElement
  minus.type = 'button'
  minus.ariaLabel = '수량 줄이기'
  const qtyValue = el('span', 'hub__qty-value', '1')
  const plus = el('button', 'hub__step hub__step--plus') as HTMLButtonElement
  plus.type = 'button'
  plus.ariaLabel = '수량 늘리기'

  const minusUrl = assetCssUrl(UI_ASSET.stepMinus)
  if (minusUrl !== null) minus.style.setProperty('--hub-step-image', minusUrl)
  const plusUrl = assetCssUrl(UI_ASSET.stepPlus)
  if (plusUrl !== null) plus.style.setProperty('--hub-step-image', plusUrl)

  qtyWrap.append(minus, qtyValue, plus)

  // 증감 줄 위에 서는 물음 (A3 목업). 줄과 한 덩어리로 묶어 세로로 쌓는다
  const qtyBlock = el('div', 'hub__qty-block')
  qtyBlock.append(el('div', 'hub__qty-prompt', spec.prompt), qtyWrap)

  /**
   * 수량을 고쳐 쓴다.
   *
   * **위쪽 한계를 두지 않는다.** 보유량이나 소지금으로 막으면 그 한계가 곧
   * "얼마까지 살 수 있나" 를 화면에 알려주게 되는데, `DEC-UI-005` 는 거래 후
   * 남는 값을 보여 주라고만 했지 미리 막으라고 하지 않았다. 확정은 `submit` 이
   * 다시 검증한다.
   */
  function setAmount(next: number): void {
    amount = Math.max(1, next)
    qtyValue.textContent = String(amount)
    // 총액과 거래 후 남는 값이 바로 따라와야 한다. 다음 프레임을 기다리면
    // 버튼을 눌렀는데 숫자만 바뀌고 미리보기가 늦게 오는 것처럼 보인다.
    if (latestView !== null) draw(latestView)
  }

  minus.addEventListener('click', () => setAmount(amount - 1))
  plus.addEventListener('click', () => setAmount(amount + 1))

  const preview = el('div', 'hub__preview')

  const action = el('button', 'hub__action', spec.action) as HTMLButtonElement
  action.type = 'button'
  const actionUrl = assetCssUrl(UI_ASSET.buttonNormal)
  if (actionUrl !== null) action.style.setProperty('--hub-button-image', actionUrl)

  // 계산 결과(총액·거래 후 남는 값)는 오른쪽 판의 증감 줄 아래다 (A3 목업).
  // 왼쪽 판에는 고른 품목이 무엇이고 단가가 얼마인지까지만 남는다.
  const totals = el('div', 'hub__totals')

  footer.append(qtyBlock, totals, preview, action)

  action.addEventListener('click', () => {
    if (busy) return
    const id = selectedId
    if (id === null) return

    busy = true
    action.disabled = true
    try {
      const result = handlers.submit(id, amount)
      // 성공하면 자원이 이미 바뀌었고 다음 render 가 새 수량을 그린다.
      // 수량은 1로 되돌린다 — 방금 판 만큼이 그대로 남아 있으면
      // 다음 거래에서 실수로 같은 양을 한 번 더 확정하기 쉽다.
      notice = result.ok ? null : '거래를 확정하지 못했다'
      if (result.ok) setAmount(1)
    } finally {
      busy = false
    }
  })

  /** 마지막으로 받은 뷰. 증감 버튼이 이것으로 미리보기를 다시 그린다 */
  let latestView: ShopView | null = null

  return {
    root,

    render(view) {
      latestView = view
      draw(view)
    },
  }

  function draw(view: ShopView): void {
      latest = view.items
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

      // 수량은 증감 버튼이 1 이상으로 지켜 준다. 더 이상 "정수인가" 를 묻지 않는다.
      const total = selected === null ? null : selected.unitPrice * amount

      // 거래를 실행할 수 있는가 (DEC-UI-005).
      // 판매는 보유 수량이, 구매는 소지금이 상한이다.
      // 재고는 상한이 아니다 — 조합 재료 재고는 무제한이다 (DEC-RESOURCE-009).
      const allowed =
        selected !== null &&
        total !== null &&
        (mode === 'sell' ? amount <= selected.held : total <= view.money)

      action.disabled = !allowed || busy

      // ── 상세 (DEC-UI-005, 14.9) ──
      //
      // 왼쪽 판의 목록 줄이 이름·단가·보유를 계속 들고 있으므로, 여기서 그리는
      // 것은 **수량에 따라 바뀌는 계산 결과뿐**이다 (DEC-UI-005).
      // 실행 버튼 바로 위에 둔다 (8/8) — 확정하기 직전에 읽는 숫자라서다.
      if (selected === null) {
        totals.replaceChildren()
        preview.textContent = '품목을 고른다'
      } else {
        // 오른쪽 판 — 수량에 따라 바뀌는 것
        const sums: [string, string][] = [
          ['총액', total === null ? '—' : String(total)],
          [
            spec.remainderLabel,
            mode === 'sell'
              ? String(selected.held - amount)
              : total === null
                ? '—'
                : String(view.money - total),
          ],
        ]

        const detailRow = ([label, value]: [string, string]): HTMLElement => {
          const row = el('div', 'hub__detail-row')
          row.append(el('span', 'hub__row-sub', label), el('span', undefined, value))
          return row
        }

        /**
         * 엽전이 값 앞에 서는 줄 (8/8).
         *
         * 총액과 거래 후 남는 소지금은 둘 다 돈이라 엽전이 붙는다. 판매의
         * `거래 후 보유` 는 **수확물 개수**라 돈이 아니므로 붙이지 않는다 —
         * 같은 자리에 있다고 같은 단위로 읽히게 하면 안 된다.
         */
        const moneyRow = ([label, value]: [string, string]): HTMLElement => {
          const row = el('div', 'hub__detail-row')
          const right = el('span', 'hub__row-price')
          const coin = el('span', 'hub__coin')
          const url = assetCssUrl(UI_ASSET.coin)
          if (url !== null) coin.style.setProperty('--hub-coin-image', url)
          right.append(coin, el('span', undefined, value))
          row.append(el('span', 'hub__row-sub', label), right)
          return row
        }

        // 총액은 항상 돈이고, 거래 후 남는 값은 구매만 돈이다 (판매는 수확물 개수)
        totals.replaceChildren(
          moneyRow(sums[0]!),
          (mode === 'buy' ? moneyRow : detailRow)(sums[1]!),
        )

        preview.textContent = ''
      }

    if (notice !== null) preview.textContent = notice
  }
}
