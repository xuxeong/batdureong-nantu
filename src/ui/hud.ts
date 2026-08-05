// 필드 공통 HUD (DEC-UI-017, DEC-UI-018, DEC-UI-002)
//
// 재배 모드와 습격 모드 모두에서 표시하는 공통 레이어다.
// 위치·크기·색은 전부 layout.css 의 변수에서 온다. 여기에 픽셀 값을 쓰지 않는다
// (개발 로드맵 2절 — 기획자 사진을 받으면 CSS 값만 고친다).
//
// 이 파일은 **상태를 읽어 그리기만 한다.** 자원을 직접 바꾸지 않는다.
// 소지금은 필드 HUD 에 표시하지 않는다. 정비 단계 화면에서만 보인다 (DEC-UI-017).

import './layout.css'

/** 퀵슬롯 한 칸의 표시 상태 */
export interface QuickslotView {
  /** 편성된 무기 이름. 빈 칸이면 null */
  name: string | null
  /** 보유 수량. 편성돼 있어도 0일 수 있다 (DEC-RESOURCE-015) */
  count: number
  selected: boolean
}

export interface HudView {
  health: number
  maxHealth: number
  dayNumber: number

  /** 재배 모드에서만 값이 있다. 습격 모드에는 시간제한이 없다 (DEC-UI-017) */
  remainingSeconds: number | null
  timeUrgent: boolean

  quickslots: readonly QuickslotView[]
  /** 선택된 회복 아이템 이름. 사용 가능한 것이 없으면 null */
  recoveryName: string | null

  /**
   * 소진으로 자동 전환돼 새로 선택된 칸 (DEC-UI-002, DEC-INPUT-007).
   *
   * **상시 선택 강조(`selected`)와 다른 것이다.** 선택 강조는 유지되는 상태이고
   * 이건 "방금 바뀌었다"는 전환 알림이라 짧게 나타났다 사라진다. 둘을 한 값으로
   * 합치면 자동 전환과 손으로 고른 것이 화면에서 구분되지 않는다.
   * 강조가 끝나면 null 이다.
   */
  autoSwitchedIndex: number | null

  /**
   * 투척 무기가 없는 상태로 좌클릭했을 때의 짧은 안내 (DEC-UI-002).
   *
   * 확정문은 "빈 발사음과 짧은 안내"를 요구한다. 소리는 오디오 서브시스템이 없어
   * 아직 없다(6절 P2). 표시하지 않을 때는 null 이다.
   */
  emptyFireNotice: string | null

  /**
   * 습격 예고 표지 (`raid_notices.hud_label`).
   *
   * `DEC-RUN-011` 이 문구를 승인 데이터에서 공급하라고 정했는데 `raid_notices.csv` 가
   * 아직 없다. 그동안 null 로 두고 자리만 비운다 — 임시 문구를 코드에 넣으면
   * 그 자체가 위반이고, 나중에 데이터가 와도 아무도 지우지 않는다.
   */
  raidNoticeLabel: string | null
}

export interface Hud {
  render(view: HudView): void
  /**
   * 필드가 떠 있는 동안만 보인다 (DEC-UI-017 — **필드 공통** HUD).
   *
   * 독립 화면(일차 시작·결과 2종·런 실패·엔딩)은 필드를 대체하는 전환이라
   * HUD 가 남으면 안 된다 (DEC-UI-014). 그런데 독립 화면의 배경이 완전 불투명이
   * 아니라서, 안 지우면 엔딩 화면 위로 체력과 일차가 비친다.
   *
   * 정비 허브는 반대다 — 셔터가 필드를 덮는 **오버레이**라 필드가 살아 있고
   * HUD 도 그대로 둔다.
   */
  setVisible(visible: boolean): void
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

export interface HudHandlers {
  /** 일시정지·설정 아이콘. Esc 와 같은 화면을 연다 (DEC-UI-017) */
  onPause(): void
}

export function createHud(container: HTMLElement, handlers: HudHandlers): Hud {
  const root = el('div', 'hud')

  // ── 좌상단: 체력 + 일차 ──────────────────────────
  const topLeft = el('div', 'hud__corner hud__corner--top-left')
  const health = el('div', 'hud__health')
  const healthBar = el('div', 'hud__health-bar')
  const healthFill = el('div', 'hud__health-fill')
  const healthText = el('div', 'hud__health-text')
  healthBar.appendChild(healthFill)
  health.append(healthBar, healthText)
  const day = el('div', 'hud__day')
  topLeft.append(health, day)

  // ── 상단 중앙: 남은 시간 + 습격 예고 ─────────────
  const topCenter = el('div', 'hud__corner hud__corner--top-center')
  const time = el('div', 'hud__time')
  const raidNotice = el('div', 'hud__raid-notice')
  topCenter.append(time, raidNotice)

  // ── 우상단: 일시정지·설정 ────────────────────────
  const topRight = el('div', 'hud__corner hud__corner--top-right')
  const pauseButton = el('button', 'hud__icon-button', '일시정지')
  pauseButton.type = 'button'
  pauseButton.addEventListener('click', () => handlers.onPause())
  topRight.appendChild(pauseButton)

  // ── 하단 중앙: 퀵슬롯 + 회복 아이템 ──────────────
  const bottom = el('div', 'hud__corner hud__corner--bottom-center')
  const quickslots = el('div', 'hud__quickslots')
  const noThrowable = el('div', 'hud__no-throwable', '투척 무기 없음')
  // 빈 발사 안내는 `투척 무기 없음` 표시와 별개다 (DEC-UI-002).
  // 하나는 상태이고 하나는 방금 누른 것에 대한 반응이라 자리를 나눈다.
  const emptyFire = el('div', 'hud__empty-fire')
  const recovery = el('div', 'hud__recovery')
  bottom.append(quickslots, recovery)

  root.append(topLeft, topCenter, topRight, bottom)
  container.appendChild(root)

  /** 퀵슬롯 칸은 개수가 고정이라 매번 만들지 않고 재사용한다 */
  const slotNodes: { root: HTMLElement; name: HTMLElement; count: HTMLElement }[] = []

  function ensureSlots(n: number): void {
    while (slotNodes.length < n) {
      const slot = el('div', 'hud__slot')
      const name = el('div')
      const count = el('div', 'hud__slot-count')
      slot.append(name, count)
      quickslots.appendChild(slot)
      slotNodes.push({ root: slot, name, count })
    }
    while (slotNodes.length > n) {
      const removed = slotNodes.pop()
      removed?.root.remove()
    }
  }

  return {
    render(view) {
      // 체력 — 게이지 바와 수치를 함께, 수치는 바 우측 (DEC-UI-017)
      const ratio = view.maxHealth > 0 ? view.health / view.maxHealth : 0
      healthFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`
      healthText.textContent = `${view.health} / ${view.maxHealth}`

      day.textContent = `${view.dayNumber}일차`

      // 습격 모드에는 시간제한이 없으므로 표시하지 않는다 (DEC-UI-017)
      if (view.remainingSeconds === null) {
        time.textContent = ''
      } else {
        time.textContent = `${Math.ceil(view.remainingSeconds)}초`
      }
      time.classList.toggle('hud__time--urgent', view.timeUrgent)

      // 문구가 없으면 빈 자리로 둔다. 임시 문구를 채우지 않는다 (DEC-RUN-011)
      raidNotice.textContent = view.raidNoticeLabel ?? ''

      ensureSlots(view.quickslots.length)
      let anyUsable = false
      view.quickslots.forEach((slot, i) => {
        const node = slotNodes[i]
        node.name.textContent = slot.name ?? ''
        node.count.textContent = slot.name === null ? '' : String(slot.count)
        node.root.classList.toggle('hud__slot--selected', slot.selected)
        // 편성은 유지한 채 사용 불가로만 구분한다 (DEC-RESOURCE-015)
        node.root.classList.toggle('hud__slot--empty', slot.name !== null && slot.count === 0)
        // 소진 자동 전환으로 방금 선택된 칸을 짧게 강조한다 (DEC-UI-002).
        // 이름이 이미 칸 안에 있으므로 칸을 강조하는 것이 곧 이름 강조다.
        node.root.classList.toggle('hud__slot--switched', i === view.autoSwitchedIndex)
        if (slot.name !== null && slot.count > 0) anyUsable = true
      })

      // 모든 투척 무기가 소진되면 퀵슬롯 전체를 비활성화하고 안내를 띄운다 (DEC-UI-002)
      quickslots.classList.toggle('hud__quickslots--exhausted', !anyUsable)
      if (anyUsable) noThrowable.remove()
      else if (!noThrowable.isConnected) bottom.insertBefore(noThrowable, recovery)

      // 무기 없이 좌클릭했을 때의 짧은 안내 (DEC-UI-002)
      if (view.emptyFireNotice === null) {
        emptyFire.remove()
      } else {
        emptyFire.textContent = view.emptyFireNotice
        if (!emptyFire.isConnected) bottom.insertBefore(emptyFire, recovery)
      }

      // 문구는 DEC-RESOURCE-017 확정 원문을 그대로 쓴다
      recovery.textContent = view.recoveryName ?? '회복 아이템 없음'
    },

    setVisible(visible) {
      root.hidden = !visible
    },

    destroy() {
      root.remove()
    },
  }
}
