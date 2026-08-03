// 재배 — 파종·성장·수확 (DEC-FARM-001 ~ 005, DEC-INPUT-003)
//
// 이 파일에는 수치가 없다. 성장 시간·수확량·출현 가중치·상호작용 반경은 전부
// 승인 데이터에서 받아 온다 (DEC-PIPELINE-016). 없으면 던진다 — 기본값으로 메우지 않는다.
//
// 좌표는 camera.ts 가 정의한 월드 좌표계를 쓴다. farm_plots 의 x/y 와
// maps.farm_interaction_radius 가 같은 계에 있다는 전제다.

import type { Crop, FarmPlot } from '../data/types.ts'
import { DataMissingError } from '../data/run-config.ts'

export type PlotStage = 'empty' | 'seed' | 'growing' | 'ready'

export interface PlotState {
  readonly plotId: string
  readonly x: number
  readonly y: number
  stage: PlotStage
  /** 파종 순간 확정된다. 이후 바뀌지 않는다 (DEC-FARM-001) */
  cropId: string | null
  /** 현재 단계의 잔여 시간(초). `ready` 와 `empty` 에서는 0 */
  remainingSeconds: number
}

export type InteractionKind = 'harvest' | 'plant'

export interface InteractionTarget {
  kind: InteractionKind
  plot: PlotState
}

export type FarmingEvent =
  | { type: 'planted'; plot: PlotState }
  | { type: 'harvested'; plot: PlotState; cropId: string; amount: number }

export interface FarmingSystem {
  readonly plots: readonly PlotState[]
  /** 수확물 보관함. crop_id → 수량 */
  readonly harvested: ReadonlyMap<string, number>

  /**
   * 재배 단계에서만 호출한다. 정비·대화·습격·일시정지 중에는 부르지 않는다.
   * 부르지 않으면 잔여 시간이 그대로 보존되고, 다음 재배 단계에서 이어서 자란다
   * (DEC-FARM-003).
   */
  update(deltaSeconds: number): void

  /** 가장 가까운 유효 대상. 없으면 null (DEC-INPUT-003) */
  targetAt(position: { x: number; y: number }): InteractionTarget | null

  /** `E`. 심거나 수확한다. 대상이 없으면 null */
  interact(position: { x: number; y: number }): FarmingEvent | null
}

export interface FarmingOptions {
  plots: readonly FarmPlot[]
  crops: readonly Crop[]
  /** maps.csv 의 farm_interaction_radius */
  interactionRadius: number
  /** 파종 추첨. 테스트에서 고정할 수 있게 주입받는다 */
  random?: () => number
}

export function createFarming(options: FarmingOptions): FarmingSystem {
  const { plots: plotRows, crops, interactionRadius } = options
  const random = options.random ?? Math.random

  if (plotRows.length === 0) {
    throw new DataMissingError('farm_plots 승인 행이 없어 경작지를 만들 수 없다')
  }
  if (!(interactionRadius > 0)) {
    throw new DataMissingError('maps.farm_interaction_radius 가 0보다 커야 한다')
  }

  // 현재 출현 풀에는 가중치 1 이상인 승인 작물이 하나 이상 있어야 한다 (DEC-CONTENT-003).
  const pool = crops.filter((crop) => crop.spawn_weight > 0)
  const totalWeight = pool.reduce((sum, crop) => sum + crop.spawn_weight, 0)
  if (totalWeight <= 0) {
    throw new DataMissingError(
      'spawn_weight 가 1 이상인 승인 작물이 없어 파종할 수 없다 (DEC-CONTENT-003)',
    )
  }

  const cropById = new Map(crops.map((crop) => [crop.id, crop]))

  const plots: PlotState[] = plotRows.map((row) => ({
    plotId: row.plot_id,
    x: row.x,
    y: row.y,
    stage: 'empty',
    cropId: null,
    remainingSeconds: 0,
  }))

  const harvested = new Map<string, number>()

  /**
   * 가중치 추첨. 확률은 가중치를 합으로 나눈 값이며 합을 100으로 맞추지 않는다
   * (DEC-CONTENT-003).
   */
  function rollCrop(): Crop {
    let ticket = random() * totalWeight
    for (const crop of pool) {
      ticket -= crop.spawn_weight
      if (ticket < 0) return crop
    }
    // 부동소수 오차로 끝을 넘긴 경우에만 도달한다
    return pool[pool.length - 1]
  }

  function cropOf(plot: PlotState): Crop {
    if (plot.cropId === null) {
      throw new Error(`경작지 ${plot.plotId} 에 작물이 없는데 작물 데이터를 찾고 있다`)
    }
    const crop = cropById.get(plot.cropId)
    if (crop === undefined) {
      throw new DataMissingError(
        `${plot.cropId} 가 승인 작물 목록에 없다. 경작지 ${plot.plotId}`,
      )
    }
    return crop
  }

  function distanceTo(plot: PlotState, position: { x: number; y: number }): number {
    return Math.hypot(plot.x - position.x, plot.y - position.y)
  }

  return {
    plots,
    harvested,

    update(deltaSeconds) {
      if (deltaSeconds <= 0) return

      for (const plot of plots) {
        if (plot.stage !== 'seed' && plot.stage !== 'growing') continue

        plot.remainingSeconds -= deltaSeconds

        // 한 번의 호출로 두 단계를 모두 넘길 수 있다. 탭이 백그라운드에 있다가
        // 돌아왔을 때처럼 dt 가 크면 실제로 일어난다. 한 단계씩만 넘기면
        // 그만큼 성장이 느려지고, 그 느려짐은 화면에서 잘 안 보인다.
        // 단계는 씨앗 → 성장 중 → 수확 가능 셋뿐이라 최대 두 번 돈다.
        while (plot.remainingSeconds <= 0 && plot.stage !== 'ready') {
          const crop = cropOf(plot)
          if (plot.stage === 'seed') {
            // 씨앗 → 성장 중. 여기서부터 외형으로 종류가 공개된다 (DEC-FARM-001).
            // 남은 초과분을 다음 단계로 넘겨야 프레임 길이에 따라 총 성장 시간이 흔들리지 않는다.
            plot.stage = 'growing'
            plot.remainingSeconds += crop.growth_duration_seconds
          } else {
            // 성장 중 → 수확 가능. 여기엔 제한시간이 없다 (DEC-CONTENT-003)
            plot.stage = 'ready'
            plot.remainingSeconds = 0
          }
        }
      }
    },

    targetAt(position) {
      let best: InteractionTarget | null = null
      let bestDistance = Infinity
      let bestPriority = Infinity

      for (const plot of plots) {
        const kind: InteractionKind | null =
          plot.stage === 'ready' ? 'harvest' : plot.stage === 'empty' ? 'plant' : null
        if (kind === null) continue

        const distance = distanceTo(plot, position)
        if (distance > interactionRadius) continue

        // 같은 거리에서 겹치면 `수확 가능 작물 → 빈 경작지` 순으로 우선한다 (DEC-INPUT-003)
        const priority = kind === 'harvest' ? 0 : 1
        const closer =
          distance < bestDistance - 1e-6 ||
          (Math.abs(distance - bestDistance) <= 1e-6 && priority < bestPriority)

        if (closer) {
          best = { kind, plot }
          bestDistance = distance
          bestPriority = priority
        }
      }

      return best
    },

    interact(position) {
      const target = this.targetAt(position)
      if (target === null) return null

      const plot = target.plot

      if (target.kind === 'plant') {
        const crop = rollCrop()
        plot.cropId = crop.id
        plot.stage = 'seed'
        plot.remainingSeconds = crop.seed_duration_seconds
        return { type: 'planted', plot }
      }

      // 수확 — 수량을 보관함에 넣고 경작지는 즉시 빈 상태가 된다 (DEC-FARM-005).
      // 두 가지가 함께 일어나야 하므로 중간에 끊기지 않게 한 번에 처리한다.
      const crop = cropOf(plot)
      const amount = crop.base_yield
      const cropId = crop.id

      harvested.set(cropId, (harvested.get(cropId) ?? 0) + amount)
      plot.stage = 'empty'
      plot.cropId = null
      plot.remainingSeconds = 0

      return { type: 'harvested', plot, cropId, amount }
    },
  }
}
