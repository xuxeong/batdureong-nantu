// 5일 런 밸런스 시뮬레이터.
//
// 화면·입력 계층 없이 승인 런타임 JSON과 실제 시스템만 조립한다. 여기의 정책은
// 규칙이 아니라 시스템에 전달하는 플레이어 입력(이동·선택)이다.

import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRunState } from '../src/state/run-state.ts'
import { createFarming } from '../src/systems/farming.ts'
import { createCombat } from '../src/systems/combat.ts'
import { createWildlife } from '../src/systems/wildlife.ts'
import { createEncounter } from '../src/systems/encounter.ts'
import { createEconomy } from '../src/systems/economy.ts'
import { createResolution } from '../src/systems/resolution.ts'
import { createEndingJudge } from '../src/systems/ending.ts'
import { createResidentCombat } from '../src/systems/resident-combat.ts'
import { createAllySupport } from '../src/systems/ally-support.ts'
import {
  advanceRecovery,
  recoveryOptions,
  startRecovery,
  syncSelection,
} from '../src/systems/recovery.ts'
import { createStageTimer } from '../src/systems/stage-timer.ts'
import { clampToWorld } from '../src/systems/world-bounds.ts'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const RUNTIME = resolve(ROOT, 'generated/runtime')
const REPORT = resolve(ROOT, 'docs/progress/balance-report.md')
const DEFAULT_RUNS = 1000
const DEFAULT_SEED = 20260825
// 요청 애니메이션과 같은 입력 표본 간격이다. 승인 게임 데이터나 규칙 수치가 아니다.
const INPUT_STEP_SECONDS = 1 / 60

function parseArgs(argv) {
  const values = new Map()
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]
    if (key?.startsWith('--') && value !== undefined) values.set(key, value)
  }
  const runs = Number(values.get('--runs') ?? DEFAULT_RUNS)
  const seed = Number(values.get('--seed') ?? DEFAULT_SEED)
  if (!Number.isInteger(runs) || runs <= 0) throw new Error('--runs 는 1 이상의 정수여야 한다')
  if (!Number.isInteger(seed)) throw new Error('--seed 는 정수여야 한다')
  return { runs, seed }
}

async function readRuntime(name) {
  return JSON.parse(await readFile(resolve(RUNTIME, `${name}.json`), 'utf8'))
}

async function loadData() {
  const [
    maps,
    crops,
    attributes,
    stats,
    schedules,
    wildlife,
    spawnProfiles,
    weapons,
    residents,
    combatProfiles,
    modifiers,
    supportProfiles,
    personalities,
    choices,
    rewardBundles,
    fearIncrements,
    fearBands,
    endings,
    materials,
    recipes,
    recoveryItems,
  ] = await Promise.all(
    [
      'maps', 'crops', 'crop_attributes', 'player_base_stats', 'run_schedules', 'wildlife',
      'wildlife_spawn_profiles', 'throwable_weapons', 'residents', 'resident_combat_profiles',
      'resident_combat_modifiers', 'resident_support_attack_profiles',
      'resident_personality_profiles', 'dialogue_choices', 'reward_bundles', 'fear_increments',
      'fear_bands', 'endings', 'crafting_materials', 'recipes', 'recovery_items',
    ].map(readRuntime),
  )
  if (maps.length !== 1 || stats.length !== 1 || schedules.length !== 1) {
    throw new Error('시뮬레이션에는 승인 맵·플레이어 수치·런 일정이 각각 정확히 하나여야 한다')
  }
  const fearByCause = new Map(fearIncrements.map((row) => [row.cause, row.fear_amount]))
  const causes = ['threat_selected', 'surrender_retreat_reward', 'resident_killed']
  if (!causes.every((cause) => fearByCause.has(cause))) {
    throw new Error('fear_increments 승인 데이터에 필수 원인이 없다')
  }
  return {
    map: maps[0], crops, attributes, stats: stats[0], schedule: schedules[0], wildlife,
    spawnProfiles, weapons, residents, combatProfiles, modifiers, supportProfiles, personalities,
    choices, rewardBundles, fearBands, endings, materials, recipes, recoveryItems,
    fearIncrements: Object.fromEntries(causes.map((cause) => [cause, fearByCause.get(cause)])),
  }
}

function seededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000
  }
}

function add(store, id, quantity) {
  store[id] = (store[id] ?? 0) + quantity
}

function moveToward(player, target, speed, dt, bounds) {
  const dx = target.x - player.x
  const dy = target.y - player.y
  const distance = Math.hypot(dx, dy)
  const step = Math.min(speed * dt, distance)
  if (distance > 0) {
    player.x += (dx / distance) * step
    player.y += (dy / distance) * step
    clampToWorld(player, bounds)
  }
}

function aimAt(from, target) {
  return Math.atan2(target.y - from.y, target.x - from.x)
}

function median(values) {
  const ordered = [...values].sort((a, b) => a - b)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 === 0 ? (ordered[middle - 1] + ordered[middle]) / 2 : ordered[middle]
}

function percent(numerator, denominator) {
  return `${((numerator / denominator) * 100).toFixed(1)}%`
}

const POLICY = {
  aggressive: {
    label: '공격적',
    precombat: (choices) => choices.find((choice) => choice.choice_function === 'threat'),
    surrender: () => 'resume_combat',
    maintenanceOrder: ['throwable_weapon', 'recovery_item'],
    useThrowables: () => true,
  },
  conciliatory: {
    label: '회유적',
    precombat: (choices) => choices.find((choice) => choice.choice_function === 'empathy'),
    surrender: () => 'recruit',
    maintenanceOrder: ['recovery_item', 'throwable_weapon'],
    useThrowables: () => false,
  },
  mixed: {
    label: '혼합',
    precombat: (choices, random) => choices[Math.floor(random() * choices.length)],
    surrender: (random) => ['recruit', 'retreat_reward', 'resume_combat'][Math.floor(random() * 3)],
    maintenanceOrder: ['throwable_weapon', 'recovery_item'],
    useThrowables: (random) => random() < 0.5,
  },
}

function setupSystems(data, seed) {
  const random = seededRandom(seed)
  const run = createRunState({
    stats: data.stats,
    schedule: data.schedule,
    playerName: 'simulation',
    seed,
    residents: data.residents,
  })
  const resolution = createResolution(run, {
    rewardBundles: data.rewardBundles,
    residents: data.residents,
    combatProfiles: data.combatProfiles,
    fearIncrements: data.fearIncrements,
  })
  const economy = createEconomy(
    { resources: run.resources, cropMastery: run.record.cropMastery, unlockedRecipeIds: run.record.unlockedRecipeIds },
    { crops: data.crops, materials: data.materials, recipes: data.recipes },
  )
  const farming = createFarming({
    plots: data.map.farm_plots ?? [], crops: data.crops,
    interactionRadius: data.map.farm_interaction_radius, random,
  })
  const combat = createCombat({ stats: data.stats, weapons: data.weapons, attributes: data.attributes })
  const wildlife = createWildlife({ map: data.map, species: data.wildlife, weapons: data.weapons, random })
  const encounter = createEncounter({
    residents: data.residents,
    personalityProfiles: data.personalities,
    choiceOutcomes: data.personalities.flatMap((profile) => profile.choice_outcomes ?? []),
    choices: data.choices,
    responses: data.choices.flatMap((choice) => choice.responses ?? []),
  })
  const residentCombat = createResidentCombat({
    weapons: data.weapons,
    bounds: { width: data.map.world_width, height: data.map.world_height },
  })
  const endingJudge = createEndingJudge({
    fearBands: data.fearBands, endings: data.endings, crops: data.crops, cropAttributes: data.attributes,
  })
  return { random, run, resolution, economy, farming, combat, wildlife, encounter, residentCombat, endingJudge }
}

function recordHarvest(run, event) {
  if (event === null || event.type !== 'harvested') return
  add(run.resources.crops, event.cropId, event.amount)
  add(run.record.cropHarvested, event.cropId, event.amount)
}

function applyPlayerDamage(run, amount) {
  run.health = Math.max(0, run.health - amount)
  // main.ts와 같이 피격 중 회복은 소비 없이 취소된다.
  run.recovering = null
}

function currentWildlifeTargets(wildlife) {
  return wildlife.instances.map((instance) => ({
    entity: instance.entity,
    collisionRadius: instance.species.collision_radius,
    surrenderThreshold: null,
    surrenderOffered: false,
  }))
}

function equipWeapons(run, weapons) {
  const ids = Object.keys(run.resources.throwables).filter((id) => run.resources.throwables[id] > 0)
  run.quickslots.slots = run.quickslots.slots.map((_, index) => ids[index] ?? null)
  if (run.quickslots.slots[run.quickslots.selectedIndex] === null) {
    run.quickslots.selectedIndex = run.quickslots.slots.findIndex((id) => id !== null)
    if (run.quickslots.selectedIndex < 0) run.quickslots.selectedIndex = 0
  }
  void weapons
}

function maintain(run, economy, data, policy) {
  const recipes = data.recipes.filter((recipe) => policy.maintenanceOrder.includes(recipe.result_kind))
  const byKind = new Map(policy.maintenanceOrder.map((kind, index) => [kind, index]))
  recipes.sort((a, b) => byKind.get(a.result_kind) - byKind.get(b.result_kind))
  for (const recipe of recipes) {
    while (true) {
      const missingMaterial = (recipe.inputs ?? []).find((input) =>
        input.input_kind === 'material' && (run.resources.materials[input.input_id] ?? 0) < input.quantity,
      )
      if (missingMaterial !== undefined) {
        const material = data.materials.find((row) => row.id === missingMaterial.input_id)
        if (material === undefined) throw new Error(`${missingMaterial.input_id} 승인 재료가 없다`)
        while (run.resources.money < material.buy_price) {
          const sellable = Object.entries(run.resources.crops)
            .sort(([, a], [, b]) => b - a)[0]
          if (sellable === undefined || !economy.sell(sellable[0], 1).ok) break
        }
        if (!economy.buy(material.id, 1).ok) break
      }
      if (economy.maxCraftTimes(recipe.id) < 1 || !economy.craft(recipe.id, 1).ok) break
    }
  }
  // 남은 수확물은 승인 sell_price로 판매한다. 이는 정책의 정비 입력일 뿐 경제 규칙이 아니다.
  for (const [cropId, count] of Object.entries({ ...run.resources.crops })) economy.sell(cropId, count)
  equipWeapons(run, data.weapons)
}

function chooseTarget(player, farming, wildlife) {
  const wildlifeTarget = wildlife.instances
    .map((instance) => instance.entity)
    .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0]
  if (wildlifeTarget !== undefined) return wildlifeTarget
  const target = farming.targetAt(player)
  if (target !== null) return target.plot
  return farming.plots
    .filter((plot) => plot.stage === 'ready' || plot.stage === 'empty')
    .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0] ?? null
}

function shouldStartRecovery(run, data) {
  syncSelection(run.pouch, recoveryOptions(run, { items: data.recoveryItems, crops: data.crops, maxHealth: data.stats.max_health }))
  if (run.recovering !== null || run.health >= data.stats.max_health) return
  const started = startRecovery(run, recoveryOptions(run, { items: data.recoveryItems, crops: data.crops, maxHealth: data.stats.max_health }))
  if (started.ok) run.recovering = { itemId: started.option.id, elapsedSeconds: 0, durationSeconds: started.option.useDurationSeconds }
}

function runFarmingDay(systems, data, player, day) {
  const { run, farming, wildlife, combat } = systems
  const dayData = data.schedule.days?.find((entry) => entry.day_number === day)
  if (dayData === undefined) throw new Error(`${day}일차 일정이 없다`)
  const profile = dayData.wildlife_spawn_profile_id === null
    ? null : data.spawnProfiles.find((entry) => entry.id === dayData.wildlife_spawn_profile_id)
  if (dayData.wildlife_spawn_profile_id !== null && profile === undefined) throw new Error('출현 프로필이 없다')
  const timer = createStageTimer(data.schedule.farming_duration_seconds)
  combat.reset()
  wildlife.beginFarming(profile ?? null, profile?.entries ?? [])
  const bounds = { width: data.map.world_width, height: data.map.world_height }
  while (!timer.expired && run.health > 0) {
    const target = chooseTarget(player, farming, wildlife)
    if (target !== null) moveToward(player, target, data.stats.move_speed, INPUT_STEP_SECONDS, bounds)
    combat.setTargets(currentWildlifeTargets(wildlife))
    const hostile = wildlife.instances.find((instance) => instance.entity === target)
    if (hostile !== undefined) {
      const swing = combat.swingSickle(player, aimAt(player, hostile.entity))
      for (const hit of swing.hits) {
        wildlife.notifyDamagedByPlayer(hit.targetId)
        if (hit.outcome === 'killed') wildlife.remove(hit.targetId)
      }
    } else {
      recordHarvest(run, farming.interact(player))
    }
    farming.update(INPUT_STEP_SECONDS)
    for (const event of wildlife.update(INPUT_STEP_SECONDS, player, farming.plots)) {
      if (event.type === 'playerDamaged') applyPlayerDamage(run, event.amount)
    }
    for (const event of combat.update(INPUT_STEP_SECONDS)) {
      if (event.type === 'killed') wildlife.remove(event.targetId)
    }
    shouldStartRecovery(run, data)
    advanceRecovery(run, INPUT_STEP_SECONDS, { items: data.recoveryItems, crops: data.crops, maxHealth: data.stats.max_health })
    timer.tick(INPUT_STEP_SECONDS)
  }
  wildlife.endFarming()
}

function encounterChoice(data, residentId, phase, policy, random, crops = {}) {
  const resident = data.residents.find((entry) => entry.id === residentId)
  const scenarioId = resident?.story_scenario_ids?.[0]
  const choices = data.choices.filter((choice) =>
    choice.scenario_id === scenarioId &&
    choice.dialogue_phase === phase &&
    (choice.resource_offer_quantity === null ||
      Object.values(crops).reduce((total, amount) => total + amount, 0) >= choice.resource_offer_quantity),
  )
  if (choices.length === 0) throw new Error(`${residentId} ${phase} 선택지가 없다`)
  const selectedKind = phase === 'precombat' ? null : policy.surrender(random)
  const selected = phase === 'precombat'
    ? policy.precombat(choices, random)
    : choices.find((choice) => choice.choice_function === selectedKind)
  if (selected === undefined) {
    throw new Error(`${residentId} ${phase} 정책 선택(${selectedKind})이 승인 선택지에 없다: ${choices.map((choice) => choice.choice_function).join(', ')}`)
  }
  return selected
}

function selectAlly(run, data, schedule) {
  const dayByResident = new Map((schedule.days ?? []).map((day) => [day.hostile_resident_id, day.day_number]))
  return Object.values(run.residents)
    .filter((resident) => resident.allegiance === 'recruited' && resident.lifeState === 'alive' && !resident.supportUsed)
    .sort((a, b) => (dayByResident.get(a.residentId) ?? 0) - (dayByResident.get(b.residentId) ?? 0))[0] ?? null
}

function runRaid(systems, data, player, day, policy) {
  const { run, resolution, encounter, combat, residentCombat, random } = systems
  const dayData = data.schedule.days?.find((entry) => entry.day_number === day)
  const residentId = dayData?.hostile_resident_id
  if (residentId === null || residentId === undefined || residentId === '') return true
  const precombat = encounterChoice(data, residentId, 'precombat', policy, random, run.resources.crops)
  const judgement = encounter.judge(residentId, precombat.id, run.resources.crops)
  if (judgement.choiceFunction === 'threat') resolution.recordThreat(residentId)
  if (judgement.resolved) {
    if (precombat.resource_offer_quantity !== null) {
      const settled = encounter.settleNegotiation(run.resources.crops, `encounter.day${day}`, precombat.id, precombat.resource_offer_quantity, run.seed)
      if (!settled.ok) throw new Error(`협상 확정 실패: ${settled.reason}`)
    }
    const result = resolution.resolve(residentId, judgement.choiceFunction === 'empathy' ? 'empathy_resolve' : 'resource_negotiation_resolve')
    if (!result.ok) throw new Error(`조우 해소 실패: ${result.reason}`)
    return true
  }
  if (judgement.choiceFunction === 'resource_negotiation') resolution.recordNegotiationRejected(residentId)
  const state = judgement.systemResultId.replace('system_result.precombat.combat_', '')
  const resident = data.residents.find((entry) => entry.id === residentId)
  const profile = data.combatProfiles.find((entry) => entry.id === resident?.combat_profile_id)
  const modifier = data.modifiers.find((entry) => entry.combat_state === state)
  const spawn = (data.map.points ?? []).find((point) => point.point_role === 'resident_spawn')
  if (profile === undefined || modifier === undefined || spawn === undefined) throw new Error('습격 시작 승인 데이터가 없다')
  combat.reset()
  const hostile = residentCombat.spawn({ instanceId: `hostile.${day}`, residentId, profile, modifier, x: spawn.x, y: spawn.y })
  const combatTarget = { entity: hostile.entity, collisionRadius: hostile.collisionRadius, surrenderThreshold: hostile.surrenderThreshold, surrenderOffered: false }
  combat.setTargets([combatTarget])
  const ally = selectAlly(run, data, data.schedule)
  const allyProfile = ally === null ? null : data.supportProfiles.find((entry) => entry.id === data.residents.find((resident) => resident.id === ally.residentId)?.support_attack_profile_id)
  const allyPoint = (data.map.points ?? []).find((point) => point.point_role === 'ally_support')
  const support = ally === null || allyProfile === undefined || allyPoint === undefined ? null : createAllySupport({ residentId: ally.residentId, x: allyPoint.x, y: allyPoint.y, profile: { damage: allyProfile.damage, firstAttackDelaySeconds: allyProfile.first_attack_delay_seconds, attackIntervalSeconds: allyProfile.attack_interval_seconds } })
  if (ally !== null && support !== null) ally.supportUsed = true
  const bounds = { width: data.map.world_width, height: data.map.world_height }
  let finished = false
  const handleSurrender = () => {
    residentCombat.suspendForSurrender()
    const choice = encounterChoice(data, residentId, 'surrender', policy, random)
    const outcome = choice.choice_function
    resolution.recordSurrenderChoice(residentId, outcome)
    if (outcome === 'resume_combat') {
      resolution.recordSurrenderResumed(residentId)
      return
    }
    const result = resolution.resolve(residentId, outcome === 'recruit' ? 'recruited' : 'retreated')
    if (!result.ok) throw new Error(`투항 해소 실패: ${result.reason}`)
    finished = true
  }
  while (!finished && run.health > 0) {
    moveToward(player, hostile.entity, data.stats.move_speed, INPUT_STEP_SECONDS, bounds)
    shouldStartRecovery(run, data)
    if (policy.useThrowables(random)) combat.throwWeapon(player, aimAt(player, hostile.entity), run)
    const swing = combat.swingSickle(player, aimAt(player, hostile.entity))
    for (const hit of swing.hits) {
      if (hit.outcome === 'killed') {
        const result = resolution.resolve(residentId, 'killed')
        if (!result.ok) throw new Error(`처치 해소 실패: ${result.reason}`)
        finished = true
      }
      if (hit.outcome === 'surrender_offered') handleSurrender()
    }
    if (finished) break
    for (const event of residentCombat.update(INPUT_STEP_SECONDS, { ...player, collisionRadius: data.stats.collision_radius })) {
      if (event.type === 'playerDamaged') applyPlayerDamage(run, event.amount)
    }
    if (run.health <= 0) break
    for (const event of combat.update(INPUT_STEP_SECONDS)) {
      if (event.type === 'killed') {
        const result = resolution.resolve(residentId, 'killed')
        if (!result.ok) throw new Error(`지속 피해 해소 실패: ${result.reason}`)
        finished = true
      }
      if (event.type === 'surrenderOffered') handleSurrender()
    }
    if (!finished && support !== null) {
      const damage = support.update(INPUT_STEP_SECONDS)
      if (damage !== null) {
        for (const event of combat.applySupportDamage(hostile.entity.instanceId, damage)) {
          if (event.type === 'surrenderOffered') handleSurrender()
        }
      }
    }
    advanceRecovery(run, INPUT_STEP_SECONDS, { items: data.recoveryItems, crops: data.crops, maxHealth: data.stats.max_health })
  }
  residentCombat.reset()
  return run.health > 0
}

function simulateRun(data, policyName, seed) {
  const policy = POLICY[policyName]
  const systems = setupSystems(data, seed)
  const { run, economy, endingJudge } = systems
  // 실제 런 시작과 마찬가지로 맵 중심에서 시작한다 (main.ts의 startNewRun).
  const player = { x: data.map.world_width / 2, y: data.map.world_height / 2 }
  const moneyByDay = []
  for (const day of data.schedule.days ?? []) {
    run.dayNumber = day.day_number
    runFarmingDay(systems, data, player, day.day_number)
    if (run.health <= 0) return { complete: false, deathDay: day.day_number, moneyByDay, fear: run.record.fear, endingId: null }
    maintain(run, economy, data, policy)
    if (day.raid_type !== 'none') {
      if (!runRaid(systems, data, player, day.day_number, policy)) {
        return { complete: false, deathDay: day.day_number, moneyByDay, fear: run.record.fear, endingId: null }
      }
    }
    moneyByDay.push(run.resources.money)
  }
  const judgement = endingJudge.judge({ record: run.record, residents: run.residents })
  return { complete: true, deathDay: null, moneyByDay, fear: run.record.fear, endingId: judgement.ending?.id ?? 'ending.global_fallback', fallback: judgement.fallbackReason }
}

function summarize(name, runs, data) {
  const completed = runs.filter((run) => run.complete)
  const deaths = new Map()
  const endings = new Map()
  const fearBands = new Map(data.fearBands.map((band) => [band.id, 0]))
  for (const run of runs) {
    if (run.deathDay !== null) deaths.set(run.deathDay, (deaths.get(run.deathDay) ?? 0) + 1)
    if (run.complete) endings.set(run.endingId, (endings.get(run.endingId) ?? 0) + 1)
    const band = data.fearBands.find((entry) => run.fear >= entry.min_fear && (entry.max_fear === null || run.fear <= entry.max_fear))
    if (band !== undefined) fearBands.set(band.id, (fearBands.get(band.id) ?? 0) + 1)
  }
  const money = (data.schedule.days ?? []).map((day) => {
    const values = runs.map((run) => run.moneyByDay[day.day_number - 1]).filter((value) => value !== undefined)
    return values.length === 0
      ? { day: day.day_number, median: null, minimum: null }
      : { day: day.day_number, median: median(values), minimum: Math.min(...values) }
  })
  return { name, runs: runs.length, completed, deaths, endings, fearBands, fears: runs.map((run) => run.fear), money }
}

function markdown(summaries, data, options) {
  const endingRows = data.endings.map((ending) => ending.id)
  const lines = [
    '# 5일 런 밸런스 측정 보고서',
    '',
    `승인 런타임 JSON 기준으로 정책별 ${options.runs.toLocaleString('ko-KR')}회(총 ${(options.runs * summaries.length).toLocaleString('ko-KR')}회)를 실행했다. 기준 시드는 ${options.seed}이며, 정책별 런 시드는 기준 시드에 실행 순서를 더해 재현 가능하다.`,
    '',
    '시뮬레이터는 `createFarming`, `createCombat`, `createWildlife`, `createEncounter`, `createEconomy`, `createResolution`, `createEndingJudge`, `createResidentCombat`, 회복·지원·타이머·경계 시스템을 호출한다. 정책은 기존 판정을 바꾸지 않고 이동·대화·투항·정비 입력만 결정한다. 공격적은 위협 후 투항을 거부하고, 회유적은 공감을 고르고 투항을 영입으로 수용하며, 혼합은 두 선택을 시드 난수로 고른다.',
    '',
    '## 완주와 사망',
    '',
    '| 정책 | 완주 | 1일 | 2일 | 3일 | 4일 | 5일 |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...summaries.map((summary) => `| ${POLICY[summary.name].label} | ${summary.completed.length}/${summary.runs} (${percent(summary.completed.length, summary.runs)}) | ${summary.deaths.get(1) ?? 0} | ${summary.deaths.get(2) ?? 0} | ${summary.deaths.get(3) ?? 0} | ${summary.deaths.get(4) ?? 0} | ${summary.deaths.get(5) ?? 0} |`),
    '',
    '## 엔딩 도달 분포 (완주 런만)',
    '',
    `| 정책 | ${endingRows.map((id) => data.endings.find((ending) => ending.id === id)?.display_name ?? '전역 폴백').join(' | ')} |`,
    `| --- | ${endingRows.map(() => '---:').join(' | ')} |`,
    ...summaries.map((summary) => `| ${POLICY[summary.name].label} | ${endingRows.map((id) => summary.endings.get(id) ?? 0).join(' | ')} |`),
    '',
    '## 일차 종료 소지금',
    '',
    '| 정책 | 1일 중앙/최소 | 2일 중앙/최소 | 3일 중앙/최소 | 4일 중앙/최소 | 5일 중앙/최소 |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...summaries.map((summary) => `| ${POLICY[summary.name].label} | ${summary.money.map((row) => row.median === null ? '—' : `${row.median}/${row.minimum}`).join(' | ')} |`),
    '',
    '## 최종 공포도 (모든 종료 런)',
    '',
    '| 정책 | 중앙값 | 최소~최대 | 온기 | 경계 | 공포 |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...summaries.map((summary) => `| ${POLICY[summary.name].label} | ${median(summary.fears)} | ${Math.min(...summary.fears)}~${Math.max(...summary.fears)} | ${summary.fearBands.get('fear_band.warmth')} (${percent(summary.fearBands.get('fear_band.warmth'), summary.runs)}) | ${summary.fearBands.get('fear_band.wariness')} (${percent(summary.fearBands.get('fear_band.wariness'), summary.runs)}) | ${summary.fearBands.get('fear_band.terror')} (${percent(summary.fearBands.get('fear_band.terror'), summary.runs)}) |`),
    '',
    '## 관찰',
    '',
    ...observations(summaries, data),
    '',
    '측정 범위: 각 일차의 소지금은 재배→정비→습격을 모두 끝낸 뒤 기록했다. 엔딩 분포는 완주 런만, 공포도는 사망을 포함한 모든 종료 런의 마지막 기록값이다. 재배·습격의 공격·회복·지원·상태 효과 판정은 시스템 구현을 사용하며, 시뮬레이터는 UI·렌더·입력·LLM을 호출하지 않는다.',
  ]
  return `${lines.join('\n')}\n`
}

function observations(summaries, data) {
  const notes = []
  const allEndingIds = data.endings.map((ending) => ending.id)
  const unreachable = allEndingIds.filter((id) => summaries.every((summary) => (summary.endings.get(id) ?? 0) === 0))
  notes.push(unreachable.length === 0
    ? '세 정책 표본에서는 전역 폴백을 제외한 모든 승인 엔딩이 한 번 이상 도달했다.'
    : `세 정책 표본에서 한 번도 도달하지 못한 승인 엔딩은 ${unreachable.join(', ')}이다.`)
  for (const summary of summaries) {
    const measured = summary.money.filter((row) => row.median !== null)
    const lowest = [...measured].sort((a, b) => a.median - b.median)[0]
    notes.push(lowest === undefined
      ? `${POLICY[summary.name].label} 정책은 완주 일차 종료 소지금 표본이 없다.`
      : `${POLICY[summary.name].label} 정책의 중앙 소지금 최저점은 ${lowest.day}일차 ${lowest.median}이다.`)
  }
  for (const summary of summaries) {
    const largest = [...summary.fearBands.entries()].sort((a, b) => b[1] - a[1])[0]
    const band = data.fearBands.find((entry) => entry.id === largest[0])
    notes.push(`${POLICY[summary.name].label} 정책은 최종 공포도가 ${band?.display_name ?? largest[0]} 구간에 ${percent(largest[1], summary.runs)}로 가장 많이 쏠렸다.`)
  }
  return notes.map((note) => `- ${note}`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const data = await loadData()
  const summaries = Object.keys(POLICY).map((name) => {
    const runs = Array.from({ length: options.runs }, (_, index) => simulateRun(data, name, options.seed + index))
    return summarize(name, runs, data)
  })
  await writeFile(REPORT, markdown(summaries, data, options), 'utf8')
  console.log(`완료: 정책 ${summaries.length}개 × ${options.runs}회 → docs/progress/balance-report.md`)
}

await main()
