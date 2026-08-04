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
import type { FearIncrements, Resolution } from './systems/resolution.ts'
import { createEndingJudge } from './systems/ending.ts'
import type { EndingJudge } from './systems/ending.ts'
import { buildEndingInput, requestEndingRecord } from './llm/ending.ts'
import type {
  Crop,
  FearBand,
  FearIncrement,
  FinalOutcome,
  RewardBundle,
  ThrowableWeapon,
  WildlifeSpawnEntry,
  WildlifeSpawnProfile,
} from './data/types.ts'
import { createRunState } from './state/run-state.ts'
import type { RunState } from './state/types.ts'
import { createHud } from './ui/hud.ts'
import type { Hud } from './ui/hud.ts'
import { createMaintenanceHub, createPopupShell } from './ui/maintenance-hub.ts'
import type { InventoryRow, MaintenanceHub } from './ui/maintenance-hub.ts'
import { createNightResult, selectNightResultText } from './ui/night-result.ts'
import type { NightResultScreen, NightResultSelection } from './ui/night-result.ts'
import { createEncounterResult } from './ui/encounter-result.ts'
import type {
  EncounterResourceLine,
  EncounterResultScreen,
  EncounterResultView,
} from './ui/encounter-result.ts'
import { createEconomy } from './systems/economy.ts'
import type { Economy } from './systems/economy.ts'
import type { ItemStore } from './state/types.ts'

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
let economy: Economy | null = null
/** 보관함 표시 이름을 찾기 위한 통합 사전. 분류가 달라도 조회는 한 곳에서 한다 */
let displayNames = new Map<string, string>()
/** 지금 열려 있는 정비 팝업. 한 번에 하나만 연다 (DEC-UI-020) */
let openPopup: string | null = null

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
  /** 일차 → raid_type. 마지막 습격 뒤에 엔딩 판정으로 간다 (DEC-RUN-014) */
  raidTypeByDay: Map<number, string>
} | null = null
/** 주민 표시 이름. 조우 결과 화면이 ID 대신 이걸 쓴다 (DEC-UI-011) */
let residentNames = new Map<string, string>()
/** 보상 묶음. 조우 결과가 "실제 지급된 자원의 종류와 수량"을 여기서 읽는다 (DEC-UI-011) */
let rewardBundlesById = new Map<string, RewardBundle>()
/**
 * 사연 정보 ID → `ending_fact_text` (DEC-UI-011).
 *
 * `source_fact_text` 는 숨겨진 설정 원본이라 런타임 JSON 에 아예 없다
 * (DEC-CONTENT-017). 그래서 화면에 새어 나갈 경로가 구조적으로 없다.
 */
let storyFactById = new Map<string, string>()
/** 공포도 구간. 개발 빌드의 조우 결과 표시에만 쓴다 (DEC-UI-013) */
let fearBands: readonly FearBand[] = []

/**
 * 승인된 밤 결과 문구 (DEC-RUN-015).
 *
 * 부팅 때 한 번 고른다. 여러 행 중 무엇을 고를지가 `DEC-CONTENT-018` 보류라
 * 정확히 한 행일 때만 성공한다 (ui/night-result.ts).
 */
let nightResult: NightResultSelection = {
  ok: false,
  reason: '승인 데이터를 아직 읽지 않았다',
}

/**
 * 이번 조우에서 결과 화면에 전달할 것 (DEC-UI-011).
 *
 * 조우가 끝나는 순간에는 이미 알 수 없는 것들이라 **일어나는 시점에 모아 둔다** —
 * 협상으로 실제 빠져나간 작물은 `settleNegotiation()` 만 알고, 새로 확인한 사연은
 * 판정 순간에만 "새로"인지 알 수 있다. 나중에 런 상태에서 역산하려 하면
 * "이번 조우에서 새로 확인한 것"과 "예전에 확인한 것"을 구분할 수 없다.
 */
interface PendingEncounter {
  /** 자원 협상으로 실제 빠져나간 작물. 실행 후에만 알 수 있다 (DEC-RESIDENT-050) */
  consumedCrops: Record<string, number>
  /** 협상이 성격 프로필에 막혀 아무것도 소비되지 않았다 */
  negotiationRejected: boolean
  /** 이번 조우에서 **새로** 확인한 사연 정보 */
  revealedFactIds: string[]
}

let pendingEncounter: PendingEncounter | null = null

/** 조우 결과 화면이 그릴 내용. 조우가 끝나는 순간 확정한다 */
let encounterResultView: EncounterResultView | null = null

/** 엔딩 판정 (DEC-CONTENT-011) */
let endingJudge: EndingJudge | null = null
/** 엔딩 기록문 입력을 만드는 데 필요한 승인 데이터 (DEC-CONTENT-011) */
let endingData: {
  manifest: import('./data/types.ts').RuntimeManifest
  residents: readonly import('./data/types.ts').Resident[]
  storyInfos: readonly import('./data/types.ts').StoryInfo[]
} | null = null

const player = { x: 0, y: 0 }

/**
 * 승인 `fear_increments.csv` 를 행동별 증가량으로 바꾼다 (DEC-RESIDENT-048).
 *
 * **세 원인이 다 있을 때만 값을 돌려준다.** 일부만 있으면 없는 원인이 0으로
 * 취급되어 "위협은 공포도를 안 올린다" 같은 규칙이 조용히 생긴다. 그럴 바에는
 * 통째로 미승인으로 보고 공포도를 멈추는 편이 낫다 — 화면에 경고가 남는다.
 */
function readFearIncrements(rows: readonly FearIncrement[] | undefined): FearIncrements | null {
  const byCause = new Map((rows ?? []).map((r) => [r.cause, r.fear_amount]))

  const threat = byCause.get('threat_selected')
  const retreat = byCause.get('surrender_retreat_reward')
  const kill = byCause.get('resident_killed')
  if (threat === undefined || retreat === undefined || kill === undefined) return null

  return {
    threat_selected: threat,
    surrender_retreat_reward: retreat,
    resident_killed: kill,
  }
}

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
      raidTypeByDay: new Map((schedule.days ?? []).map((d) => [d.day_number, d.raid_type])),
    }

    endingJudge = createEndingJudge({
      fearBands: data.fear_bands ?? [],
      endings: data.endings ?? [],
      crops,
      cropAttributes: data.crop_attributes ?? [],
    })

    // ── 결과 화면이 읽는 승인 데이터 ────────────────
    residentNames = new Map((data.residents ?? []).map((r) => [r.id, r.display_name]))
    rewardBundlesById = new Map((data.reward_bundles ?? []).map((b) => [b.id, b]))
    storyFactById = new Map(
      (data.story_infos ?? []).map((info) => [info.id, info.ending_fact_text]),
    )
    fearBands = data.fear_bands ?? []

    // 밤 결과 문구는 승인 행이 정확히 하나일 때만 쓴다 (DEC-CONTENT-018 보류).
    // 실패해도 부팅을 막지 않는다 — 문구 하나가 없다고 런 전체가 안 돌 이유는 없고,
    // 실제로 그 화면에 닿는 순간 데이터 오류로 올린다.
    nightResult = selectNightResultText(data.night_result_texts)
    if (!nightResult.ok) {
      console.warn(`[데이터] 밤 결과 문구를 고르지 못했다 — ${nightResult.reason}`)
    }

    endingData = {
      manifest: data.manifest,
      residents: data.residents ?? [],
      // 사연 정보는 독립 콘텐츠다. 확인한 것만 골라 쓰는 것은 입력을 만드는
      // 쪽이 한다 (DEC-CONTENT-017 — 확인하지 않은 정보는 LLM 에 넘기지 않는다).
      storyInfos: data.story_infos ?? [],
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
    resolution = createResolution(run, {
      rewardBundles: data.reward_bundles ?? [],
      residents: data.residents ?? [],
      combatProfiles: data.resident_combat_profiles ?? [],
      fearIncrements: readFearIncrements(data.fear_increments),
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
    raidTypeOfDay = (day) => raidByDay.get(day) ?? 'none'

    // 보관함 표시 이름. 분류가 넷이라 조회를 한 곳으로 모은다.
    displayNames = new Map(
      [
        ...crops,
        ...(data.crafting_materials ?? []),
        ...(data.throwable_weapons ?? []),
        ...(data.recovery_items ?? []),
      ].map((entry) => [entry.id, entry.display_name]),
    )

    economy = createEconomy(
      { resources: run.resources, cropMastery: run.record.cropMastery, unlockedRecipeIds: run.record.unlockedRecipeIds },
      {
        crops,
        materials: data.crafting_materials ?? [],
        recipes: data.recipes ?? [],
      },
    )

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
      onTargetKilled(event.targetId ?? '')
      return
    }
  }

  // 습격 중 체력 0도 즉시 런 실패다 (DEC-RUN-008)
  failRunIfDead()
}

/**
 * 공포도 구간 이름. **개발 빌드의 조우 결과 표시에만 쓴다** (DEC-UI-013).
 *
 * 제출 빌드는 구간 이름도 표시하지 않으므로 이 값이 화면까지 가지 않는다.
 */
function fearBandNameOf(fear: number): string | null {
  const band = fearBands.find(
    (b) => fear >= b.min_fear && (b.max_fear === null || fear <= b.max_fear),
  )
  return band?.display_name ?? null
}

/**
 * 자원 한 항목을 결과 화면의 한 줄로.
 *
 * 소지금은 콘텐츠 테이블이 아니라 통화라 보관함 표시 사전에 없다. 여기서만
 * 이름을 붙이고 정비 허브와 같은 말(`소지금`)을 쓴다 — 같은 것을 두 화면이
 * 다르게 부르면 플레이어가 다른 자원으로 읽는다.
 */
function resourceLine(kind: string, id: string, quantity: number): EncounterResourceLine {
  return {
    name: kind === 'money' ? '소지금' : (displayNames.get(id) ?? id),
    quantity,
  }
}

/**
 * 조우 결과 화면이 그릴 내용을 확정한다 (DEC-UI-011, DEC-UI-013).
 *
 * **결과가 확정되는 그 시점에 만든다.** 화면이 열릴 때 런 상태에서 역산하면
 * "이번 조우에서 실제로 지급·소비된 것"이 아니라 "지금 보관함에 있는 것"이 되고,
 * 그 둘은 다음 처리가 하나만 끼어도 갈린다.
 */
function buildEncounterResultView(
  residentId: string,
  outcome: FinalOutcome,
  rewardBundleId: string | null,
  fearDelta: number,
): EncounterResultView | null {
  const resident = run?.residents[residentId]
  if (resident === undefined) return null

  const bundle = rewardBundleId === null ? undefined : rewardBundlesById.get(rewardBundleId)
  const collected = pendingEncounter
  const fear = run?.record.fear ?? 0

  return {
    residentName: residentNames.get(residentId) ?? residentId,
    outcome,
    lifeState: resident.lifeState,
    allegiance: resident.allegiance,
    relationship: resident.relationship,

    // 보상 묶음은 전부 지급되거나 전혀 지급되지 않는다 (DEC-RESIDENT-042).
    // 그래서 승인 묶음의 항목이 곧 실제 지급 내역이다. 보상이 없는 결과면
    // 빈 배열이고 화면이 영역 자체를 그리지 않는다 (DEC-UI-011).
    rewards: (bundle?.entries ?? []).map((entry) =>
      resourceLine(entry.resource_kind, entry.resource_id, entry.quantity),
    ),
    consumedCrops: Object.entries(collected?.consumedCrops ?? {}).map(([cropId, quantity]) =>
      resourceLine('crop', cropId, quantity),
    ),
    negotiationRejected: collected?.negotiationRejected ?? false,

    // 이번 조우에서 **새로** 확인한 것만 모여 있다. 걸러 넣는 것은 판정 시점이다
    revealedFacts: (collected?.revealedFactIds ?? [])
      .map((id) => storyFactById.get(id))
      .filter((text): text is string => typeof text === 'string' && text.length > 0),
    supportUsed: resident.supportUsed,

    // 제출 빌드에서는 점수·구간·변화량을 어떤 형태로도 두지 않는다 (DEC-UI-013)
    fear: isDevBuild
      ? { total: fear, delta: fearDelta, bandName: fearBandNameOf(fear) }
      : null,
  }
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

  // 결과 화면 내용을 여기서 확정한다. 화면 전환보다 앞이라야 한다 —
  // 아래 `scenes.send()` 가 곧바로 조우 결과 화면을 열고 그때 이 값을 읽는다.
  encounterResultView = buildEncounterResultView(residentId, outcome, rewardBundleId, fearDelta)

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

  // 마지막 습격의 조우 결과와 모든 상태 변경을 끝낸 뒤에 엔딩을 판정한다
  // (DEC-CONTENT-011). 여기보다 앞이면 방금 바뀐 관계·공포도가 반영되지 않는다.
  if (raidData?.raidTypeByDay.get(run?.dayNumber ?? 0) === 'final_raid') decideEnding()

  // **버스 이벤트만 쏘면 화면이 안 넘어간다.** `encounter.finished` 는 UI 에게
  // 알리는 결과 이벤트이고, 흐름을 옮기는 것은 `encounter_finished` 입력이다.
  // 둘을 헷갈려서 체력 0에도 계속 움직였던 것과 같은 구조다 (failRunIfDead).
  //
  // 조우 결과 화면에서 `확인` 을 눌러야 다음 일차 또는 엔딩으로 간다 (DEC-RUN-015).
  if (scenes.step().at === 'raid') {
    scenes.send({ type: 'encounter_finished' })
  } else {
    // 개발 통로(`enterFieldPreview`)로 들어오면 흐름은 습격 단계가 아니다.
    // 그대로 보내면 흐름 오류로 데이터 오류 화면이 떠서 테스트가 끊긴다.
    // **정상 흐름에서는 여기 오지 않는다.** 조용히 넘기지 않고 남긴다.
    console.warn(
      `[개발 전용] 흐름이 습격 단계가 아니라(${scenes.step().at}) 조우 결과로 넘기지 않는다. ` +
        '개발 통로로 필드에 들어왔기 때문이다 (로드맵 11-2).',
    )
  }
  return true
}

/**
 * 엔딩 판정 (DEC-CONTENT-011).
 *
 * 시스템이 엔딩을 먼저 확정하고 그 값을 런 결과에 저장한 **뒤에만** LLM 기록문을
 * 요청한다. 기록문 생성은 아직 붙지 않았고, 붙어도 실패가 엔딩 진행을 막지 않는다.
 */
function decideEnding(): void {
  if (endingJudge === null || run === null) return

  const judgement = endingJudge.judge({ record: run.record, residents: run.residents })

  if (judgement.ending === null) {
    // 전역 폴백조차 없다. 승인 데이터가 잘못된 것이라 화면에 그대로 올린다.
    bus.emit('data.error', {
      summary: '엔딩을 확정할 수 없다',
      detail: `공포도 ${judgement.fearScore} · ${judgement.fallbackReason}`,
    })
    return
  }

  // **확정한 엔딩을 런 결과에 저장한 뒤에만** 기록문 생성을 요청한다
  // (DEC-CONTENT-011). 먼저 승인된 폴백 문장으로 채워 두므로, LLM 이 실패하거나
  // 응답이 늦어도 화면에 보여 줄 문장이 항상 있다.
  run.ending = {
    endingId: judgement.ending.id,
    endingContentVersion: judgement.ending.content_version,
    fear: judgement.fearScore,
    fearBandId: judgement.fearBand?.id ?? null,
    dominantCropId: judgement.dominantCrop?.cropId ?? null,
    recordText: judgement.ending.fallback_record_text,
    usedFallback: true,
  }

  bus.emit('ending.decided', {
    endingId: judgement.ending.id,
    endingTitle: judgement.ending.ending_title,
  })

  // 폴백은 판정 실패의 결과지 기본값이 아니다. 왜 그렇게 됐는지를 남긴다.
  if (judgement.fallbackReason !== null) {
    console.warn(
      `[엔딩] 전역 폴백으로 떨어졌다 — ${judgement.fallbackReason}. ` +
        `공포도 ${judgement.fearScore} · 구간 ${judgement.fearBand?.id ?? '없음'}`,
    )
  }

  console.info(
    `[엔딩] ${judgement.ending.ending_title} (${judgement.ending.id}) · ` +
      `공포도 ${judgement.fearScore} · 구간 ${judgement.fearBand?.display_name ?? '없음'} · ` +
      `대표 작물 ${judgement.dominantCrop?.displayName ?? '없음'}`,
  )

  // 기록문은 비동기로 채운다. **기다리지 않는다** — LLM 요청이 엔딩 진행을 막지
  // 않아야 한다 (DEC-CONTENT-011). 응답이 오면 폴백 문장을 대체한다.
  void fillEndingRecord(judgement.ending, judgement)
}

/**
 * 엔딩 기록문을 LLM 으로 채운다 (DEC-CONTENT-011).
 *
 * 실패하면 아무것도 하지 않는다 — `run.ending.recordText` 에 이미 승인된
 * `fallback_record_text` 가 들어 있고, 그것이 규칙상 정상 경로다.
 */
async function fillEndingRecord(
  ending: import('./data/types.ts').Ending,
  judgement: import('./systems/ending.ts').EndingJudgement,
): Promise<void> {
  if (run === null || endingData === null) return

  const input = buildEndingInput({
    manifest: endingData.manifest,
    playerName: run.playerName,
    finalDay: run.dayNumber,
    ending,
    fearBand: judgement.fearBand,
    dominantCrop: judgement.dominantCrop,
    record: run.record,
    residents: run.residents,
    residentData: endingData.residents,
    storyInfos: endingData.storyInfos,
  })

  const result = await requestEndingRecord(input, ending.fallback_record_text)
  if (run === null || run.ending === null) return // 그 사이 런이 초기화됐다

  run.ending.recordText = result.recordText
  run.ending.usedFallback = result.usedFallback

  bus.emit('ending.recordReady', {
    recordText: result.recordText,
    usedFallback: result.usedFallback,
  })

  console.info(
    result.usedFallback
      ? '[엔딩] 승인된 폴백 기록문을 쓴다 (LLM 미사용 또는 실패 — 정상 경로)'
      : `[엔딩] 기록문 생성됨 · 모델 ${result.generatorModelId} · 재시도 ${result.retryCount}회`,
  )
}

/**
 * 판정으로 공개된 사연 정보를 기록한다 (DEC-UI-011, DEC-CONTENT-017).
 *
 * **"이번 조우에서 새로 확인했는가"는 이 순간에만 알 수 있다.** 런 상태에 넣고 나면
 * 예전에 확인한 것과 구분이 안 되고, 그러면 조우 결과가 이미 본 사연을 다시 띄운다.
 * 그래서 넣기 전에 한 번 거르고 이번 조우 목록에도 같이 남긴다.
 *
 * 런 상태의 `revealedStoryInfoIds` 는 엔딩 기록문 입력도 읽는다 — 확인한 사연만
 * LLM 에 넘긴다 (llm/ending.ts).
 */
function recordRevealedStoryInfo(residentId: string, storyInfoId: string | null): void {
  if (storyInfoId === null || run === null) return

  const resident = run.residents[residentId]
  if (resident === undefined) return
  if (resident.revealedStoryInfoIds.includes(storyInfoId)) return

  resident.revealedStoryInfoIds.push(storyInfoId)
  pendingEncounter?.revealedFactIds.push(storyInfoId)
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
    // 씨앗 단계에서는 종류를 공개하지 않으므로 cropId 를 싣지 않는다 (DEC-FARM-001)
    bus.emit('farm.planted', { plotId: event.plot.plotId })
  } else {
    const name = cropsById.get(event.cropId)?.display_name ?? event.cropId
    bus.emit('farm.harvested', {
      plotId: event.plot.plotId,
      cropId: event.cropId,
      quantity: event.amount,
    })

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

/**
 * 대상이 죽었을 때. **처치 처리는 이 함수 하나다.**
 *
 * 처치가 두 경로로 온다 — 투사체와 지속 피해는 `combat.update()` 안에서,
 * 낫 직접 명중은 `swingSickle()` 이 그 자리에서 돌려준다. 두 곳에서 각각 처리했더니
 * **낫으로 주민을 죽였을 때만 조우가 안 끝났다.** 야생동물만 지우고 주민은 아무 일도
 * 일어나지 않아서, 화면에서는 "죽었는데 아무것도 안 뜬다" 로만 보인다.
 * 8/3 에 대상 선택이 두 군데라서 낫이 아무도 못 때렸던 것과 같은 모양이다.
 */
function onTargetKilled(targetId: string): void {
  if (scenes.currentFieldMode() === 'raid') {
    if (hostile === null || targetId !== hostile.entity.instanceId) return

    // 보상 지급과 상태 변경이 실패하면 주민을 지우지 않는다 (DEC-RESIDENT-042)
    if (!finishEncounter(hostile.entity.residentId, 'killed')) return

    hostile = null
    hostileTarget = null
    // 조우가 해결되면 남은 투사체와 공격을 제거한다 (DEC-UI-019)
    residentCombat?.reset()
    return
  }

  wildlife?.remove(targetId)
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
    if (hit.outcome === 'killed') onTargetKilled(hit.targetId)
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

const hub: MaintenanceHub = createMaintenanceHub(uiRoot, {
  openPopup: (popup) => {
    // 한 번에 하나만 연다. 이미 같은 팝업이 열려 있으면 아무 일도 하지 않는다 (DEC-UI-020)
    if (openPopup === popup) return
    openPopup = popup
    hub.setPopup(buildPopup(popup))
  },
  finish: () => {
    // 습격 여부에 따라 버튼이 하나만 나온다. 흐름이 둘을 대조해 어긋나면 오류로 잡는다.
    const raidType = raidTypeOfDay(run?.dayNumber ?? 1)
    scenes.send({
      type: 'maintenance_finished',
      intent: raidType !== 'none' ? 'scout_field' : 'sleep_until_morning',
    })
  },
})

// ── 결과 화면 2종 (DEC-RUN-015, DEC-UI-023) ──────────────────
//
// 하루에 하나만 뜬다. 둘 다 없으면 하루가 끝나지 않고, 둘 다 뜨면 결과 화면이
// 두 번 나온다 — 폐기된 DEC-RUN-012 에서 문제가 됐던 지점이다.
// 어느 쪽이 뜰지는 흐름(scenes/flow.ts)이 습격 여부로 이미 갈라 놨다.
//
// 진행 입력은 각 화면에 하나뿐이고 둘 다 `confirm` 을 보낸다 (DEC-UI-023).
// 조우 결과는 마지막 습격이면 엔딩으로, 아니면 다음 일차로 간다 (DEC-RUN-015).

const nightResultScreen: NightResultScreen = createNightResult(uiRoot, {
  onContinue: () => scenes.send({ type: 'confirm' }),
})

const encounterResultScreen: EncounterResultScreen = createEncounterResult(uiRoot, {
  onContinue: () => scenes.send({ type: 'confirm' }),
})

/**
 * 지금 떠 있어야 할 독립 화면을 맞춘다.
 *
 * **각 화면이 "내가 열려 있나"를 스스로 보지 않는다.** 화면 매니저 하나가 답을
 * 갖고 있고 여기서 한 번에 반영한다 — 정비 허브가 `openOverlays().includes()` 로
 * 판단했다가 일시정지와 겹쳤을 때 입력을 계속 받던 것과 같은 종류의 실수를 막는다.
 *
 * 프레임마다 부르지 않고 화면이 바뀔 때만 부른다. 결과 화면의 내용은 조우가
 * 끝나는 순간 확정된 스냅샷이라 매 프레임 다시 그릴 이유가 없다.
 */
function syncScreens(): void {
  const screen = scenes.currentScreen()

  if (screen === 'night_result') {
    if (nightResult.ok) {
      nightResultScreen.render({ text: nightResult.text })
    } else {
      // 승인 문구가 없거나 여럿이다. 임시 문장을 지어내지 않고 비운 채 올린다 —
      // 진행 버튼은 남으므로 하루가 막히지는 않는다 (DEC-UI-024).
      nightResultScreen.render({ text: '' })
      bus.emit('data.error', {
        summary: '밤 결과 문구를 표시할 수 없다',
        detail: nightResult.reason,
      })
    }
    nightResultScreen.show()
  } else {
    nightResultScreen.hide()
  }

  if (screen === 'encounter_result') {
    if (encounterResultView !== null) {
      encounterResultScreen.render(encounterResultView)
      encounterResultScreen.show()
    } else {
      // 조우가 끝나면 반드시 채워진다. 비어 있다면 흐름과 조우 확정이 어긋난
      // 것이므로 빈 화면을 올려 넘기지 않고 드러낸다.
      encounterResultScreen.hide()
      bus.emit('data.error', {
        summary: '조우 결과를 표시할 수 없다',
        detail: '조우가 확정되지 않은 채 조우 결과 화면으로 넘어왔다',
      })
    }
  } else {
    encounterResultScreen.hide()
  }
}

/** 승인된 일정에서 해당 일차의 습격 종류를 읽는다 */
let raidTypeOfDay: (day: number) => string = () => 'none'

const POPUP_TITLES: Record<string, string> = {
  sell: '판매',
  buy: '구매',
  craft: '제작',
  quickslots: '투척 퀵슬롯 편성',
}

/**
 * 팝업 본문.
 *
 * 지금은 껍데기와 닫기 버튼만 만든다. 실제 목록·수량·미리보기는
 * shop-modal.ts / craft-modal.ts 로 분리해 붙인다 (DEC-UI-005, DEC-UI-006).
 * 판정은 이미 economy.ts 에 있으므로 여기서 자원을 직접 만지지 않는다.
 */
function buildPopup(popup: string): HTMLElement {
  const { root, body } = createPopupShell(POPUP_TITLES[popup] ?? popup, () => {
    openPopup = null
    hub.setPopup(null)
  })

  const note = document.createElement('div')
  note.className = 'hub__preview'
  if (popup === 'craft' && economy !== null) {
    // 해금 여부와 최대 제작 횟수는 economy 가 이미 판단한다.
    // 목록 UI 가 붙기 전에도 그 판정이 살아 있는지 여기서 보인다.
    const lines = economy
      .baseRecipeIds()
      .map((id) => `${id} — 최대 ${economy!.maxCraftTimes(id)}회`)
    note.textContent = lines.length > 0 ? lines.join('\n') : '해금된 레시피가 없다'
    note.style.whiteSpace = 'pre-line'
  } else {
    note.textContent = '이 팝업의 목록 UI는 아직 붙지 않았다.'
  }
  body.appendChild(note)

  return root
}

/** 보관함 한 분류를 표시용 줄로 바꾼다. 수량 0인 키는 애초에 없다 */
function rowsOf(store: ItemStore): InventoryRow[] {
  return Object.entries(store)
    .map(([id, count]) => ({ id, name: displayNames.get(id) ?? id, count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
}

function hubView() {
  const raidType = raidTypeOfDay(run?.dayNumber ?? 1)
  return {
    dayNumber: run?.dayNumber ?? 1,
    money: run?.resources.money ?? 0,
    inventory: {
      crops: rowsOf(run?.resources.crops ?? {}),
      materials: rowsOf(run?.resources.materials ?? {}),
      throwables: rowsOf(run?.resources.throwables ?? {}),
      recoveries: rowsOf(run?.resources.recoveries ?? {}),
    },
    // raid_notices.csv 가 승인되면 여기에 hud_label 이 들어간다 (DEC-RUN-011)
    raidNoticeLabel: null,
    // 문구는 DEC-RUN-006 이 정한 두 가지다
    finishLabel: raidType !== 'none' ? '밭을 정찰하러 간다' : '아침까지 잔다',
  }
}

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

      // 수확 가능으로 바뀐 순간을 한 번만 강조한다 (DEC-UI-004).
      // 강조는 여기서 직접 그리지만 효과음은 버스로 나간다 — 오디오가 붙을 때
      // 재배 시스템을 다시 건드리지 않게 계약을 지금부터 살려 둔다.
      for (const plotId of farming?.justBecameReady ?? []) {
        readyFlashes.set(plotId, READY_FLASH_SECONDS)
        bus.emit('farm.plotReady', { plotId })
      }

      // 제한시간이 끝나면 재배 단계를 자동 종료한다 (DEC-RUN-004).
      // 조기 종료 조건을 만들지 않는다 — DEC-RUN-005 는 보류다.
      if (farmingTimer?.tick(dt)) {
        bus.emit('farm.timeExpired', {})
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

      // 정비 허브는 오버레이가 열려 있는 동안만 보인다.
      // 입력 소유는 scenes 가 판단한다 — 각자 "내가 열려 있나"를 보면
      // 일시정지가 겹쳤을 때 둘 다 입력을 받는다 (DEC-UI-026).
      if (scenes.inputOwner() === 'maintenance_hub') {
        hub.render(hubView())
        hub.show()
      } else {
        hub.hide()
        openPopup = null
      }
    },
  },
  {
    // 포커스를 잃으면 일시정지 화면을 연다 (DEC-INPUT-009, DEC-UI-022).
    // 자동 재개는 하지 않는다. 회복 퀵메뉴가 열려 있으면 그것도 닫는다 (DEC-UI-026).
    onFocusLost: () => scenes.handleFocusLost(),
  },
)

const scenes: SceneManager = createSceneManager(bus, loop)

/**
 * 런 상태의 일차를 흐름에 맞춘다.
 *
 * **일차의 단일 원본은 흐름이다** (`scenes/flow.ts`). 런 상태는 그 값을 따라간다.
 * 지금까지 아무도 이 둘을 잇지 않아서 `run.dayNumber` 가 1에 멈춰 있었고, 그래서
 * 2일차 정비를 끝내면 흐름은 습격(`raid`)으로 가려는데 정비 허브는 1일차 기준으로
 * `아침까지 잔다` 를 보내 **흐름이 데이터 오류로 떨어졌다.** 화면에는 "정비를 끝냈는데
 * 오류가 났다" 로만 보이고 원인이 일차 불일치라는 것은 드러나지 않는다.
 *
 * HUD 의 일차 표시, 정비 종료 버튼 문구, 그날의 야생동물 출현 프로필, 적대 주민
 * 배치, 엔딩 기록문의 `finalDay` 가 전부 이 값을 읽는다.
 *
 * **야생동물 출현 프로필을 고르는 `field.entered` 구독보다 먼저 등록해야 한다.**
 * 뒤에 두면 그 구독이 한 일차 전의 프로필로 재배를 시작한다.
 */
function syncRunDay(): void {
  const step = scenes.step()
  if (run !== null && 'day' in step) run.dayNumber = step.day
}
bus.on('screen.changed', syncRunDay)
bus.on('field.entered', syncRunDay)

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

// 독립 화면 표시도 같은 두 신호를 본다. 필드로 나가면 화면이 없어지는데
// 그때는 `screen.changed` 가 오지 않고 `field.entered` 만 온다.
bus.on('screen.changed', syncScreens)
bus.on('field.entered', syncScreens)
syncScreens()

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
    console.warn(`[조우] 종료 — ${residentId} · ${finalOutcome}`),
  )
  bus.on('reward.granted', ({ residentId, bundleId }) =>
    console.info(`[보상] ${residentId} · ${bundleId} 지급`),
  )
  bus.on('ending.decided', ({ endingId, endingTitle }) =>
    console.warn(`[엔딩] 확정 — ${endingTitle} (${endingId}). 엔딩 화면은 8/4~5 최수정`),
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
  // 입력 소유가 아니라 **열려 있는지**를 본다. 콘솔로 전환하면 창이 포커스를 잃어
  // 자동 일시정지가 걸리고(DEC-UI-022) 일시정지는 항상 최상위라(DEC-UI-026)
  // inputOwner() 가 언제나 'pause' 다. 개발 통로는 콘솔에서만 불리므로 항상 막힌다.
  if (!scenes.openOverlays().includes('surrender_dialogue')) {
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

  // 이번 조우의 결과 화면 재료를 여기서 연다. 조우가 시작되는 유일한 지점이라
  // 이전 조우의 협상 내역·사연이 남아 넘어가지 않는다 (DEC-UI-011).
  const collected: PendingEncounter = {
    consumedCrops: {},
    negotiationRejected: false,
    revealedFactIds: [],
  }
  pendingEncounter = collected

  const judgement = encounter.judge(residentId, picked.choiceId, run.resources.crops)
  console.info(`[조우] 판정 → ${judgement.systemResultId}`)
  console.info(`[조우] 반응 대사: ${judgement.reactionText}`)

  // 반응 대사와 함께 사연이 공개될 수 있다 (DEC-CONTENT-009)
  recordRevealedStoryInfo(residentId, judgement.revealedStoryInfoId)

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
      // 실제로 무엇이 빠져나갔는지는 실행 후에만 알 수 있다 (DEC-RESIDENT-050).
      // 조우 결과가 이 내역을 그대로 표시한다 (DEC-UI-011).
      collected.consumedCrops = settled.consumed
    }

    // 어느 선택으로 해결됐는지가 최종 결과를 가른다 (DEC-RESIDENT-052)
    finishEncounter(
      residentId,
      picked.choiceFunction === 'empathy' ? 'empathy_resolve' : 'resource_negotiation_resolve',
    )
    console.warn('[개발 전용] 조우가 해결돼 전투에 들어가지 않는다.')
    return
  }

  // 자원 협상이 성격 프로필에 막힌 것도 중요 행동이다 (DEC-CONTENT-011)
  if (judgement.choiceFunction === 'resource_negotiation') {
    resolution!.recordNegotiationRejected(residentId)
    // 수확물이 소비되지 않았다는 사실을 조우 결과에서 알린다 (DEC-UI-011)
    collected.negotiationRejected = true
    console.info('[조우] 자원 협상 거절 — 중요 행동으로 기록')
  }

  // 전투 결과 — 시스템 결과 ID 에서 전투 보정 키를 얻는다 (DEC-CONTENT-009)
  const combatState = judgement.systemResultId.replace('system_result.precombat.combat_', '')

  // **정상 흐름으로 이미 습격 단계면 개발 통로로 다시 들어가지 않는다.**
  //
  // `enterFieldPreview()` 는 화면만 바꾸고 흐름(`scenes.step()`)은 건드리지 않는다.
  // 한 번 거치면 조우가 끝나도 `encounter_finished` 를 보낼 수 없어 조우 결과 화면에
  // 닿지 못한다 (로드맵 11-2 — "개발 통로가 흐름과 런 상태를 갈라놓는다").
  // 정비 종료로 들어온 습격은 흐름이 이미 `raid` 라 그 경로를 탈 이유가 없다.
  if (scenes.step().at === 'raid') {
    // 전투 전 대화가 오버레이로 열려 있다. 대화 모달이 선택 확정 뒤에 할 일을
    // 대신 한다 — 열려 있는 동안은 `inRaidStage()` 가 false 라 전투가 돌지 않는다.
    scenes.closeOverlay('precombat_dialogue')
  } else {
    scenes.enterFieldPreview('raid')
  }

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
