// 전투 전 대화 · 투항 대화 (DEC-UI-007, DEC-UI-008, DEC-UI-009, DEC-UI-010)
//
// 필드(습격 모드) 위 오버레이다. 열려 있는 동안 필드 시뮬레이션이 멈춘다
// (DEC-INPUT-009, DEC-RESIDENT-039). **필수 화면이라 `Esc` 로 닫을 수 없고**,
// `Esc` 는 이 대화를 그대로 둔 채 일시정지만 겹친다 (DEC-UI-014).
//
// ── 두 대화를 한 파일에 둔 이유 ────────────────────────────
//
// `DEC-UI-010` 이 "투항 대화는 전투 전 대화와 **같은 표시·입력 규칙**을 사용한다.
// 대사의 순차 출력과 즉시 표시, 마우스 클릭 선택, 시간제한 없음, 확정 후 되돌아가기
// 없음이 모두 같다"로 확정했다. 규칙이 같다고 확정문이 못 박은 것을 두 벌로 만들면
// 한쪽만 고쳐지는 날이 온다. 결과 화면 2종을 일부러 안 합친 것과 근거가 반대다 —
// 거긴 `DEC-UI-023` 이 공유를 **금지**했다.
//
// 두 대화가 다른 점은 세 가지뿐이고 전부 뷰에 담겨 온다.
//   · 시작 대사의 출처 (precombat_opening_text / surrender_opening_text)
//   · 자원 협상 선택지의 수량 표시 — 전투 전 대화에만 있다 (DEC-UI-008)
//   · 고를 수 없는 선택지 — 투항 대화에는 없다 (DEC-UI-010)
//
// ── 이 파일이 표시하지 않는 것 ─────────────────────────────
//
//   선택지의 기능 이름(공감·설득 / 자원 협상 / 위협·대립) — DEC-UI-007.
//     세 선택지를 시각적으로 구분하되 그 구분이 기능을 드러내면 안 되므로
//     자리 순서로만 색을 준다. 뷰에 choice_function 이 아예 오지 않는다
//   판정 결과 이름, 성공·실패 같은 시스템 용어 — DEC-UI-009.
//     판정 결과는 오직 주민의 반응 대사로 전달한다
//   남은 시간 — DEC-UI-008. 선택에 시간제한이 없다
//   투항 기준값과 남은 체력의 비율 — DEC-UI-010
//   이번이 마지막 투항 기회라는 사실 — DEC-UI-010

import { assetCssUrl, UI_ASSET } from '../render/assets.ts'
import './layout.css'

export type DialoguePhase = 'precombat' | 'surrender'

/** 자원 협상 선택지에만 붙는 수량 정보 (DEC-UI-008) */
export interface ResourceOfferView {
  /** 제안 수량 */
  quantity: number
  /** 현재 수확물 총수량. 종류가 아니라 개수다 (DEC-RESIDENT-050) */
  heldTotal: number
}

export interface DialogueChoiceView {
  id: string
  /** 콘텐츠로 작성된 선택지 문장. 플레이어는 이것만 읽고 고른다 (DEC-UI-007) */
  text: string
  /** 자원 협상만 값이 있다. 그 외에는 null */
  offer: ResourceOfferView | null
  /**
   * 고를 수 있는가.
   *
   * 총수량이 제안 수량보다 적으면 **표시하되 흐리게** 처리해 고를 수 없음을
   * 나타내며 별도의 안내 문구를 덧붙이지 않는다 (DEC-UI-008).
   * 투항 대화에는 수량 조건이 없어 항상 true 다 (DEC-UI-010).
   */
  usable: boolean
}

export interface DialogueView {
  phase: DialoguePhase
  residentName: string
  /**
   * 말하는 주민의 그림 (아트 디렉션 12.2 A4 — 왼쪽 초상화 칸).
   *
   * 8/7 에 `portrait` 5종이 들어와 이제 그것이 온다. 부르는 쪽이 `portrait` →
   * `field_sprite` 순으로 골라 넘기므로 이 파일은 어느 구간인지 알 필요가 없다.
   * 없으면 칸 자체를 만들지 않는다.
   */
  portraitAsset?: string | null

  /**
   * 플레이어 그림. 주민 반대쪽에 선다 (아트 디렉션 12.2 A4).
   *
   * **A4 는 두 사람이 마주 보는 화면이다.** `portrait` 이 5종(주민 4 + 플레이어)인
   * 이유가 이것이고, `player_base_stats.csv` 가 에셋 연결 CSV 의 부모 후보에 들어간
   * 이유도 같다 (아트 디렉션 14.7). 말풍선 꼬리가 오른쪽을 향하므로 플레이어가
   * 오른쪽이다.
   */
  playerPortraitAsset?: string | null
  /** 주민의 시작 대사. 선택지보다 먼저 나온다 (DEC-UI-008) */
  openingText: string
  choices: readonly DialogueChoiceView[]
  /**
   * 선택을 확정한 뒤의 반응 대사. 아직 고르지 않았으면 null.
   *
   * 값이 들어오면 선택지를 지우고 이것만 남긴다 — 이전 선택 화면으로 돌아가는
   * 수단을 제공하지 않는다 (DEC-UI-008).
   */
  reaction: string | null
}

export interface DialogueHandlers {
  /** 선택 확정. 마우스 클릭으로만 고른다 (DEC-UI-008) */
  choose(choiceId: string): void
  /** 반응 대사를 읽고 다음으로. 앞으로만 간다 */
  proceed(): void
}

export interface DialogueModal {
  render(view: DialogueView): void
  show(): void
  hide(): void

  /**
   * 입력을 소유하고 있는가 (DEC-UI-026).
   *
   * **표시와 입력은 다르다.** 일시정지가 겹치면 가장 위가 입력을 독점하고 아래
   * 층위는 *표시만* 남는다. 그래서 `hide()` 가 아니라 이것으로 끈다 — 8/5 플레이
   * 테스트에서 브라우저 저장 대화상자로 포커스를 잃자 대화창이 통째로 사라졌고,
   * 일시정지 화면이 아직 뼈대라 왜 사라졌는지 알 수단이 없었다.
   */
  setInteractive(interactive: boolean): void
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
 * 반응 대사를 읽고 넘어가는 버튼의 문구.
 *
 * **근거 없이 고른 값이다.** 결과 화면의 진행 입력과 같은 말을 쓴다.
 * `DEC-UI-008` 은 "되돌아가는 수단을 제공하지 않는다"만 정하고 앞으로 가는 입력의
 * 문구는 정하지 않았다.
 */
const PROCEED_LABEL = '확인'

export function createDialogueModal(
  container: HTMLElement,
  handlers: DialogueHandlers,
): DialogueModal {
  const root = el('div', 'dialogue')
  root.hidden = true

  /**
   * UI 에셋을 CSS 변수로 넘긴다.
   *
   * 파일이 없으면 아무것도 설정하지 않는다 — `layout.css` 의 테두리·배경이 그대로
   * 플레이스홀더로 남는다. 여기서 경로를 지어내지 않는다 (AGENTS.md 6절).
   * 하나라도 붙으면 `dialogue--has-art` 를 켜서 글자색 같은 대비를 뒤집는다.
   */
  function bindUi(node: HTMLElement, property: string, assetId: string): void {
    const url = assetCssUrl(assetId)
    if (url === null) return
    node.style.setProperty(property, url)
    root.classList.add('dialogue--has-art')
  }

  // ── 무대: 두 인물과 그 사이의 선택지 말풍선 (A4) ──
  //
  // 말하는 주민이 왼쪽, 플레이어가 오른쪽이고 **선택지는 둘 사이**에 뜬다.
  // 선택지를 대사창 안 목록으로 두지 않는다 — 목업이 말풍선 하나에 버튼 셋을
  // 담는 모양이고, 그림 크기(506×441)가 버튼 350×116 세 개에 맞춰 나왔다.
  const stage = el('div', 'dialogue__stage')
  const portrait = el('div', 'dialogue__portrait')
  const playerPortrait = el('div', 'dialogue__portrait dialogue__portrait--player')
  const choiceList = el('div', 'dialogue__choices')
  bindUi(choiceList, '--dialogue-balloon-image', UI_ASSET.choiceBalloon)
  stage.append(portrait, choiceList, playerPortrait)

  // ── 대사창: 화면 하단 전폭. 두 인물의 하단을 덮는다 (A4) ──
  const panel = el('div', 'dialogue__panel')
  bindUi(panel, '--dialogue-panel-border', UI_ASSET.panelBorder)
  bindUi(panel, '--dialogue-panel-texture', UI_ASSET.panelTexture)

  // 발화자 이름판은 대사창 위로 튀어나온 나무판이다 (전성민 8/6 조립 지시 —
  // `발화자 이름판: button_normal`, 자리는 A4 목업). 선택지와 같은 그림을 쓴다.
  const speaker = el('div', 'dialogue__speaker')
  bindUi(speaker, '--dialogue-name-image', UI_ASSET.buttonNormal)
  const text = el('p', 'dialogue__text')

  const proceed = el('button', 'dialogue__proceed', PROCEED_LABEL)
  proceed.type = 'button'
  bindUi(proceed, '--dialogue-button-image', UI_ASSET.buttonNormal)
  proceed.addEventListener('click', () => handlers.proceed())

  panel.append(speaker, text, proceed)

  root.append(stage, panel)
  container.appendChild(root)

  /** 지금 그려진 내용의 서명. 같으면 다시 만들지 않는다 */
  let builtSignature = ''

  function signatureOf(view: DialogueView): string {
    return [
      view.phase,
      view.residentName,
      view.portraitAsset ?? '',
      view.playerPortraitAsset ?? '',
      view.openingText,
      view.reaction ?? '',
      ...view.choices.map((c) => `${c.id}:${c.usable ? 'o' : 'x'}:${c.offer?.heldTotal ?? ''}`),
    ].join('|')
  }

  return {
    render(view) {
      // 매 프레임 다시 만들면 클릭이 씹힌다. 내용이 바뀔 때만 새로 그린다.
      const signature = signatureOf(view)
      if (signature === builtSignature) return
      builtSignature = signature

      speaker.textContent = view.residentName

      // 그림이 없으면 칸을 통째로 숨긴다. 빈 사각형은 "그림이 깨졌나" 로 읽힌다.
      const portraitUrl = assetCssUrl(view.portraitAsset)
      portrait.hidden = portraitUrl === null
      if (portraitUrl !== null) portrait.style.setProperty('--portrait-image', portraitUrl)

      const playerUrl = assetCssUrl(view.playerPortraitAsset)
      playerPortrait.hidden = playerUrl === null
      if (playerUrl !== null) playerPortrait.style.setProperty('--portrait-image', playerUrl)

      // 반응 대사가 오면 선택지를 지우고 그것만 남긴다 (DEC-UI-008).
      // 순차 출력 연출은 확정문이 "사용할 수 있으며"로 열어 둔 선택 사항이라
      // 1차 빌드에서는 쓰지 않고 전체를 즉시 표시한다.
      if (view.reaction !== null) {
        text.textContent = view.reaction
        // 말풍선을 통째로 숨긴다. 빈 말풍선이 인물 사이에 남으면
        // 아직 고를 것이 있는 것처럼 보인다.
        choiceList.replaceChildren()
        choiceList.hidden = true
        proceed.hidden = false
        return
      }

      text.textContent = view.openingText
      proceed.hidden = true

      choiceList.replaceChildren()
      choiceList.hidden = false
      view.choices.forEach((choice, index) => {
        const button = el('button', 'dialogue__choice') as HTMLButtonElement
        button.type = 'button'
        // 세 선택지를 시각적으로 구분하되 그 구분이 기능 이름을 드러내지 않게 한다
        // (DEC-UI-007). 자리 순서로만 색을 준다 — 뷰에 기능이 오지 않으므로
        // 이 코드는 어떤 선택지가 무슨 기능인지 알 수 없다.
        button.dataset.slot = String(index)
        button.appendChild(el('span', 'dialogue__choice-text', choice.text))

        // 자원 협상 선택지에만 제안 수량·현재 총수량·무작위 소비 사실을
        // 한 줄로 짧게 덧붙인다 (DEC-UI-008). 어떤 작물이 나갈지는 공개하지 않는다.
        if (choice.offer !== null) {
          button.appendChild(
            el(
              'span',
              'dialogue__choice-offer',
              `수확물 ${choice.offer.quantity}개 (보유 ${choice.offer.heldTotal}) · 무작위로 나간다`,
            ),
          )
        }

        if (choice.usable) {
          bindUi(button, '--dialogue-button-image', UI_ASSET.buttonNormal)
          button.addEventListener('click', () => handlers.choose(choice.id))
        } else {
          // 흐리게 처리해 고를 수 없음을 나타내며 별도의 안내를 덧붙이지 않는다.
          // 그림도 비활성 한 장으로 갈린다 — 투명도만으로는 눈에 덜 띈다.
          bindUi(button, '--dialogue-button-image', UI_ASSET.buttonDisabled)
          button.disabled = true
        }

        choiceList.appendChild(button)
      })
    },

    show() {
      root.hidden = false
    },

    hide() {
      root.hidden = true
      // 다음에 열릴 때 이전 대화가 한 프레임 비치지 않게 한다
      builtSignature = ''
    },

    setInteractive(interactive) {
      // 입력만 끈다. 표시는 그대로 남는다 (DEC-UI-026).
      root.classList.toggle('is-inert', !interactive)
    },

    destroy() {
      root.remove()
    },
  }
}
