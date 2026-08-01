// 고정 timestep 게임 루프.
//
// 왜 고정 timestep인가: 프레임 시간이 그대로 dt 로 들어가면 같은 입력이 기기마다
// 다른 결과를 낸다. 작물 성장·투사체 사거리·투항 판정이 전부 시간 기반이라
// 재현 안 되는 버그가 남는다. 시뮬레이션은 항상 같은 폭으로 전진시키고
// 렌더만 남는 시간(alpha)으로 보간한다.
//
// 여기 있는 값은 게임 데이터가 아니라 실행 방식이다 (DEC-PIPELINE-016 대상 아님).
// 작물 성장 시간·사거리 같은 수치는 이 파일에 오지 않는다.

/** 시뮬레이션 1스텝 = 1/60초 */
const STEP_SECONDS = 1 / 60

/**
 * 한 프레임에 처리할 최대 시간. 탭이 오래 멈췄다 돌아왔을 때
 * 밀린 스텝을 전부 돌면 프레임이 더 늦어지고 그게 다시 쌓인다.
 */
const MAX_FRAME_SECONDS = 0.25

export type PauseCause = 'dialogue' | 'pause_menu' | 'focus_lost'

export interface LoopCallbacks {
  /** 시뮬레이션 한 스텝. dt 는 항상 STEP_SECONDS 다 */
  update(dtSeconds: number): void
  /** 그리기. alpha 는 다음 스텝까지의 진행률 0~1 */
  render(alpha: number): void
}

export interface GameLoop {
  start(): void
  stop(): void

  /** 정지한다. 이미 정지 중이면 사유만 추가된다 */
  pause(cause: PauseCause): void
  /** 해당 사유를 푼다. 남은 사유가 없을 때만 실제로 재개한다 */
  resume(cause: PauseCause): void
  /** 사유와 무관하게 전부 푼다. 런 전환처럼 상태를 갈아끼울 때 쓴다 */
  resumeAll(): void

  readonly paused: boolean
  /** 지금 걸려 있는 정지 사유들 */
  pauseCauses(): PauseCause[]

  /**
   * 시간 배율. 회복 퀵메뉴가 열리면 게임 전체 속도를 크게 낮춘다 (DEC-INPUT-008).
   *
   * **실제 배율값은 아직 정해지지 않았다.** 퀵메뉴는 P2라 지금 호출하는 곳이 없다.
   * 값을 여기에 상수로 박지 않는다 — 정해지면 호출하는 쪽에서 넘긴다.
   */
  setTimeScale(scale: number): void
}

export interface LoopOptions {
  /**
   * 브라우저 탭·창이 포커스를 잃으면 자동 정지한다 (DEC-INPUT-009).
   *
   * 확정 규칙은 "제한시간이 흐르는 중"으로 한정하지만, 시간이 흐르지 않는 화면에서
   * 멈춰 봐야 진행되는 것이 없으므로 항상 정지한다. 규칙과 충돌하지 않는 상위집합이다.
   *
   * **자동으로 재개하지는 않는다.** 재개 확인 절차는 `DEC-UI-022`가 보류라
   * 임의로 만들지 않는다. 포커스 복귀는 일시정지 화면을 여는 것으로 처리하고
   * 재개는 플레이어가 한다 (DEC-UI-014 — Esc 일시정지).
   */
  autoPauseOnBlur?: boolean
  /** 포커스를 잃어 정지했을 때 알린다. 화면 매니저가 일시정지 오버레이를 연다 */
  onFocusLost?: () => void
}

export function createGameLoop(callbacks: LoopCallbacks, options: LoopOptions = {}): GameLoop {
  const { autoPauseOnBlur = true, onFocusLost } = options

  const causes = new Set<PauseCause>()
  let running = false
  let rafId = 0
  let lastMs = 0
  let accumulator = 0
  let timeScale = 1

  function frame(nowMs: number): void {
    if (!running) return
    rafId = requestAnimationFrame(frame)

    let elapsed = (nowMs - lastMs) / 1000
    lastMs = nowMs
    if (elapsed > MAX_FRAME_SECONDS) elapsed = MAX_FRAME_SECONDS

    if (causes.size === 0) {
      accumulator += elapsed * timeScale
      while (accumulator >= STEP_SECONDS) {
        callbacks.update(STEP_SECONDS)
        accumulator -= STEP_SECONDS
      }
    }

    // 정지 중에도 그린다. 대화·정비 오버레이 뒤로 필드가 계속 보여야 한다 (DEC-UI-014).
    callbacks.render(accumulator / STEP_SECONDS)
  }

  function handleBlur(): void {
    if (!running || causes.has('focus_lost')) return
    causes.add('focus_lost')
    onFocusLost?.()
  }

  return {
    start() {
      if (running) return
      running = true
      lastMs = performance.now()
      accumulator = 0
      if (autoPauseOnBlur) {
        window.addEventListener('blur', handleBlur)
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) handleBlur()
        })
      }
      rafId = requestAnimationFrame(frame)
    },

    stop() {
      running = false
      cancelAnimationFrame(rafId)
      window.removeEventListener('blur', handleBlur)
    },

    pause(cause) {
      causes.add(cause)
    },

    resume(cause) {
      causes.delete(cause)
      // 정지 중 흘러간 시간이 쌓여 있으면 재개하자마자 여러 스텝이 한꺼번에 돈다.
      accumulator = 0
    },

    resumeAll() {
      causes.clear()
      accumulator = 0
    },

    get paused() {
      return causes.size > 0
    },

    pauseCauses() {
      return [...causes]
    },

    setTimeScale(scale) {
      timeScale = scale
    },
  }
}
