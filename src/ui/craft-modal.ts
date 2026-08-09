// 제작 모달 (DEC-UI-006, DEC-CRAFT-004·005·006·007)
//
// 정비 허브의 내부 팝업이다. 판정과 자원 변경은 `systems/economy.ts` 가 원자적으로
// 처리하고 이 파일은 그 결과를 그린다.
//
// ── 이 파일이 지키는 것 ────────────────────────────────────
//
// **잠긴 레시피의 입력과 결과 수치를 공개하지 않는다** (DEC-UI-006). 그래서 잠긴
// 레시피의 뷰 타입에는 그 필드가 **아예 없다.** 그리는 쪽에서 `if` 로 가리는 방식이면
// 값은 이미 화면 코드까지 와 있고, 조건 하나만 잘못 건드리면 새어 나간다.
//
// **결과물 수치는 설명 문장이 아니라 승인 데이터에서 읽는다** (DEC-UI-006).
// `player_description` 은 설명이고 `resultStats` 는 데이터에서 온 수치다. 둘을 섞지 않는다.
//
// ── 설명과 수치는 상세창이 아니라 목록 안내에 있다 (14.9) ──
//
// `DEC-UI-005` 는 판매·구매에 보유 수량·단가·총액·거래 후 남는 값만 요구하고
// 설명과 수치는 요구하지 않는다. `DEC-UI-006` 만 제작에 그것을 요구해서 상세창이
// 혼자 다른 모양이 됐다. 셋을 맞추려고 설명과 수치를 **왼쪽 목록에 마우스를
// 올렸을 때 뜨는 안내**로 옮겼다. 상세창에는 입력 표만 남는다.
//
// 잠긴 레시피의 안내에는 수치가 가지 않는다 — 뷰 타입에 필드가 아예 없다.
// 안내를 만드는 함수를 하나로 합치면 잠긴 것에도 다 보여주기 쉬운 지점이라
// 타입으로 갈라 둔 것이 그대로 방벽이 된다 (DEC-UI-006).
//
// **부족한 입력을 따로 안내하지 않는다** (DEC-UI-006). 필요 수량과 보유 수량이 이미
// 표에 나란히 있으므로 실행 버튼만 끈다.
//
// 목록 정렬 규칙도 확정문이 정해 두었다 — 아래 `sortRecipes()` 가 그 순서 그대로다.

import { assetCssUrl, UI_ASSET } from '../render/assets.ts'
import { createPopupShell, createElement as el } from './maintenance-hub.ts'
import { createTooltip } from './tooltip.ts'
import { createIcon } from './icon.ts'
import './layout.css'

/**
 * 횟수 증감 위에 서는 물음 (A3 목업).
 *
 * `DEC-UI-029` 의 라벨 갈래다 — 이 자리가 무엇을 정하는 곳인지만 가리키고
 * 플레이어의 선택을 바꾸는 정보가 없다. 판매·구매는 `shop-modal.ts` 의 `MODE`
 * 표가 같은 자리의 문구를 들고 있다.
 */
const CRAFT_PROMPT = '몇 개 제작하시겠습니까?'

export type CraftResultKind = 'throwable_weapon' | 'recovery_item'

/**
 * 제작 1회당 입력 하나 (DEC-UI-006 — 필요 수량과 보유 수량을 함께 표시한다).
 *
 * 입력 표는 아이콘·이름·필요 수량·보유 수량 넷이다 (아트 디렉션 14.9).
 */
export interface CraftInputView {
  name: string
  perCraft: number
  held: number
  /** `asset.icon.*` */
  icon?: string
}

/** 승인 데이터에서 읽은 결과물 수치. 설명 문장에서 읽지 않는다 */
export interface CraftStatView {
  label: string
  value: string
}

export interface UnlockedRecipeView {
  id: string
  locked: false
  resultKind: CraftResultKind
  /** 기본 레시피인가. 목록에서 상위 레시피보다 앞에 온다 */
  base: boolean

  resultName: string
  /** 결과물의 `asset.icon.*` */
  resultIcon?: string
  resultDescription: string
  resultStats: readonly CraftStatView[]
  inputs: readonly CraftInputView[]
  /** 제작 1회당 결과 수량 */
  resultQuantity: number
  /** 현재 보유 자원으로 만들 수 있는 최대 횟수 */
  maxTimes: number
}

/**
 * 잠긴 레시피 (DEC-CRAFT-006, DEC-UI-006).
 *
 * 존재와 해금 조건만 있고 입력·결과 수치가 없다. 타입 단계에서 없으므로
 * 실수로 그릴 수 없다.
 */
export interface LockedRecipeView {
  id: string
  locked: true
  resultKind: CraftResultKind
  base: boolean

  resultName: string
  /** 잠긴 레시피에도 결과물 아이콘은 보인다 — 이름과 같은 층위다 (DEC-UI-006) */
  resultIcon?: string
  unlock: {
    cropName: string
    /**
     * 대상 작물의 논리 에셋 ID (DEC-UI-006 — 해금 조건에 대상 작물의 논리 에셋).
     * 그림이 없으면 null 이고 이름이 그 자리를 대신한다.
     */
    cropAssetId: string | null
    currentMastery: number
    requiredMastery: number
  }
}

export type CraftRecipeView = UnlockedRecipeView | LockedRecipeView

export interface CraftView {
  recipes: readonly CraftRecipeView[]
}

export interface CraftHandlers {
  /**
   * 제작을 확정한다. 재료 차감과 결과물 지급은 `economy` 가 하나의 처리로 끝낸다.
   *
   * 해금된 레시피 이름을 돌려받아 그 자리에서 알린다 (DEC-UI-006 — 상위 레시피가
   * 해금되면 그 사실을 즉시 알린다).
   */
  submit(
    recipeId: string,
    times: number,
  ): { ok: boolean; unlockedNames: readonly string[]; reason: string | null }
}

export interface CraftModal {
  readonly root: HTMLElement
  render(view: CraftView): void
}

/** 결과 분류 두 가지. 이 순서로 나눠 배치한다 (DEC-UI-006) */
const GROUPS: { kind: CraftResultKind; title: string }[] = [
  { kind: 'throwable_weapon', title: '투척 무기' },
  { kind: 'recovery_item', title: '회복 아이템' },
]

/**
 * 목록 순서 (DEC-UI-006 확정문 그대로).
 *
 *   1. 해금된 것 먼저, 잠긴 것 뒤
 *   2. 같은 구간 안에서 기본 레시피 먼저, 상위 레시피 뒤
 *   3. 그래도 같으면 레시피 ID 오름차순
 *
 * 레시피 작성 원본에 표시 순서 열을 만들지 않는다는 것도 같은 결정에 있다.
 * 그래서 순서를 데이터가 아니라 여기서 만든다.
 */
function sortRecipes(recipes: readonly CraftRecipeView[]): CraftRecipeView[] {
  return [...recipes].sort((a, b) => {
    if (a.locked !== b.locked) return a.locked ? 1 : -1
    if (a.base !== b.base) return a.base ? -1 : 1
    return a.id.localeCompare(b.id)
  })
}

export function createCraftModal(handlers: CraftHandlers): CraftModal {
  const { root, body, footer } = createPopupShell('제작')

  /** 한 번에 한 레시피만 고른다 (DEC-UI-006) */
  let selectedId: string | null = null
  /** 제작 처리 중 중복 입력 차단 (DEC-CRAFT-004) */
  let busy = false
  /** 해금 알림 또는 실패 안내. 다음 선택에서 지운다 */
  let notice: string | null = null

  const list = el('div')
  const detail = el('div', 'hub__detail')
  body.append(list, detail)

  const tooltip = createTooltip(root)
  const rowButtons = new Map<string, HTMLButtonElement>()
  /** 안내가 뜰 때 최신 뷰에서 다시 읽는다 — 보유 수량과 해금 진행도가 바뀐다 */
  let latest: readonly CraftRecipeView[] = []
  let builtSignature = ''

  /**
   * 목록을 만든다. **순서가 바뀔 때만** 다시 만든다.
   *
   * 해금되면 그 레시피가 잠긴 구간에서 해금 구간으로 올라가므로 순서가 바뀐다.
   * 그때만 새로 그리고, 평소에는 그대로 둔다 — 매 프레임 다시 만들면 클릭이 씹힌다.
   */
  function buildList(recipes: readonly CraftRecipeView[]): void {
    const signature = recipes.map((r) => `${r.id}:${r.locked ? 'L' : 'U'}`).join('|')
    if (signature === builtSignature) return
    builtSignature = signature

    list.replaceChildren()
    rowButtons.clear()

    for (const group of GROUPS) {
      const inGroup = sortRecipes(recipes.filter((r) => r.resultKind === group.kind))
      if (inGroup.length === 0) continue

      const wrap = el('div', 'hub__popup-group')
      wrap.appendChild(el('div', 'hub__popup-group-title', group.title))

      for (const recipe of inGroup) {
        const button = el('button', 'hub__row') as HTMLButtonElement
        button.type = 'button'

        // 판매·구매 목록과 같은 나무 칸에 결과물 그림을 올린다 (8/8).
        // 일곱 개가 한 판에 다 안 들어가므로 넷쯤 보이고 나머지는 휠로 내린다 —
        // 왼쪽 판의 `overflow-y` 가 그 역할을 한다.
        const slot = el('div', 'hub__row-slot')
        const slotUrl = assetCssUrl(UI_ASSET.itemSlot)
        if (slotUrl !== null) slot.style.setProperty('--hub-slot-image', slotUrl)
        const rowIcon = createIcon(recipe.resultIcon)
        if (rowIcon !== null) slot.appendChild(rowIcon)

        const lines = el('div', 'hub__row-lines')
        lines.appendChild(el('div', 'hub__row-name', recipe.resultName))

        // 잠김을 목록에서도 알 수 있게 한다. 조건은 골랐을 때 상세에 나온다.
        // 자물쇠 그림(B2)이 있으면 그것이 서고 없으면 글자가 남는다 — 어느 쪽이든
        // 해금 조건은 여기 오지 않는다 (DEC-UI-006).
        if (recipe.locked) {
          const lock = el('div', 'hub__row-sub hub__lock', '잠김')
          const lockUrl = assetCssUrl(UI_ASSET.lockIcon)
          if (lockUrl !== null) {
            lock.style.setProperty('--hub-lock-image', lockUrl)
            lock.classList.add('hub__lock--has-art')
          }
          lines.appendChild(lock)
        }

        button.append(slot, lines)

        button.addEventListener('click', () => {
          selectedId = recipe.id
          notice = null
          setTimes(1)
        })

        // 설명과 수치는 여기로 온다 (14.9). 잠긴 레시피는 이름과 해금 조건뿐이다 —
        // 그 뷰 타입에 수치 필드가 없어서 실수로도 넣을 수 없다 (DEC-UI-006).
        tooltip.bind(button, () => {
          const now = latest.find((r) => r.id === recipe.id)
          if (now === undefined) return null

          if (now.locked) {
            const { cropName, currentMastery, requiredMastery } = now.unlock
            return {
              name: now.resultName,
              note: `${cropName} 숙련도 ${currentMastery} / ${requiredMastery}`,
            }
          }
          return {
            name: now.resultName,
            description: now.resultDescription,
            stats: now.resultStats,
          }
        })

        wrap.appendChild(button)
        rowButtons.set(recipe.id, button)
      }
      list.appendChild(wrap)
    }
  }

  // ── 바닥: 횟수 · 미리보기 · 실행 ─────────────────
  //
  // 최대 제작 횟수는 미리보기가 아니라 **입력칸 옆**에 둔다 (DEC-UI-006 — 현재 보유
  // 자원으로 만들 수 있는 최대 제작 횟수를 표시한다). 미리보기에 같이 넣었더니
  // "고춧가루 주머니 1개 · 최대 0회" 처럼 성격이 다른 숫자 둘이 한 줄에 붙어서,
  // 어느 쪽이 내가 지정한 값인지 읽히지 않았다.
  //
  // **입력칸이 아니라 증감 버튼이다** (A3 목업). 판매·구매가 8/8 에 먼저 바뀌었고
  // 제작만 남아 있었다 — 같은 자리에 같은 조작이어야 셋이 한 화면으로 읽힌다.
  let times = 1

  const timesWrap = el('div', 'hub__qty')
  const minus = el('button', 'hub__step hub__step--minus') as HTMLButtonElement
  minus.type = 'button'
  minus.ariaLabel = '횟수 줄이기'
  const timesValue = el('span', 'hub__qty-value', '1')
  const plus = el('button', 'hub__step hub__step--plus') as HTMLButtonElement
  plus.type = 'button'
  plus.ariaLabel = '횟수 늘리기'

  const minusUrl = assetCssUrl(UI_ASSET.stepMinus)
  if (minusUrl !== null) minus.style.setProperty('--hub-step-image', minusUrl)
  const plusUrl = assetCssUrl(UI_ASSET.stepPlus)
  if (plusUrl !== null) plus.style.setProperty('--hub-step-image', plusUrl)

  timesWrap.append(minus, timesValue, plus)

  // 증감 줄 위에 서는 물음 (A3 목업). `DEC-UI-029` 의 라벨 갈래다
  const timesBlock = el('div', 'hub__qty-block')
  timesBlock.append(el('div', 'hub__qty-prompt', CRAFT_PROMPT), timesWrap)

  /**
   * 제작 1회당 필요 재료와 보유 수량 (DEC-UI-006).
   *
   * **오른쪽 판의 증감 줄 아래다** (8/8 요청). 왼쪽 판에 있을 때는 횟수를 올려도
   * 필요 수량이 시선 밖에서 바뀌어서, 무엇이 부족해 실행이 막힌 것인지 알기까지
   * 눈이 판 사이를 왕복해야 했다.
   */
  const needs = el('div', 'hub__needs')

  const preview = el('div', 'hub__preview')

  const action = el('button', 'hub__action', '제작') as HTMLButtonElement
  action.type = 'button'
  const actionUrl = assetCssUrl(UI_ASSET.buttonNormal)
  if (actionUrl !== null) action.style.setProperty('--hub-button-image', actionUrl)

  // 안내·실행은 바닥 묶음이다 (8/9) — 필요 재료는 증감 줄에 붙어 있어야 하므로
  // 묶음 밖에 남는다. 각각 margin-top: auto 를 주면 공간을 나눠 먹어 중간에 뜬다.
  const bottom = el('div', 'hub__footer-bottom')
  bottom.append(preview, action)
  footer.append(timesBlock, needs, bottom)

  /** 횟수를 고쳐 쓴다. 상한은 두지 않고 실행 가능 여부만 `render` 가 판정한다 */
  function setTimes(next: number): void {
    times = Math.max(1, next)
    timesValue.textContent = String(times)
    // 필요 수량이 횟수에 곱해지므로 바로 다시 그린다
    if (latestView !== null) draw(latestView)
  }

  minus.addEventListener('click', () => setTimes(times - 1))
  plus.addEventListener('click', () => setTimes(times + 1))

  action.addEventListener('click', () => {
    if (busy) return
    const id = selectedId
    if (id === null) return

    busy = true
    action.disabled = true
    try {
      const result = handlers.submit(id, times)
      if (!result.ok) {
        notice = '제작을 확정하지 못했다'
      } else {
        // 상위 레시피 해금을 즉시 알린다 (DEC-UI-006)
        notice =
          result.unlockedNames.length > 0
            ? `${result.unlockedNames.join(' · ')} 해금됨`
            : null
        setTimes(1)
      }
    } finally {
      busy = false
    }
  })

  /**
   * 해금된 레시피의 상세 — 이름과 **입력 표만** (DEC-UI-006, 14.9).
   *
   * 설명과 결과물 수치는 여기 없다. 왼쪽 목록의 안내로 갔다 — 판매·구매 상세창이
   * 요구하지 않는 것을 제작만 상세창에 두면 셋이 다른 모양이 된다.
   */
  function renderUnlocked(recipe: UnlockedRecipeView, count: number | null): void {
    // 큰 아이콘과 이름이 상세의 머리다 (14.9 공통 구조)
    const heading = el('div', 'hub__detail-heading')
    const bigIcon = createIcon(recipe.resultIcon, 'icon--lg')
    if (bigIcon !== null) heading.appendChild(bigIcon)
    heading.appendChild(el('div', 'hub__detail-title', recipe.resultName))

    // 왼쪽 판에는 무엇을 만드는지까지만 남는다
    detail.replaceChildren(heading)

    // 필요 재료는 오른쪽 판이다 (8/8 요청)
    const nodes: HTMLElement[] = [el('div', 'hub__popup-group-title', '제작 1회당 필요')]
    for (const input of recipe.inputs) {
      const row = el('div', 'hub__detail-row')
      const need = count === null ? input.perCraft : input.perCraft * count
      // 부족한 것을 따로 안내하지 않는다. 필요·보유를 나란히 두고 실행만 막는다
      const lacking = input.held < need
      const amount = el(
        'span',
        lacking ? 'hub__lack' : undefined,
        `${need} / 보유 ${input.held}`,
      )
      // 입력 표는 아이콘·이름·필요 수량·보유 수량이다 (14.9)
      const label = el('span', 'hub__detail-input')
      const inputIcon = createIcon(input.icon)
      if (inputIcon !== null) label.appendChild(inputIcon)
      label.appendChild(el('span', undefined, input.name))
      row.append(label, amount)
      nodes.push(row)
    }

    needs.replaceChildren(...nodes)
  }

  /**
   * 잠긴 레시피의 상세 (DEC-UI-006).
   *
   * 결과물 이름과 해금 조건·진행도만 그린다. 숙련도 규칙을 문장으로 설명하지 않고
   * 대상 작물과 현재·필요 숙련도, 짧은 안내만 둔다.
   */
  function renderLocked(recipe: LockedRecipeView): void {
    const { cropName, cropAssetId, currentMastery, requiredMastery } = recipe.unlock

    // 해금 조건은 대상 작물의 논리 에셋과 현재·필요 숙련도다 (DEC-UI-006).
    // 그림이 없으면 이름이 그 자리를 대신한다.
    const target = el('span', 'hub__detail-input')
    const cropIcon = createIcon(cropAssetId)
    if (cropIcon !== null) target.appendChild(cropIcon)
    target.appendChild(el('span', undefined, cropName))

    const progress = el('div', 'hub__detail-row')
    progress.append(target, el('span', undefined, `${currentMastery} / ${requiredMastery}`))

    const heading = el('div', 'hub__detail-heading')
    const bigIcon = createIcon(recipe.resultIcon, 'icon--lg')
    if (bigIcon !== null) heading.appendChild(bigIcon)
    heading.appendChild(el('div', 'hub__detail-title', recipe.resultName))

    detail.replaceChildren(
      heading,
      progress,
      el('p', 'hub__detail-text', `${cropName}을(를) 제작에 더 사용하면 해금된다.`),
    )
  }

  /** 마지막으로 받은 뷰. 증감 버튼이 이것으로 필요 수량을 다시 그린다 */
  let latestView: CraftView | null = null

  return {
    root,

    render(view) {
      latestView = view
      draw(view)
    },
  }

  function draw(view: CraftView): void {
    latest = view.recipes
    buildList(view.recipes)

    const selected = view.recipes.find((r) => r.id === selectedId) ?? null
    if (selected === null) selectedId = null

    for (const [id, button] of rowButtons) {
      button.classList.toggle('hub__row--selected', id === selectedId)
    }

    if (selected === null) {
      detail.replaceChildren()
      needs.replaceChildren()
      preview.textContent = '레시피를 고른다'
      action.disabled = true
    } else if (selected.locked) {
      renderLocked(selected)
      // 잠긴 레시피의 입력을 공개하지 않는다 (DEC-UI-006)
      needs.replaceChildren()
      preview.textContent = '아직 해금되지 않았다'
      action.disabled = true
    } else {
      renderUnlocked(selected, times)

      // 만들 수 있는 최대 횟수만 남긴다 (DEC-UI-006).
      //
      // 8/8까지 `1회 → 고춧가루 주머니 1개` 도 같이 적었는데, 같은 날 미끈 토란
      // 주머니가 1회당 2개에서 1개로 내려가면서 **네 레시피가 전부 1개**가 됐다.
      // 그 뒤로는 횟수와 결과 수량이 늘 같은 숫자라 한 줄이 아무 말도 하지 않는다.
      preview.textContent = `최대 ${selected.maxTimes}회`
      action.disabled = times > selected.maxTimes || busy
    }

    if (notice !== null) preview.textContent = notice
  }
}
