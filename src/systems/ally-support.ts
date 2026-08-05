// 영입 주민의 습격 지원 공격 (DEC-RESIDENT-021, DEC-RESIDENT-045, DEC-UI-012)
//
// ── 이 시스템이 하지 않는 것이 더 많다 ─────────────────────
//
// `DEC-RESIDENT-021` 이 지원 주민을 **일부러 얇게** 정의했다. 경로 탐색도, 체력도,
// 충돌도, 사망도 없다. 정해진 자리에 서서 주기적으로 한 번씩 때리는 것이 전부다.
// 그래서 여기에 추적·회피·타깃 선택 같은 것을 더하면 확정 규칙을 넘는 것이 된다.
//
//   - 플레이어를 따라다니거나 경로 탐색을 하지 않는다
//   - 적의 공격 대상이 되지 않고 체력과 사망 상태를 가지지 않는다
//   - 플레이어와 충돌하지 않고 플레이어의 공격을 막지 않는다
//   - 지원 공격은 플레이어, 작물, 다른 아군에게 피해를 주지 않는다
//
// ── 피해를 여기서 적용하지 않는다 ──────────────────────────
//
// `update()` 는 "지금 때렸다" 와 피해량만 돌려주고 체력은 건드리지 않는다.
// 확정문이 *"지원 공격으로 적대 주민이 투항 체력 기준에 도달하면 정상적으로 투항
// 대화를 시작한다"* 로 정했는데, 투항 발동 판정은 `combat.ts` 의 피해 경로 한 곳에
// 있다. 여기서 체력을 직접 깎으면 그 경로를 우회하게 되고 지원 공격만 투항을
// 발동시키지 못한다.
//
// **체력을 0으로 만들 수 없다**는 제한도 같은 이유로 `combat.ts` 쪽에 있다.
//
// ── 수치는 승인 데이터가 단일 원본이다 ─────────────────────
//
// 피해량·첫 공격 지연·공격 간격은 `resident_support_attack_profiles.csv` 에서 온다
// (`DEC-RESIDENT-045`). 여기에 기본값을 두지 않는다 — 프로필이 없으면 부르는 쪽이
// 지원을 세우지 않고 데이터 오류로 보고한다.

/** `resident_support_attack_profiles.csv` 한 행에서 온 값 (DEC-RESIDENT-045) */
export interface AllySupportProfile {
  damage: number
  firstAttackDelaySeconds: number
  attackIntervalSeconds: number
}

export interface AllySupportOptions {
  residentId: string
  /** 맵의 `ally_support` 지점 (DEC-CONTENT-016). 런 내내 움직이지 않는다 */
  x: number
  y: number
  profile: AllySupportProfile
}

export interface AllySupport {
  readonly residentId: string
  readonly x: number
  readonly y: number

  /**
   * 방금 공격했다는 표시가 남은 정도 1~0 (DEC-UI-012 — "지원 공격이 발생하는
   * 순간을 알 수 있게 표시한다").
   *
   * **다음 공격까지 남은 시간은 내보내지 않는다.** 같은 확정문이 금지했다.
   * 그래서 이 값은 공격 뒤에만 줄어들고 평소에는 0이다.
   */
  readonly attackFlash: number

  /**
   * 시간을 흘린다. 이번 호출에서 공격이 일어났으면 피해량을, 아니면 null 을 준다.
   *
   * 한 호출에서 두 번 이상 때리지 않는다. 프레임이 길게 밀렸을 때 몰아서 때리면
   * 화면에는 한 번만 보이는데 체력은 여러 번 깎인다.
   */
  update(deltaSeconds: number): number | null
}

/** 공격 표시가 남는 시간(초). 표현이라 승인 데이터가 아니다 (개발 로드맵 2절) */
const ATTACK_FLASH_SECONDS = 0.35

export function createAllySupport(options: AllySupportOptions): AllySupport {
  const { residentId, x, y, profile } = options

  // 첫 공격은 지연 뒤다. 습격이 시작하자마자 때리면 전투 전 대화가 끝나는 순간과
  // 겹쳐 무엇이 일어났는지 안 보인다 (DEC-RESIDENT-045 가 지연을 둔 이유).
  let untilNextAttack = profile.firstAttackDelaySeconds
  let flash = 0

  return {
    residentId,
    x,
    y,

    get attackFlash() {
      return flash
    },

    update(deltaSeconds) {
      if (flash > 0) flash = Math.max(0, flash - deltaSeconds / ATTACK_FLASH_SECONDS)

      untilNextAttack -= deltaSeconds
      if (untilNextAttack > 0) return null

      // 밀린 시간을 몰아서 때리지 않는다. 다음 간격을 새로 시작한다.
      untilNextAttack = profile.attackIntervalSeconds
      flash = 1
      return profile.damage
    },
  }
}
