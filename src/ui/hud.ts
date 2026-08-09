// 필드 공통 HUD (DEC-UI-036, DEC-UI-018, DEC-UI-002)
//
// 재배 모드와 습격 모드 모두에서 표시하는 공통 레이어다.
// 위치·크기·색은 전부 layout.css 의 변수에서 온다. 여기에 픽셀 값을 쓰지 않는다
// (개발 로드맵 2절).
//
// 이 파일은 **상태를 읽어 그리기만 한다.** 자원을 직접 바꾸지 않는다.
// 소지금은 필드 HUD 에 표시하지 않는다. 정비 단계 화면에서만 보인다 (DEC-UI-036).
//
// ── A1 확정 배치 (아트 디렉션 12.2) ────────────────────────
//
//   상단 왼쪽 끝    나무 표지판 하나 — 위칸 현재 일차 / 아래칸 습격 예고
//   상단 가운데     가로로 긴 게이지 하나 — 남은 재배 시간. **숫자를 넣지 않는다**
//   상단 오른쪽 끝  톱니바퀴 버튼 하나. 이것뿐이다
//   하단 왼쪽 끝    가로로 긴 카드 — 초상화 자리 / 이름 / 체력 바 + 바 우측 수치
//   하단 오른쪽     투척 퀵슬롯 4칸, 그 오른쪽에 회복 칸이 화면 끝에 닿는다
//
// **일차와 습격 예고를 한 틀에 합쳤다.** 8/5까지 둘이 `topLeft`·`topCenter` 로
// 갈려 있었는데 `asset.ui.signboard` 가 두 칸짜리 한 장이다.
//
// **남은 시간에서 숫자를 뺐다.** `DEC-UI-036` 은 "재배 모드 전용 요소: 남은 재배
// 시간" 이라고만 정하고 형태를 정하지 않았고, `DEC-UI-018` 이 *"배치 좌표, 색과
// 아이콘은 `DEC-ART-004`에서 정한다"* 로 위임했다. 그 위임을 받은 A1 이 게이지로
// 정했다. 반면 **체력 수치는 뺄 수 없다** — `DEC-UI-036` 이 "게이지 바와 수치를
// 함께 표시, 바 우측에 수치" 로 못박았다.
//
// **플레이어 이름은 아트 장식이다.** `DEC-UI-036` 의 공통 요소 여덟 개에 이름이
// 없지만 `DEC-UI-030` 이름 입력에서 오는 값이라 새 정보를 더하는 것이 아니다.
// 근거는 아트 디렉션 14.2 이며, 이름을 넣으려고 그 DEC 를 폐기·대체하지는 않았다.
// (8/8 에 `DEC-UI-017` 이 `DEC-UI-036` 로 대체됐는데 이유는 이름이 아니라
//  퀵슬롯 칸 수다 — 5칸 → 4칸.)

import { assetCssUrl, UI_ASSET } from '../render/assets.ts'
import { KEY_BINDINGS } from '../input/bindings.ts'
import { createTooltip } from './tooltip.ts'
import './layout.css'

/**
 * 회복 키의 표시 이름. **바인딩에서 읽는다** — `Q` 를 여기 적으면 키를 바꾸는 날
 * 화면과 조작이 다른 말을 한다. `KeyQ` → `Q` 는 일시정지 화면의 조작 안내와
 * 같은 규칙이다 (pause.ts 의 keyLabel).
 */
const RECOVER_KEY_LABEL = (
  Object.entries(KEY_BINDINGS).find(([, action]) => action === 'recover')?.[0] ?? 'KeyQ'
).replace(/^Key/, '')

/** 퀵슬롯 한 칸의 표시 상태 */
export interface QuickslotView {
  /** 편성된 무기 이름. 빈 칸이면 null */
  name: string | null
  /** 보유 수량. 편성돼 있어도 0일 수 있다 (DEC-RESOURCE-015) */
  count: number
  selected: boolean
  /**
   * 편성된 무기의 `asset.icon.*`.
   *
   * `DEC-UI-002` 가 소진 자동 전환 때 "새로 선택된 무기의 **이름과 아이콘**"을
   * 강조하라고 정했다. 그림이 없으면 이름만 남는다.
   */
  icon?: string
}

export interface HudView {
  /** 이름 입력에서 온 값 (DEC-UI-030). 카드 장식이다 — 아트 디렉션 14.2 */
  playerName: string
  health: number
  maxHealth: number
  dayNumber: number

  /**
   * 남은 재배 시간의 **비율** 1~0. 습격 모드에는 시간제한이 없어 null 이다
   * (DEC-UI-036).
   *
   * 초가 아니라 비율인 이유는 화면이 숫자를 쓰지 않기 때문이다. 초를 넘기면
   * 받는 쪽이 전체 길이를 따로 알아야 게이지를 그릴 수 있고, 그 길이는
   * `run_schedules.farming_duration_seconds` 라 HUD 가 알 일이 아니다.
   */
  timeRatio: number | null
  timeUrgent: boolean

  quickslots: readonly QuickslotView[]
  /** 선택된 회복 아이템 이름. 사용 가능한 것이 없으면 null */
  recoveryName: string | null
  /**
   * 선택된 회복 아이템의 `asset.icon.*` (8/9 담당자).
   *
   * 퀵슬롯 칸과 같은 규칙이다 — 그림이 있으면 아이콘만 남기고 이름을 숨긴다.
   * 칸이 162×166 이라 아이콘과 이름을 같이 두면 둘 다 작아진다.
   */
  recoveryIcon?: string
  /**
   * 선택된 회복 아이템의 보유 수량 (A1 목업 8/9).
   *
   * 퀵슬롯 칸의 수량 배지와 같은 자리·같은 모양이다 — 던질 것과 먹을 것의
   * 남은 개수가 화면에서 같은 방식으로 읽혀야 한다. 없으면 배지를 안 그린다.
   */
  recoveryCount?: number | null

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
   * 필드 입력이 잠겨 있는가 (`DEC-UI-026`).
   *
   * **잠겨 있으면 화면 위쪽 안내를 띄우지 않는다.** `투척 무기 없음` 과 빈 발사
   * 안내는 지금 던질 수 있는지를 알리는 것인데, 대화·정비·일시정지 중에는 애초에
   * 던질 수 없어서 알릴 것이 없다.
   *
   * 8/8 에 대화 말풍선을 목업 자리(위쪽)로 옮기면서 `투척 무기 없음` 글자가
   * 말풍선 테두리에 절반 먹혔다. 겹침을 피해 자리를 옮기는 대신 **의미 없는
   * 구간에는 안 띄우는 쪽**을 골랐다 — 자리를 옮기면 다음에 뭔가 커질 때 또 겹친다.
   */
  fieldInputLocked: boolean

  /**
   * 습격 진입 시 어느 주민이 지원하는지 알리는 짧은 안내 (DEC-UI-012).
   *
   * `DEC-UI-036` 의 공통 요소 목록에는 없지만 `DEC-UI-012` 가
   * *"습격 전투에 진입할 때 어느 주민이 지원하는지 알린다"* 로 따로 확정했다.
   * 잠깐 떴다 사라지므로 자리를 상시로 잡지 않는다. 없으면 null 이다.
   */
  allySupportNotice: string | null

  /**
   * 습격 예고 표지 (`raid_notices.hud_label`).
   *
   * `DEC-RUN-011` 이 문구를 승인 데이터에서 공급하라고 정했다. 데이터가 없으면
   * null 이고 표지판 아래칸이 빈다 — 임시 문구를 코드에 넣지 않는다.
   *
   * 재배 모드 내내 상시 노출하며 습격이 없는 날에도 사라지지 않는다 (DEC-UI-036).
   */
  raidNoticeLabel: string | null

  /**
   * 오늘 밤의 습격 종류 (`DEC-RUN-011`). 좌측 상단 판 그림을 가른다.
   *
   * **문구와 판이 같은 값에서 나와야 한다** — 문구는 조용한 밤인데 판은 마지막
   * 습격이면 화면이 서로 다른 말을 한다. 그래서 라벨과 이 값을 한 곳에서 만든다.
   */
  raidType?: 'none' | 'raid' | 'final_raid' | null
}

export interface Hud {
  render(view: HudView): void
  /**
   * 필드가 떠 있는 동안만 보인다 (DEC-UI-036 — **필드 공통** HUD).
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

/**
 * 논리 에셋 ID 를 CSS 변수로 넘긴다.
 *
 * 파일이 없으면 아무것도 설정하지 않는다 — `layout.css` 의 대체 표현(테두리와
 * 배경색)이 그대로 남아 플레이스홀더가 된다. 여기서 경로를 지어내지 않는다.
 */
function bindAsset(node: HTMLElement, property: string, assetId: string): void {
  const url = assetCssUrl(assetId)
  if (url === null) return
  node.style.setProperty(property, url)
  node.classList.add('hud--has-art')
}

/**
 * 일차 표시 문구.
 *
 * 화면이 숫자에 붙이는 단위이지 `DEC-UI-029` 가 말하는 안내 문구가 아니다.
 * 바꿔도 플레이어의 선택이 달라지지 않으므로 데이터로 빼지 않는다.
 */
const DAY_SUFFIX = '일차'

export interface HudHandlers {
  /** 일시정지·설정 아이콘. Esc 와 같은 화면을 연다 (DEC-UI-036) */
  onPause(): void
  /**
   * 퀵슬롯 칸을 눌렀다. 그 자리를 선택한다 (`DEC-INPUT-013`).
   *
   * **키와 같은 일을 한다.** `1~4` 가 위치를 직접 고르는 입력이고 칸을 누르는
   * 것도 같은 뜻이다 — `DEC-UI-035` 가 *"무엇을 고르는 조작은 마우스로만"* 이라
   * 오히려 마우스 쪽이 본류다. 수량이 0이어도 선택은 된다.
   */
  onSelectSlot(index: number): void
  /**
   * 회복 칸을 눌렀다. 회복 퀵메뉴를 연다 (`DEC-UI-037`).
   *
   * `Q` 길게와 같은 메뉴이고 닫는 방법만 다르다 — 이쪽은 정해진 시간이 지나면
   * 스스로 닫힌다. 손을 떼는 순간이 없기 때문이다.
   */
  onOpenRecoveryMenu(): void
}

export function createHud(container: HTMLElement, handlers: HudHandlers): Hud {
  const root = el('div', 'hud')

  // ── 상단 왼쪽 끝: 표지판 (일차 / 습격 예고) ──────
  //
  // 두 칸이 한 장이다. 8/5까지 갈려 있던 두 요소를 여기서 합친다.
  const signboard = el('div', 'hud__signboard')
  const day = el('div', 'hud__signboard-day')
  const raidNotice = el('div', 'hud__signboard-raid')
  signboard.append(day, raidNotice)
  /*
    좌측 상단 판 (A1 목업 8/9).

    **`signboard` 가 아니라 `raid_notice_*` 세 장이다.** 목업이 마을 그림과
    일차·예고 칸을 한 판에 담았고, 그 판이 습격 종류에 따라 갈린다
    (`DEC-RUN-011` — 습격 여부에 따른 시각적 구분).

    한 장만 미리 붙여 두고 `render()` 에서 갈아 끼운다. 셋 다 미리 받아 두지
    않으면 습격 예고가 바뀌는 첫 프레임에 판이 한 번 사라진다.
  */
  bindAsset(signboard, '--hud-signboard-image', UI_ASSET.raidNoticeNone)

  const RAID_PLATE = {
    none: UI_ASSET.raidNoticeNone,
    raid: UI_ASSET.raidNoticeRaid,
    final_raid: UI_ASSET.raidNoticeFinal,
  } as const

  // ── 상단 가운데: 남은 재배 시간 게이지 ───────────
  //
  // 숫자를 넣지 않는다 (A1). 습격 모드에는 시간제한이 없어 통째로 숨는다.
  const timer = el('div', 'hud__timer')
  const timerFill = el('div', 'hud__timer-fill')
  timer.appendChild(timerFill)
  bindAsset(timer, '--hud-timer-image', UI_ASSET.farmingTimer)

  // ── 상단 오른쪽 끝: 일시정지·설정 (버튼 하나) ────
  //
  // 아트 디렉션 14.3 이 "일시정지와 설정은 버튼 하나" 로 정했다.
  const pauseButton = el('button', 'hud__settings')
  pauseButton.type = 'button'
  // 그림이 없을 때만 글자가 보이게 둔다. 아이콘이 붙으면 CSS 가 가린다.
  pauseButton.textContent = '일시정지'
  pauseButton.setAttribute('aria-label', '일시정지')
  pauseButton.addEventListener('click', () => handlers.onPause())
  bindAsset(pauseButton, '--hud-settings-image', UI_ASSET.settingsButton)

  // ── 하단 왼쪽 끝: 플레이어 상태 카드 ─────────────
  //
  // 초상화 자리 · 이름 · 체력 바 · 바 우측 수치 (DEC-UI-036).
  // 초상화 그림은 F단계라 아직 없다. 자리만 만들어 둔다.
  const card = el('div', 'hud__card')
  const portrait = el('div', 'hud__portrait')
  const cardBody = el('div', 'hud__card-body')
  const name = el('div', 'hud__name')
  const healthRow = el('div', 'hud__health')
  const healthBar = el('div', 'hud__health-bar')
  const healthFill = el('div', 'hud__health-fill')
  const healthText = el('div', 'hud__health-text')
  healthBar.appendChild(healthFill)
  healthRow.append(healthBar, healthText)
  cardBody.append(name, healthRow)
  card.append(portrait, cardBody)
  bindAsset(card, '--hud-card-image', UI_ASSET.playerStatusCard)

  // ── 하단 오른쪽: 퀵슬롯 4칸 + 회복 칸 ────────────
  //
  // 회복 칸이 화면 오른쪽 끝에 닿는다 (A1).
  const bottomRight = el('div', 'hud__bottom-right')
  const quickslots = el('div', 'hud__quickslots')
  const recovery = el('div', 'hud__recovery')
  // 퀵슬롯 칸과 같은 구조다 — 아이콘이 있으면 그것만, 없으면 이름이 대신 선다.
  const recoveryIcon = el('div', 'hud__recovery-icon')
  const recoveryName = el('div', 'hud__recovery-name')
  // 수량 배지는 퀵슬롯 칸과 같은 클래스를 쓴다 (A1 목업 8/9) — 같은 뜻의 숫자라
  // 모양이 갈리면 안 된다.
  // 퀵슬롯과 **같은 배지 그림**을 쓴다 (팀 결정 8/9). 에셋 메모에는 "투척 전용,
  // 회복 칸에 자동 적용하지 말 것" 으로 왔는데 담당자가 같은 것으로 정했다 —
  // 같은 뜻의 숫자라 모양이 갈리면 두 칸이 다른 규칙으로 읽힌다.
  const recoveryCount = el('div', 'hud__slot-count')
  bindAsset(recoveryCount, '--hud-slot-badge-image', UI_ASSET.quickslotCountBadge)
  recovery.append(recoveryIcon, recoveryName, recoveryCount)
  bindAsset(recovery, '--hud-recovery-image', UI_ASSET.recoverySlot)
  /*
    회복 칸을 눌러 퀵메뉴를 연다 (DEC-UI-037). 퀵슬롯 칸과 같은 이유로 이 칸만
    클릭을 되살린다.

    **이 클릭은 위로 안 올려보낸다.** 부르는 쪽이 "메뉴 밖 클릭이면 닫는다" 를
    `window` 에서 듣는데, 여는 클릭이 거기까지 올라가면 열자마자 닫힌다.
  */
  recovery.addEventListener('click', (event) => {
    event.stopPropagation()
    handlers.onOpenRecoveryMenu()
  })

  // 회복 칸에 마우스를 올리면 조작 안내가 뜬다 (8/9 — 짧게 사용 / 길게 장착 변경).
  // 두 조작이 한 키에 겹쳐 있어 화면만 봐서는 알 수 없는 정보다 (DEC-UI-037).
  const tooltip = createTooltip(root)
  tooltip.bind(recovery, () => ({
    name: `${RECOVER_KEY_LABEL}를 눌러 회복 아이템 사용`,
    note: `${RECOVER_KEY_LABEL}를 길게 눌러 장착 변경`,
  }))

  bottomRight.append(quickslots, recovery)

  // 퀵슬롯 상태 문구 둘. 자리를 나눠 둔다 (DEC-UI-002).
  // 하나는 "지금 쓸 것이 없다" 는 상태이고 하나는 방금 누른 것에 대한 반응이다.
  const noThrowable = el('div', 'hud__no-throwable', '투척 무기 없음')
  const emptyFire = el('div', 'hud__empty-fire')
  // 지원 안내는 같은 자리를 쓰되 클래스를 나눈다 — 경고가 아니라 알림이라 색이 다르다
  const allyNotice = el('div', 'hud__ally-notice')
  const notices = el('div', 'hud__notices')

  root.append(signboard, timer, pauseButton, card, notices, bottomRight)
  container.appendChild(root)

  /** 퀵슬롯 칸은 개수가 고정이라 매번 만들지 않고 재사용한다 */
  const slotNodes: {
    root: HTMLElement
    icon: HTMLElement
    name: HTMLElement
    count: HTMLElement
  }[] = []

  function ensureSlots(n: number): void {
    while (slotNodes.length < n) {
      const slot = el('div', 'hud__slot')
      // 선택 강조는 다른 그림 한 장이다. 배경을 두 개 겹치지 않고 클래스로 가른다.
      bindAsset(slot, '--hud-slot-image', UI_ASSET.quickslot)
      bindAsset(slot, '--hud-slot-selected-image', UI_ASSET.quickslotSelected)
      // 아이콘 자리. 그림이 붙으면 이름을 가리고 아이콘만 남는다 (DEC-UI-002)
      const slotIcon = el('div', 'hud__slot-icon')
      const slotName = el('div', 'hud__slot-name')
      const count = el('div', 'hud__slot-count')
      bindAsset(count, '--hud-slot-badge-image', UI_ASSET.quickslotCountBadge)
      /*
        칸 위 번호판 (A1 목업 8/9).

        **여기 번호는 장식이 아니라 조작이다.** `DEC-INPUT-013` 이 `1~4` 로 그
        위치를 직접 고르게 정했고, 편성 팝업은 이미 번호를 달고 있다(`hub__slot-index`).
        HUD 에만 없어서 필드에서는 몇 번을 눌러야 하는지 알 수 없었다.

        `DEC-UI-035` 가 막은 번호 표시는 **대화 선택지** 쪽이다 — 거긴 번호키
        조작 자체가 없어서 번호를 보이면 없는 조작을 약속하게 된다. 여기는 반대다.

        길이는 `QUICKSLOT_KEYS` 가 아니라 칸 순서에서 온다. 배치표를 여기서
        다시 읽으면 두 곳이 갈린다 — 칸 수와 키 수가 같은 것은 테스트가 지킨다.
      */
      const index = el('div', 'hud__slot-index', String(slotNodes.length + 1))
      slot.append(slotIcon, slotName, count, index)
      /*
        칸을 눌러 그 자리를 고른다 (`DEC-UI-037` 과 같은 8/9 요청, `DEC-INPUT-013`).

        **HUD 는 클릭을 안 받는다** — 필드 클릭 공격을 가로채면 안 되기 때문에
        `.hud` 가 `pointer-events: none` 이다. 그래서 이 칸만 되살린다.

        번호는 `slotNodes.length` 로 굳힌다. 만들 때 자리가 정해지고 그 뒤로는
        안 바뀌므로, 렌더마다 다시 세면 같은 값을 두 곳에서 계산하게 된다.
      */
      const slotIndex = slotNodes.length
      slot.addEventListener('click', () => handlers.onSelectSlot(slotIndex))

      quickslots.appendChild(slot)
      slotNodes.push({ root: slot, icon: slotIcon, name: slotName, count })
    }
    while (slotNodes.length > n) {
      const removed = slotNodes.pop()
      removed?.root.remove()
    }
  }

  return {
    render(view) {
      // 이름은 카드 장식이다 (아트 디렉션 14.2). 비어 있으면 자리를 비워 둔다 —
      // 이름 입력을 지나면 항상 값이 있고, 없다는 것은 그 화면을 건너뛴 것이다.
      name.textContent = view.playerName

      // 체력 — 게이지 바와 수치를 함께, 수치는 바 우측 (DEC-UI-036).
      // 수치는 **현재 체력 하나**다. 확정문이 요구하는 것이 `현재 체력`의 수치이고
      // 카드 그림의 그 자리가 55px 이라 `100 / 100` 은 들어가지 않는다.
      const ratio = view.maxHealth > 0 ? view.health / view.maxHealth : 0
      healthFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`
      healthText.textContent = String(view.health)

      day.textContent = `${view.dayNumber}${DAY_SUFFIX}`

      // 습격 모드에는 시간제한이 없으므로 게이지를 통째로 숨긴다 (DEC-UI-036)
      timer.hidden = view.timeRatio === null
      if (view.timeRatio !== null) {
        // **퍼센트가 아니라 0~1 비율을 넘긴다.** 게이지 홈은 그림(911px) 전체가
        // 아니라 왼쪽 613px 뿐이라, 퍼센트로 주면 기준이 그림 전체가 되어
        // 게이지가 그림에 박힌 글자 위로 넘어간다. 기준 폭은 layout.css 가 갖는다.
        const clamped = Math.max(0, Math.min(1, view.timeRatio))
        timer.style.setProperty('--hud-timer-ratio', clamped.toFixed(4))
      }
      timer.classList.toggle('hud__timer--urgent', view.timeUrgent)

      // 문구가 없으면 빈 자리로 둔다. 임시 문구를 채우지 않는다 (DEC-RUN-011)
      raidNotice.textContent = view.raidNoticeLabel ?? ''

      // 판 그림을 습격 종류에 맞춘다 (DEC-RUN-011). 종류가 안 오면 그대로 둔다 —
      // 판이 사라지는 것보다 직전 것이 남는 쪽이 화면이 덜 튄다.
      const plate = view.raidType == null ? null : assetCssUrl(RAID_PLATE[view.raidType])
      if (plate !== null) signboard.style.setProperty('--hud-signboard-image', plate)

      ensureSlots(view.quickslots.length)
      let anyUsable = false
      view.quickslots.forEach((slot, i) => {
        const node = slotNodes[i]

        // 아이콘이 있으면 그것만, 없으면 이름을 남긴다 (DEC-UI-002).
        // 매 프레임 요소를 새로 만들지 않고 CSS 변수만 바꾼다.
        const iconUrl = assetCssUrl(slot.icon)
        node.icon.hidden = iconUrl === null
        if (iconUrl !== null) node.icon.style.setProperty('--icon-image', iconUrl)
        node.name.hidden = iconUrl !== null

        node.name.textContent = slot.name ?? ''
        // 빈 칸에는 배지를 안 그린다.
        //
        // **지금도 안 보이긴 한다** — 빈 요소는 세로 여백이 0 이라 높이가 0 이고,
        // 배경색이 있어도 26×0 이라 그려질 게 없다. 다만 8/9 에 배지가 판이 되면서
        // 그게 우연이 됐다. 세로 여백이나 최소 높이가 붙는 순간 빈 크림 판이 뜬다.
        node.count.hidden = slot.name === null
        node.count.textContent = slot.name === null ? '' : String(slot.count)
        node.root.classList.toggle('hud__slot--selected', slot.selected)
        // 편성은 유지한 채 사용 불가로만 구분한다 (DEC-RESOURCE-015)
        node.root.classList.toggle('hud__slot--empty', slot.name !== null && slot.count === 0)
        // 소진 자동 전환으로 방금 선택된 칸을 짧게 강조한다 (DEC-UI-002).
        node.root.classList.toggle('hud__slot--switched', i === view.autoSwitchedIndex)
        if (slot.name !== null && slot.count > 0) anyUsable = true
      })

      // 모든 투척 무기가 소진되면 퀵슬롯 전체를 비활성화하고 안내를 띄운다 (DEC-UI-002).
      // **필드 입력이 잠겨 있으면 안내는 띄우지 않는다** (`HudView.fieldInputLocked`) —
      // 던질 수 없는 동안 "던질 것이 없다" 를 알릴 이유가 없다. 칸 비활성 표시는
      // 상태라서 그대로 둔다.
      quickslots.classList.toggle('hud__quickslots--exhausted', !anyUsable)

      /*
        **좌클릭 반응이 떠 있으면 상태 줄을 내린다** (8/9).

        둘이 같이 뜨면 `투척 무기 없음` 과 `던질 무기가 없다` 가 화면에 나란히
        서서 같은 말을 두 번 한다. `DEC-UI-002` 가 빈 발사에 요구하는 "짧은
        안내" 는 반응 쪽이 이미 하고 있으므로, 겹치는 동안은 그것만 남긴다.
        반응이 사라지면 상태 줄이 다시 올라온다.
      */
      const emptyFireUp = view.emptyFireNotice !== null && !view.fieldInputLocked
      if (anyUsable || view.fieldInputLocked || emptyFireUp) noThrowable.remove()
      else if (!noThrowable.isConnected) notices.appendChild(noThrowable)

      // 무기 없이 좌클릭했을 때의 짧은 안내 (DEC-UI-002)
      if (view.emptyFireNotice === null || view.fieldInputLocked) {
        emptyFire.remove()
      } else {
        emptyFire.textContent = view.emptyFireNotice
        if (!emptyFire.isConnected) notices.appendChild(emptyFire)
      }

      // 습격 진입 시 지원 주민 안내 (DEC-UI-012)
      if (view.allySupportNotice === null) {
        allyNotice.remove()
      } else {
        allyNotice.textContent = view.allySupportNotice
        if (!allyNotice.isConnected) notices.appendChild(allyNotice)
      }

      // 문구는 DEC-RESOURCE-017 확정 원문을 그대로 쓴다
      recoveryName.textContent = view.recoveryName ?? '회복 아이템 없음'

      // 아이콘이 있으면 그것만 남긴다 (퀵슬롯 칸과 같은 규칙).
      const recoveryIconUrl = assetCssUrl(view.recoveryIcon)
      recoveryIcon.hidden = recoveryIconUrl === null
      recoveryName.hidden = recoveryIconUrl !== null
      if (recoveryIconUrl !== null) {
        recoveryIcon.style.setProperty('--hud-recovery-icon-image', recoveryIconUrl)
      }

      const held = view.recoveryCount ?? null
      recoveryCount.hidden = held === null
      if (held !== null) recoveryCount.textContent = String(held)
    },

    setVisible(visible) {
      root.hidden = !visible
    },

    destroy() {
      root.remove()
    },
  }
}
