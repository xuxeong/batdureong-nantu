// 걷기 표현의 순수 계산 (DEC-ART-004)
//
// `main.ts` 가 좌표와 dt 를 주면 이 파일이 **위상·방향·회전각만** 돌려준다.
// 상태(개체별 직전 좌표)는 부르는 쪽이 들고 있고 여기는 아무것도 기억하지 않는다.
//
// ── 왜 따로 빼나 ───────────────────────────────────────────
//
// 8/7~8/8 에 걷기 bob 과 야생동물 회전을 `main.ts` 안에 짰는데, 그 파일은 DOM 과
// 씬 전환이 섞여 있어 단위 테스트가 붙지 않는다. 계산만 떼면 "멈춘 것으로 볼
// 속도", "세로 이동이면 정면", "멈추면 마지막 각도 유지" 같은 규칙을 코드로
// 검증할 수 있다 — 전부 확정문에서 온 규칙이라 조용히 깨지면 안 된다.
//
// **표현이므로 승인 데이터가 아니다.** 다만 걸음 속도만은 승인 이동속도에
// 비례시킨다. 부르는 쪽이 그 값을 넘긴다.

/**
 * 좌·우 교체 스프라이트를 쓸 방향. 정면이면 null.
 *
 * `DEC-ART-004` 가 *"좌·우 이동 방향에 따라 교체하는 스프라이트"* 와
 * *"상하 이동과 정지 상태는 기존 정면 스프라이트를 그대로 쓴다"* 로 나눠서,
 * 가로 이동이 세로보다 클 때만 방향이 생긴다.
 */
export type Facing = 'left' | 'right' | null

/** 한 프레임의 걷기 상태. 멈춰 있으면 위상이 null 이다 */
export interface WalkStep {
  /** 0~1 위상. 한 바퀴가 한 걸음이다. 멈췄으면 null */
  phase: number | null
  facing: Facing
}

/** 걷기 계산에 필요한 값. 전부 표현이라 승인 데이터가 아니다 */
export interface WalkConfig {
  /** 한 걸음에 걸리는 시간(초) */
  stepSeconds: number
  /** 이 속도(월드 단위/초) 아래면 멈춘 것으로 본다 */
  movingSpeed: number
}

/**
 * 좌표 변화로 이동을 판정해 다음 위상과 방향을 낸다.
 *
 * **걸음 속도를 실제 이동 속도에 비례시킨다.** 고정 주기로 두면 회복 중이거나
 * 둔화가 걸려 느리게 걸을 때도 같은 박자로 튀어서 미끄러지는 것처럼 보인다.
 * `referenceSpeed` 는 승인 데이터의 기준 이동속도이며 0 이면 비례를 포기하고
 * 멈춘 것으로 다룬다 — 0 으로 나누면 위상이 `NaN` 이 되어 그림이 사라진다.
 *
 * @param phase 직전 위상 0~1
 * @param dt 지난 시간(초). 0 이하면 속도를 잴 수 없다
 */
export function walkStep(
  phase: number,
  dx: number,
  dy: number,
  dt: number,
  referenceSpeed: number,
  config: WalkConfig,
): WalkStep {
  const speed = dt > 0 ? Math.hypot(dx, dy) / dt : 0

  // 멈추면 착지 자세로 되돌린다. 공중에서 굳으면 떠 있는 것처럼 보인다.
  if (speed < config.movingSpeed || referenceSpeed <= 0) {
    return { phase: null, facing: null }
  }

  const rate = speed / referenceSpeed / config.stepSeconds
  // 세로가 더 크면 정면이다. **마지막 방향을 기억하지 않는다** — 확정문이 정지와
  // 상하를 정면으로 묶어서, 기억하면 위로 걸을 때 직전 좌우 그림이 남는다.
  const facing: Facing = Math.abs(dx) <= Math.abs(dy) ? null : dx < 0 ? 'left' : 'right'
  return { phase: (phase + dt * rate) % 1, facing }
}

/**
 * 야생동물의 진행 방향 (`DEC-ART-004`).
 *
 * **멈추면 마지막 각도를 유지한다.** 확정문이 그렇게 정했고, 멈춘 프레임에
 * 각도를 버리면 설 때마다 홱 돌아간다. 그래서 이동이 없으면 받은 각도를
 * 그대로 돌려준다.
 */
export function headingStep(
  angle: number,
  dx: number,
  dy: number,
  dt: number,
  movingSpeed: number,
): number {
  const speed = dt > 0 ? Math.hypot(dx, dy) / dt : 0
  if (speed < movingSpeed) return angle
  return Math.atan2(dy, dx)
}
