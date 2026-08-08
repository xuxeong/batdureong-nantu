// 일차 시작 화면 (DEC-UI-016, DEC-UI-028, DEC-RUN-011, DEC-JOURNAL-001)
//
// 매 일차의 아침이다. 현재 일차, 그날 밤의 습격 예고, 전날 일지 셋만 있다.
//
// ── 이 화면이 표시하지 않는 것 ─────────────────────────────
//
// `DEC-UI-016` 이 명시로 금지한 것들이다. 화면이 비어 보인다고 채우지 않는다.
//   - 당일 목표·과제 — 이 게임에는 일차별 목표 시스템이 **없다**
//   - 전체 습격 일정과 남은 일수 — 예고는 그날 밤까지만 말한다 (DEC-RUN-011)
//   - 적대 주민의 이름, 전투·보상 정보
//
// 그리고 자동으로 넘어가지 않는다. 진행 입력이 있어야 닫힌다.
//
// ── 일지 영역은 있고 없고가 갈린다 (DEC-UI-028) ────────────
//
// 1일차 아침에는 전날 기록이 없어 **영역 자체를 만들지 않는다.** 비운 채 자리를
// 남기는 것과 다르다. 생성 중에는 같은 자리에 대기 표시만 하고, 폴백 일지를 정상
// 생성분과 시각적으로 구분하지 않는다 — 화면은 어느 쪽인지 알 필요가 없어서
// `DayStartJournal` 에 그 구분이 없다.
//
// 이 파일은 화면만 만든다. 흐름 전진과 일지 생성은 호출하는 쪽이 한다.

import type { RaidNotice, RaidType } from '../data/types.ts'
import { applyHanjiPanel } from './panel.ts'
import './layout.css'

/**
 * 일지 영역의 상태.
 *
 * `null` 은 "아직 없다" 가 아니라 **"이 아침에는 일지가 없다"** 이며 1일차뿐이다.
 * 생성 중은 `pending`, 표시할 문장이 있으면 `ready` 다.
 */
export type DayStartJournal = { state: 'pending' } | { state: 'ready'; text: string } | null

export interface DayStartView {
  dayNumber: number
  /** 그날 밤의 습격 종류. 세 값을 시각적으로 구분한다 (DEC-RUN-011) */
  raidType: RaidType
  /** raid_notices.opening_text — 일차 시작 연출용 **문장** 형태 (DEC-RUN-011) */
  raidNoticeText: string
  journal: DayStartJournal
}

export interface DayStartHandlers {
  /**
   * 다음으로 넘어가는 진행 입력. **하나뿐이다** (DEC-UI-016).
   * 뒤로 가거나 일지를 다시 생성하는 수단을 두지 않는다 (DEC-UI-028).
   */
  onContinue(): void
}

export interface DayStartScreen {
  render(view: DayStartView): void
  show(): void
  hide(): void
  destroy(): void
}

export type RaidNoticeSelection =
  | { ok: true; notice: RaidNotice }
  | { ok: false; reason: string }

/**
 * 그날의 습격 예고를 고른다.
 *
 * 승인 행은 `raid_type` 세 값마다 정확히 하나다 (스키마 6, DEC-CONTENT-021).
 * 없거나 여럿이면 문구를 지어내지 않고 데이터 오류로 올린다 — 습격 예고 문구를
 * 코드에 두는 것은 `DEC-RUN-011` 이 금지했다.
 */
export function selectRaidNotice(
  rows: readonly RaidNotice[] | undefined,
  raidType: RaidType,
): RaidNoticeSelection {
  const matched = (rows ?? []).filter((row) => row.raid_type === raidType)

  if (matched.length === 0) {
    return {
      ok: false,
      reason:
        `raid_notices 에 raid_type=${raidType} 승인 행이 없다. 습격 예고 문구는 ` +
        '코드에 둘 수 없다 (DEC-RUN-011)',
    }
  }

  if (matched.length > 1) {
    return {
      ok: false,
      reason: `raid_notices 의 raid_type=${raidType} 승인 행이 ${matched.length} 개다. 하나여야 한다`,
    }
  }

  return { ok: true, notice: matched[0] }
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
 * 일차 표시 문구.
 *
 * `DEC-UI-029` 가 말하는 **조작만 가리키는 라벨**이 아니라 화면이 숫자에 붙이는
 * 단위다. 바꿔도 플레이어의 선택이 달라지지 않으므로 데이터로 빼지 않는다.
 */
const DAY_SUFFIX = '일차'

/**
 * 진행 입력과 대기 표시 문구.
 *
 * `DEC-UI-029` 의 두 번째 갈래다 — 누르면 다음으로 넘어간다는 사실 외에 아무
 * 정보도 담지 않는다. 정비 종료 버튼(`DEC-RUN-006`)과 달리 다음에 무엇이
 * 일어나는지 알리지 않으므로 승인 데이터에서 공급하지 않는다.
 */
const CONTINUE_LABEL = '시작'
const JOURNAL_PENDING_LABEL = '일지를 쓰는 중…'

export function createDayStart(
  container: HTMLElement,
  handlers: DayStartHandlers,
): DayStartScreen {
  const root = el('div', 'day-start')
  root.hidden = true

  const panel = el('div', 'day-start__panel')
  // 한지 판 (팀 결정 8/8 — CSS 로 뜨는 창은 전부 한지다)
  applyHanjiPanel(panel)

  const day = el('h1', 'day-start__day')
  const notice = el('p', 'day-start__notice')

  // 일지 영역은 1일차에 **만들지 않는다** (DEC-UI-028). 자리를 비워 두는 것과
  // 다르므로 hidden 이 아니라 붙였다 뗀다.
  const journal = el('p', 'day-start__journal')

  const continueButton = el('button', 'day-start__continue', CONTINUE_LABEL)
  continueButton.type = 'button'
  continueButton.addEventListener('click', () => handlers.onContinue())

  panel.append(day, notice, continueButton)
  root.appendChild(panel)
  container.appendChild(root)

  return {
    render(view) {
      day.textContent = `${view.dayNumber}${DAY_SUFFIX}`

      notice.textContent = view.raidNoticeText
      // 세 종류를 시각적으로 구분한다 (DEC-RUN-011). 실제 색은 layout.css 가
      // 갖고 있고 아트 디렉션 4.5 색표가 채워지면 그 값으로 바뀐다.
      notice.className = `day-start__notice day-start__notice--${view.raidType}`

      if (view.journal === null) {
        journal.remove()
        // 1일차에는 기다릴 일지가 없다. 앞 일차에서 잠근 채로 왔을 수 있으니 푼다.
        continueButton.disabled = false
        return
      }

      /*
        일지가 오는 동안 진행 버튼을 잠근다.

        안 잠그면 생성이 끝나기 전에 눌러서 **그날 일지를 아예 못 보고** 넘어간다.
        LLM 응답이 0.6~1.7초라 잠깐이지만, 빠르게 누르는 플레이어에게는 일지가
        있다 없다 한다 — 매번 다른 화면이 나오는 셈이다.

        `DEC-JOURNAL-003` 의 *"일지 생성 실패는 일차 진행을 막지 않는다"* 와
        충돌하지 않는다. 그 문장은 **실패**를 말하는데, 실패하면 승인된 폴백
        문구가 즉시 채워져 `ready` 가 되므로 여기서 잠기는 시간이 없다.
        잠기는 것은 생성이 아직 진행 중인 동안뿐이다.
      */
      continueButton.disabled = view.journal.state === 'pending'

      // 대기 표시와 완성 일지가 같은 자리를 쓴다 (DEC-UI-028).
      // 폴백인지 아닌지로 모양을 바꾸지 않는다 — 이 화면은 그 구분을 받지도 않는다.
      journal.textContent =
        view.journal.state === 'pending' ? JOURNAL_PENDING_LABEL : view.journal.text
      journal.classList.toggle('day-start__journal--pending', view.journal.state === 'pending')

      // 진행 버튼 앞에 둔다.
      if (journal.parentElement === null) panel.insertBefore(journal, continueButton)
    },

    show() {
      root.hidden = false
    },

    hide() {
      root.hidden = true
    },

    destroy() {
      root.remove()
    },
  }
}
