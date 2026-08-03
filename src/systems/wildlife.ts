// 야생동물 — 출현·목표 선택·먹기·공격 (로드맵 8/2 최수정, 8/3 밤 이월)
//
// DEC-CONTENT-007 · DEC-FARM-006 · DEC-FARM-010
//
// ── 주민 전투와 규칙이 반대인 지점 ─────────────────────────
//
// **야생동물은 공격 예고를 쓴다.** `attack_windup_seconds` 동안 예고하고, 예고가
// 끝날 때 플레이어가 범위를 벗어났으면 공격을 취소한다 (DEC-CONTENT-007).
// 적대 주민은 정반대로 예고를 **금지**한다 (DEC-CONTENT-008 — `attack_windup_seconds`
// 필드를 만들지 않는다). 두 시스템을 한 파일에 넣으면 이 차이가 지워진다.
//
// ── 먹기가 조용히 틀리기 쉬운 곳이다 ───────────────────────
//
// 먹힌 작물은 **보관함에 들어가지 않는다** (DEC-FARM-006). 수확 경로를 재사용하면
// 플레이어가 잃은 작물이 오히려 보관함에 쌓인다. 그래서 여기서 경작지를 직접 비우고
// 수확 함수를 부르지 않는다.
//
// 수치는 하나도 없다. `wildlife`, `wildlife_spawn_profiles`, `wildlife_spawn_entries`,
// `maps` 에서 온다.

import type {
  ThrowableWeapon,
  Wildlife,
  WildlifeSpawnEntry,
  WildlifeSpawnProfile,
  WorldMap,
} from '../data/types.ts'
import type { ActiveEffect, WildlifeInstance } from '../state/types.ts'
import type { PlotState } from './farming.ts'
import { DataMissingError } from '../data/run-config.ts'
import { effectiveMoveSpeed } from './combat.ts'

/** 개체 하나의 런 상태. 콘텐츠 CSV 에 저장하지 않는다 (DEC-CONTENT-007) */
export interface WildlifeRuntime {
  readonly entity: WildlifeInstance
  readonly species: Wildlife

  /**
   * 플레이어에게 영구 적대로 바뀌었는가.
   *
   * `crop_first` 개체가 플레이어 공격으로 한 번이라도 피해를 받으면
   * **남은 생존 시간 동안** 플레이어를 목표로 한다 (DEC-CONTENT-007).
   * 그래서 되돌리는 경로를 만들지 않는다.
   */
  hostileToPlayer: boolean

  /** 먹는 중이면 남은 시간(초). 아니면 null */
  eatingSeconds: number | null
  /** 공격 예고 중이면 남은 시간(초). 아니면 null */
  windupSeconds: number | null
  cooldownRemaining: number
}

export interface PlayerView {
  x: number
  y: number
}

export type WildlifeEvent =
  | { type: 'spawned'; instanceId: string; wildlifeId: string }
  | { type: 'cropEaten'; instanceId: string; plotId: string }
  | { type: 'playerDamaged'; amount: number; instanceId: string }
  | { type: 'attackCancelled'; instanceId: string }

export interface WildlifeOptions {
  map: WorldMap
  species: readonly Wildlife[]
  /** 둔화 배율을 읽는다 */
  weapons: readonly ThrowableWeapon[]
  /** 출현 추첨. 테스트에서 고정할 수 있게 주입받는다 */
  random?: () => number
}

export interface WildlifeSystem {
  readonly instances: readonly WildlifeRuntime[]

  /** 재배 단계 시작. 프로필이 없는 일차는 null 을 넘긴다 */
  beginFarming(profile: WildlifeSpawnProfile | null, entries: readonly WildlifeSpawnEntry[]): void
  /** 재배 종료 — 전부 제거한다 (DEC-FARM-006 계열, 로드맵 8/2) */
  endFarming(): void

  /** 플레이어 공격으로 피해를 받았다고 알린다. 목표 전환의 유일한 경로다 */
  notifyDamagedByPlayer(instanceId: string): void
  remove(instanceId: string): void

  update(deltaSeconds: number, player: PlayerView, plots: readonly PlotState[]): WildlifeEvent[]
}

export function createWildlife(options: WildlifeOptions): WildlifeSystem {
  const { map, weapons } = options
  const random = options.random ?? Math.random

  const speciesById = new Map(options.species.map((s) => [s.id, s]))

  let instances: WildlifeRuntime[] = []
  let profile: WildlifeSpawnProfile | null = null
  let pool: WildlifeSpawnEntry[] = []
  let totalWeight = 0
  let spawnedTotal = 0
  let nextSpawnSeconds = 0
  let serial = 0

  function speciesOf(id: string): Wildlife {
    const species = speciesById.get(id)
    if (species === undefined) {
      throw new DataMissingError(`${id} 가 승인 야생동물 목록에 없다`)
    }
    return species
  }

  /**
   * 목표로 삼을 수 있는 경작지 — **수확 가능 상태만**이다.
   * 씨앗과 성장 중은 목표로 선택하지도, 공격하지도 않는다 (DEC-FARM-010).
   */
  function targetablePlots(plots: readonly PlotState[]): PlotState[] {
    return plots.filter((p) => p.stage === 'ready')
  }

  /** 가장 가까운 수확 가능 작물. 같은 거리면 경작지 ID 순서로 하나 (DEC-CONTENT-007) */
  function nearestCrop(from: PlayerView, plots: readonly PlotState[]): PlotState | null {
    let best: PlotState | null = null
    let bestDistance = Infinity

    for (const plot of targetablePlots(plots)) {
      const distance = Math.hypot(plot.x - from.x, plot.y - from.y)
      if (distance < bestDistance - 1e-6) {
        best = plot
        bestDistance = distance
      } else if (best !== null && Math.abs(distance - bestDistance) <= 1e-6) {
        // 안정적인 ID 순서. 부동소수 비교로 순서가 흔들리지 않게 문자열로 가른다.
        if (plot.plotId < best.plotId) best = plot
      }
    }
    return best
  }

  function speedOf(runtime: WildlifeRuntime): number {
    // 둔화는 이동속도에만 적용한다. 공격 예고·대기시간에는 영향이 없다
    // (DEC-CONTENT-007).
    return effectiveMoveSpeed(runtime.species.move_speed, runtime.entity.effects, weapons)
  }

  function moveToward(runtime: WildlifeRuntime, x: number, y: number, deltaSeconds: number): number {
    const dx = x - runtime.entity.x
    const dy = y - runtime.entity.y
    const distance = Math.hypot(dx, dy)
    if (distance === 0) return 0

    const step = Math.min(speedOf(runtime) * deltaSeconds, distance)
    runtime.entity.x += (dx / distance) * step
    runtime.entity.y += (dy / distance) * step
    return distance - step
  }

  /** 출현 위치 — 맵 외곽에서, 플레이어와 최소 거리를 띄운다 */
  function spawnPoint(player: PlayerView): { x: number; y: number } {
    const margin = map.wildlife_spawn_edge_margin
    const minDistance = map.wildlife_spawn_min_player_distance

    // 네 변 중 플레이어에게서 가장 먼 쪽을 고른다. 무작위로 고르면 눈앞에 튀어나오는
    // 경우가 생기고, 그때 최소 거리를 다시 검사해 되돌리는 경로가 필요해진다.
    const candidates = [
      { x: margin, y: player.y },
      { x: map.world_width - margin, y: player.y },
      { x: player.x, y: margin },
      { x: player.x, y: map.world_height - margin },
    ]

    let best = candidates[0]
    let bestDistance = -1
    for (const candidate of candidates) {
      const distance = Math.hypot(candidate.x - player.x, candidate.y - player.y)
      if (distance > bestDistance) {
        best = candidate
        bestDistance = distance
      }
    }

    if (bestDistance < minDistance) {
      throw new DataMissingError(
        `맵 ${map.id} 가 좁아 wildlife_spawn_min_player_distance 를 지킬 수 없다`,
      )
    }
    return best
  }

  function rollSpecies(): Wildlife {
    let ticket = random() * totalWeight
    for (const entry of pool) {
      ticket -= entry.spawn_weight
      if (ticket < 0) return speciesOf(entry.wildlife_id)
    }
    return speciesOf(pool[pool.length - 1].wildlife_id)
  }

  return {
    get instances() {
      return instances
    },

    beginFarming(nextProfile, entries) {
      instances = []
      spawnedTotal = 0
      profile = nextProfile

      if (nextProfile === null) {
        pool = []
        totalWeight = 0
        return
      }

      pool = entries
        .filter((e) => e.wildlife_spawn_profile_id === nextProfile.id && e.spawn_weight > 0)
        .sort((a, b) => (a.wildlife_id < b.wildlife_id ? -1 : 1))

      totalWeight = pool.reduce((sum, e) => sum + e.spawn_weight, 0)
      if (totalWeight <= 0) {
        throw new DataMissingError(
          `출현 프로필 ${nextProfile.id} 에 가중치 1 이상인 승인 야생동물이 없다`,
        )
      }
      nextSpawnSeconds = nextProfile.first_spawn_delay_seconds
    },

    endFarming() {
      // 재배가 끝나면 전부 제거한다. 효과도 함께 사라진다 (DEC-CONTENT-013).
      instances = []
      profile = null
      pool = []
    },

    notifyDamagedByPlayer(instanceId) {
      const runtime = instances.find((i) => i.entity.instanceId === instanceId)
      if (runtime === undefined) return

      // 먹는 중이었으면 먹기를 취소한다 (DEC-CONTENT-007)
      runtime.eatingSeconds = null
      runtime.entity.targetPlotId = null
      // crop_first 만 전환 대상이다. player_only 는 원래부터 플레이어만 본다.
      runtime.hostileToPlayer = true
    },

    remove(instanceId) {
      instances = instances.filter((i) => i.entity.instanceId !== instanceId)
    },

    update(deltaSeconds, player, plots) {
      const events: WildlifeEvent[] = []
      if (deltaSeconds <= 0) return events

      advanceSpawning(deltaSeconds, player, events)

      for (const runtime of instances) {
        if (runtime.entity.health <= 0) continue
        advanceOne(runtime, deltaSeconds, player, plots, events)
      }

      // 체력이 0이 된 개체와 그 효과를 제거한다 (DEC-CONTENT-007)
      instances = instances.filter((i) => i.entity.health > 0)
      return events
    },
  }

  function advanceSpawning(
    deltaSeconds: number,
    player: PlayerView,
    events: WildlifeEvent[],
  ): void {
    if (profile === null) return

    nextSpawnSeconds -= deltaSeconds
    // dt 가 간격보다 크면 여러 번 시도한다. 한 번만 하면 배경 탭에서 돌아왔을 때
    // 출현이 조용히 밀린다.
    while (nextSpawnSeconds <= 0) {
      nextSpawnSeconds += profile.spawn_interval_seconds

      // 동시 생존 수와 총 생성 수를 검사한다. 조건을 못 채우면 이번 간격은 건너뛴다.
      if (instances.length >= profile.max_concurrent) continue
      if (spawnedTotal >= profile.total_spawn_limit) return

      const species = rollSpecies()
      const point = spawnPoint(player)
      serial += 1
      const instanceId = `wildlife.${serial}`

      instances.push({
        entity: {
          instanceId,
          wildlifeId: species.id,
          x: point.x,
          y: point.y,
          health: species.max_health,
          effects: [],
          targetPlotId: null,
        },
        species,
        // player_only 는 생성될 때부터 플레이어만 목표로 한다 (DEC-CONTENT-007)
        hostileToPlayer: species.target_mode === 'player_only',
        eatingSeconds: null,
        windupSeconds: null,
        cooldownRemaining: 0,
      })
      spawnedTotal += 1
      events.push({ type: 'spawned', instanceId, wildlifeId: species.id })
    }
  }

  function advanceOne(
    runtime: WildlifeRuntime,
    deltaSeconds: number,
    player: PlayerView,
    plots: readonly PlotState[],
    events: WildlifeEvent[],
  ): void {
    const species = runtime.species
    runtime.cooldownRemaining = Math.max(0, runtime.cooldownRemaining - deltaSeconds)

    // ── 먹는 중 ────────────────────────────────────────────
    if (runtime.eatingSeconds !== null) {
      const plot = plots.find((p) => p.plotId === runtime.entity.targetPlotId)

      // 먹는 도중 플레이어가 먼저 수확하면 취소하고 새 목표를 찾는다
      if (plot === undefined || plot.stage !== 'ready') {
        runtime.eatingSeconds = null
        runtime.entity.targetPlotId = null
        return
      }

      runtime.eatingSeconds -= deltaSeconds
      if (runtime.eatingSeconds > 0) return

      // 먹기 완료 — 보관함에 넣지 않고 소멸시키고 경작지를 빈 상태로 (DEC-FARM-006)
      plot.stage = 'empty'
      plot.cropId = null
      plot.remainingSeconds = 0
      runtime.eatingSeconds = null
      runtime.entity.targetPlotId = null
      events.push({ type: 'cropEaten', instanceId: runtime.entity.instanceId, plotId: plot.plotId })
      return
    }

    // ── 목표 선택 ──────────────────────────────────────────
    // crop_first 이고 아직 적대 전환되지 않았을 때만 작물을 본다.
    let targetX = player.x
    let targetY = player.y
    let targetPlot: PlotState | null = null

    if (species.target_mode === 'crop_first' && !runtime.hostileToPlayer) {
      // 목표 작물이 수확되거나 사라졌으면 새로 탐색한다
      const current = plots.find((p) => p.plotId === runtime.entity.targetPlotId)
      targetPlot =
        current !== undefined && current.stage === 'ready'
          ? current
          : nearestCrop(runtime.entity, plots)

      runtime.entity.targetPlotId = targetPlot?.plotId ?? null
      if (targetPlot !== null) {
        targetX = targetPlot.x
        targetY = targetPlot.y
      }
      // 수확 가능한 작물이 없으면 플레이어를 목표로 한다 (DEC-FARM-010)
    }

    // ── 공격 예고 진행 중 ──────────────────────────────────
    if (runtime.windupSeconds !== null) {
      runtime.windupSeconds -= deltaSeconds
      if (runtime.windupSeconds > 0) return

      runtime.windupSeconds = null
      runtime.cooldownRemaining = species.attack_cooldown_seconds

      // 예고가 끝날 때 플레이어가 범위를 벗어났으면 공격을 취소한다 (DEC-CONTENT-007).
      // 취소해도 재사용 대기는 시작한다.
      const distance = Math.hypot(player.x - runtime.entity.x, player.y - runtime.entity.y)
      if (distance > species.attack_range) {
        events.push({ type: 'attackCancelled', instanceId: runtime.entity.instanceId })
        return
      }

      events.push({
        type: 'playerDamaged',
        amount: species.attack_damage,
        instanceId: runtime.entity.instanceId,
      })
      return
    }

    // ── 이동 ───────────────────────────────────────────────
    if (targetPlot !== null) {
      const remaining = moveToward(runtime, targetX, targetY, deltaSeconds)
      // 상호작용 거리 안에 도달하면 멈추고 먹기를 시작한다
      if (remaining <= map.farm_interaction_radius) {
        runtime.eatingSeconds = species.crop_eat_duration_seconds
      }
      return
    }

    const distance = Math.hypot(player.x - runtime.entity.x, player.y - runtime.entity.y)
    if (distance > species.attack_range) {
      moveToward(runtime, targetX, targetY, deltaSeconds)
      return
    }

    // 범위 안 — 이동을 멈추고 예고를 시작한다. 대기 중이면 아무것도 하지 않는다.
    if (runtime.cooldownRemaining > 0) return
    runtime.windupSeconds = species.attack_windup_seconds
  }
}

/** 둔화가 걸린 개체의 현재 이동속도. 디버그·표시용 */
export function wildlifeSpeed(
  runtime: WildlifeRuntime,
  weapons: readonly ThrowableWeapon[],
): number {
  return effectiveMoveSpeed(
    runtime.species.move_speed,
    runtime.entity.effects as readonly ActiveEffect[],
    weapons,
  )
}
