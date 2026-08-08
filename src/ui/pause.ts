// 일시정지 화면 (DEC-UI-027, DEC-UI-022, DEC-INPUT-009)
//
// ── 확정문이 정한 항목 넷 ──────────────────────────────────
//
//   계속하기 / 음량 설정 / 조작 안내 다시 보기 / 타이틀로 돌아가기
//
// **음량은 2026-08-08 에 들어왔다.** 같은 확정문의 *"오디오를 구현하지 않는
// 빌드에서는 음량 항목을 표시하지 않는다"* 를 근거로 미뤄 뒀던 자리인데,
// `audio/sfx.ts`·`audio/bgm.ts` 가 생기면서 그 전제가 없어졌다. 전체·배경음·
// 효과음 셋을 확정문 그대로 둔다.
//
// **`mixer` 를 안 넘기면 여전히 표시하지 않는다.** 확정문이 "비워 둔다" 가 아니라
// "표시하지 않는다" 라 자리도 만들지 않는다 — 오디오 없는 빌드가 다시 생기면
// 이 인자를 빼는 것으로 확정문을 지킬 수 있다.
//
// **런을 처음부터 다시 시작하는 입력을 두지 않는다.** 확정문이 명시로 금지했다.
// 타이틀로 돌아간 뒤 새 런을 시작하는 것이 유일한 경로다.
//
// **타이틀로 돌아가기에는 확인 절차가 있다.** 현재 런이 사라지기 때문이다.
// 확인은 이 화면 안에서 처리하고 별도 층위를 만들지 않는다 — `DEC-UI-026` 의
// "기능 오버레이는 하나만" 에 걸리면 일시정지 자체가 닫힌다.
//
// ── 문구를 코드에 두는 근거 ────────────────────────────────
//
// `DEC-UI-029` 는 **그 문구를 바꾸면 플레이어의 선택이 달라지는가**를 기준으로
// 삼는다. 조작 안내는 "어느 키가 무엇을 하는가" 이지 게임 안의 판단 재료가
// 아니므로 두 번째 갈래(조작만 가리키는 라벨)다. 승인 데이터로 공급해야 하는
// 목록(진행 버튼·습격 예고·밤 결과·튜토리얼 안내·주민 대사·엔딩 기록문)에도 없다.
//
// 대신 **키 문자열을 여기 적지 않는다.** `input/bindings.ts` 가 유일한 배치표라고
// 스스로 선언했으므로(DEC-INPUT-001) 거기서 역으로 끌어온다. 바인딩을 바꾸면
// 안내가 따라오고, 안 따라오면 안내가 거짓말을 한다.

import type { Mixer, VolumeChannel } from '../audio/mixer.ts'
import { KEY_BINDINGS, MOUSE_BINDINGS, QUICKSLOT_KEYS } from '../input/bindings.ts'
import type { InputAction } from '../input/bindings.ts'
import './layout.css'

export interface PauseHandlers {
  /** 계속하기. `Esc` 를 다시 누른 것과 같다 (DEC-UI-022) */
  onResume(): void
  /** 타이틀로 돌아간다. **확인을 거친 뒤에만** 불린다 (DEC-UI-027) */
  onReturnToTitle(): void
  /**
   * 음량 조절. **없으면 음량 항목 자체를 그리지 않는다** — 오디오를 구현하지
   * 않는 빌드의 처리를 확정문 그대로 두기 위해서다 (DEC-UI-027).
   */
  mixer?: Mixer
}

export interface PauseScreen {
  show(): void
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

/** `KeyboardEvent.code` 를 사람이 읽는 이름으로. 배치표가 바뀌면 여기로 들어온다 */
function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code === 'Escape') return 'Esc'
  return code
}

/** 한 행동에 배정된 키를 배치표에서 찾는다. 없으면 빈 문자열 */
function keyFor(action: InputAction): string {
  const found = Object.entries(KEY_BINDINGS).find(([, a]) => a === action)
  return found === undefined ? '' : keyLabel(found[0])
}

function mouseFor(action: InputAction): string {
  const found = Object.entries(MOUSE_BINDINGS).find(([, a]) => a === action)
  if (found === undefined) return ''
  return found[0] === '0' ? '마우스 왼쪽' : '마우스 오른쪽'
}

/**
 * 조작 안내 (DEC-INPUT-002 ~ 009).
 *
 * 확정된 조작만 적는다. `DEC-INPUT-010`(회피·대시)과 `DEC-INPUT-011`(연속 발사)은
 * **보류라 구현하지 않았으므로 여기에도 없다.** 안내에 먼저 넣으면 없는 조작을
 * 화면이 약속하게 된다.
 */
function controlRows(): { keys: string; what: string }[] {
  const move = (['move_up', 'move_left', 'move_down', 'move_right'] as const)
    .map(keyFor)
    .filter((k) => k !== '')
    .join(' ')

  return [
    { keys: move, what: '8방향 이동' },
    { keys: '마우스', what: '조준 — 투척과 낫은 커서 방향으로 나간다' },
    { keys: keyFor('interact'), what: '씨앗 심기 · 수확' },
    { keys: mouseFor('sickle'), what: '낫 공격' },
    { keys: mouseFor('throw'), what: '선택한 투척 무기 사용' },
    {
      keys: `${keyLabel(QUICKSLOT_KEYS[0])} ~ ${keyLabel(QUICKSLOT_KEYS[QUICKSLOT_KEYS.length - 1])}`,
      what: '투척 퀵슬롯 직접 선택',
    },
    { keys: '마우스 휠', what: '수량이 남은 투척 무기만 순환' },
    { keys: `${keyFor('recover')} 짧게`, what: '선택된 회복 아이템 사용' },
    { keys: `${keyFor('recover')} 길게`, what: '회복 퀵메뉴 — 다른 아이템 선택' },
    { keys: keyFor('escape'), what: '일시정지 · 열려 있는 보조 UI 닫기' },
  ]
}

const TITLE = '일시정지'
const RESUME_LABEL = '계속하기'
const VOLUME_LABEL = '음량 설정'
const CONTROLS_LABEL = '조작 안내'
const TITLE_LABEL = '타이틀로 돌아가기'

/** 확정문의 "전체, 배경음, 효과음" 순서를 그대로 쓴다 (DEC-UI-027) */
const VOLUME_ROWS: { channel: VolumeChannel; label: string }[] = [
  { channel: 'master', label: '전체' },
  { channel: 'bgm', label: '배경음' },
  { channel: 'sfx', label: '효과음' },
]

/**
 * 슬라이더 눈금.
 *
 * 0~100 정수로 다루고 `mixer` 에 0~1 로 넘긴다. 화면에 백분율을 같이 적는 것은
 * **끝까지 내렸는지 조금 남았는지가 손잡이 위치만으로는 안 갈리기 때문**이다 —
 * 소리가 안 나는 이유를 여기서 찾게 된다.
 */
const VOLUME_STEPS = 100

/**
 * 타이틀 복귀 확인 (DEC-UI-027 — "현재 런이 사라지므로 확인 절차를 둔다").
 *
 * 무엇이 사라지는지 밝힌다. `정말?` 만 물으면 확인 절차가 형식이 된다.
 */
const CONFIRM_TEXT = '타이틀로 돌아가면 지금 런이 사라진다. 이어서 할 수 없다.'
const CONFIRM_YES = '돌아간다'
const CONFIRM_NO = '취소'

export function createPause(container: HTMLElement, handlers: PauseHandlers): PauseScreen {
  const root = el('div', 'pause')
  root.hidden = true

  const panel = el('div', 'pause__panel')
  panel.append(el('h2', 'pause__title', TITLE))

  // ── 기본 메뉴 ────────────────────────────────────
  const menu = el('div', 'pause__menu')

  const resume = el('button', 'pause__button', RESUME_LABEL)
  resume.type = 'button'
  resume.addEventListener('click', () => handlers.onResume())

  const volumeToggle = el('button', 'pause__button', VOLUME_LABEL)
  volumeToggle.type = 'button'

  const controlsToggle = el('button', 'pause__button', CONTROLS_LABEL)
  controlsToggle.type = 'button'

  const toTitle = el('button', 'pause__button pause__button--quiet', TITLE_LABEL)
  toTitle.type = 'button'

  // 오디오가 없는 빌드에서는 버튼도 두지 않는다 (DEC-UI-027).
  if (handlers.mixer === undefined) volumeToggle.remove()
  menu.append(resume, volumeToggle, controlsToggle, toTitle)

  // ── 음량 (DEC-UI-027) ────────────────────────────
  const volume = el('div', 'pause__volume')
  volume.hidden = true
  const mixer = handlers.mixer
  if (mixer !== undefined) {
    for (const row of VOLUME_ROWS) {
      const line = el('div', 'pause__volume-row')
      const slider = el('input', 'pause__volume-slider')
      slider.type = 'range'
      slider.min = '0'
      slider.max = String(VOLUME_STEPS)
      slider.step = '1'
      slider.value = String(Math.round(mixer.get(row.channel) * VOLUME_STEPS))
      slider.setAttribute('aria-label', row.label)

      const readout = el('span', 'pause__volume-value', `${slider.value}%`)
      slider.addEventListener('input', () => {
        const steps = Number(slider.value)
        mixer.set(row.channel, steps / VOLUME_STEPS)
        readout.textContent = `${steps}%`
      })

      line.append(el('span', 'pause__volume-label', row.label), slider, readout)
      volume.appendChild(line)
    }

    volumeToggle.addEventListener('click', () => {
      volume.hidden = !volume.hidden
    })
  }

  // ── 조작 안내 (다시 보기) ────────────────────────
  const controls = el('div', 'pause__controls')
  for (const row of controlRows()) {
    const line = el('div', 'pause__control-row')
    line.append(el('span', 'pause__control-keys', row.keys), el('span', undefined, row.what))
    controls.appendChild(line)
  }
  controls.hidden = true
  controlsToggle.addEventListener('click', () => {
    controls.hidden = !controls.hidden
  })

  // ── 타이틀 복귀 확인 ─────────────────────────────
  const confirm = el('div', 'pause__confirm')
  const confirmYes = el('button', 'pause__button pause__button--danger', CONFIRM_YES)
  confirmYes.type = 'button'
  confirmYes.addEventListener('click', () => handlers.onReturnToTitle())
  const confirmNo = el('button', 'pause__button', CONFIRM_NO)
  confirmNo.type = 'button'
  confirmNo.addEventListener('click', () => {
    confirm.hidden = true
    menu.hidden = false
  })
  confirm.append(el('p', 'pause__confirm-text', CONFIRM_TEXT), confirmYes, confirmNo)
  confirm.hidden = true

  toTitle.addEventListener('click', () => {
    // 확인 중에는 기본 메뉴를 숨긴다. 둘이 같이 보이면 무엇을 묻는지 흐려진다.
    menu.hidden = true
    confirm.hidden = false
  })

  panel.append(menu, volume, controls, confirm)
  root.appendChild(panel)
  container.appendChild(root)

  return {
    show() {
      // **이미 떠 있으면 아무것도 건드리지 않는다.**
      //
      // 부르는 쪽(오버레이 동기화)이 매 프레임 부른다. 그냥 초기화하면 조작 안내를
      // 펼치거나 확인 절차를 띄운 것이 다음 프레임에 지워져 **버튼이 아무 일도 안
      // 하는 것처럼 보인다.** 8/5의 "회복 퀵메뉴가 열리자마자 같은 틱에 닫혔다" 와
      // 같은 모양이고, 그때처럼 콘솔에는 아무것도 안 남는다.
      if (!root.hidden) return

      // 처음 열 때만 되돌린다. 확인을 띄운 채 닫았다가 다시 열면 "돌아간다" 가
      // 먼저 보이고, 그 버튼은 런을 지운다.
      menu.hidden = false
      volume.hidden = true
      controls.hidden = true
      confirm.hidden = true
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
