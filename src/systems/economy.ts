// 판매·구매·제작과 작물 숙련도 (로드맵 8/3)
//
// DEC-RESOURCE-011 · DEC-CRAFT-004 · DEC-CRAFT-007 · DEC-CRAFT-008
//
// ── 원자성이 이 파일의 전부다 ──────────────────────────────
//
// 세 처리 모두 "검증 → 전부 반영 또는 아무것도 반영 안 함"이어야 한다. 절반만 반영된
// 상태를 허용하지 않는다. 그래서 각 함수는 **먼저 계획을 만들어 전부 검증한 뒤**
// 마지막에 한 번에 적용한다. 검증과 적용을 번갈아 하면 세 번째 재료에서 실패했을 때
// 앞의 두 재료가 이미 사라진 뒤다.
//
// 가격·수량·해금 기준은 전부 승인 데이터에서 온다. 여기에 숫자를 두지 않는다.

import type { Crop, CraftingMaterial, Recipe } from '../data/types.ts'
import type { ItemStore, Resources } from '../state/types.ts'

/** 처리 결과. 실패는 예외가 아니라 값으로 돌려준다 — UI 가 버튼을 끄는 데 그대로 쓴다 */
export type EconomyResult<T> = { ok: true; value: T } | { ok: false; reason: string }

const fail = (reason: string): EconomyResult<never> => ({ ok: false, reason })
const done = <T>(value: T): EconomyResult<T> => ({ ok: true, value })

export interface CraftOutcome {
  recipeId: string
  times: number
  /** 이번 제작으로 해금된 레시피 ID. 없으면 빈 배열 */
  unlockedRecipeIds: string[]
}

export interface EconomyState {
  resources: Resources
  /** 작물별 숙련도 (DEC-CRAFT-007) */
  cropMastery: Record<string, number>
  /** 해금된 레시피 ID (DEC-CRAFT-006, 008) */
  unlockedRecipeIds: string[]
}

export interface EconomyData {
  crops: readonly Crop[]
  materials: readonly CraftingMaterial[]
  recipes: readonly Recipe[]
}

export interface Economy {
  /** 처음부터 공개되는 레시피 (DEC-CRAFT-006) */
  baseRecipeIds(): string[]
  /** 지금 제작할 수 있는가 — 해금 여부만 본다. 재료는 별개다 */
  isUnlocked(recipeId: string): boolean
  /** 현재 보유 자원으로 만들 수 있는 최대 제작 횟수 (DEC-UI-006) */
  maxCraftTimes(recipeId: string): number

  sell(cropId: string, quantity: number): EconomyResult<number>
  buy(materialId: string, quantity: number): EconomyResult<number>
  craft(recipeId: string, times: number): EconomyResult<CraftOutcome>
}

/** 보관함 조작. 0이 되면 키를 지운다 (state/types.ts 의 ItemStore 규칙) */
function addTo(store: ItemStore, id: string, delta: number): void {
  const next = (store[id] ?? 0) + delta
  if (next <= 0) delete store[id]
  else store[id] = next
}

function countIn(store: ItemStore, id: string): number {
  return store[id] ?? 0
}

/** 결과 분류에 맞는 보관함을 고른다 (DEC-CRAFT-005) */
function storeForResult(resources: Resources, kind: Recipe['result_kind']): ItemStore {
  return kind === 'throwable_weapon' ? resources.throwables : resources.recoveries
}

function isPositiveInteger(n: number): boolean {
  return Number.isInteger(n) && n > 0
}

export function createEconomy(state: EconomyState, data: EconomyData): Economy {
  const cropById = new Map(data.crops.map((c) => [c.id, c]))
  const materialById = new Map(data.materials.map((m) => [m.id, m]))
  const recipeById = new Map(data.recipes.map((r) => [r.id, r]))

  /** 작물 숙련도로 해금되는 레시피. crop_id → { 필요 숙련도, 레시피 } */
  const masteryUnlocks = data.recipes
    .filter((r) => r.mastery_unlock != null)
    .map((r) => ({
      recipeId: r.id,
      cropId: r.mastery_unlock!.crop_id,
      required: r.mastery_unlock!.required_mastery,
    }))

  const economy: Economy = {
    baseRecipeIds() {
      return data.recipes.filter((r) => r.unlock_type === 'base').map((r) => r.id)
    },

    isUnlocked(recipeId) {
      const recipe = recipeById.get(recipeId)
      if (recipe === undefined) return false
      return recipe.unlock_type === 'base' || state.unlockedRecipeIds.includes(recipeId)
    },

    maxCraftTimes(recipeId) {
      const recipe = recipeById.get(recipeId)
      if (recipe === undefined || !economy.isUnlocked(recipeId)) return 0

      let limit = Infinity
      for (const input of recipe.inputs ?? []) {
        const store = input.input_kind === 'crop' ? state.resources.crops : state.resources.materials
        limit = Math.min(limit, Math.floor(countIn(store, input.input_id) / input.quantity))
      }
      return limit === Infinity ? 0 : limit
    },

    // ── 판매 (DEC-RESOURCE-011) ──────────────────────────────
    sell(cropId, quantity) {
      if (!isPositiveInteger(quantity)) return fail('판매 수량은 1 이상의 정수여야 한다')

      const crop = cropById.get(cropId)
      if (crop === undefined) return fail(`승인된 작물이 아니다: ${cropId}`)

      // 검증을 먼저 끝낸다. 보유 수량이 모자라면 아무것도 바꾸지 않는다.
      const held = countIn(state.resources.crops, cropId)
      if (held < quantity) return fail(`보유 ${held}개로 ${quantity}개를 팔 수 없다`)

      const income = crop.sell_price * quantity

      // 여기서부터 적용. 중간에 실패할 수 있는 것이 남아 있지 않다.
      addTo(state.resources.crops, cropId, -quantity)
      state.resources.money += income
      return done(income)
    },

    // ── 구매 (DEC-RESOURCE-011) ──────────────────────────────
    buy(materialId, quantity) {
      if (!isPositiveInteger(quantity)) return fail('구매 수량은 1 이상의 정수여야 한다')

      const material = materialById.get(materialId)
      if (material === undefined) return fail(`승인된 재료가 아니다: ${materialId}`)

      const cost = material.buy_price * quantity
      if (state.resources.money < cost) {
        return fail(`소지금 ${state.resources.money}로 ${cost}를 지불할 수 없다`)
      }

      state.resources.money -= cost
      addTo(state.resources.materials, materialId, quantity)
      return done(cost)
    },

    // ── 제작 (DEC-CRAFT-004, 007) ────────────────────────────
    craft(recipeId, times) {
      if (!isPositiveInteger(times)) return fail('제작 횟수는 1 이상의 정수여야 한다')

      const recipe = recipeById.get(recipeId)
      if (recipe === undefined) return fail(`승인된 레시피가 아니다: ${recipeId}`)
      if (!economy.isUnlocked(recipeId)) return fail(`아직 해금되지 않은 레시피다: ${recipeId}`)

      const inputs = recipe.inputs ?? []
      if (inputs.length === 0) return fail(`${recipeId} 에 입력이 없다`)

      // 1) 필요한 것을 전부 모아 계획을 세운다
      const plan: { store: ItemStore; id: string; need: number; isCrop: boolean }[] = []
      for (const input of inputs) {
        const isCrop = input.input_kind === 'crop'
        plan.push({
          store: isCrop ? state.resources.crops : state.resources.materials,
          id: input.input_id,
          need: input.quantity * times,
          isCrop,
        })
      }

      // 2) 전부 검증한다. 하나라도 모자라면 여기서 끝 — 아직 아무것도 안 건드렸다.
      for (const item of plan) {
        const held = countIn(item.store, item.id)
        if (held < item.need) {
          return fail(`${item.id} 보유 ${held}개로 ${item.need}개가 필요한 제작을 할 수 없다`)
        }
      }

      // 3) 적용한다. 여기서부터는 실패할 수 있는 것이 없다.
      for (const item of plan) {
        addTo(item.store, item.id, -item.need)

        // 제작에 소비한 작물만 숙련도를 올린다.
        // 판매하거나 생으로 먹은 작물은 반영하지 않는다 (DEC-CRAFT-007).
        if (item.isCrop) {
          state.cropMastery[item.id] = (state.cropMastery[item.id] ?? 0) + item.need
        }
      }

      addTo(storeForResult(state.resources, recipe.result_kind), recipe.result_id, recipe.result_quantity * times)

      // 4) 숙련도가 기준에 도달했으면 상위 레시피를 해금한다 (DEC-CRAFT-007)
      const unlocked: string[] = []
      for (const rule of masteryUnlocks) {
        if (state.unlockedRecipeIds.includes(rule.recipeId)) continue
        if ((state.cropMastery[rule.cropId] ?? 0) < rule.required) continue
        state.unlockedRecipeIds.push(rule.recipeId)
        unlocked.push(rule.recipeId)
      }

      return done({ recipeId, times, unlockedRecipeIds: unlocked })
    },
  }

  return economy
}
