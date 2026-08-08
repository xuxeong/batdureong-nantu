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
  /**
   * 글자가 몇 자 찍힐 때마다 한 번 불린다 (`DEC-UI-008` 순차 출력).
   *
   * **이 파일은 소리를 모른다.** 논리 에셋 ID 도 `sfx` 도 여기 두지 않는다 —
   * 어느 소리인지는 부르는 쪽(`main.ts`)이 정한다. 안 넘기면 소리가 없다.
   */
  onType?(): void
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

  /**
   * 다음이 있다는 표시 (`DEC-UI-035`).
   *
   * **버튼이 아니라 표시다.** 8/8까지는 `확인` 버튼이었는데 확정문이
   * *"읽고 넘기는 자리에는 다음이 있다는 표시를 둔다. 그 표시가 조작 번호나 키
   * 이름을 드러내지 않게 한다"* 로 바뀌었다. 그래서 글자를 넣지 않고 화살표만
   * 둔다 — `클릭` 이나 `Space` 라고 적으면 확정문이 막은 쪽이다.
   *
   * 누르는 자리는 대사창 전체이므로 이 요소는 클릭을 받지 않는다.
   */
  const advance = el('div', 'dialogue__advance')
  advance.setAttribute('aria-hidden', 'true')

  panel.append(speaker, text, advance)

  root.append(stage, panel)
  container.appendChild(root)

  /** 지금 그려진 내용의 서명. 같으면 다시 만들지 않는다 */
  let builtSignature = ''

  /**
   * 시작 대사를 읽었는가 (`DEC-UI-008` — 시작 대사를 먼저, 그다음 선택지).
   *
   * 확정문은 순서만 정하고 그 사이에 무엇이 필요한지는 안 정했는데, 선택지가
   * 대사와 같이 뜨면 **읽기 전에 고르게 된다.** 한 번 넘겨야 선택지가 나온다.
   */
  let openingRead = false

  /**
   * 반응 대사를 나눈 장. 한 장씩 넘긴다 (19번, 8/8 담당자 요청).
   *
   * 승인 문구 중 금례 공감이 79자로 대사창 한 장에 안 들어간다. 나머지는 58자
   * 이하라 한 장이다 — **길 때만 나뉜다.**
   */
  let reactionPages: string[] = []
  let reactionPage = 0

  /**
   * 한 장에 담는 글자 수.
   *
   * **문장 부호로 나누되 이 길이를 넘을 때만 나눈다.** 승인 문구를 고치는 것이
   * 아니라 같은 문장을 나눠 보여줄 뿐이므로 데이터 경계를 넘지 않는다.
   * 값의 근거는 대사창 크기다 — 선택지 글자 25px 을 실측으로 정한 것과 같은
   * 종류의 수치이고, 문구가 바뀌어도 이 값이 바뀌지는 않는다.
   */
  const REACTION_PAGE_CHARS = 60

  /**
   * 문장 경계로 나눈다. 경계가 없으면 통째로 한 장이다.
   *
   * 글자 수로 자르지 않는 이유는 문장이 중간에서 끊기면 **읽는 사람이 그것을
   * 오타로 읽기 때문**이다. 문장이 하나뿐인데 길면 나누지 않고 그대로 둔다 —
   * 그때는 데이터에 문단을 나누는 것이 맞고, 코드가 문장을 쪼갤 자리가 아니다.
   */
  function paginate(reaction: string): string[] {
    if (reaction.length <= REACTION_PAGE_CHARS) return [reaction]

    const sentences = reaction.split(/(?<=[.!?…。])\s+/).filter((s) => s !== '')
    if (sentences.length <= 1) return [reaction]

    const pages: string[] = []
    let current = ''
    for (const sentence of sentences) {
      if (current === '') current = sentence
      else if (`${current} ${sentence}`.length <= REACTION_PAGE_CHARS) current += ` ${sentence}`
      else {
        pages.push(current)
        current = sentence
      }
    }
    if (current !== '') pages.push(current)
    return pages
  }

  /**
   * 등장 연출 (`DEC-ART-005` — 움직임은 위치·크기·투명도로).
   *
   * 주민 → 플레이어 → 대사창 순으로 들어온다. **셋이 같이 나타나면 누가 말하는
   * 자리인지가 한 번에 뭉쳐 보인다.** 순서를 두면 시선이 왼쪽에서 오른쪽으로
   * 옮겨간 뒤 대사창에 앉는다.
   *
   * 프레임 애니메이션이 아니라 위치와 투명도만 쓰므로 확정문 안이다. 실제 값은
   * `layout.css` 에 있고 여기서는 **언제 끝나는지만** 안다 — 둘이 어긋나면
   * 연출이 끝나기 전에 입력이 열리거나, 끝났는데 화면이 안 받는다.
   */
  const ENTER_MS = 980
  let entering = false
  let enterTimer: number | null = null

  function beginEnter(): void {
    entering = true
    root.classList.add('dialogue--entering')
    if (enterTimer !== null) window.clearTimeout(enterTimer)
    enterTimer = window.setTimeout(finishEnter, ENTER_MS)
  }

  /**
   * 연출을 끝낸다. 시간이 다 됐거나 플레이어가 넘겼거나.
   *
   * **넘기기 입력이 연출을 건너뛴다.** `DEC-UI-008` 이 순차 출력에 대해
   * *"진행 중 입력하면 즉시 전체를 표시한다"* 로 정한 것과 같은 성질이다 —
   * 기다리게 만드는 연출은 두 번째 판부터 방해가 된다.
   */
  function finishEnter(): void {
    if (enterTimer !== null) {
      window.clearTimeout(enterTimer)
      enterTimer = null
    }
    entering = false
    root.classList.remove('dialogue--entering')
    // 연출이 끝나야 찍기 시작한다. 같이 시작하면 인물이 들어오는 동안 대사가
    // 다 지나가서 두 연출이 겹쳐 보인다 (8/9 담당자).
    runTyping()
  }

  /*
    순차 출력 (`DEC-UI-008` — "대사는 순차 출력 연출을 사용할 수 있으며,
    진행 중 입력하면 즉시 전체를 표시한다").

    확정문이 **"사용할 수 있으며"** 로 열어 둔 선택 사항이고, 8/9 에 켰다.
    한 글자씩 찍는 동안에도 **넘기기 입력을 받으면 즉시 전체가 뜬다** — 두 번째
    판부터는 이미 읽은 대사를 기다리게 하면 안 된다.

    간격은 화면 표시 속도라 확정문에 없다. 한글은 한 글자에 담긴 정보가 많아
    라틴 문자보다 느리게 찍어야 읽힌다 — 28ms 면 초당 36자쯤이다.
  
    **찍는 중에도 멈출 수 있어야 한다.** `setInterval` 은 게임 루프와 무관하게
    돌아서, 처음엔 일시정지 중에도 대사가 계속 찍혔다 (8/9 담당자가 잡았다).
    타이머를 껐다 켜도 진행이 유지되도록 `shown` 을 밖에 둔다.

    **등장 연출이 끝난 뒤에 찍는다.** 같이 시작하면 인물이 들어오는 동안 대사가
    다 지나가서 두 연출이 겹쳐 보인다. 연출이 끝나면 `finishEnter()` 가 켠다.
  */
  const TYPE_MS = 28
  /** 소리를 내는 간격(글자 수). 28ms × 4 라 초당 아홉 번쯤이다 */
  const TYPE_SOUND_EVERY = 4
  let typeTimer: number | null = null
  let typingFull = ''
  let typingShown = 0
  /** 아직 다 안 찍혔다. 타이머가 멈춰 있어도 참일 수 있다 */
  let typingActive = false
  /** 입력을 소유하고 있는가. 일시정지가 겹치면 false 다 (DEC-UI-026) */
  let interactive = true

  function stopTyping(): void {
    if (typeTimer === null) return
    window.clearInterval(typeTimer)
    typeTimer = null
  }

  /** 조건이 맞으면 타이머를 켠다. 이미 켜져 있거나 다 찍혔으면 아무 일도 없다 */
  function runTyping(): void {
    if (typeTimer !== null || !typingActive) return
    if (entering || !interactive || root.hidden) return
    typeTimer = window.setInterval(() => {
      typingShown += 1
      text.textContent = typingFull.slice(0, typingShown)
      // 몇 글자에 한 번만 소리를 낸다. 매 글자면 초당 36번이라 잡음이 된다.
      if (typingShown % TYPE_SOUND_EVERY === 0) handlers.onType?.()
      if (typingShown >= typingFull.length) {
        typingActive = false
        stopTyping()
      }
    }, TYPE_MS)
  }

  /** 남은 글자를 한 번에 다 보여준다. 넘기기 입력이 부른다 */
  function finishTyping(): void {
    stopTyping()
    typingActive = false
    typingShown = typingFull.length
    text.textContent = typingFull
  }

  function startTyping(full: string): void {
    stopTyping()
    typingFull = full
    typingShown = 0
    typingActive = full !== ''
    text.textContent = ''
    runTyping()
  }

  /** 지금 화면에서 넘기기 입력이 할 일 */
  function advanceRead(): void {
    if (root.hidden) return

    // 연출 중이면 그것부터 끝낸다. 같은 입력이 연출도 끝내고 선택지까지 열면
    // 대사를 읽을 틈 없이 두 단계가 지나간다.
    if (entering) {
      finishEnter()
      return
    }

    // 찍는 중이면 먼저 다 보여준다 (`DEC-UI-008` — "진행 중 입력하면 즉시 전체를
    // 표시한다"). 한 입력이 대사를 완성하고 장까지 넘기면 읽을 틈이 없다.
    if (typingActive) {
      finishTyping()
      return
    }

    // 반응 대사를 읽는 중이면 장을 넘기고, 마지막이면 흐름을 진행시킨다.
    if (reactionPages.length > 0) {
      if (reactionPage < reactionPages.length - 1) {
        reactionPage += 1
        startTyping(reactionPages[reactionPage] ?? '')
        return
      }
      handlers.proceed()
      return
    }

    // 시작 대사를 읽는 중이면 선택지를 연다. 이미 열렸으면 할 일이 없다 —
    // 고르는 것은 마우스 전용이라 넘기기 입력이 선택을 대신하지 않는다.
    if (!openingRead) {
      openingRead = true
      showChoices()
    }
  }

  /**
   * 말하는 쪽만 밝게 둔다 (19번, 8/8 담당자 요청).
   *
   * 두 인물이 같은 밝기로 서 있으면 **누가 말하고 있는지가 대사창 이름판에만
   * 남는다.** 딤 전용 그림은 아직 없어서 `layout.css` 가 밝기로 처리한다 —
   * 그림이 오면 그 규칙만 갈아 끼우면 되고 이 함수는 그대로다.
   */
  function setSpeakingSide(side: 'resident' | 'player'): void {
    portrait.classList.toggle('dialogue__portrait--dim', side !== 'resident')
    playerPortrait.classList.toggle('dialogue__portrait--dim', side !== 'player')
  }

  /**
   * 선택지를 만들어 띄운다.
   *
   * `render()` 에서 바로 만들지 않고 미뤄 두는 이유는 시작 대사를 한 번 넘겨야
   * 나오기 때문이다. 넘기기 전에는 `pendingChoices` 에만 들고 있는다.
   */
  function showChoices(): void {
    // 선택지가 뜨면 고르는 쪽은 플레이어다.
    setSpeakingSide('player')
    advance.hidden = true

    choiceList.replaceChildren()
    choiceList.hidden = false
    pendingChoices.forEach((choice, index) => {
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
  }

  /**
   * 읽고 넘기는 입력 (`DEC-UI-035`).
   *
   * **대사창을 눌러도 되고 스페이스를 눌러도 된다.** 확정문이 고르는 조작과
   * 읽고 넘기는 조작을 갈랐고, 후자만 키를 받는다.
   *
   * 선택지 버튼 위 클릭은 여기로 오지 않게 막는다 — 고르는 순간 같은 클릭이
   * 넘기기까지 하면 반응 대사 첫 장이 그대로 지나간다.
   */
  panel.addEventListener('click', () => advanceRead())
  stage.addEventListener('click', (event) => {
    const target = event.target
    if (target instanceof Element && target.closest('button') !== null) return
    advanceRead()
  })

  function onKeyDown(event: KeyboardEvent): void {
    if (event.code !== 'Space') return
    if (root.hidden || root.classList.contains('is-inert')) return
    // 스페이스로 화면이 스크롤되거나 포커스된 버튼이 눌리는 것을 막는다.
    event.preventDefault()
    advanceRead()
  }
  window.addEventListener('keydown', onKeyDown)

  /** 아직 안 띄운 선택지. 시작 대사를 넘기면 이걸로 만든다 */
  let pendingChoices: readonly DialogueChoiceView[] = []

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
        reactionPages = paginate(view.reaction)
        reactionPage = 0
        startTyping(reactionPages[0] ?? '')
        // 말풍선을 통째로 숨긴다. 빈 말풍선이 인물 사이에 남으면
        // 아직 고를 것이 있는 것처럼 보인다.
        choiceList.replaceChildren()
        choiceList.hidden = true
        advance.hidden = false
        // 반응은 주민이 말한다. 플레이어 쪽을 죽인다.
        setSpeakingSide('resident')
        return
      }

      // 새 대화다. 시작 대사를 아직 안 읽은 상태로 되돌리고 등장 연출을 건다.
      reactionPages = []
      reactionPage = 0
      openingRead = false
      beginEnter()

      startTyping(view.openingText)
      // 시작 대사도 주민이 말한다.
      setSpeakingSide('resident')

      // 선택지는 한 번 넘긴 뒤에 나온다. 화살표가 그때까지 자리를 지킨다.
      choiceList.replaceChildren()
      choiceList.hidden = true
      advance.hidden = false
      pendingChoices = view.choices
    },

    show() {
      root.hidden = false
    },

    hide() {
      root.hidden = true
      // 다음에 열릴 때 이전 대화가 한 프레임 비치지 않게 한다
      builtSignature = ''
      // 연출·타이핑 중에 닫히면 타이머가 남아 다음 대화를 끊는다.
      finishEnter()
      stopTyping()
    },

    setInteractive(next) {
      // 입력만 끈다. 표시는 그대로 남는다 (DEC-UI-026).
      interactive = next
      root.classList.toggle('is-inert', !next)

      /*
        **찍는 것도 같이 멈춘다.** `setInterval` 은 게임 루프와 무관해서, 8/9 에
        일시정지를 겹쳐도 대사가 계속 찍혔다. 필드는 멈추는데 대사만 흐르면
        일시정지가 무엇을 멈추는지 화면이 거짓말을 한다.

        진행은 `typingShown` 에 남아 있어 다시 켜면 이어서 찍는다 — 처음부터
        다시 찍거나 통째로 뛰어넘지 않는다.
      */
      if (next) runTyping()
      else stopTyping()
    },

    destroy() {
      window.removeEventListener('keydown', onKeyDown)
      finishEnter()
      stopTyping()
      root.remove()
    },
  }
}
