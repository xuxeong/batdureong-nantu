// 판매·구매·제작의 원자성과 작물 숙련도
// DEC-RESOURCE-011 · DEC-CRAFT-004 · DEC-CRAFT-007

import test from 'node:test'
import assert from 'node:assert/strict'

import { createEconomy } from '../src/systems/economy.ts'

function setup(overrides = {}) {
  const state = {
    resources: {
      money: 100,
      crops: { 'crop.tomato': 5, 'crop.banana': 5 },
      materials: { 'material.honey': 2 },
      throwables: {},
      recoveries: {},
    },
    cropMastery: {},
    unlockedRecipeIds: [],
    ...overrides,
  }

  const data = {
    crops: [
      { id: 'crop.tomato', sell_price: 5 },
      { id: 'crop.banana', sell_price: 10 },
    ],
    materials: [{ id: 'material.honey', buy_price: 8 }],
    recipes: [
      {
        id: 'recipe.honey_banana',
        result_kind: 'recovery_item',
        result_id: 'recovery_item.honey_banana',
        result_quantity: 1,
        unlock_type: 'base',
        inputs: [
          { input_kind: 'crop', input_id: 'crop.banana', quantity: 1 },
          { input_kind: 'material', input_id: 'material.honey', quantity: 1 },
        ],
      },
      {
        id: 'recipe.fruit_honey_bowl',
        result_kind: 'recovery_item',
        result_id: 'recovery_item.fruit_honey_bowl',
        result_quantity: 1,
        unlock_type: 'crop_mastery',
        mastery_unlock: { crop_id: 'crop.banana', required_mastery: 3, recipe_id: 'recipe.fruit_honey_bowl' },
        inputs: [
          { input_kind: 'crop', input_id: 'crop.tomato', quantity: 2 },
          { input_kind: 'crop', input_id: 'crop.banana', quantity: 2 },
          { input_kind: 'material', input_id: 'material.honey', quantity: 1 },
        ],
      },
    ],
  }

  return { state, economy: createEconomy(state, data) }
}

test('판매는 수확물을 줄이고 소지금을 늘린다 (DEC-RESOURCE-011)', () => {
  const { state, economy } = setup()
  const result = economy.sell('crop.tomato', 3)

  assert.equal(result.ok, true)
  assert.equal(result.value, 15)
  assert.equal(state.resources.crops['crop.tomato'], 2)
  assert.equal(state.resources.money, 115)
})

test('수확물이 모자라면 소지금도 보관함도 바뀌지 않는다 (DEC-RESOURCE-011)', () => {
  const { state, economy } = setup()
  const before = { ...state.resources.crops }

  const result = economy.sell('crop.tomato', 99)

  assert.equal(result.ok, false)
  assert.deepEqual(state.resources.crops, before)
  assert.equal(state.resources.money, 100)
})

test('수량이 0이 되면 보관함에서 키를 지운다', () => {
  const { state, economy } = setup()
  economy.sell('crop.tomato', 5)
  assert.equal('crop.tomato' in state.resources.crops, false)
})

test('소지금이 모자라면 재료도 소지금도 바뀌지 않는다 (DEC-RESOURCE-011)', () => {
  const { state, economy } = setup({ resources: {
    money: 5, crops: {}, materials: {}, throwables: {}, recoveries: {},
  } })

  const result = economy.buy('material.honey', 1)

  assert.equal(result.ok, false)
  assert.equal(state.resources.money, 5)
  assert.deepEqual(state.resources.materials, {})
})

test('제작은 재료를 차감하고 결과물을 넣는다 (DEC-CRAFT-004)', () => {
  const { state, economy } = setup()
  const result = economy.craft('recipe.honey_banana', 2)

  assert.equal(result.ok, true)
  assert.equal(state.resources.crops['crop.banana'], 3)
  assert.equal('material.honey' in state.resources.materials, false)
  assert.equal(state.resources.recoveries['recovery_item.honey_banana'], 2)
})

test('재료가 하나라도 모자라면 아무것도 차감하지 않는다 (DEC-CRAFT-004)', () => {
  const { state, economy } = setup()
  // 바나나는 5개로 충분하지만 꿀이 2개뿐이라 3회는 불가능하다.
  // 검증을 하나씩 하면서 차감하면 바나나가 먼저 사라진다.
  const crops = { ...state.resources.crops }
  const materials = { ...state.resources.materials }

  const result = economy.craft('recipe.honey_banana', 3)

  assert.equal(result.ok, false)
  assert.deepEqual(state.resources.crops, crops)
  assert.deepEqual(state.resources.materials, materials)
  assert.deepEqual(state.resources.recoveries, {})
})

test('제작 실패는 숙련도도 올리지 않는다 (DEC-CRAFT-007)', () => {
  const { state, economy } = setup()
  economy.craft('recipe.honey_banana', 3)
  assert.deepEqual(state.cropMastery, {})
})

test('제작에 소비한 작물만큼 숙련도가 는다 (DEC-CRAFT-007)', () => {
  const { state, economy } = setup()
  economy.craft('recipe.honey_banana', 2)
  assert.equal(state.cropMastery['crop.banana'], 2)
  // 재료(꿀)는 작물이 아니므로 숙련도가 없다
  assert.equal('material.honey' in state.cropMastery, false)
})

test('판매한 작물은 숙련도에 반영하지 않는다 (DEC-CRAFT-007)', () => {
  const { state, economy } = setup()
  economy.sell('crop.banana', 3)
  assert.deepEqual(state.cropMastery, {})
})

test('숙련도가 기준에 도달하면 상위 레시피를 해금한다 (DEC-CRAFT-007)', () => {
  // 기본 픽스처는 꿀이 2개라 3회를 만들 수 없다. 해금 기준까지 가려면 재료가 더 필요하다.
  const { economy } = setup({ resources: {
    money: 100,
    crops: { 'crop.tomato': 5, 'crop.banana': 5 },
    materials: { 'material.honey': 5 },
    throwables: {},
    recoveries: {},
  } })

  assert.equal(economy.isUnlocked('recipe.fruit_honey_bowl'), false)

  // 바나나 숙련도 3 필요. 1회당 1개 소비이므로 2회로는 부족하다.
  economy.craft('recipe.honey_banana', 2)
  assert.equal(economy.isUnlocked('recipe.fruit_honey_bowl'), false)

  const result = economy.craft('recipe.honey_banana', 1)
  assert.deepEqual(result.value.unlockedRecipeIds, ['recipe.fruit_honey_bowl'])
  assert.equal(economy.isUnlocked('recipe.fruit_honey_bowl'), true)
})

test('해금되지 않은 레시피는 제작할 수 없다 (DEC-CRAFT-006)', () => {
  const { state, economy } = setup()
  const result = economy.craft('recipe.fruit_honey_bowl', 1)

  assert.equal(result.ok, false)
  assert.match(result.reason, /해금/)
  assert.deepEqual(state.resources.recoveries, {})
})

test('만들 수 있는 최대 횟수는 가장 모자란 입력이 정한다 (DEC-UI-006)', () => {
  const { economy } = setup()
  // 바나나 5, 꿀 2 → 꿀이 상한
  assert.equal(economy.maxCraftTimes('recipe.honey_banana'), 2)
  // 잠긴 레시피는 0
  assert.equal(economy.maxCraftTimes('recipe.fruit_honey_bowl'), 0)
})

test('수량이 정수가 아니거나 0 이하면 거부한다', () => {
  const { economy } = setup()
  assert.equal(economy.sell('crop.tomato', 0).ok, false)
  assert.equal(economy.sell('crop.tomato', 1.5).ok, false)
  assert.equal(economy.buy('material.honey', -1).ok, false)
  assert.equal(economy.craft('recipe.honey_banana', 0).ok, false)
})
