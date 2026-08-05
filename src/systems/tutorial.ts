// 튜토리얼 진행 (DEC-UI-030, DEC-RUN-003, DEC-CONTENT-025)
//
// ── 이 모듈이 갖는 것은 "지금 몇 번째 안내인가" 뿐이다 ─────
//
// 안내 문구도, 순서도, 어떤 조작이 넘기는지도 전부 승인 데이터에서 온다.
// 여기서 하는 일은 **완료 키가 들어오면 다음으로 넘기는 것** 하나다.
//
//   - 순서의 단일 원본은 `step_order` 다 (`DEC-CONTENT-025`). 여기서 `stage` 로
//     다시 정렬하지 않는다 — 결정 로그가 `stage` 순서를 고정하지 않기로 했다.
//   - `completion_key` 는 고정 일곱 개이고 코드가 판정한다. 새로 만들 수 없다.
//   - 시간제한이 없다 (`DEC-RUN-003`). 그래서 이 모듈에 시간이 없다.
//
// ── 같은 키가 여러 번 들어와도 한 칸만 간다 ────────────────
//
// 심기를 두 번 하면 `plant_crop` 이 두 번 온다. 현재 안내의 키와 같을 때만
// 넘기므로 두 번째는 무시된다. 반대로 **아직 오지 않은 안내의 키를 미리 눌러도
// 넘어가지 않는다** — 안내를 읽지 않고 지나가는 길을 만들지 않는다.

import type { TutorialStep } from '../data/types.ts'

export interface TutorialProgress {
  /** 지금 보여 줄 안내. 전부 끝났으면 null */
  readonly current: TutorialStep | null
  /** 현재 몇 번째인가 (1부터). 끝났으면 전체 개수와 같다 */
  readonly position: number
  readonly total: number
  readonly finished: boolean

  /**
   * 조작 성공을 알린다. 현재 안내의 `completion_key` 와 같으면 다음으로 넘어간다.
   *
   * 넘어갔으면 true. 다른 키였거나 이미 끝났으면 false 다 — 부르는 쪽이 화면을
   * 다시 그릴지 판단하는 데 쓴다.
   */
  complete(key: string): boolean
}

/**
 * 승인 안내를 `step_order` 순으로 세운다.
 *
 * 빈 배열이면 `finished` 로 시작한다. 승인 행이 없는 것은 데이터 문제이지
 * 여기서 임시 안내를 지어낼 자리가 아니다 — 부르는 쪽이 데이터 오류로 올린다.
 */
export function createTutorialProgress(steps: readonly TutorialStep[]): TutorialProgress {
  const ordered = [...steps].sort((a, b) => a.step_order - b.step_order)
  let index = 0

  return {
    get current() {
      return index < ordered.length ? ordered[index] : null
    },
    get position() {
      return Math.min(index + 1, ordered.length)
    },
    get total() {
      return ordered.length
    },
    get finished() {
      return index >= ordered.length
    },

    complete(key) {
      if (index >= ordered.length) return false
      if (ordered[index].completion_key !== key) return false
      index += 1
      return true
    },
  }
}
