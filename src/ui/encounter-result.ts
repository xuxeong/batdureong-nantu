// 조우 결과 화면 (DEC-RUN-015, DEC-UI-011, DEC-UI-012, DEC-UI-013, DEC-UI-023)
//
// 런 실패를 제외한 모든 주민 조우의 해결 경로가 이 화면을 거친다. 밤 결과와 같은
// 층위이고 **하루에 하나만** 나타난다. 여기서 새로운 후속 선택을 제공하지 않는다.
//
// ── 표시할 것 (DEC-UI-011) ─────────────────────────────────
//
//   주민 표시 이름 / 해결 방식 / 최종 생존·소속 상태 / 관계 상태
//   실제 지급된 보상 (없으면 영역 자체를 그리지 않는다)
//   자원 협상으로 소비된 작물 · 협상이 거절됐으면 소비되지 않았다는 사실
//   이번 조우에서 **새로** 확인한 사연 정보의 ending_fact_text
//   영입이면 다음 습격부터 지원한다는 사실 · 대가·퇴각이면 지원하지 않는다는 사실
//
// ── 표시하지 않을 것 ───────────────────────────────────────
//
//   `final_outcome` 같은 키 이름 (DEC-UI-011). 아래 표가 사람이 읽는 말로 바꾼다
//   `source_fact_text` (DEC-UI-011). 숨겨진 설정 원본이라 런타임 JSON 에 아예 없다
//   전투 보정의 실제 배율과 수치 (DEC-UI-009)
//   **제출 빌드의 공포도 점수·구간·변화량** (DEC-UI-013, DEC-RESIDENT-047).
//   문장·게이지·아이콘 어느 형태로도 두지 않는다 — 관계 상태가 공포도를 올리는
//   행동과 대응하므로 같은 내용을 두 번 전달하지 않는다. 빌드 판정은 호출하는 쪽이
//   하고 이 화면은 `fear` 가 null 이면 영역을 아예 만들지 않는다
//
// 이 파일은 화면만 만든다. 결과 확정과 자원 변경은 systems/resolution.ts 가 끝냈다.

import type { FinalOutcome } from '../data/types.ts'
import { subjectParticle } from './korean.ts'
import type {
  RelationshipState,
  ResidentAllegiance,
  ResidentLifeState,
} from '../state/types.ts'
import { assetCssUrl, UI_ASSET } from '../render/assets.ts'
import { applyHanjiPanel } from './panel.ts'
import { applyClosedDoors } from './shutter.ts'
import './layout.css'

/** 지급되거나 소비된 자원 한 줄. 표시 이름은 승인 데이터에서 온다 */
export interface EncounterResourceLine {
  name: string
  quantity: number
}

/** 개발 빌드 전용 공포도 표시 (DEC-UI-013). 제출 빌드에서는 view.fear 가 null 이다 */
export interface EncounterFearView {
  total: number
  delta: number
  /** fear_bands.display_name. 구간을 못 찾았으면 null */
  bandName: string | null
}

export interface EncounterResultView {
  /** residents.display_name */
  residentName: string
  /**
   * 주민 초상화 `asset.portrait.*` (A6 목업 — 카드 왼쪽에 선다).
   *
   * 대화 화면과 같은 그림이다. 없으면 칸을 만들지 않고 글이 왼쪽으로 넓어진다 —
   * 빈 사각형은 "그림이 깨졌나" 로 읽힌다.
   */
  portraitAsset?: string | null
  outcome: FinalOutcome
  lifeState: ResidentLifeState
  allegiance: ResidentAllegiance
  relationship: RelationshipState

  /** 실제로 지급된 자원만. 비면 보상 영역을 그리지 않는다 (DEC-UI-011) */
  rewards: readonly EncounterResourceLine[]
  /** 자원 협상으로 실제 소비된 작물 (DEC-RESIDENT-050) */
  consumedCrops: readonly EncounterResourceLine[]
  /** 협상이 성격 프로필에 막혀 수확물이 소비되지 않았다 */
  negotiationRejected: boolean

  /** 이번 조우에서 **새로** 확인한 사연 정보의 ending_fact_text */
  revealedFacts: readonly string[]
  /**
   * 이번 습격을 지원한 영입 주민의 표시 이름. 지원이 없었으면 null (DEC-UI-012).
   *
   * **조우 상대가 아니라 지원한 쪽이다.** 8/6까지 이 자리가 조우 상대의
   * `supportUsed` 였는데, 해결된 주민은 다시 적대로 나오지 않으므로
   * (`DEC-RESIDENT-043`) 그 값이 항상 false 였고 줄이 한 번도 안 떴다.
   */
  supportedBy: string | null

  /** 개발 빌드에서만 값이 있다 */
  fear: EncounterFearView | null
}

export interface EncounterResultHandlers {
  /** 다음 일차 또는 엔딩으로. 진행 입력은 **하나뿐이다** (DEC-UI-023) */
  onContinue(): void
}

export interface EncounterResultScreen {
  render(view: EncounterResultView): void
  show(): void
  hide(): void
  destroy(): void
}

/**
 * 해결 방식 (DEC-UI-011 — 키 이름을 그대로 노출하지 않는다).
 *
 * 문장은 `DEC-RESIDENT-052`·`DEC-RESIDENT-012` 확정 원문의 어휘를 그대로 쓴다.
 * 정비 허브의 진행 버튼이 `DEC-RUN-006` 원문을 그대로 쓰는 것과 같은 취급이다 —
 * 새 표현을 지어내면 기획서와 화면이 다른 말을 하게 된다.
 */
const OUTCOME_LABEL: Readonly<Record<FinalOutcome, string>> = {
  empathy_resolve: '공감·설득으로 해결',
  resource_negotiation_resolve: '자원 협상으로 해결',
  recruited: '투항 수용·영입',
  retreated: '대가 요구·퇴각',
  killed: '처치',
}

/** DEC-RESIDENT-052 — 생존 여부 */
const LIFE_LABEL: Readonly<Record<ResidentLifeState, string>> = {
  alive: '생존',
  killed: '처치됨',
}

/** DEC-RESIDENT-041, 052 — 플레이어와의 소속 */
const ALLEGIANCE_LABEL: Readonly<Record<ResidentAllegiance, string>> = {
  neutral: '중립',
  recruited: '영입',
  hostile: '적대',
}

/** DEC-UI-013 — 표시 이름은 DEC-RESIDENT-012 가 정한 여섯 가지를 쓴다 */
const RELATIONSHIP_LABEL: Readonly<Record<RelationshipState, string>> = {
  unformed: '미형성',
  friendly: '우호',
  trade: '거래',
  companion: '동료',
  coercive: '강압',
  severed: '단절',
}

/**
 * 이후 습격에 적용될 변화 (DEC-UI-011).
 *
 * 영입과 대가·퇴각에만 있다. 나머지 셋은 지원과 무관하므로 줄을 만들지 않는다.
 */
const SUPPORT_NOTE: Readonly<Partial<Record<FinalOutcome, string>>> = {
  recruited: '다음 습격부터 이 주민이 지원한다.',
  retreated: '대가를 받고 보낸 주민은 습격을 지원하지 않는다.',
}

/**
 * 진행 버튼 문구.
 *
 * **근거 없이 고른 값이다.** 결과 화면의 진행 입력 문구를 정한 확정 DEC 가 없다.
 * 밤 결과와 같은 말을 쓴다 — 같은 층위의 화면이라 서로 다르면 그 차이가 뜻을 갖는
 * 것처럼 읽힌다.
 */
const CONTINUE_LABEL = '확인'

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

/** 제목이 붙은 구획. 내용이 없으면 아예 만들지 않는 쪽에서 걸러 부른다 */
function section(title: string, body: HTMLElement[]): HTMLElement {
  const wrap = el('div', 'encounter-result__section')
  wrap.appendChild(el('div', 'encounter-result__section-title', title))
  wrap.append(...body)
  return wrap
}

function resourceRows(lines: readonly EncounterResourceLine[]): HTMLElement[] {
  return lines.map((line) => {
    const row = el('div', 'encounter-result__resource')
    row.append(
      el('span', undefined, line.name),
      el('span', 'encounter-result__count', String(line.quantity)),
    )
    return row
  })
}

export function createEncounterResult(
  container: HTMLElement,
  handlers: EncounterResultHandlers,
): EncounterResultScreen {
  const root = el('div', 'encounter-result')
  root.hidden = true

  // 배경은 닫힌 창호지다 (A6 목업). 그래서 앞의 미닫이문 전환이 문을 닫은 뒤
  // 열지 않고 그냥 치운다 — 이 배경이 같은 그림으로 이어진다 (shutter.closeThen).
  //
  // 전용 그림(bg_encounter_result)이 오기 전까지는 문짝 두 장을 그대로 깐다 —
  // 전환 층과 같은 파일이라 픽셀까지 이어진다 (applyClosedDoors 주석).
  const backgroundUrl = assetCssUrl(UI_ASSET.bgEncounterResult)
  if (backgroundUrl !== null) {
    root.classList.add('encounter-result--has-art')
    root.style.setProperty('--result-background', backgroundUrl)
  } else if (applyClosedDoors(root)) {
    root.classList.add('encounter-result--has-art')
  }

  const panel = el('div', 'encounter-result__panel')
  // 한지 판 (팀 결정 8/8 — CSS 로 뜨는 창은 전부 한지다)
  applyHanjiPanel(panel)

  // ── 카드 두 칸 (A6 목업) ─────────────────────────
  //
  // 왼쪽이 주민 초상화, 오른쪽이 글 전부다. 초상화가 없으면 칸을 아예 만들지
  // 않으므로 항상 두 칸인 것은 아니다 — 오른쪽 칸이 그때 카드 전체가 된다.
  const portrait = el('div', 'encounter-result__portrait')
  const column = el('div', 'encounter-result__column')

  // ── 머리: 주민 이름 + 해결 방식 (같은 줄, 아래 밑줄) ──
  const header = el('div', 'encounter-result__header')
  const residentName = el('div', 'encounter-result__resident')
  const outcome = el('div', 'encounter-result__outcome')
  header.append(residentName, outcome)

  // ── 최종 상태 세 가지 ────────────────────────────
  const states = el('div', 'encounter-result__states')

  // ── 나머지는 결과마다 있고 없고가 갈려 매번 다시 만든다 ──
  const body = el('div', 'encounter-result__body')

  // 진행 버튼은 팻말 그림이 아니라 목업의 크림 상자다 (A6). 카드 안이라
  // 나무 팻말이 서면 배경(정비 화면 버튼)과 층위가 섞여 보인다.
  const continueButton = el('button', 'encounter-result__continue', CONTINUE_LABEL)
  continueButton.type = 'button'

  /**
   * 확인을 누르면 카드가 먼저 내려가고 그다음 화면이 바뀐다 (8/9 플로우 —
   * "카드가 내려가고 창호지가 열리면서 새로운 일차").
   *
   * 내려가는 동안 `onContinue` 를 잡아 둔다 — 바로 부르면 화면이 즉시 바뀌어
   * 퇴장이 보이지 않는다. 아트가 없거나 움직임을 꺼 뒀으면 잡지 않는다.
   */
  const EXIT_MS = 300
  let leaving = false
  continueButton.addEventListener('click', () => {
    if (leaving) return
    const animated =
      root.classList.contains('encounter-result--has-art') &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!animated) {
      handlers.onContinue()
      return
    }
    leaving = true
    root.classList.add('encounter-result--leaving')
    window.setTimeout(() => handlers.onContinue(), EXIT_MS)
  })

  column.append(header, states, body, continueButton)
  panel.append(portrait, column)
  root.appendChild(panel)
  container.appendChild(root)

  /** 이름표 + 값 한 쌍 */
  function stateChip(label: string, value: string): HTMLElement {
    const chip = el('div', 'encounter-result__chip')
    chip.append(
      el('span', 'encounter-result__chip-label', label),
      el('span', undefined, value),
    )
    return chip
  }

  return {
    render(view) {
      residentName.textContent = view.residentName
      outcome.textContent = OUTCOME_LABEL[view.outcome]

      // 그림이 없으면 칸을 통째로 숨긴다 — 대화 화면 초상화와 같은 처리다
      const portraitUrl = assetCssUrl(view.portraitAsset)
      portrait.hidden = portraitUrl === null
      if (portraitUrl !== null) portrait.style.setProperty('--portrait-image', portraitUrl)

      states.replaceChildren(
        stateChip('생존', LIFE_LABEL[view.lifeState]),
        stateChip('소속', ALLEGIANCE_LABEL[view.allegiance]),
        stateChip('관계', RELATIONSHIP_LABEL[view.relationship]),
      )

      const sections: HTMLElement[] = []

      // 보상이 없는 결과에는 보상 영역을 표시하지 않는다 (DEC-UI-011).
      // 빈 목록에 "없음"을 적지 않는다 — 확정문이 영역 자체를 두지 말라고 한다.
      if (view.rewards.length > 0) {
        sections.push(section('받은 것', resourceRows(view.rewards)))
      }

      // 협상은 셋 중 하나다 — 소비했거나, 거절돼 소비되지 않았거나, 협상이 아니었거나.
      if (view.consumedCrops.length > 0) {
        sections.push(section('내준 수확물', resourceRows(view.consumedCrops)))
      } else if (view.negotiationRejected) {
        sections.push(
          section('내준 수확물', [
            el('div', 'encounter-result__note', '수확물은 소비되지 않았다.'),
          ]),
        )
      }

      // 이번 조우에서 새로 확인한 것만 온다. 이미 확인한 정보를 거르는 것은
      // 호출하는 쪽이 한다 — 무엇이 이미 확인됐는지는 런 상태가 안다 (DEC-UI-011).
      if (view.revealedFacts.length > 0) {
        sections.push(
          section(
            '알게 된 것',
            view.revealedFacts.map((fact) => el('p', 'encounter-result__fact', fact)),
          ),
        )
      }

      const supportNotes: HTMLElement[] = []
      const note = SUPPORT_NOTE[view.outcome]
      if (note !== undefined) supportNotes.push(el('p', 'encounter-result__note', note))
      // 지원 기회 소비도 이 화면에서 전달한다 (DEC-UI-012).
      // **누가 썼는지 밝힌다** — 이름 없이 "소비했다" 만 두면 조우 상대의 이야기로
      // 읽히고, 실제로는 이전 습격에서 영입한 다른 주민이다.
      if (view.supportedBy !== null) {
        const who = view.supportedBy
        supportNotes.push(
          el(
            'p',
            'encounter-result__note',
            `${who}${subjectParticle(who)} 이번 습격을 지원했다. 지원 기회는 여기서 소비됐다.`,
          ),
        )
      }
      if (supportNotes.length > 0) sections.push(section('이후 습격', supportNotes))

      // 공포도는 개발 빌드에서도 더 이상 그리지 않는다 (8/10 담당자 — 제출 전
      // 정리). 판정에는 계속 쓰이고 콘솔 로그로 남는다. view.fear 는 부르는
      // 쪽 계약이라 그대로 받되 여기서 버린다 — 되살릴 일이 생기면 이 자리다.

      body.replaceChildren(...sections)
    },

    show() {
      // 지난번 퇴장 상태가 남아 있으면 카드가 내려간 채로 뜬다
      if (root.hidden) {
        leaving = false
        root.classList.remove('encounter-result--leaving')
      }
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
