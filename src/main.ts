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
import type { PlotView } from './render/field.ts'
import { runConfig, usePlaceholderStats, setPlayerBaseStats } from './data/run-config.ts'
import { loadRuntimeData, requireTables } from './data/loader.ts'
import { createFarming } from './systems/farming.ts'
import type { FarmingSystem } from './systems/farming.ts'
import { createStageTimer } from './systems/stage-timer.ts'
import type { StageTimer } from './systems/stage-timer.ts'
import type { Crop, ThrowableWeapon } from './data/types.ts'
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

    // 런 상태를 새로 만든다. 부분 초기화하지 않는다 (로드맵 9-5).
    // 이름 입력 화면이 아직 없어 playerName 은 비어 있다.
    run = createRunState({
      stats: data.player_base_stats![0],
      schedule,
      playerName: '',
      seed: 1,
    })

    // 흐름이 일차·습격을 판단할 근거를 승인 데이터로 갈아끼운다.
    // 여기서 일정을 지어내지 않는다 — 없으면 흐름이 데이터 오류로 보고한다.
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
    }
  })
}

/** 상호작용 가능한 대상이 있을 때 행동을 안내한다 (DEC-INPUT-003) */
function actionPrompt(): string | null {
  if (farming === null) return null
  const target = farming.targetAt(player)
  if (target === null) return null
  return target.kind === 'harvest' ? 'E — 수확' : 'E — 심기'
}

const input = createInput(renderer.canvas, {
  onInteract,
  onThrow: () => console.info('[입력] 투척'),
  onSickle: () => console.info('[입력] 낫'),
  onQuickslotSelect: (index) => console.info(`[입력] 퀵슬롯 ${index + 1}`),
  onQuickslotCycle: (dir) => console.info(`[입력] 퀵슬롯 순환 ${dir > 0 ? '다음' : '이전'}`),
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

      // 작물 성장과 재배 타이머는 같은 조건에서만 흐른다 (DEC-FARM-003, DEC-RUN-004).
      // 정비·대화·습격에서는 이 블록이 통째로 빠지므로 잔여 시간이 그대로 보존되고,
      // 다음 날 재배 단계에서 이어서 자란다. 일시정지는 루프가 update 자체를 멈춘다.
      if (!inFarmingStage()) return

      farming?.update(dt)
      advanceFeedback(dt)

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
        remainingSeconds: inFarmingStage() ? (farmingTimer?.remainingSeconds ?? null) : null,
        timeUrgent: farmingTimer?.urgent ?? false,
        harvestPopups: harvestPopups.map((p) => ({
          x: p.x,
          y: p.y,
          text: p.text,
          life: p.remaining / HARVEST_POPUP_SECONDS,
        })),
      })
      hud.render(hudView())
    },
  },
  {
    // 포커스를 잃으면 일시정지 화면을 연다 (DEC-INPUT-009, DEC-UI-014).
    // 자동 재개는 하지 않는다 — 재개 확인 절차는 DEC-UI-022 가 보류다.
    onFocusLost: () => scenes.openOverlay('pause'),
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

  // 흐름을 손으로 밟아 보기 위한 개발용 통로.
  // 승인 데이터가 없으면 일차로 진입하는 순간 데이터 오류가 뜨는 것이 정상이다.
  Object.assign(window, { __scenes: scenes, __bus: bus, __loop: loop })

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

// 데이터 적재는 `data.error` 구독이 모두 끝난 뒤에 시작한다.
// 먼저 부르면 오류 이벤트가 아무 데도 도달하지 않고 화면만 비어 보인다.
void bootData().then(() => {
  // 승인 데이터가 없으면 흐름을 밀지 않는다. 데이터 오류 화면이 그대로 남아야 한다.
  if (isDevBuild && runConfig.loaded) devSkipToFarming()
  loop.start()
})
