// 밭두렁난투 진입점
//
// 구현 순서는 docs/planning/밭두렁난투_시스템_UIUX_기획서_현재본.md 3절의
// 런 구조(DEC-RUN-014)를 따른다.
//
// 변경 가능한 게임 데이터는 이 파일을 포함해 어떤 코드에도 하드코딩하지 않는다.
// 모든 값은 generated/runtime/ 의 런타임 JSON에서 읽는다. (DEC-PIPELINE-016)
//
// 여기서 하는 일은 배선뿐이다. 규칙은 각 모듈에 있다.

import { createEventBus } from './core/bus.ts'
import { createGameLoop } from './core/loop.ts'
import { createSceneManager } from './scenes/manager.ts'
import type { SceneManager } from './scenes/manager.ts'
import { createInput } from './input/input.ts'
import { createCamera } from './render/camera.ts'
import { createFieldRenderer } from './render/field.ts'
import type { HostileView, PlotView } from './render/field.ts'
import { runConfig, usePlaceholderStats, setPlayerBaseStats } from './data/run-config.ts'
import { loadRuntimeData, requireTables } from './data/loader.ts'
import { createFarming } from './systems/farming.ts'
import type { FarmingSystem } from './systems/farming.ts'
import { createStageTimer } from './systems/stage-timer.ts'
import type { StageTimer } from './systems/stage-timer.ts'
import { createCombat } from './systems/combat.ts'
import type { CombatSystem, CombatTarget } from './systems/combat.ts'
import { createWildlife } from './systems/wildlife.ts'
import type { WildlifeSystem } from './systems/wildlife.ts'
import { createResidentCombat } from './systems/resident-combat.ts'
import type { HostileRuntime, ResidentCombatSystem } from './systems/resident-combat.ts'
import { createEncounter } from './systems/encounter.ts'
import type { Encounter } from './systems/encounter.ts'
import { createResolution } from './systems/resolution.ts'
import type { Resolution } from './systems/resolution.ts'
import type {
  Crop,
  FinalOutcome,
  ThrowableWeapon,
  WildlifeSpawnEntry,
  WildlifeSpawnProfile,
} from './data/types.ts'
import { createRunState } from './state/run-state.ts'
import type { RunState } from './state/types.ts'
import { createHud } from './ui/hud.ts'
import type { Hud } from './ui/hud.ts'

const isDevBuild = import.meta.env.VITE_BUILD_MODE !== 'submission'

const gameRoot = document.getElementById('game')
if (gameRoot === null) throw new Error('#game 요소가 없다')

const bus = createEventBus()
const camera = createCamera()
const renderer = createFieldRenderer(gameRoot, camera)

// 재배는 승인 데이터가 들어와야 시작된다. 없으면 null 로 남고 밭이 그려지지 않는다.
// 여기에 임시 경작지를 만들어 넣지 않는다 — 데이터가 없다는 사실이 화면에 보여야 한다.
let farming: FarmingSystem | null = null
let farmingTimer: StageTimer | null = null
let cropsById = new Map<string, Crop>()
let throwablesById = new Map<string, ThrowableWeapon>()
let run: RunState | null = null

// 전투와 야생동물도 승인 데이터가 있어야 만들어진다. 없으면 null 로 남고
// 우클릭·좌클릭이 아무 일도 하지 않는다 — 임시 수치를 지어내지 않는다.
let combat: CombatSystem | null = null
let wildlife: WildlifeSystem | null = null
let spawnEntries: WildlifeSpawnEntry[] = []
let spawnProfilesById = new Map<string, WildlifeSpawnProfile>()
/** 일차 → 그날의 출현 프로필 ID. 없는 일차는 야생동물이 없다 (DEC-CONTENT-007) */
let spawnProfileIdByDay = new Map<number, string | null>()

let residentCombat: ResidentCombatSystem | null = null
let encounter: Encounter | null = null
/** 조우 해결 — 최종 결과·관계·공포도·보상 (DEC-RESIDENT-052, 042) */
let resolution: Resolution | null = null
/** 이번 습격의 적대 주민. 한 번에 한 명이다 (DEC-CONTENT-002) */
let hostile: HostileRuntime | null = null
/**
 * 전투 시스템이 보는 적대 주민 대상.
 *
 * **매 프레임 새로 만들지 않는다.** `combat.ts` 는 투항이 발동하면 이 객체의
 * `surrenderOffered` 를 true 로 바꾸는데, 새로 만들면 그 표시가 매 프레임 지워져
 * "투항 대화는 주민 한 명당 최대 한 번" (DEC-RESIDENT-016) 이 깨진다.
 */
let hostileTarget: CombatTarget | null = null
/** 맵의 resident_spawn 지점 (DEC-CONTENT-016) */
let raidSpawnPoint: { x: number; y: number } | null = null
/** 습격 조우를 시작하는 데 필요한 승인 데이터 묶음 */
let raidData: {
  hostileResidentByDay: Map<number, string | null>
  combatProfileByResident: Map<string, string>
  profileById: Map<string, import('./data/types.ts').ResidentCombatProfile>
  modifierByState: Map<string, import('./data/types.ts').ResidentCombatModifier>
  scenarioByResident: Map<string, import('./data/types.ts').StoryScenario>
} | null = null

const player = { x: 0, y: 0 }

/**
 * 승인 데이터를 읽어 맵·작물·플레이어 수치를 붙인다.
 *
 * 실패하면 데이터 오류로 올리고(DEC-UI-024) 이동만 확인할 수 있는 임시 값으로 남는다.
 * 임시 값은 폴백이 아니라 **명시적 선언**이며 콘솔에 경고가 남는다 (run-config.ts).
 */
async function bootData(): Promise<void> {
  try {
    const data = await loadRuntimeData()
    requireTables(data, ['maps', 'crops', 'player_base_stats', 'run_schedules'])

    setPlayerBaseStats(data.player_base_stats!)

    // 1차 프로토타입은 승인된 맵 하나만 쓴다 (DEC-CONTENT-016)
    const map = data.maps![0]
    camera.setWorldSize(map.world_width, map.world_height)
    player.x = map.world_width / 2
    player.y = map.world_height / 2

    const plots = map.farm_plots ?? []
    if (plots.length === 0) {
      throw new Error(`맵 ${map.id} 에 승인된 경작지가 없다`)
    }

    const crops = data.crops! as Crop[]
    cropsById = new Map(crops.map((crop) => [crop.id, crop]))

    farming = createFarming({
      plots,
      crops,
      interactionRadius: map.farm_interaction_radius,
    })

    // 1차 프로토타입은 승인된 런 일정 하나만 쓴다 (DEC-CONTENT-002)
    const schedule = data.run_schedules![0]
    farmingTimer = createStageTimer(schedule.farming_duration_seconds)

    throwablesById = new Map((data.throwable_weapons ?? []).map((w) => [w.id, w]))

    const weapons = data.throwable_weapons ?? []
    combat = createCombat({
      stats: data.player_base_stats![0],
      weapons,
      attributes: data.crop_attributes ?? [],
    })
    wildlife = createWildlife({
      map,
      species: data.wildlife ?? [],
      weapons,
    })

    // 1일차 재배의 출현 프로필. 일차가 넘어갈 때 다시 부른다.
    // 프로필 참조가 비어 있는 일차는 야생동물이 없다 (DEC-CONTENT-007).
    spawnEntries = (data.wildlife_spawn_profiles ?? []).flatMap((p) => p.entries ?? [])
    spawnProfilesById = new Map((data.wildlife_spawn_profiles ?? []).map((p) => [p.id, p]))

    const residentSpawn = (map.points ?? []).find((p) => p.point_role === 'resident_spawn')
    raidSpawnPoint = residentSpawn === undefined ? null : { x: residentSpawn.x, y: residentSpawn.y }

    residentCombat = createResidentCombat({ weapons })
    encounter = createEncounter({
      residents: data.residents ?? [],
      personalityProfiles: data.resident_personality_profiles ?? [],
      choiceOutcomes: (data.resident_personality_profiles ?? []).flatMap(
        (p) => p.choice_outcomes ?? [],
      ),
      choices: data.dialogue_choices ?? [],
      responses: (data.dialogue_choices ?? []).flatMap((c) => c.responses ?? []),
    })

    raidData = {
      hostileResidentByDay: new Map(
        (schedule.days ?? []).map((d) => [d.day_number, d.hostile_resident_id]),
      ),
      combatProfileByResident: new Map(
        (data.residents ?? []).map((r) => [r.id, r.combat_profile_id]),
      ),
      profileById: new Map((data.resident_combat_profiles ?? []).map((p) => [p.id, p])),
      modifierByState: new Map(
        (data.resident_combat_modifiers ?? []).map((m) => [m.combat_state, m]),
      ),
      scenarioByResident: new Map(
        (data.story_scenarios ?? []).map((s) => [s.resident_id, s]),
      ),
    }

    // 런 상태를 새로 만든다. 부분 초기화하지 않는다 (로드맵 9-5).
    // 이름 입력 화면이 아직 없어 playerName 은 비어 있다.
    run = createRunState({
      stats: data.player_base_stats![0],
      schedule,
      playerName: '',
      seed: 1,
      residents: data.residents ?? [],
    })

    // 조우 해결. 런 상태가 만들어진 뒤라야 붙는다 — 주민 런 상태를 직접 고친다.
    //
    // `fearIncrements` 가 null 인 것은 `DEC-RESIDENT-048`(공포도 증가량)이 보류라
    // 승인 CSV 에 수치가 없기 때문이다. 임시 기본값을 넣지 않는다 (DEC-PIPELINE-016).
    // 그동안 공포도만 누적되지 않고 관계·보상·중요 행동은 정상 처리된다.
    resolution = createResolution(run, {
      rewardBundles: data.reward_bundles ?? [],
      residents: data.residents ?? [],
      combatProfiles: data.resident_combat_profiles ?? [],
      fearIncrements: null,
    })

    // 흐름이 일차·습격을 판단할 근거를 승인 데이터로 갈아끼운다.
    // 여기서 일정을 지어내지 않는다 — 없으면 흐름이 데이터 오류로 보고한다.
    spawnProfileIdByDay = new Map(
      (schedule.days ?? []).map((d) => [d.day_number, d.wildlife_spawn_profile_id]),
    )

    const raidByDay = new Map((schedule.days ?? []).map((d) => [d.day_number, d.raid_type]))
    scenes.setContext({
      totalDays: schedule.total_days,
      raidTypeOf: (day) => raidByDay.get(day),
    })

    console.info(
      `[데이터] 맵 ${map.display_name} · 경작지 ${plots.length}칸 · 작물 ${crops.length}종 · ` +
        `${schedule.total_days}일 런 · 재배 ${schedule.farming_duration_seconds}초`,
    )
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    bus.emit('data.error', { summary: '승인 데이터를 읽지 못했다', detail })

    // 승인 전에도 이동과 카메라는 확인할 수 있어야 한다. 밭은 뜨지 않는다.
    usePlaceholderStats({
      moveSpeed: 210,
      collisionRadius: 20,
      worldWidth: 1600,
      worldHeight: 900,
    })
    camera.setWorldSize(1600, 900)
    player.x = 800
    player.y = 450
  }
}

/**
 * 화면 피드백의 수명(초).
 *
 * 표현이지 게임 데이터가 아니다 (개발 로드맵 2절). `DEC-UI-004`·`DEC-UI-018` 은
 * "짧게 표시한다"고만 정하고 길이를 정하지 않았으므로 **임의로 고른 값**이다.
 */
const READY_FLASH_SECONDS = 0.6
const HARVEST_POPUP_SECONDS = 1.2

/** 전환 강조가 남은 경작지. plot_id → 남은 초 */
const readyFlashes = new Map<string, number>()
/** 수확 획득 표시 */
let harvestPopups: { x: number; y: number; text: string; remaining: number }[] = []

/** 표시용 수명을 줄인다. 재배 단계에서만 흐른다 */
function advanceFeedback(dt: number): void {
  for (const [plotId, remaining] of readyFlashes) {
    const next = remaining - dt
    if (next <= 0) readyFlashes.delete(plotId)
    else readyFlashes.set(plotId, next)
  }

  for (const popup of harvestPopups) popup.remaining -= dt
  harvestPopups = harvestPopups.filter((p) => p.remaining > 0)
}

/**
 * 지금 재배 단계인가.
 *
 * 필드 모드가 `farming` 이어도 정비 허브 오버레이가 덮고 있으면 재배가 아니다
 * (정비는 화면 전환이 아니라 셔터 오버레이라 필드 모드가 그대로 유지된다).
 * 작물 성장·재배 타이머·심기·수확이 전부 이 판정 하나를 쓴다.
 */
function inFarmingStage(): boolean {
  return scenes.currentFieldMode() === 'farming' && scenes.openOverlays().length === 0
}

function inRaidStage(): boolean {
  return scenes.currentFieldMode() === 'raid' && scenes.openOverlays().length === 0
}

/**
 * 습격 한 프레임.
 *
 * 투항 대화가 열려 있으면 `inRaidStage()` 가 false 라 여기 오지 않는다.
 * 그것이 `DEC-RESIDENT-039` 가 정한 "전투 타이머 정지" 다 — 정지 플래그를
 * 따로 두지 않는다.
 */
function updateRaid(dt: number): void {
  if (residentCombat === null || combat === null || hostile === null || run === null) return

  // 체력 0이면 어떤 경로로 여기 들어왔든 전투가 돌지 않는다 (DEC-RUN-008).
  //
  // 화면 전환만으로 막으면 화면을 우회하는 경로가 생겼을 때 그대로 뚫린다 —
  // 실제로 `enterFieldPreview()` 가 run_failed 위에 필드를 다시 띄워서, 체력 0인
  // 플레이어가 주민을 투항 직전까지 때리는 상태가 나왔다. 실패 여부는 상태로 판단한다.
  if (run.health <= 0) {
    failRunIfDead()
    return
  }

  for (const event of residentCombat.update(dt, { ...player, collisionRadius: runConfig.collisionRadius })) {
    if (event.type !== 'playerDamaged') continue
    run.health = Math.max(0, run.health - event.amount)
    bus.emit('combat.playerDamaged', { amount: event.amount, remainingHealth: run.health })
  }

  // 플레이어 → 주민. 야생동물과 같은 시스템을 쓰되 대상만 바뀐다.
  combat.setTargets(currentTargets())
  for (const event of combat.update(dt)) {
    if (event.type === 'surrenderOffered') onSurrenderOffered()
    if (event.type === 'killed') {
      // 처치 보상 지급과 상태 변경은 하나의 처리다 (DEC-RESIDENT-042).
      // 실패하면 주민을 지우지 않는다 — 지워 버리면 보상 없이 조우만 사라진다.
      if (!finishEncounter(hostile.entity.residentId, 'killed')) return
      hostile = null
      hostileTarget = null
      return
    }
  }

  // 습격 중 체력 0도 즉시 런 실패다 (DEC-RUN-008)
  failRunIfDead()
}

/**
 * 조우를 끝낸다 — 최종 결과 확정, 관계·공포도, 보상 지급 (DEC-RESIDENT-052, 042).
 *
 * **여기가 조우를 끝내는 유일한 경로다.** 처치·투항·대화 해결이 각자 상태를 고치면
 * "처치했는데 관계가 단절이 아닌" 조합이 만들어지고, 엔딩 판정이 그걸 그대로 읽는다.
 *
 * @returns 실제로 확정됐으면 true. 중복 입력이나 보상 데이터 오류면 false.
 */
function finishEncounter(residentId: string, outcome: FinalOutcome): boolean {
  if (resolution === null) return false

  const result = resolution.resolve(residentId, outcome)
  if (!result.ok) {
    // 조용히 넘어가지 않는다. 중복 확정은 막힌 것이 정상이고,
    // 보상 데이터 오류는 승인 데이터를 고쳐야 하는 문제다.
    if (result.reason === 'already_resolved') {
      console.warn(`[조우] ${residentId} 는 이미 해결됐다 — 중복 확정을 막았다`)
    } else {
      bus.emit('data.error', {
        summary: '조우를 끝낼 수 없다',
        detail: `${residentId} · ${outcome} · ${result.reason}`,
      })
    }
    return false
  }

  const { rewardBundleId, fearDelta, fearPending } = result.value
  bus.emit('encounter.finished', { residentId, finalOutcome: outcome })
  if (rewardBundleId !== null) {
    bus.emit('reward.granted', { residentId, bundleId: rewardBundleId })
  }

  console.info(
    `[조우] ${residentId} → ${outcome} · 관계 ${run?.residents[residentId]?.relationship} · ` +
      `공포도 +${fearDelta} (누적 ${run?.record.fear})` +
      (rewardBundleId === null ? '' : ` · 보상 ${rewardBundleId}`),
  )
  if (fearPending) warnFearPending()
  return true
}

/** 공포도 증가량 미승인 안내. 개발 빌드에서만, 한 런에 한 번만 (DEC-RESIDENT-048) */
let fearPendingWarned = false
function warnFearPending(): void {
  if (!isDevBuild || fearPendingWarned) return
  fearPendingWarned = true
  console.warn(
    '[조우] 공포도가 오르지 않는다 — DEC-RESIDENT-048(공포도 증가량)이 보류라 ' +
      '승인 CSV 에 수치가 없다. 임시값을 넣지 않는다. 확정되면 엔딩 판정이 정상 동작한다.',
  )
}

/**
 * 체력 0이면 런 전체를 실패로 끝낸다 (DEC-RUN-008).
 *
 * **이벤트만 쏘면 안 된다.** `run.failed` 는 UI 에게 알리는 결과 이벤트이고,
 * 흐름을 옮기는 것은 `player_died` 입력이다. 이벤트만 쐈더니 체력이 0인 채로
 * 계속 움직이고 야생동물도 계속 때렸다 — 화면에서는 "체력 바가 비었는데 안 죽네"
 * 로만 보인다. 엔딩으로 가지 않고 런 실패 화면으로 간다 (DEC-UI-014).
 */
function failRunIfDead(): void {
  if (run === null || run.health > 0) return
  if (scenes.step().at === 'run_failed') return

  bus.emit('run.failed', {})
  scenes.send({ type: 'player_died' })
}

/**
 * 투항 발동 (DEC-RESIDENT-016, DEC-RESIDENT-039).
 *
 * 전투를 정지하고 진행 중인 공격을 취소한 뒤 투항 대화를 연다.
 * 선택지 UI(`surrender-modal.ts`)는 로드맵 8/4 김민주 몫이라 지금은 오버레이만
 * 열린다 — 오버레이가 열리면 `inRaidStage()` 가 false 가 되어 전투가 멈춘다.
 */
function onSurrenderOffered(): void {
  if (hostile === null) return

  residentCombat?.suspendForSurrender()
  scenes.openOverlay('surrender_dialogue')

  bus.emit('surrender.offered', {
    residentId: hostile.entity.residentId,
    remainingHealth: hostile.entity.health,
  })
  console.warn(
    `[습격] 투항 발동 — 체력 ${hostile.entity.health} / 기준 ${hostile.surrenderThreshold}. ` +
      '선택지 UI 는 8/4 김민주. Esc 로는 닫히지 않는다 (DEC-UI-022).',
  )
}

/** `E` — 심기·수확 문맥 상호작용 (DEC-INPUT-003) */
function onInteract(): void {
  if (farming === null) {
    console.warn('[입력] 승인 데이터가 없어 재배 상호작용을 할 수 없다')
    return
  }
  // 습격 단계에서는 작물을 심거나 수확할 수 없다 (DEC-FARM-004)
  if (!inFarmingStage()) return
  const event = farming.interact(player)
  if (event === null) return

  if (event.type === 'planted') {
    // 씨앗 단계에서는 종류를 공개하지 않으므로 로그에도 남기지 않는다 (DEC-FARM-001)
    console.info(`[재배] ${event.plot.plotId} 파종`)
  } else {
    const name = cropsById.get(event.cropId)?.display_name ?? event.cropId
    const total = farming.harvested.get(event.cropId) ?? 0
    console.info(`[재배] ${name} ${event.amount}개 수확 — 보관함 ${total}개`)

    // 수확물 보관함과 총수확 기록에 반영한다.
    // farming.harvested 는 재배 시스템 안의 집계이고, 판매·제작이 보는 원본은 런 상태다.
    if (run !== null) {
      run.resources.crops[event.cropId] = (run.resources.crops[event.cropId] ?? 0) + event.amount
      run.record.cropHarvested[event.cropId] =
        (run.record.cropHarvested[event.cropId] ?? 0) + event.amount
    }

    // 획득한 작물과 수량을 그 자리에 짧게 표시한다 (DEC-UI-018)
    harvestPopups.push({
      x: event.plot.x,
      y: event.plot.y,
      text: `${name} +${event.amount}`,
      remaining: HARVEST_POPUP_SECONDS,
    })
  }
}

/** 재배 상태를 렌더가 쓰는 모양으로 옮긴다 */
function plotViews(): readonly PlotView[] {
  if (farming === null) return []
  const target = farming.targetAt(player)

  return farming.plots.map((plot) => {
    const crop = plot.cropId === null ? null : (cropsById.get(plot.cropId) ?? null)

    // 단계 전체 길이를 알아야 진행도를 낼 수 있다. 수확 가능은 제한시간이 없다.
    let progress = 0
    if (crop !== null && (plot.stage === 'seed' || plot.stage === 'growing')) {
      const total =
        plot.stage === 'seed' ? crop.seed_duration_seconds : crop.growth_duration_seconds
      progress = total > 0 ? 1 - plot.remainingSeconds / total : 0
    }

    return {
      x: plot.x,
      y: plot.y,
      stage: plot.stage,
      // 씨앗 단계는 종류를 숨긴다 (DEC-FARM-001)
      cropLabel: plot.stage === 'seed' || crop === null ? null : crop.display_name,
      progress: Math.min(Math.max(progress, 0), 1),
      highlighted: target?.plot.plotId === plot.plotId,
      readyFlash: (readyFlashes.get(plot.plotId) ?? 0) / READY_FLASH_SECONDS,
      eatingProgress: eatingProgressOf(plot.plotId),
    }
  })
}

/**
 * 이 칸을 먹고 있는 야생동물의 진행도 0~1. 없으면 null (DEC-UI-018).
 *
 * 야생동물 쪽 남은 시간을 역산한다. 진행도를 따로 저장하면 두 곳이 어긋난다.
 */
function eatingProgressOf(plotId: string): number | null {
  for (const runtime of wildlife?.instances ?? []) {
    if (runtime.entity.targetPlotId !== plotId) continue
    if (runtime.eatingSeconds === null) continue

    const total = runtime.species.crop_eat_duration_seconds
    return Math.min(Math.max(1 - runtime.eatingSeconds / total, 0), 1)
  }
  return null
}

/**
 * 그날의 적대 주민을 필드에 세운다 (DEC-CONTENT-008).
 *
 * `combatState` 는 전투 전 대화 판정이 확정한다. 여기서 기본값을 고르지 않는다 —
 * 판정 없이 습격을 시작하는 경로를 만들면 `DEC-RESIDENT-049` 가 정한
 * "대화 결과가 지정한 전투 보정" 이 우회된다.
 */
function spawnHostile(dayNumber: number, combatState: string): HostileRuntime | null {
  if (residentCombat === null || raidData === null) return null

  const residentId = raidData.hostileResidentByDay.get(dayNumber) ?? null
  if (residentId === null || residentId === '') return null // 습격 없는 날

  // 해결된 주민은 같은 런에서 다시 적대로 등장하지 않는다 (DEC-RESIDENT-043).
  // 승인 일정이 같은 주민을 두 번 배치하지 않으므로 정상 흐름에서는 걸리지 않지만,
  // 걸린다면 일정 데이터나 흐름이 잘못된 것이라 조용히 세우면 안 된다.
  if (resolution !== null && !resolution.canAppearAsHostile(residentId)) {
    bus.emit('data.error', {
      summary: '습격을 시작할 수 없다',
      detail: `${residentId} 는 이미 조우가 해결된 주민이다 (DEC-RESIDENT-043)`,
    })
    return null
  }

  const profileId = raidData.combatProfileByResident.get(residentId)
  const profile = profileId === undefined ? undefined : raidData.profileById.get(profileId)
  const modifier = raidData.modifierByState.get(combatState)

  if (profile === undefined || modifier === undefined) {
    bus.emit('data.error', {
      summary: '습격을 시작할 수 없다',
      detail: `${residentId} 의 전투 프로필(${profileId}) 또는 보정(${combatState}) 이 없다`,
    })
    return null
  }

  // 시작 위치는 맵의 resident_spawn 지점에서 온다 (DEC-CONTENT-016).
  const spawn = raidSpawnPoint ?? { x: player.x + 400, y: player.y }

  const runtime = residentCombat.spawn({
    instanceId: `hostile.${dayNumber}`,
    residentId,
    profile,
    modifier,
    x: spawn.x,
    y: spawn.y,
  })

  hostileTarget = {
    entity: runtime.entity,
    collisionRadius: runtime.collisionRadius,
    surrenderThreshold: runtime.surrenderThreshold,
    surrenderOffered: false,
  }
  return runtime
}

/** 낫 재사용 대기 0~1. 개발 빌드가 아니거나 대기가 없으면 null */
function devSickleRatio(): number | null {
  if (!isDevBuild || combat === null || !runConfig.loaded) return null

  const remaining = combat.sickleCooldownRemaining
  if (remaining <= 0) return null
  return Math.min(remaining / runConfig.sickleCooldownSeconds, 1)
}

/** 야생동물과 적대 주민을 렌더가 쓰는 모양으로 옮긴다 */
function hostileViews(): HostileView[] {
  // 적대 주민은 예고를 쓰지 않는다 (DEC-CONTENT-008). windup 이 항상 null 이다.
  const resident: HostileView[] =
    hostile === null
      ? []
      : [
          {
            x: hostile.entity.x,
            y: hostile.entity.y,
            radius: hostile.collisionRadius,
            healthRatio: hostile.entity.health / hostile.maxHealth,
            windup: null,
            slowed: hostile.entity.effects.some((e) => e.mechanicKey === 'movement_slow'),
            burning: hostile.entity.effects.some((e) => e.mechanicKey === 'damage_over_time'),
          },
        ]

  return resident.concat((wildlife?.instances ?? []).map((runtime) => ({
    x: runtime.entity.x,
    y: runtime.entity.y,
    radius: runtime.species.collision_radius,
    healthRatio: runtime.entity.health / runtime.species.max_health,
    // 공격 예고는 야생동물만 있다. 적대 주민은 예고를 쓰지 않는다 (DEC-CONTENT-008)
    windup:
      runtime.windupSeconds === null
        ? null
        : runtime.windupSeconds / runtime.species.attack_windup_seconds,
    slowed: runtime.entity.effects.some((e) => e.mechanicKey === 'movement_slow'),
    burning: runtime.entity.effects.some((e) => e.mechanicKey === 'damage_over_time'),
  })))
}

/** 상호작용 가능한 대상이 있을 때 행동을 안내한다 (DEC-INPUT-003) */
function actionPrompt(): string | null {
  if (farming === null) return null
  const target = farming.targetAt(player)
  if (target === null) return null
  return target.kind === 'harvest' ? 'E — 수확' : 'E — 심기'
}

/**
 * 지금 때릴 수 있는 대상.
 *
 * **모드로 갈린다.** 재배에서는 야생동물, 습격에서는 적대 주민이다.
 * 이걸 한 곳에 모으지 않았더니 `onSickle` 이 습격 중에도 야생동물 목록(0마리)을
 * 넘겨서 낫이 아무도 못 때렸고, 그 호출이 `updateRaid` 가 세워 둔 대상까지 덮었다.
 * **대상 선택이 두 군데 있으면 반드시 한쪽이 틀린다.**
 */
function currentTargets(): CombatTarget[] {
  if (scenes.currentFieldMode() === 'raid') {
    return hostileTarget === null ? [] : [hostileTarget]
  }
  if (wildlife === null) return []

  // 야생동물이 죽거나 새로 나오면 목록이 바뀌므로 매 프레임 만든다.
  // `entity` 를 참조로 들고 있어 체력을 깎으면 원본이 바뀐다.
  return wildlife.instances.map((runtime) => ({
    entity: runtime.entity,
    collisionRadius: runtime.species.collision_radius,
    // 야생동물에게는 투항이 없다 (DEC-RESIDENT-016 은 주민 규칙이다)
    surrenderThreshold: null,
    surrenderOffered: false,
  }))
}

/** 우클릭 — 낫 (DEC-INPUT-004) */
function onSickle(): void {
  if (combat === null) return

  combat.setTargets(currentTargets())
  const result = combat.swingSickle(player, input.aimAngle())
  if (!result.swung) return // 재사용 대기 중

  for (const hit of result.hits) {
    // 피해를 받은 crop_first 야생동물은 플레이어에게 영구 적대한다 (DEC-CONTENT-007).
    // 이 알림이 그 전환의 유일한 경로다. 습격 중에는 해당 없다.
    wildlife?.notifyDamagedByPlayer(hit.targetId)
    if (hit.outcome === 'killed') wildlife?.remove(hit.targetId)
    if (hit.outcome === 'surrender_offered') onSurrenderOffered()
  }
}

/** 좌클릭 — 투척 (DEC-INPUT-004, 005) */
function onThrow(): void {
  if (combat === null || run === null) return

  const result = combat.throwWeapon(player, input.aimAngle(), run)
  if (result.ok) {
    // 소진 자동 전환과 `투척 무기 없음` 을 UI 에 알린다 (DEC-INPUT-007, DEC-UI-002)
    if (result.slot.autoSwitchedTo !== null) {
      bus.emit('quickslot.autoSwitched', {
        fromIndex: run.quickslots.selectedIndex,
        toIndex: result.slot.autoSwitchedTo,
      })
    }
    if (result.slot.allEmpty) bus.emit('quickslot.allEmpty', {})
    bus.emit('combat.throwableSpent', {
      throwableId: result.weaponId,
      remaining: run.resources.throwables[result.weaponId] ?? 0,
    })
    return
  }

  // 거절 사유는 콘솔로만 남긴다. `투척 무기 없음`·빈 발사 안내의 화면 표시는
  // `DEC-UI-002` 의 HUD 몫이고 김민주 8/4 항목이다. 여기서 문구를 지어내면
  // 나중에 두 곳이 다른 말을 한다.
  if (isDevBuild && result.reason !== 'cooldown') {
    console.info(`[투척] 거절 — ${result.reason}`)
  }
}

const input = createInput(renderer.canvas, {
  onInteract,
  onThrow,
  onSickle,
  // 선택은 재배·습격 중에도 할 수 있다. 편성만 정비 단계 전용이다 (DEC-INPUT-006).
  onQuickslotSelect: (index) => {
    if (combat === null || run === null) return
    combat.selectSlot(run, index)
  },
  onQuickslotCycle: (dir) => {
    if (combat === null || run === null) return
    combat.cycleSlot(run, dir > 0 ? 1 : -1)
  },
  onRecoverShortPress: () => console.info('[입력] 회복 짧게 누름 — 시작 또는 취소'),
  onRecoverMenuOpen: () => scenes.openOverlay('recovery_quickmenu'),
  onRecoverMenuClose: () => scenes.closeOverlay('recovery_quickmenu'),
  onEscape: () => scenes.handleEscape(),
})

const uiRoot = document.getElementById('ui')
if (uiRoot === null) throw new Error('#ui 요소가 없다')

const hud: Hud = createHud(uiRoot, {
  onPause: () => scenes.handleEscape(),
})

/** 런 상태를 HUD 가 쓰는 모양으로 옮긴다 */
function hudView() {
  const quickslots = (run?.quickslots.slots ?? []).map((id, index) => ({
    name: id === null ? null : (throwablesById.get(id)?.display_name ?? id),
    count: id === null ? 0 : (run?.resources.throwables[id] ?? 0),
    selected: index === (run?.quickslots.selectedIndex ?? 0),
  }))

  return {
    health: run?.health ?? 0,
    maxHealth: runConfig.loaded ? runConfig.maxHealth : 0,
    dayNumber: run?.dayNumber ?? 1,
    remainingSeconds: inFarmingStage() ? (farmingTimer?.remainingSeconds ?? null) : null,
    timeUrgent: farmingTimer?.urgent ?? false,
    quickslots,
    recoveryName: run?.pouch.selectedId ?? null,
    // raid_notices.csv 가 없어 비워 둔다 (DEC-RUN-011, DEC-CONTENT-021)
    raidNoticeLabel: null,
  }
}

const loop = createGameLoop(
  {
    update(dt) {
      const move = input.move()
      const speed = runConfig.moveSpeed
      player.x += move.x * speed * dt
      player.y += move.y * speed * dt

      // 습격 모드 — 주민만 돈다. 작물은 자라지 않고 재배 타이머도 없다.
      if (inRaidStage()) {
        updateRaid(dt)
        return
      }

      // 작물 성장과 재배 타이머는 같은 조건에서만 흐른다 (DEC-FARM-003, DEC-RUN-004).
      // 정비·대화·습격에서는 이 블록이 통째로 빠지므로 잔여 시간이 그대로 보존되고,
      // 다음 날 재배 단계에서 이어서 자란다. 일시정지는 루프가 update 자체를 멈춘다.
      if (!inFarmingStage()) return

      farming?.update(dt)
      advanceFeedback(dt)

      // 야생동물 → 전투 순서로 돈다.
      // 야생동물이 먼저 움직여야 투사체가 이번 프레임의 실제 위치를 맞힌다.
      const events = wildlife?.update(dt, player, farming?.plots ?? []) ?? []
      for (const event of events) {
        if (event.type === 'playerDamaged' && run !== null) {
          run.health = Math.max(0, run.health - event.amount)
          bus.emit('combat.playerDamaged', {
            amount: event.amount,
            remainingHealth: run.health,
          })
        }
        if (event.type === 'cropEaten') {
          // 먹힌 작물은 보관함에 넣지 않는다 (DEC-FARM-006).
          // 여기서 수확 처리를 부르면 잃은 작물이 오히려 쌓인다.
          //
          // 사라진 사실을 그 자리에 짧게 표시한다 (DEC-UI-018). 이게 없으면
          // 플레이어는 자기가 수확한 것과 먹힌 것을 구분할 수 없다.
          const eaten = farming?.plots.find((p) => p.plotId === event.plotId)
          if (eaten !== undefined) {
            harvestPopups.push({
              x: eaten.x,
              y: eaten.y,
              text: '먹혔다',
              remaining: HARVEST_POPUP_SECONDS,
            })
          }
        }
      }

      if (combat !== null) {
        combat.setTargets(currentTargets())
        for (const event of combat.update(dt)) {
          if (event.type === 'killed' && event.targetId !== undefined) {
            wildlife?.remove(event.targetId)
          }
          // 지속 피해도 적대 전환의 계기다 (DEC-CONTENT-007 — 플레이어 공격으로
          // 피해를 받으면). 투척 무기의 지속 피해는 플레이어 공격이다.
          if (event.type === 'damaged' && event.overTime === true && event.targetId !== undefined) {
            wildlife?.notifyDamagedByPlayer(event.targetId)
          }
        }
      }

      // 재배 중 체력이 0이면 즉시 런 실패다 (DEC-RUN-008)
      failRunIfDead()

      // 수확 가능으로 바뀐 순간을 한 번만 강조한다 (DEC-UI-004)
      for (const plotId of farming?.justBecameReady ?? []) {
        readyFlashes.set(plotId, READY_FLASH_SECONDS)
      }

      // 제한시간이 끝나면 재배 단계를 자동 종료한다 (DEC-RUN-004).
      // 조기 종료 조건을 만들지 않는다 — DEC-RUN-005 는 보류다.
      if (farmingTimer?.tick(dt)) {
        console.info('[재배] 제한시간 종료 — 정비 단계로')
        scenes.send({ type: 'farming_time_expired' })
      }
    },
    render() {
      renderer.draw({
        player,
        aimAngle: input.aimAngle(),
        collisionRadius: runConfig.collisionRadius,
        plots: plotViews(),
        actionPrompt: actionPrompt(),
        harvestPopups: harvestPopups.map((p) => ({
          x: p.x,
          y: p.y,
          text: p.text,
          life: p.remaining / HARVEST_POPUP_SECONDS,
        })),
        hostiles: hostileViews(),
        // 확정 UI 규칙이 없어 개발 빌드에만 보인다 (field.ts 주석 참고).
        // 렌더는 0~1 을 받는다 — 초를 그대로 넘기면 대기시간이 바뀔 때 호가 한 바퀴를 넘는다.
        devSickleCooldown: devSickleRatio(),
        projectiles: (combat?.projectiles ?? []).map((p) => ({
          x: p.x,
          y: p.y,
          radius: throwablesById.get(p.sourceId)?.collision_radius ?? 4,
          hostile: p.source === 'resident',
        })),
      })
      hud.render(hudView())
    },
  },
  {
    // 포커스를 잃으면 일시정지 화면을 연다 (DEC-INPUT-009, DEC-UI-022).
    // 자동 재개는 하지 않는다. 회복 퀵메뉴가 열려 있으면 그것도 닫는다 (DEC-UI-026).
    onFocusLost: () => scenes.handleFocusLost(),
  },
)

const scenes: SceneManager = createSceneManager(bus, loop)

// 필드 입력 잠금을 화면 층위에 맞춘다 (DEC-INPUT-009).
// 재배·습격 단계에서만 이동과 전투 입력을 받는다.
function syncInputLock(): void {
  const onField = scenes.currentFieldMode() !== null
  const overlayOpen = scenes.openOverlays().length > 0
  input.setFieldLocked(!onField || overlayOpen)
}
bus.on('screen.changed', syncInputLock)
bus.on('field.entered', syncInputLock)
bus.on('field.exited', syncInputLock)

/**
 * 재배에 들어갈 때 야생동물 출현을 시작하고 나갈 때 전부 제거한다.
 *
 * 출현 프로필은 그 일차의 데이터에서 온다. 프로필 참조가 비어 있는 일차는
 * 야생동물이 없다 (DEC-CONTENT-007). 여기서 기본 프로필을 지어내지 않는다.
 *
 * 전역 투척 재사용 대기도 단계 진입마다 초기화한다 (DEC-CONTENT-005).
 */
bus.on('field.entered', ({ mode }) => {
  combat?.reset()
  if (mode !== 'farming') {
    wildlife?.endFarming()
    return
  }

  const day = run?.dayNumber ?? 1
  const profileId = spawnProfileIdByDay.get(day) ?? null
  const profile = profileId === null ? null : (spawnProfilesById.get(profileId) ?? null)

  if (profileId !== null && profile === undefined) {
    bus.emit('data.error', {
      summary: '출현 프로필을 찾지 못했다',
      detail: `${day}일차가 참조하는 ${profileId} 가 승인 데이터에 없다`,
    })
    return
  }
  wildlife?.beginFarming(profile, spawnEntries)
})

bus.on('field.exited', () => wildlife?.endFarming())
bus.on('overlay.opened', syncInputLock)
bus.on('overlay.closed', syncInputLock)
syncInputLock()

// 개발 빌드에서만 화면 전환을 콘솔에 찍는다.
// 제출 빌드에서는 개발용 표시를 모두 숨긴다 (DEC-UI-024, DEC-RESIDENT-047).
if (isDevBuild) {
  bus.on('screen.changed', ({ screen }) => console.info(`[화면] ${screen}`))
  bus.on('field.entered', ({ mode }) => console.info(`[필드] 진입 — ${mode}`))
  bus.on('field.exited', () => console.info('[필드] 이탈'))
  bus.on('overlay.opened', ({ overlay }) => console.info(`[오버레이] 열림 — ${overlay}`))
  bus.on('overlay.closed', ({ overlay }) => console.info(`[오버레이] 닫힘 — ${overlay}`))
  bus.on('data.error', ({ summary, detail }) =>
    console.error(`[데이터 오류] ${summary}: ${detail}`),
  )

  // 전투 결과 이벤트. UI 가 붙기 전까지 이걸로만 확인된다.
  //
  // 없는 동안 `quickslot.allEmpty` 가 나가는지 아무도 알 수 없었다 — 버스로 쏘고
  // 듣는 쪽이 없으면 "구현했다" 와 "구현 안 했다" 가 화면에서 똑같이 보인다.
  bus.on('combat.playerDamaged', ({ amount, remainingHealth }) =>
    console.info(`[전투] 피격 ${amount} → 체력 ${remainingHealth}`),
  )
  bus.on('combat.throwableSpent', ({ throwableId, remaining }) =>
    console.info(`[투척] ${throwableId} 소비 — 남은 ${remaining}`),
  )
  bus.on('quickslot.autoSwitched', ({ fromIndex, toIndex }) =>
    console.info(`[퀵슬롯] 소진 자동 전환 ${fromIndex + 1} → ${(toIndex ?? 0) + 1}`),
  )
  bus.on('quickslot.allEmpty', () =>
    console.warn('[퀵슬롯] 투척 무기 없음 — 전체 비활성. 낫은 계속 쓸 수 있다'),
  )
  bus.on('surrender.offered', ({ residentId, remainingHealth }) =>
    console.warn(`[조우] 투항 발동 — ${residentId} 체력 ${remainingHealth}`),
  )
  bus.on('run.failed', () => console.warn('[런] 체력 0 — 런 실패 (DEC-RUN-008)'))
  bus.on('encounter.finished', ({ residentId, finalOutcome }) =>
    console.warn(`[조우] 종료 — ${residentId} · ${finalOutcome}. 조우 결과 화면은 김민주`),
  )
  bus.on('reward.granted', ({ residentId, bundleId }) =>
    console.info(`[보상] ${residentId} · ${bundleId} 지급`),
  )

  // 흐름을 손으로 밟아 보기 위한 개발용 통로.
  // 승인 데이터가 없으면 일차로 진입하는 순간 데이터 오류가 뜨는 것이 정상이다.
  //
  // `__dev` 안의 둘은 **김민주의 8/4 UI 를 임시로 대신한다.** 제작 모달·편성 팝업·
  // 대화 모달이 오면 이 두 함수와 여기 노출을 지운다 (로드맵 11-2).
  Object.assign(window, {
    __scenes: scenes,
    __bus: bus,
    __loop: loop,
    __dev: {
      fillThrowables: (count = 5) => devFillThrowables(count),
      goToDay: (dayNumber: number) => devGoToDay(dayNumber),
      startRaid: (choiceIndex = 0) => devStartRaid(choiceIndex),
      surrender: (choiceIndex = 0) => devSurrender(choiceIndex),
    },
  })

  console.info(
    '[개발 전용] __dev.fillThrowables(5) 투척 무기 채우기 · ' +
      '__dev.goToDay(2) 일차 이동 · __dev.startRaid(0) 습격 시작 (0=공감 1=협상 2=위협) · ' +
      '__dev.surrender(0) 투항 선택 (0=영입 1=대가·퇴각 2=거부·전투 계속). ' +
      '승인 일정상 습격은 2일차부터다.',
  )

}

/**
 * **개발 전용.** 타이틀에서 1일차 재배 단계까지 흐름을 밀어 준다.
 *
 * `run_schedules` 가 승인돼 이제 정상 흐름으로 재배까지 갈 수 있다. 다만 타이틀·이름 입력·
 * 튜토리얼·일차 시작 화면이 아직 없어서(로드맵 8/5, 최수정) 손으로 `확인`을 누를 수단이 없다.
 *
 * 가짜 단계를 만들지 않고 **실제 흐름에 실제 입력을 넣는다.** 흐름이 규칙대로 막으면
 * 그대로 데이터 오류가 뜨는 것이 맞다. 네 화면이 생기면 이 함수를 지운다.
 */
function devSkipToFarming(): void {
  const confirms = ['title', 'name_input', 'tutorial', 'day_start']
  for (const from of confirms) {
    if (scenes.step().at !== from) {
      console.warn(`[개발 전용] ${from} 에서 멈췄다. 현재 단계: ${scenes.step().at}`)
      return
    }
    scenes.send({ type: 'confirm' })
  }
  console.warn('[개발 전용] 타이틀~일차 시작 화면을 건너뛰고 재배 단계로 들어왔다.')
}

/**
 * **개발 전용.** 무기 보관함과 퀵슬롯을 채운다.
 *
 * 무기를 얻으려면 제작 모달(`DEC-UI-006`), 슬롯에 넣으려면 편성 팝업(`DEC-UI-021`)이
 * 필요한데 둘 다 아직 없다(로드맵 8/4, 김민주). 그래서 좌클릭이 항상
 * `투척 무기 없음` 으로 떨어지고 투척·`direct`/`area`·전투 효과·소진 자동 전환을
 * 하나도 확인할 수 없다.
 *
 * **경제를 우회한다.** 제작 비용도 숙련도 해금도 거치지 않는다. 그래서 이건
 * 밸런스 확인에 쓸 수 없고 오직 "동작하는가" 만 본다.
 * 두 UI 가 오면 이 함수와 호출을 지운다 (로드맵 11-2).
 */
function devFillThrowables(count: number): void {
  if (run === null) {
    console.warn('[개발 전용] 런 상태가 없어 무기를 채울 수 없다')
    return
  }

  const ids = [...throwablesById.keys()].sort()
  if (ids.length === 0) {
    console.warn('[개발 전용] 승인된 투척 무기가 없다')
    return
  }

  // 퀵슬롯은 5칸 고정이다 (DEC-INPUT-006). 승인 무기를 앞에서부터 채운다.
  run.quickslots.slots = run.quickslots.slots.map((_, index) => ids[index] ?? null)
  run.quickslots.selectedIndex = 0
  for (const id of ids) run.resources.throwables[id] = count

  console.warn(
    `[개발 전용] 제작·편성 UI 를 우회해 투척 무기 ${ids.length}종을 ${count}개씩 넣었다. ` +
      '제작 비용과 숙련도 해금을 거치지 않았으므로 밸런스 확인에 쓸 수 없다.',
  )
}

/**
 * **개발 전용.** 일차를 옮긴다.
 *
 * 정상 흐름은 재배 → 정비 → (습격) → 결과 → 다음 일차인데, 정비 허브와 결과 화면이
 * 아직 없어서(로드맵 8/4) 하루를 넘길 수단이 없다. 습격은 2일차부터라 1일차에
 * 갇히면 습격을 한 번도 볼 수 없다.
 *
 * **런 상태의 일차만 바꾼다.** 자원·주민 상태·공포도는 건드리지 않으므로 이 통로로
 * 넘긴 날은 실제 플레이와 다르다. 정비·결과 화면이 오면 지운다.
 */
/**
 * **개발 전용.** 투항 대화의 선택지 3개를 대신한다 (`DEC-UI-007`, `DEC-RESIDENT-016`).
 *
 * `surrender-modal.ts` 가 로드맵 8/4 김민주 몫이라 투항이 발동하면 오버레이만 열리고
 * 거기서 멈춘다. 그런데 이 세 선택이 최종 결과 다섯 개 중 셋(`recruited`,
 * `retreated`, 거부 후 `killed`)과 **보상 지급 경로 전체**로 가는 유일한 문이라,
 * 통로가 없으면 `DEC-RESIDENT-042` 의 원자적 지급을 플레이로 확인할 방법이 없다.
 *
 * **판정을 우회하지 않는다.** 투항 선택에는 성격 판정이 없고 선택 기능이 곧 시스템
 * 결과다 (`DEC-CONTENT-009`). 우회하는 것은 대사 표시와 클릭뿐이다.
 * 모달이 오면 이 함수와 노출을 지운다 (로드맵 11-2).
 */
function devSurrender(choiceIndex: number): void {
  if (hostile === null || resolution === null) {
    console.warn('[개발 전용] 투항 중인 주민이 없다')
    return
  }
  if (scenes.inputOwner() !== 'surrender_dialogue') {
    console.warn('[개발 전용] 투항 대화가 열려 있지 않다')
    return
  }

  const residentId = hostile.entity.residentId
  const choices = ['recruit', 'retreat_reward', 'resume_combat'] as const
  const choice = choices[choiceIndex]
  if (choice === undefined) {
    console.warn(`[개발 전용] 투항 선택지 ${choiceIndex} 가 없다. 0=영입 1=대가·퇴각 2=거부`)
    return
  }

  // 무엇을 골랐는지는 최종 결과와 별개로 남는다 (DEC-RESIDENT-042)
  resolution.recordSurrenderChoice(residentId, choice)
  console.warn(`[개발 전용] 투항 대화 UI 를 우회해 선택을 확정한다 — ${choice}`)

  if (choice === 'resume_combat') {
    // 거부는 최종 결과가 아니다. 전투로 돌아가고 실제로 처치했을 때만
    // killed 를 확정한다 (DEC-RESIDENT-052).
    resolution.recordSurrenderResumed(residentId)
    scenes.closeOverlay('surrender_dialogue')
    console.info('[조우] 투항 거부 — 전투 재개. 처치하면 killed 로 확정된다')
    return
  }

  // 영입·대가 요구는 조우를 끝낸다. 보상과 상태 변경이 하나의 처리다.
  if (!finishEncounter(residentId, choice === 'recruit' ? 'recruited' : 'retreated')) return

  scenes.closeOverlay('surrender_dialogue')
  hostile = null
  hostileTarget = null
  residentCombat?.reset()
}

function devGoToDay(dayNumber: number): void {
  if (run === null) {
    console.warn('[개발 전용] 런 상태가 없다')
    return
  }
  run.dayNumber = dayNumber
  console.warn(
    `[개발 전용] 정비·결과 화면을 건너뛰고 ${dayNumber}일차로 옮겼다. ` +
      '자원과 주민 상태는 그대로라 실제 플레이와 다르다.',
  )
}

/**
 * **개발 전용.** 습격 모드로 들어가 적대 주민을 세운다.
 *
 * 전투 전 대화 UI(`DEC-UI-007/008`, 로드맵 8/4 김민주)가 없어서 선택지를 마우스로
 * 고를 수단이 없다. **판정 자체는 우회하지 않는다** — 실제 `encounter.judge()` 를
 * 부르고 그 결과가 지정한 전투 보정으로 주민을 세운다 (`DEC-RESIDENT-049`).
 * 사람이 화면에서 고르던 것을 인자로 받을 뿐이다.
 *
 * 대화 모달이 오면 이 함수를 지우고 모달의 선택 이벤트에 같은 경로를 연결한다.
 */
function devStartRaid(choiceIndex = 0): void {
  if (encounter === null || raidData === null || run === null) {
    console.warn('[개발 전용] 승인 데이터가 없어 습격을 시작할 수 없다')
    return
  }

  if (run.health <= 0) {
    console.warn('[개발 전용] 체력이 0이라 습격을 시작할 수 없다. 런이 이미 실패했다 (DEC-RUN-008)')
    return
  }

  const dayNumber = run.dayNumber
  const residentId = raidData.hostileResidentByDay.get(dayNumber) ?? null
  if (residentId === null || residentId === '') {
    // 어느 날에 습격이 있는지 같이 알려준다. 이 말이 없으면 "안 되는 건가" 로 읽힌다.
    const raidDays = [...raidData.hostileResidentByDay]
      .filter(([, id]) => id !== null && id !== '')
      .map(([day, id]) => `${day}일차(${id})`)

    console.warn(
      `[개발 전용] ${dayNumber}일차는 습격이 없는 날이다. 습격일: ${raidDays.join(', ')}. ` +
        '__dev.goToDay(n) 으로 일차를 옮긴다.',
    )
    return
  }

  // 해결된 주민과는 대화도 다시 열리지 않는다 (DEC-RESIDENT-043).
  // 전투 진입 전에 막아야 한다 — spawnHostile 에서 막으면 판정이 이미 돌아
  // 중요 행동과 공포도가 한 번 더 기록된다.
  if (resolution !== null && !resolution.canAppearAsHostile(residentId)) {
    console.warn(`[개발 전용] ${residentId} 는 이미 해결된 주민이라 다시 조우하지 않는다`)
    return
  }

  const scenario = raidData.scenarioByResident.get(residentId)
  if (scenario === undefined) {
    console.warn(`[개발 전용] ${residentId} 의 사연 시나리오가 없다`)
    return
  }

  const choices = encounter.availableChoices(scenario.id, run.resources.crops)
  const picked = choices[choiceIndex]
  if (picked === undefined) {
    console.warn(`[개발 전용] 선택지 ${choiceIndex} 가 없다. 0~${choices.length - 1}`)
    return
  }
  if (!picked.usable) {
    console.warn(
      `[개발 전용] ${picked.choiceFunction} 은 지금 쓸 수 없다 ` +
        `(수확물 ${picked.heldTotal} / 필요 ${picked.offerQuantity})`,
    )
    return
  }

  console.warn(`[개발 전용] 대화 UI 를 우회해 선택지를 확정한다 — ${picked.choiceFunction}`)
  console.info('[조우] 선택 가능:', choices.map((c) => `${c.choiceFunction}${c.usable ? '' : '(불가)'}`).join(' / '))

  const judgement = encounter.judge(residentId, picked.choiceId, run.resources.crops)
  console.info(`[조우] 판정 → ${judgement.systemResultId}`)
  console.info(`[조우] 반응 대사: ${judgement.reactionText}`)

  // 위협·대립 선택은 조우를 해결하지 않지만 중요 행동이고 공포도를 올린다
  // (DEC-RESIDENT-046, DEC-RESIDENT-052).
  if (judgement.choiceFunction === 'threat') {
    const { fearDelta, fearPending } = resolution!.recordThreat(residentId)
    console.info(`[조우] 위협 선택 — 공포도 +${fearDelta} (누적 ${run.record.fear})`)
    if (fearPending) warnFearPending()
  }

  if (judgement.resolved) {
    // 조우 해결 — 전투에 들어가지 않는다 (DEC-RESIDENT-049)
    if (picked.offerQuantity !== null) {
      const settled = encounter.settleNegotiation(
        run.resources.crops,
        `encounter.day${dayNumber}`,
        picked.choiceId,
        picked.offerQuantity,
        run.seed,
      )
      console.info('[조우] 자원 협상', settled.ok ? settled.consumed : settled.reason)
      if (!settled.ok) {
        // 수확물을 못 냈으면 조우가 해결되지 않는다. 여기서 결과를 확정하면
        // 대가를 치르지 않고 거래 관계가 된다.
        console.warn('[조우] 협상이 성립하지 않아 최종 결과를 확정하지 않는다')
        return
      }
    }

    // 어느 선택으로 해결됐는지가 최종 결과를 가른다 (DEC-RESIDENT-052)
    finishEncounter(
      residentId,
      picked.choiceFunction === 'empathy' ? 'empathy_resolve' : 'resource_negotiation_resolve',
    )
    console.warn('[개발 전용] 조우가 해결돼 전투에 들어가지 않는다. 결과 화면은 8/4 김민주.')
    return
  }

  // 자원 협상이 성격 프로필에 막힌 것도 중요 행동이다 (DEC-CONTENT-011)
  if (judgement.choiceFunction === 'resource_negotiation') {
    resolution!.recordNegotiationRejected(residentId)
    console.info('[조우] 자원 협상 거절 — 중요 행동으로 기록')
  }

  // 전투 결과 — 시스템 결과 ID 에서 전투 보정 키를 얻는다 (DEC-CONTENT-009)
  const combatState = judgement.systemResultId.replace('system_result.precombat.combat_', '')

  scenes.enterFieldPreview('raid')
  hostile = spawnHostile(dayNumber, combatState)
  if (hostile !== null) {
    console.info(
      `[습격] ${residentId} — ${combatState} · 체력 ${hostile.maxHealth} · ` +
        `투항 기준 ${hostile.surrenderThreshold}`,
    )
  }
}

// 데이터 적재는 `data.error` 구독이 모두 끝난 뒤에 시작한다.
// 먼저 부르면 오류 이벤트가 아무 데도 도달하지 않고 화면만 비어 보인다.
void bootData().then(() => {
  // 승인 데이터가 없으면 흐름을 밀지 않는다. 데이터 오류 화면이 그대로 남아야 한다.
  if (isDevBuild && runConfig.loaded) devSkipToFarming()
  loop.start()
})
