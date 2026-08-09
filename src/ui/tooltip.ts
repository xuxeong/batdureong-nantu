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
 * 커서에서 띄우는 거리 — **화면 픽셀이다.**
 *
 * 커서 그림은 55×67 이고 핫스팟이 왼쪽 위 `2,2` 라, 누른 점에서 오른쪽·아래로
 * 그만큼 뻗는다. 가로를 그 폭만큼 주면 안내가 **커서 오른쪽에 나란히** 서고,
 * 그러면 세로는 거의 줄 필요가 없다.
 *
 * **무대 좌표가 아니라 화면 픽셀인 것이 중요하다.** 커서 그림은 무대 배율을
 * 타지 않는데 안내는 무대 안에 있어 배율을 탄다. 무대 좌표로 잡으면 창이
 * 작을수록 여백만 줄어들어 안내가 커서 밑에 깔린다 (8/10 확인).
 * `place()` 가 배율로 나눠서 쓴다.
 */
const CURSOR_GAP_SCREEN_X = 56
const CURSOR_GAP_SCREEN_Y = 6

export function createTooltip(container: HTMLElement): Tooltip {
  const root = el('div', 'tip')
  root.hidden = true
  container.appendChild(root)

  const name = el('div', 'tip__name')
  const description = el('p', 'tip__description')
  const stats = el('div', 'tip__stats')
  const note = el('div', 'tip__note')
  root.append(name, description, stats, note)

  /**
   * `position: fixed` 의 기준이 되는 조상을 찾는다.
   *
   * **`transform` 이 걸린 조상이 있으면 `fixed` 는 화면이 아니라 그 조상 기준이
   * 된다.** 무대(`render/stage.ts`)가 `translate(-50%,-50%) scale()` 을 걸므로
   * 이 안의 `fixed` 요소는 전부 그 영향을 받는다 — 원점이 무대 왼쪽 위로 옮겨
   * 가고 좌표에 배율까지 먹는다. 8/10 에 안내가 커서에서 400px 넘게 떨어져
   * 보이던 원인이 이것이다.
   *
   * 클래스 이름으로 찾지 않는다. 규칙은 "무대" 가 아니라 "`transform` 을 가진
   * 가장 가까운 조상" 이라, 나중에 다른 곳에 `transform` 이 생겨도 따라간다.
   */
  function fixedOrigin(): { left: number; top: number; scale: number; w: number; h: number } {
    for (let node = container as HTMLElement | null; node !== null; node = node.parentElement) {
      if (getComputedStyle(node).transform === 'none') continue
      const rect = node.getBoundingClientRect()
      // 배율은 그려진 폭 ÷ 배치상의 폭이다
      const scale = node.offsetWidth === 0 ? 1 : rect.width / node.offsetWidth
      return {
        left: rect.left,
        top: rect.top,
        scale: scale === 0 ? 1 : scale,
        w: node.offsetWidth,
        h: node.offsetHeight,
      }
    }
    // 배율이 없으면 화면이 곧 기준이다
    return { left: 0, top: 0, scale: 1, w: window.innerWidth, h: window.innerHeight }
  }

  function place(clientX: number, clientY: number): void {
    /*
      **재기 전에 왼쪽 위로 옮긴다.**

      `position: fixed` 인 상자를 오른쪽 끝에 둔 채로 재면 화면에 눌려 폭이
      좁아진다. 그 좁아진 폭으로 넘침을 계산하면 "안 넘친다" 가 나와서, 접지
      않고 그 자리에 남아 글자가 세로로 접힌 채 잘린다 (8/10 정비 화면에서 확인).

      눌리지 않는 자리에서 한 번 재야 제 크기를 알 수 있다. 화면에 그리기 전에
      옮겼다 재고 다시 옮기므로 깜빡이지 않는다 — 같은 프레임 안에서 끝난다.
    */
    root.style.left = '0px'
    root.style.top = '0px'

    /*
      커서 위치를 기준 상자 안의 좌표로 바꾼다.

      `clientX/Y` 는 화면 좌표인데 `left/top` 은 기준 상자 좌표라 그대로 넣으면
      원점만큼 밀리고 배율만큼 벌어진다.

      크기는 `offsetWidth/Height` 로 잰다 — `getBoundingClientRect()` 는 배율이
      먹은 값이라 배율 없는 좌표계와 섞으면 또 어긋난다.
    */
    const origin = fixedOrigin()
    const localX = (clientX - origin.left) / origin.scale
    const localY = (clientY - origin.top) / origin.scale
    const boxW = root.offsetWidth
    const boxH = root.offsetHeight

    /*
      여백도 같은 좌표계로 바꾼다.

      상수는 화면 픽셀인데 여기 좌표는 무대 좌표라, 배율로 나눠야 화면에서
      의도한 만큼 떨어진다. 이걸 안 하면 창이 작을수록 여백이 같이 줄어들어
      안내가 커서 그림 밑에 깔린다 — 커서는 배율을 타지 않기 때문이다.
    */
    const gapX = CURSOR_GAP_SCREEN_X / origin.scale
    const gapY = CURSOR_GAP_SCREEN_Y / origin.scale

    // 화면 밖으로 나가면 반대편으로 접는다. 오른쪽 끝 항목에서 안내가 잘린다.
    const overflowRight = localX + gapX + boxW > origin.w
    const overflowBottom = localY + gapY + boxH > origin.h

    const x = overflowRight ? localX - gapX - boxW : localX + gapX
    const y = overflowBottom ? localY - gapY - boxH : localY + gapY

    /*
      접고 나서도 한 번 더 가둔다.

      상자가 화면보다 크거나 커서가 구석에 있으면 접어도 반대쪽으로 넘친다.
      `Math.max(0, …)` 만으로는 왼쪽·위만 막혀서 오른쪽·아래로는 그대로 나간다.
    */
    const maxX = Math.max(0, origin.w - boxW)
    const maxY = Math.max(0, origin.h - boxH)

    root.style.left = `${Math.min(Math.max(0, x), maxX)}px`
    root.style.top = `${Math.min(Math.max(0, y), maxY)}px`
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
