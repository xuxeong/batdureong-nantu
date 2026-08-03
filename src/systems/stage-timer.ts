// 재배 단계 제한시간 (DEC-RUN-004)
//
// 제한시간 값은 `run_schedules.farming_duration_seconds` 에서 온다. 여기에 숫자를 두지 않는다.
//
// **정지는 이 모듈이 판단하지 않는다.** 일시정지·튜토리얼·대화·정비 중에는
// 호출하는 쪽이 `tick()` 을 부르지 않는다. 그래야 "어디서 멈추는가"가 한곳
// (main.ts 의 단계 판정)에만 있고, 타이머와 작물 성장이 같은 조건으로 멈춘다.
//
// `DEC-RUN-005`(조기 종료)는 보류다. 시간 만료 말고 다른 종료 조건을 만들지 않는다.

export interface StageTimer {
  /** 남은 시간(초). 0 아래로 내려가지 않는다 */
  readonly remainingSeconds: number
  /** 전체 제한시간(초) */
  readonly durationSeconds: number
  /** 0에 도달했는가 */
  readonly expired: boolean
  /** 남은 시간이 임박 구간에 들어왔는가 (DEC-UI-018) */
  readonly urgent: boolean

  /**
   * 시간을 흘린다. 이번 호출에서 처음 0에 도달했으면 true 를 돌려준다.
   *
   * 만료를 **한 번만** 알리는 것이 중요하다. 매 프레임 true 가 나오면
   * 단계 전환이 여러 번 발행돼 흐름이 어긋난다.
   */
  tick(deltaSeconds: number): boolean

  /** 새 일차의 재배 단계를 시작한다 */
  reset(): void
}

/**
 * 남은 시간을 강조하기 시작하는 지점(초).
 *
 * 표현이지 게임 데이터가 아니다 (개발 로드맵 2절). `DEC-UI-018` 은 "임박하면
 * 강조한다"고만 정하고 기준을 정하지 않았으므로 **임의로 고른 값**이다.
 * 아트·UI 규격이 오면 함께 다시 정한다.
 */
export const URGENT_THRESHOLD_SECONDS = 10

export function createStageTimer(durationSeconds: number): StageTimer {
  if (!(durationSeconds > 0)) {
    throw new Error(
      `재배 제한시간은 0보다 커야 한다. 실제 값 ${durationSeconds} ` +
        '(run_schedules.farming_duration_seconds)',
    )
  }

  let remaining = durationSeconds
  let announced = false

  return {
    get remainingSeconds() {
      return remaining
    },
    get durationSeconds() {
      return durationSeconds
    },
    get expired() {
      return remaining <= 0
    },
    get urgent() {
      return remaining > 0 && remaining <= URGENT_THRESHOLD_SECONDS
    },

    tick(deltaSeconds) {
      if (deltaSeconds <= 0 || announced) return false

      remaining = Math.max(0, remaining - deltaSeconds)
      if (remaining > 0) return false

      announced = true
      return true
    },

    reset() {
      remaining = durationSeconds
      announced = false
    },
  }
}
