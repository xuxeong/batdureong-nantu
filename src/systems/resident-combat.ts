// 적대 주민 전투 — 추적·공격·투사체 (로드맵 8/3 최수정)
//
// DEC-CONTENT-008 · DEC-CONTENT-009 · DEC-RESIDENT-016 · DEC-RESIDENT-039
//
// 파일 소유: 최수정 (로드맵 7-2). `combat.ts` 에서 분리한 이유는 방향이 반대라서다 —
// `combat.ts` 는 플레이어가 적에게 가하는 것, 이 파일은 주민이 플레이어에게 가하는 것.
// 한 파일에 넣으면 "자해·아군 오사 없음"(DEC-CONTENT-005)을 지키는 경계가 흐려진다.
//
// ── 이 파일이 지키는 것 ────────────────────────────────────
//
// **최종 수치는 프로필 × 전투 보정이고, 그 계산은 조우 시작에 딱 한 번 한다**
// (DEC-CONTENT-008). 매 프레임 배율을 곱하면 둔화가 걸린 상태에서 보정이 다시
// 적용되며 값이 계속 흔들린다 — 화면에서는 "가끔 빨라진다"로만 보인다.
//
// **예고가 없다** (DEC-CONTENT-008). 공격 전 대기시간, 바닥 위험 범위, 근접 부채꼴,
// 조준선을 만들지 않는다. 재사용 대기가 끝나고 사거리 안이면 그 순간 피해가 들어간다.
// 여기에 windup 을 넣고 싶어지는 지점이 몇 군데 있는데 확정 규칙이 명시적으로 금지한다.
//
// 수치는 하나도 없다. `resident_combat_profiles` 와 `resident_combat_modifiers` 에서 온다.

import type {
  ResidentCombatModifier,
  ResidentCombatProfile,
  ThrowableWeapon,
} from '../data/types.ts'
import type { HostileResidentInstance, ProjectileInstance } from '../state/types.ts'
import { DataMissingError } from '../data/run-config.ts'
import { effectiveMoveSpeed } from './combat.ts'

/**
 * 조우 하나 동안 고정되는 적대 주민의 최종 수치.
 *
 * 콘텐츠가 아니라 런타임 상태다. CSV 에 저장하지 않는다 (DEC-CONTENT-008).
 */
export interface HostileRuntime {
  readonly entity: HostileResidentInstance
  readonly profileId: string

  readonly maxHealth: number
  readonly baseMoveSpeed: number
  readonly attackDamage: number
  readonly attackRange: number
  readonly attackCooldownSeconds: number
  readonly collisionRadius: number
  readonly pattern: ResidentCombatProfile['attack_pattern_key']

  /** max(1, floor(보정 후 최대 체력 × surrender_health_ratio)) (DEC-CONTENT-008) */
  readonly surrenderThreshold: number

  /**
   * `ranged_chase` 전용 투사체 수치. `melee_chase` 면 null.
   *
   * 위쪽 수치들과 달리 **전투 보정이 곱해지지 않은 원본이다.** DEC-CONTENT-009 의
   * 보정은 최대 체력·이동속도·공격 피해·공격 대기 넷만 바꾼다. 같은 자리에 평평하게
   * 두면 다음 사람이 여기에도 배율을 곱한다.
   */
  readonly ranged: {
    readonly speed: number
    readonly radius: number
    readonly maxRange: number
  } | null

  cooldownRemaining: number
}

export interface PlayerView {
  x: number
  y: number
  collisionRadius: number
}

export type ResidentCombatEvent =
  | { type: 'attacked'; instanceId: string }
  | { type: 'projectileFired'; instanceId: string; projectileId: string }
  | { type: 'playerDamaged'; amount: number; sourceInstanceId: string }

export interface ResidentCombatSystem {
  /** 적대 주민이 쏜 투사체. 플레이어하고만 충돌한다 (DEC-CONTENT-008) */
  readonly projectiles: readonly ProjectileInstance[]

  spawn(options: SpawnOptions): HostileRuntime
  remove(instanceId: string): void
  reset(): void

  /**
   * 재배·습격의 실제 플레이 시간이 흐를 때만 부른다.
   * 투항 대화 중에는 부르지 않는다 — 그것이 DEC-RESIDENT-039 의 "전투 타이머 정지"다.
   */
  update(deltaSeconds: number, player: PlayerView): ResidentCombatEvent[]

  /** 투항 대화 시작 시. 진행 중인 공격을 취소하고 적대 투사체를 제거한다 */
  suspendForSurrender(): void
}

export interface SpawnOptions {
  instanceId: string
  residentId: string
  profile: ResidentCombatProfile
  modifier: ResidentCombatModifier
  x: number
  y: number
}

export interface ResidentCombatOptions {
  /** 둔화 배율을 읽기 위해 필요하다 */
  weapons: readonly ThrowableWeapon[]
}

export function createResidentCombat(options: ResidentCombatOptions): ResidentCombatSystem {
  const { weapons } = options

  let hostiles: HostileRuntime[] = []
  let projectiles: ProjectileInstance[] = []
  let projectileSerial = 0

  return {
    get projectiles() {
      return projectiles
    },

    spawn({ instanceId, residentId, profile, modifier, x, y }) {
      // 기본 프로필에 전투 보정 하나를 적용해 이번 조우의 최종 수치를 만든다.
      // 여기서 한 번만 계산한다 (DEC-CONTENT-008, DEC-CONTENT-009).
      const maxHealth = Math.max(
        1,
        Math.floor(profile.max_health * modifier.max_health_multiplier),
      )

      const runtime: HostileRuntime = {
        entity: {
          instanceId,
          residentId,
          x,
          y,
          // 현재 체력을 최종 최대 체력으로 초기화한다 (DEC-CONTENT-008)
          health: maxHealth,
          combatState: modifier.combat_state,
          effects: [],
        },
        profileId: profile.id,
        maxHealth,
        baseMoveSpeed: profile.move_speed * modifier.move_speed_multiplier,
        attackDamage: Math.max(
          1,
          Math.floor(profile.attack_damage * modifier.attack_damage_multiplier),
        ),
        attackRange: profile.attack_range,
        attackCooldownSeconds: profile.attack_cooldown_seconds * modifier.attack_cooldown_multiplier,
        collisionRadius: profile.collision_radius,
        pattern: profile.attack_pattern_key,
        surrenderThreshold: Math.max(
          1,
          Math.floor(maxHealth * profile.surrender_health_ratio),
        ),
        ranged: profile.attack_pattern_key === 'ranged_chase' ? rangedOf(profile) : null,
        cooldownRemaining: 0,
      }

      hostiles.push(runtime)
      return runtime
    },

    remove(instanceId) {
      hostiles = hostiles.filter((h) => h.entity.instanceId !== instanceId)
    },

    reset() {
      hostiles = []
      projectiles = []
    },

    suspendForSurrender() {
      // 진행 중인 주민의 공격을 취소하고 적대 투사체를 제거한다.
      // 이것만이 투항 대화 중 전투 상태 보존의 예외다 (DEC-RESIDENT-039).
      // 체력·위치·효과는 건드리지 않는다.
      projectiles = []
    },

    update(deltaSeconds, player) {
      const events: ResidentCombatEvent[] = []
      if (deltaSeconds <= 0) return events

      for (const hostile of hostiles) {
        if (hostile.entity.health <= 0) continue

        hostile.cooldownRemaining = Math.max(0, hostile.cooldownRemaining - deltaSeconds)

        // 공격 거리 판정은 중심점 사이의 거리다 (DEC-CONTENT-008).
        // 충돌 반경을 빼지 않는다 — 그러면 데이터의 attack_range 가 뜻하는 거리가
        // 주민 크기에 따라 달라진다.
        const dx = player.x - hostile.entity.x
        const dy = player.y - hostile.entity.y
        const distance = Math.hypot(dx, dy)
        const inRange = distance <= hostile.attackRange

        if (!inRange) {
          // 플레이어를 향해 직선으로 이동한다. 길찾기·장애물 회피 없음.
          // 둔화는 이동속도에만 곱한다 — 공격 주기와 투사체 속도는 그대로다
          // (DEC-CONTENT-008, DEC-CONTENT-013).
          const speed = effectiveMoveSpeed(hostile.baseMoveSpeed, hostile.entity.effects, weapons)
          const step = Math.min(speed * deltaSeconds, distance)
          if (distance > 0) {
            hostile.entity.x += (dx / distance) * step
            hostile.entity.y += (dy / distance) * step
          }
          continue
        }

        // 사거리 안이면 이동을 멈춘다. 재사용 대기 중이어도 물러나지 않는다.
        if (hostile.cooldownRemaining > 0) continue

        hostile.cooldownRemaining = hostile.attackCooldownSeconds
        events.push({ type: 'attacked', instanceId: hostile.entity.instanceId })

        if (hostile.pattern === 'melee_chase') {
          // 예고 없이 즉시 확정 피해 (DEC-CONTENT-008)
          events.push({
            type: 'playerDamaged',
            amount: hostile.attackDamage,
            sourceInstanceId: hostile.entity.instanceId,
          })
          continue
        }

        // ranged_chase — 현재 위치를 향해 즉시 직선 투사체를 쏜다.
        // 발사 후 추적하지 않는다.
        const speed = requireRanged(hostile).speed
        projectileSerial += 1
        const projectileId = `resident_projectile.${projectileSerial}`
        projectiles.push({
          instanceId: projectileId,
          source: 'resident',
          sourceId: hostile.profileId,
          x: hostile.entity.x,
          y: hostile.entity.y,
          velocityX: (dx / (distance || 1)) * speed,
          velocityY: (dy / (distance || 1)) * speed,
          travelledDistance: 0,
        })
        events.push({
          type: 'projectileFired',
          instanceId: hostile.entity.instanceId,
          projectileId,
        })
      }

      advanceProjectiles(deltaSeconds, player, events)
      return events
    },
  }

  /**
   * 주민 투사체 진행. **플레이어하고만 충돌한다** (DEC-CONTENT-008).
   * 작물·경작지·다른 주민·플레이어 투사체를 전부 무시한다.
   */
  function advanceProjectiles(
    deltaSeconds: number,
    player: PlayerView,
    events: ResidentCombatEvent[],
  ): void {
    const survivors: ProjectileInstance[] = []

    for (const projectile of projectiles) {
      const hostile = hostiles.find((h) => h.profileId === projectile.sourceId)
      if (hostile === undefined) continue // 쏜 주민이 사라지면 투사체도 사라진다

      const { maxRange, radius } = requireRanged(hostile)

      const from = { x: projectile.x, y: projectile.y }
      const step = Math.hypot(projectile.velocityX, projectile.velocityY) * deltaSeconds
      const overshoot = projectile.travelledDistance + step - maxRange
      const ratio = overshoot > 0 && step > 0 ? (step - overshoot) / step : 1

      const to = {
        x: from.x + projectile.velocityX * deltaSeconds * ratio,
        y: from.y + projectile.velocityY * deltaSeconds * ratio,
      }

      const hit = segmentHitsCircle(
        from,
        to,
        { x: player.x, y: player.y },
        player.collisionRadius + radius,
      )

      projectile.x = to.x
      projectile.y = to.y
      projectile.travelledDistance += step * ratio

      if (hit) {
        // 플레이어에게 한 번 피해를 주고 제거한다
        events.push({
          type: 'playerDamaged',
          amount: hostile.attackDamage,
          sourceInstanceId: hostile.entity.instanceId,
        })
        continue
      }
      // 최대 사거리에 도달하면 피해 없이 제거한다
      if (overshoot >= 0) continue

      survivors.push(projectile)
    }

    projectiles = survivors
  }
}

/**
 * `ranged_chase` 프로필의 투사체 수치를 꺼낸다.
 *
 * 셋 중 하나라도 없으면 데이터 오류다. 기본값으로 메우지 않는다 (AGENTS.md 6절).
 * 검증기가 이미 차단하지만, 검증을 건너뛴 경로로 들어와도 조용히 0으로 날아가는
 * 투사체가 생기지 않게 여기서도 막는다.
 */
function rangedOf(profile: ResidentCombatProfile): HostileRuntime['ranged'] {
  const { projectile_speed, projectile_radius, projectile_max_range } = profile

  if (projectile_speed === null || projectile_radius === null || projectile_max_range === null) {
    throw new DataMissingError(
      `${profile.id} 는 ranged_chase 인데 투사체 수치가 비어 있다 (DEC-CONTENT-008)`,
    )
  }
  // projectile_max_range 는 attack_range 이상이어야 승인된다 (DEC-CONTENT-008).
  // 그래도 확인한다 — 이 조건이 깨지면 주민이 절대 맞힐 수 없는 거리에서 계속 쏜다.
  if (projectile_max_range < profile.attack_range) {
    throw new DataMissingError(
      `${profile.id} 의 projectile_max_range 가 attack_range 보다 작다 (DEC-CONTENT-008)`,
    )
  }

  return { speed: projectile_speed, radius: projectile_radius, maxRange: projectile_max_range }
}

function requireRanged(hostile: HostileRuntime): NonNullable<HostileRuntime['ranged']> {
  if (hostile.ranged === null) {
    throw new DataMissingError(`${hostile.profileId} 는 원거리 주민이 아니다`)
  }
  return hostile.ranged
}

/** 선분이 원과 만나는가. 빠른 투사체가 플레이어를 뛰어넘지 않게 한다 */
function segmentHitsCircle(
  from: { x: number; y: number },
  to: { x: number; y: number },
  center: { x: number; y: number },
  radius: number,
): boolean {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const lengthSquared = dx * dx + dy * dy

  if (lengthSquared === 0) {
    return Math.hypot(center.x - from.x, center.y - from.y) <= radius
  }

  let t = ((center.x - from.x) * dx + (center.y - from.y) * dy) / lengthSquared
  t = Math.min(Math.max(t, 0), 1)

  const closestX = from.x + dx * t
  const closestY = from.y + dy * t
  return Math.hypot(center.x - closestX, center.y - closestY) <= radius
}
