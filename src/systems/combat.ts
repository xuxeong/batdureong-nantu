// 전투 기반 — 낫, 투척, 투사체, 전투 효과 (로드맵 8/2 최수정)
//
// DEC-INPUT-004~007 · DEC-CONTENT-005 · DEC-CONTENT-013
//
// ── 이 파일이 지키는 것 ────────────────────────────────────
//
// **명중 처리의 순서가 확정돼 있다** (DEC-CONTENT-013):
//
//   기본 직접 피해 → 체력 0 확인 → 투항 기준 확인 → 전투가 계속될 때만 효과 적용
//
// 순서를 바꾸면 "죽은 대상에게 둔화가 걸리고" "투항한 주민에게 지속 피해가 계속 도는"
// 상태가 된다. 둘 다 화면에서는 잠깐 이상한 정도로만 보이고, 실제로는 투항 대화 중
// 주민이 지속 피해로 죽는 형태로 나타난다 — DEC-RESIDENT-039 가 금지한 상태다.
// 그래서 피해 적용을 `applyDamage()` 한 곳으로 모으고 호출자가 순서를 못 바꾸게 했다.
//
// **수치는 하나도 없다.** 낫은 `player_base_stats`, 투척은 `throwable_weapons`,
// 효과 종류는 `crop_attributes.combat_mechanic_key` 에서 온다 (DEC-PIPELINE-016).
//
// 야생동물과 적대 주민을 구분하지 않는다. 둘 다 `FieldEntity` 이고, 투항이라는
// 개념만 주민에게 있어서 그것을 `surrenderThreshold` 하나로 받는다. 여기서 종류를
// 나누면 "야생동물에는 효과가 안 걸리는" 종류의 누락이 생긴다.

import type { CropAttribute, PlayerBaseStats, ThrowableWeapon } from '../data/types.ts'
import type { ActiveEffect, FieldEntity, ProjectileInstance, Resources } from '../state/types.ts'
import { DataMissingError } from '../data/run-config.ts'

/** 피해를 입은 대상이 어떻게 됐는가 (DEC-CONTENT-013 의 처리 순서) */
export type DamageOutcome = 'alive' | 'killed' | 'surrender_offered'

/**
 * 전투에서 다루는 대상 하나.
 *
 * 필드 상태의 야생동물·적대 주민을 그대로 감싼다. 위치와 체력의 원본은
 * 필드 쪽에 있고 이 시스템은 그것을 고친다.
 */
export interface CombatTarget {
  readonly entity: FieldEntity
  readonly collisionRadius: number
  /**
   * 투항 기준 체력. 야생동물은 null (DEC-RESIDENT-016).
   * 비율이 아니라 이미 계산된 체력값을 받는다 — 비율 해석을 두 곳에 두지 않는다.
   */
  readonly surrenderThreshold: number | null
  /** 투항 대화는 한 명당 최대 한 번이다 (DEC-RESIDENT-016) */
  surrenderOffered: boolean
}

export interface CombatEvent {
  type: 'damaged' | 'killed' | 'surrenderOffered' | 'projectileExpired'
  targetId?: string
  amount?: number
  /** 지속 피해로 발생했는가. 화면 표시를 가르는 데 쓴다 */
  overTime?: boolean
}

/** 발사 뒤 슬롯이 어떻게 됐는가 (DEC-INPUT-007) */
export interface SlotAfterThrow {
  /** 소진돼 자동 전환됐으면 옮겨간 슬롯. 아니면 null */
  autoSwitchedTo: number | null
  /** 모든 투척 무기가 소진됐다. `투척 무기 없음` 상태 */
  allEmpty: boolean
}

export interface SickleResult {
  /** 재사용 대기 중이면 false. 이때 아무 일도 일어나지 않는다 */
  swung: boolean
  hits: { targetId: string; outcome: DamageOutcome }[]
}

export type ThrowRejection =
  | 'cooldown'
  | 'no_slot_selected'
  | 'out_of_ammo'

export type ThrowResult =
  | { ok: true; weaponId: string; projectileId: string; slot: SlotAfterThrow }
  | { ok: false; reason: ThrowRejection }

export interface CombatOptions {
  stats: PlayerBaseStats
  weapons: readonly ThrowableWeapon[]
  attributes: readonly CropAttribute[]
}

export interface CombatSystem {
  readonly projectiles: readonly ProjectileInstance[]
  /** 전역 투척 재사용 대기 남은 시간. 슬롯별이 아니다 (DEC-CONTENT-005) */
  readonly throwCooldownRemaining: number
  /** 낫 재사용 대기 남은 시간 */
  readonly sickleCooldownRemaining: number

  /** 재배·습격 단계에 새로 진입할 때 부른다 (DEC-CONTENT-005) */
  reset(): void

  setTargets(targets: readonly CombatTarget[]): void

  /**
   * 영입 주민의 지원 공격 피해 (DEC-RESIDENT-021).
   *
   * 플레이어 무기가 아닌데 이 시스템을 거치는 이유는 **투항 발동이 여기 있기
   * 때문**이다. 확정문이 *"지원 공격으로 적대 주민이 투항 체력 기준에 도달하면
   * 정상적으로 투항 대화를 시작한다"* 로 정했는데, 별도 경로로 체력을 깎으면
   * 지원 공격만 투항을 발동시키지 못한다.
   *
   * **처치할 수 없다.** 같은 확정문이 *"지원 공격은 적대 주민의 체력을 0으로
   * 만들 수 없다"* 로 정했다. 남은 체력이 피해보다 적으면 1을 남긴다.
   *
   * 대상이 없거나 이미 체력이 1이면 아무 일도 없고 빈 배열이다.
   */
  applySupportDamage(targetId: string, amount: number): CombatEvent[]

  /** 우클릭 (DEC-INPUT-004) */
  swingSickle(origin: Vec2, aimAngle: number): SickleResult

  /** `1~5` — 해당 위치를 직접 선택한다. 수량이 0이어도 선택된다 (DEC-INPUT-006) */
  selectSlot(run: ThrowContext, index: number): void
  /**
   * 마우스 휠 — **수량이 남은 무기만 순환하고 수량 0인 슬롯은 건너뛴다**
   * (DEC-INPUT-006). 전부 비었으면 아무 일도 하지 않는다.
   */
  cycleSlot(run: ThrowContext, direction: 1 | -1): void
  /**
   * 좌클릭 (DEC-INPUT-004, 005).
   *
   * 무기 소비는 **투사체 생성에 성공한 순간**에만 일어난다 (DEC-CONTENT-005).
   * 그래서 자원을 여기서 직접 깎는다 — 호출자가 따로 깎으면 거절된 발사에서도
   * 수량이 줄어드는 경로가 생긴다.
   */
  throwWeapon(origin: Vec2, aimAngle: number, run: ThrowContext): ThrowResult

  /**
   * 재배·습격의 실제 플레이 시간이 흐를 때만 부른다.
   * 일시정지·대화·정비 중에는 부르지 않는다 — 그러면 재사용 대기와 효과 타이머가
   * 그대로 멈춘다 (DEC-CONTENT-005, DEC-CONTENT-013).
   */
  update(deltaSeconds: number): CombatEvent[]
}

export interface Vec2 {
  x: number
  y: number
}

/** 퀵슬롯과 무기 보관함. 소비가 원자적이어야 해서 통째로 받는다 */
export interface ThrowContext {
  resources: Resources
  quickslots: { slots: (string | null)[]; selectedIndex: number }
}

export function createCombat(options: CombatOptions): CombatSystem {
  const { stats } = options

  const weaponById = new Map(options.weapons.map((w) => [w.id, w]))
  const attributeById = new Map(options.attributes.map((a) => [a.id, a]))

  let targets: CombatTarget[] = []
  let projectiles: ProjectileInstance[] = []
  let throwCooldown = 0
  let sickleCooldown = 0
  let projectileSerial = 0

  function weaponOf(id: string): ThrowableWeapon {
    const weapon = weaponById.get(id)
    if (weapon === undefined) {
      throw new DataMissingError(`${id} 가 승인 투척 무기 목록에 없다`)
    }
    return weapon
  }

  /** 효과 종류는 무기가 아니라 작물 속성이 소유한다 (DEC-CONTENT-013) */
  function mechanicOf(weapon: ThrowableWeapon): CropAttribute['combat_mechanic_key'] {
    const attribute = attributeById.get(weapon.crop_attribute_id)
    if (attribute === undefined) {
      throw new DataMissingError(
        `${weapon.id} 가 참조하는 작물 속성 ${weapon.crop_attribute_id} 가 없다`,
      )
    }
    return attribute.combat_mechanic_key
  }

  /**
   * 피해를 적용하고 그 결과를 확정한다. **전투의 모든 피해가 이 함수를 지난다.**
   *
   * 지속 피해도 일반 피해와 같은 경로를 쓴다 (DEC-CONTENT-013). 따로 두면
   * 지속 피해로는 투항이 발동하지 않는 형태로 갈린다 — 확정 규칙은 반대다.
   */
  function applyDamage(target: CombatTarget, amount: number): DamageOutcome {
    target.entity.health -= amount

    if (target.entity.health <= 0) {
      target.entity.health = 0
      // 처치된 대상의 효과는 전부 제거한다 (DEC-CONTENT-013)
      target.entity.effects = []
      return 'killed'
    }

    // 체력이 1 이상이고 투항 기준 이하로 **처음** 내려갈 때만 (DEC-RESIDENT-016).
    // 이미 투항을 거부한 주민은 더 낮아져도 다시 투항하지 않는다.
    if (
      target.surrenderThreshold !== null &&
      !target.surrenderOffered &&
      target.entity.health <= target.surrenderThreshold
    ) {
      target.surrenderOffered = true
      return 'surrender_offered'
    }

    return 'alive'
  }

  /**
   * 효과를 걸거나 갱신한다 (DEC-CONTENT-013).
   *
   * 같은 효과 키는 대상당 하나뿐이다. 합산도 배율 중첩도 하지 않는다.
   * 낮은 `effect_rank` 는 기존 효과를 이기지 못하지만, **기본 직접 피해는 이미
   * 적용된 뒤다** — 그래서 이 함수는 피해를 다루지 않는다.
   */
  function applyEffect(target: CombatTarget, weapon: ThrowableWeapon): void {
    const mechanicKey = mechanicOf(weapon)
    const effects = target.entity.effects
    const existing = effects.find((e) => e.mechanicKey === mechanicKey)

    const next: ActiveEffect = {
      sourceThrowableId: weapon.id,
      mechanicKey,
      effectRank: weapon.effect_rank,
      remainingSeconds: weapon.effect_duration_seconds,
      // 첫 지속 피해는 즉시가 아니라 첫 틱 간격이 지난 뒤다 (DEC-CONTENT-013)
      nextTickSeconds: weapon.effect_tick_interval_seconds ?? 0,
    }

    if (existing === undefined) {
      effects.push(next)
      return
    }
    // 더 낮은 순위는 기존 효과를 유지한다. 동급은 최신으로 교체하고 지속시간을 다시 시작한다.
    if (weapon.effect_rank < existing.effectRank) return

    effects.splice(effects.indexOf(existing), 1, next)
  }

  /** 명중 한 번의 전체 처리. 순서가 확정돼 있어 한 곳에 묶는다 (DEC-CONTENT-013) */
  function resolveHit(
    target: CombatTarget,
    weapon: ThrowableWeapon,
    events: CombatEvent[],
  ): void {
    const outcome = applyDamage(target, weapon.base_damage)
    events.push({ type: 'damaged', targetId: target.entity.instanceId, amount: weapon.base_damage })

    if (outcome === 'killed') {
      events.push({ type: 'killed', targetId: target.entity.instanceId })
      return
    }
    if (outcome === 'surrender_offered') {
      events.push({ type: 'surrenderOffered', targetId: target.entity.instanceId })
      // 전투가 계속되지 않으므로 효과를 걸지 않는다 (DEC-CONTENT-013)
      return
    }
    applyEffect(target, weapon)
  }

  /**
   * 선분 대 원의 최근접 거리. 빠른 투사체가 한 프레임에 대상을 건너뛰는 것을 막는다
   * (DEC-CONTENT-005 — 한 프레임의 이동 경로에서 가장 먼저 만난 대상).
   *
   * 반환값은 선분 시작점에서 충돌 지점까지의 진행 비율(0~1). 안 맞으면 null.
   */
  function sweepHit(
    from: Vec2,
    to: Vec2,
    center: Vec2,
    radius: number,
  ): number | null {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const lengthSquared = dx * dx + dy * dy

    if (lengthSquared === 0) {
      return Math.hypot(center.x - from.x, center.y - from.y) <= radius ? 0 : null
    }

    // 원의 중심을 선분에 정사영한 위치
    let t = ((center.x - from.x) * dx + (center.y - from.y) * dy) / lengthSquared
    t = Math.min(Math.max(t, 0), 1)

    const closestX = from.x + dx * t
    const closestY = from.y + dy * t
    const distance = Math.hypot(center.x - closestX, center.y - closestY)

    return distance <= radius ? t : null
  }

  function hasAmmo(run: ThrowContext, index: number): boolean {
    const id = run.quickslots.slots[index]
    return id !== null && id !== undefined && (run.resources.throwables[id] ?? 0) > 0
  }

  /**
   * 마지막 하나를 쓴 뒤 다음 순서의 비어 있지 않은 슬롯으로 옮긴다 (DEC-INPUT-007).
   *
   * 모든 투척 무기가 소진되면 퀵슬롯 전체가 비활성화되고 `투척 무기 없음` 상태가 된다.
   * 그때 선택 위치는 그대로 둔다 — 어디로 옮겨도 쏠 수 있는 슬롯이 없다.
   */
  function autoSwitch(run: ThrowContext): SlotAfterThrow {
    const count = run.quickslots.slots.length

    for (let step = 1; step <= count; step += 1) {
      const index = (run.quickslots.selectedIndex + step) % count
      if (hasAmmo(run, index)) {
        run.quickslots.selectedIndex = index
        return { autoSwitchedTo: index, allEmpty: false }
      }
    }
    return { autoSwitchedTo: null, allEmpty: true }
  }

  return {
    get projectiles() {
      return projectiles
    },
    get throwCooldownRemaining() {
      return throwCooldown
    },
    get sickleCooldownRemaining() {
      return sickleCooldown
    },

    reset() {
      projectiles = []
      throwCooldown = 0
      sickleCooldown = 0
    },

    setTargets(next) {
      targets = [...next]
    },

    applySupportDamage(targetId, amount) {
      const target = targets.find((t) => t.entity.instanceId === targetId)
      if (target === undefined) return []

      // 체력을 0으로 만들 수 없다 (DEC-RESIDENT-021). 피해를 남은 체력보다
      // 작게 깎아 `applyDamage()` 가 `killed` 를 돌려줄 수 없게 한다 —
      // 여기서 결과를 보고 되돌리면 이미 효과가 지워진 뒤다.
      const allowed = Math.min(amount, target.entity.health - 1)
      if (allowed <= 0) return []

      const outcome = applyDamage(target, allowed)
      const events: CombatEvent[] = [
        { type: 'damaged', targetId: target.entity.instanceId },
      ]
      if (outcome === 'surrender_offered') {
        events.push({ type: 'surrenderOffered', targetId: target.entity.instanceId })
      }
      return events
    },

    swingSickle(origin, aimAngle) {
      if (sickleCooldown > 0) return { swung: false, hits: [] }
      sickleCooldown = stats.sickle_cooldown_seconds

      // 낫은 커서 방향의 한 점을 중심으로 판정한다. 부채꼴 각도는 확정 규칙에 없어
      // 만들지 않는다 — 사거리 안의 대상을 친다.
      const hits: SickleResult['hits'] = []
      for (const target of targets) {
        const distance = Math.hypot(
          target.entity.x - origin.x,
          target.entity.y - origin.y,
        )
        if (distance - target.collisionRadius > stats.sickle_range) continue

        // 커서 반대편은 치지 않는다. 정면 180도만 유효하다.
        const toTarget = Math.atan2(target.entity.y - origin.y, target.entity.x - origin.x)
        let delta = Math.abs(toTarget - aimAngle) % (Math.PI * 2)
        if (delta > Math.PI) delta = Math.PI * 2 - delta
        if (delta > Math.PI / 2) continue

        const outcome = applyDamage(target, stats.sickle_damage)
        hits.push({ targetId: target.entity.instanceId, outcome })
      }

      return { swung: true, hits }
    },

    throwWeapon(origin, aimAngle, run) {
      // 재사용 대기 중이면 무기를 소비하지 않는다 (DEC-CONTENT-005)
      if (throwCooldown > 0) return { ok: false, reason: 'cooldown' }

      const weaponId = run.quickslots.slots[run.quickslots.selectedIndex] ?? null
      if (weaponId === null) return { ok: false, reason: 'no_slot_selected' }

      const remaining = run.resources.throwables[weaponId] ?? 0
      if (remaining <= 0) return { ok: false, reason: 'out_of_ammo' }

      const weapon = weaponOf(weaponId)

      // 여기서부터 되돌리지 않는다. 소비와 생성이 붙어 있어야 한다.
      if (remaining - 1 <= 0) delete run.resources.throwables[weaponId]
      else run.resources.throwables[weaponId] = remaining - 1

      throwCooldown = weapon.cooldown_seconds

      // 슬롯 전환은 **던진 뒤**에 일어난다. 같은 입력으로 새 슬롯의 무기를 추가
      // 발사하지 않는다 (DEC-INPUT-007). 그래서 발사 처리를 끝내고 마지막에 옮긴다.
      const slot = remaining - 1 <= 0 ? autoSwitch(run) : { autoSwitchedTo: null, allEmpty: false }

      projectileSerial += 1
      const projectileId = `projectile.${projectileSerial}`
      projectiles.push({
        instanceId: projectileId,
        source: 'player',
        sourceId: weaponId,
        x: origin.x,
        y: origin.y,
        // 발사 후 방향을 바꾸지 않는다. 유도·곡사 없음 (DEC-CONTENT-005)
        velocityX: Math.cos(aimAngle) * weapon.projectile_speed,
        velocityY: Math.sin(aimAngle) * weapon.projectile_speed,
        travelledDistance: 0,
      })

      return { ok: true, weaponId, projectileId, slot }
    },

    selectSlot(run, index) {
      // 수량이 0이어도 선택은 된다. `1~5`는 위치를 직접 고르는 입력이고
      // 수량 조건은 발사 시점에 본다 (DEC-INPUT-006).
      if (index < 0 || index >= run.quickslots.slots.length) return
      run.quickslots.selectedIndex = index
    },

    cycleSlot(run, direction) {
      const slots = run.quickslots.slots
      const count = slots.length

      for (let step = 1; step <= count; step += 1) {
        const index = (run.quickslots.selectedIndex + direction * step + count * count) % count
        if (hasAmmo(run, index)) {
          run.quickslots.selectedIndex = index
          return
        }
      }
      // 전부 비었으면 그대로 둔다. 빈 슬롯으로 옮겨 놓으면 다음 발사가
      // out_of_ammo 대신 no_slot_selected 로 떨어져 원인이 흐려진다.
    },

    update(deltaSeconds) {
      const events: CombatEvent[] = []
      if (deltaSeconds <= 0) return events

      throwCooldown = Math.max(0, throwCooldown - deltaSeconds)
      sickleCooldown = Math.max(0, sickleCooldown - deltaSeconds)

      advanceEffects(deltaSeconds, events)
      advanceProjectiles(deltaSeconds, events)

      return events
    },
  }

  /** 지속 피해 틱과 효과 만료 (DEC-CONTENT-013) */
  function advanceEffects(deltaSeconds: number, events: CombatEvent[]): void {
    for (const target of targets) {
      if (target.entity.effects.length === 0) continue

      for (const effect of [...target.entity.effects]) {
        if (effect.mechanicKey === 'movement_slow') {
          effect.remainingSeconds -= deltaSeconds
        } else {
          advanceDamageOverTime(target, effect, deltaSeconds, events)
        }

        if (effect.remainingSeconds <= 0) {
          const index = target.entity.effects.indexOf(effect)
          if (index !== -1) target.entity.effects.splice(index, 1)
        }
      }
    }
  }

  /**
   * 지속 피해 한 대상 한 효과의 시간 진행.
   *
   * **`dt` 를 통째로 빼고 틱을 세지 않는다.** 틱 간격보다 큰 `dt` 가 오면 그 안에
   * 여러 틱이 지나는데, 한 번만 주면 총 피해가 조용히 줄어든다. 탭이 백그라운드에
   * 있다가 돌아오면 실제로 일어나고, 화면에서는 "좀 약하네" 로만 보인다.
   * 그래서 남은 시간과 다음 틱 중 가까운 쪽까지만 전진하기를 반복한다.
   */
  function advanceDamageOverTime(
    target: CombatTarget,
    effect: ActiveEffect,
    deltaSeconds: number,
    events: CombatEvent[],
  ): void {
    const weapon = weaponOf(effect.sourceThrowableId)
    const interval = weapon.effect_tick_interval_seconds
    const perTick = weapon.effect_damage_per_tick
    if (interval === null || perTick === null) {
      throw new DataMissingError(
        `${weapon.id} 는 damage_over_time 인데 틱 간격 또는 틱 피해가 없다`,
      )
    }

    let left = deltaSeconds

    while (left > 0 && effect.remainingSeconds > 0) {
      const step = Math.min(left, effect.nextTickSeconds, effect.remainingSeconds)
      effect.nextTickSeconds -= step
      effect.remainingSeconds -= step
      left -= step

      // 지속시간 안에 도달한 틱만 피해를 준다 (DEC-CONTENT-013)
      if (effect.nextTickSeconds > 0) continue

      const outcome = applyDamage(target, perTick)
      events.push({
        type: 'damaged',
        targetId: target.entity.instanceId,
        amount: perTick,
        overTime: true,
      })
      effect.nextTickSeconds = interval

      if (outcome === 'killed') {
        events.push({ type: 'killed', targetId: target.entity.instanceId })
        return
      }
      if (outcome === 'surrender_offered') {
        events.push({ type: 'surrenderOffered', targetId: target.entity.instanceId })
        // 투항 대화 중에는 효과를 제거하지 않고 정지한다 (DEC-CONTENT-013).
        // 정지는 호출자가 update() 를 안 부르는 것으로 이뤄진다.
        return
      }
    }
  }

  function advanceProjectiles(deltaSeconds: number, events: CombatEvent[]): void {
    const survivors: ProjectileInstance[] = []

    for (const projectile of projectiles) {
      const weapon = weaponOf(projectile.sourceId)

      const from = { x: projectile.x, y: projectile.y }
      const step = Math.hypot(projectile.velocityX, projectile.velocityY) * deltaSeconds
      const overshoot = projectile.travelledDistance + step - weapon.max_range

      // 최대 사거리를 넘기지 않는다. 수명은 max_range / projectile_speed 이며
      // 별도 수명 필드를 두지 않는다 (DEC-CONTENT-005).
      const ratio = overshoot > 0 && step > 0 ? (step - overshoot) / step : 1
      const to = {
        x: from.x + projectile.velocityX * deltaSeconds * ratio,
        y: from.y + projectile.velocityY * deltaSeconds * ratio,
      }

      // 경로에서 가장 먼저 만난 대상 하나 (DEC-CONTENT-005)
      let firstTarget: CombatTarget | null = null
      let firstT = Infinity
      for (const target of targets) {
        if (target.entity.health <= 0) continue
        const t = sweepHit(
          from,
          to,
          { x: target.entity.x, y: target.entity.y },
          target.collisionRadius + weapon.collision_radius,
        )
        if (t !== null && t < firstT) {
          firstT = t
          firstTarget = target
        }
      }

      projectile.x = firstTarget === null ? to.x : from.x + (to.x - from.x) * firstT
      projectile.y = firstTarget === null ? to.y : from.y + (to.y - from.y) * firstT
      projectile.travelledDistance += step * ratio

      const reachedMaxRange = overshoot >= 0

      if (firstTarget === null && !reachedMaxRange) {
        survivors.push(projectile)
        continue
      }

      if (weapon.impact_mode === 'direct') {
        // 명중하지 않고 사거리에 닿으면 피해 없이 제거한다. 관통은 없다.
        if (firstTarget !== null) resolveHit(firstTarget, weapon, events)
        else events.push({ type: 'projectileExpired', targetId: projectile.instanceId })
        continue
      }

      // area — 처음 충돌하거나 최대 사거리에 도달한 위치에서 폭발한다.
      // 최초 충돌 대상도 범위 대상에 포함하며 중복 적용하지 않는다 (DEC-CONTENT-005).
      const areaRadius = weapon.area_radius
      if (areaRadius === null) {
        throw new DataMissingError(`${weapon.id} 는 area 인데 area_radius 가 없다`)
      }

      for (const target of targets) {
        if (target.entity.health <= 0) continue
        const distance = Math.hypot(
          target.entity.x - projectile.x,
          target.entity.y - projectile.y,
        )
        if (distance - target.collisionRadius > areaRadius) continue
        resolveHit(target, weapon, events)
      }
    }

    projectiles = survivors
  }
}

/** 둔화가 반영된 이동속도 (DEC-CONTENT-013) */
export function effectiveMoveSpeed(
  baseSpeed: number,
  effects: readonly ActiveEffect[],
  weapons: readonly ThrowableWeapon[],
): number {
  const slow = effects.find((e) => e.mechanicKey === 'movement_slow')
  if (slow === undefined) return baseSpeed

  const weapon = weapons.find((w) => w.id === slow.sourceThrowableId)
  const multiplier = weapon?.effect_move_speed_multiplier ?? null
  if (multiplier === null) {
    throw new DataMissingError(
      `${slow.sourceThrowableId} 는 movement_slow 인데 이동속도 배율이 없다`,
    )
  }
  return baseSpeed * multiplier
}
