// 마우스를 올렸을 때 뜨는 안내 (아트 디렉션 14.8, 14.9)
//
// 보관함 칸과 상점·제작 목록이 같이 쓴다. 항목의 **이름·설명·수치**가 여기로 간다.
//
// ── 왜 상시가 아니라 안내인가 ──────────────────────────────
//
// `DEC-UI-034` 이 보관함에 상시를 요구하는 것은 **네 분류의 구분 표시**까지이고
// 이름·설명·수치는 별개 문장이라 상시가 아니다. `DEC-UI-005` 는 판매·구매에
// 보유 수량·단가·총액·거래 후 남는 값만 요구하고 설명과 수치는 요구하지 않는다.
// `DEC-UI-006` 만 제작에 그것을 요구해서 상세창이 혼자 다른 모양이 됐다.
// 셋을 맞추면 설명과 수치는 목록 쪽 안내로 간다.
//
// ── 이 파일이 스스로 판단하지 않는 것 ──────────────────────
//
// **내용을 만들지 않는다.** 부르는 쪽이 `TooltipContent` 를 통째로 넘긴다.
// 잠긴 레시피에 수치가 새는 것을 막는 자리가 여기가 아니기 때문이다 —
// 여기서 "잠겼으면 수치를 빼자" 를 판단하면 그 조건 하나가 `DEC-UI-006` 의
// "해금 전에 공개하지 않는다" 전부를 떠받치게 된다. 잠긴 레시피의 뷰 타입에는
// 애초에 수치 필드가 없다 (craft-modal.ts).

import './layout.css'

export interface TooltipStat {
  label: string
  value: string
}

export interface TooltipContent {
  name: string
  /** 승인 데이터의 player_description. 없으면 생략한다 */
  description?: string
  /** 승인 데이터에서 읽은 수치. 설명 문장에서 읽지 않는다 */
  stats?: readonly TooltipStat[]
  /** 수치가 아닌 짧은 안내 한 줄. 잠긴 레시피의 해금 조건 같은 것 */
  note?: string
}

export interface Tooltip {
  /**
   * 요소에 안내를 붙인다. 내용은 **뜰 때 계산한다** — 보유 수량처럼 바뀌는 값이
   * 붙일 때 값으로 굳으면 다음에 떠도 옛 숫자가 나온다.
   *
   * 내용이 null 이면 그 요소에서는 안내가 뜨지 않는다.
   */
  bind(node: HTMLElement, content: () => TooltipContent | null): void
  /** 목록을 다시 만들 때 떠 있던 안내를 지운다 */
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
 * 커서에서 띄우는 거리(px) — 오른쪽 아래로 이만큼 떨어진다 (8/9).
 *
 * 14px 로 붙여 뒀더니 안내가 커서를 따라다니며 메뉴를 가렸다. 세로를 더 주는
 * 이유는 커서 그림이 위가 아니라 **아래로** 뻗기 때문이다 — 가로만큼 주면
 * 화살표 끝이 안내 머리를 덮는다.
 */
const CURSOR_GAP_X = 24
const CURSOR_GAP_Y = 36

export function createTooltip(container: HTMLElement): Tooltip {
  const root = el('div', 'tip')
  root.hidden = true
  container.appendChild(root)

  const name = el('div', 'tip__name')
  const description = el('p', 'tip__description')
  const stats = el('div', 'tip__stats')
  const note = el('div', 'tip__note')
  root.append(name, description, stats, note)

  function place(clientX: number, clientY: number): void {
    // 화면 밖으로 나가면 반대편으로 접는다. 오른쪽 끝 항목에서 안내가 잘린다.
    const box = root.getBoundingClientRect()
    const overflowRight = clientX + CURSOR_GAP_X + box.width > window.innerWidth
    const overflowBottom = clientY + CURSOR_GAP_Y + box.height > window.innerHeight

    const x = overflowRight ? clientX - CURSOR_GAP_X - box.width : clientX + CURSOR_GAP_X
    const y = overflowBottom ? clientY - CURSOR_GAP_Y - box.height : clientY + CURSOR_GAP_Y

    root.style.left = `${Math.max(0, x)}px`
    root.style.top = `${Math.max(0, y)}px`
  }

  function show(content: TooltipContent, clientX: number, clientY: number): void {
    name.textContent = content.name

    description.textContent = content.description ?? ''
    description.hidden = (content.description ?? '') === ''

    stats.replaceChildren()
    for (const stat of content.stats ?? []) {
      const row = el('div', 'tip__stat')
      row.append(el('span', 'tip__stat-label', stat.label), el('span', undefined, stat.value))
      stats.appendChild(row)
    }
    stats.hidden = (content.stats ?? []).length === 0

    note.textContent = content.note ?? ''
    note.hidden = (content.note ?? '') === ''

    root.hidden = false
    place(clientX, clientY)
  }

  const tooltip: Tooltip = {
    bind(node, content) {
      node.addEventListener('mouseenter', (event) => {
        const value = content()
        if (value === null) return
        show(value, event.clientX, event.clientY)
      })
      // 항목이 커서보다 크면 들어온 위치에 그대로 두면 멀리 떨어져 보인다
      node.addEventListener('mousemove', (event) => {
        if (!root.hidden) place(event.clientX, event.clientY)
      })
      node.addEventListener('mouseleave', () => tooltip.hide())
      // 목록이 스크롤되면 붙어 있던 자리가 어긋난다
      node.addEventListener('click', () => tooltip.hide())
    },

    hide() {
      root.hidden = true
    },

    destroy() {
      root.remove()
    },
  }

  return tooltip
}
