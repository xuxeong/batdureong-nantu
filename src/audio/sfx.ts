// 효과음 재생 (DEC-ART-004, DEC-UI-027)
//
// ── 이 파일이 하는 것과 안 하는 것 ─────────────────────────
//
// **논리 에셋 ID 를 받아 소리를 낸다. 그것뿐이다.** 어떤 상황에 어떤 소리가 나는지는
// 부르는 쪽(`main.ts`)이 정하고, 어느 파일인지는 `render/assets.ts` 가 안다.
// 여기에 파일 경로도 상황 판단도 두지 않는다.
//
// **소리가 없어도 게임은 그대로 돈다.** 파일이 없거나 브라우저가 재생을 막으면
// 조용히 넘어간다 — 아트와 같은 규칙이다 (`AGENTS.md` 6절). 승인 데이터 누락과
// 다르다는 것도 같다.
//
// ── 왜 `Audio` 를 매번 새로 만드나 ─────────────────────────
//
// 하나를 재사용하면 **겹쳐 나지 않는다.** 낫을 빠르게 두 번 휘두르면 두 번째가
// 첫 번째를 자른다. 브라우저는 같은 URL 을 캐시하므로 새로 만들어도 다시 받지 않는다.
//
// ── 브라우저가 첫 소리를 막는다 ────────────────────────────
//
// 사용자가 화면을 한 번도 누르지 않았으면 자동 재생이 거부된다. 거부는 예외가
// 아니라 거부된 Promise 로 오므로 삼킨다. 타이틀에서 `게임 시작` 을 누르는 순간
// 그 제한이 풀리므로 실제 플레이 중에는 문제가 되지 않는다.

import { assetUrl } from '../render/assets.ts'

const isDevBuild = import.meta.env.VITE_BUILD_MODE !== 'submission'

export interface Sfx {
  /**
   * 논리 에셋 ID 로 한 번 재생한다. 없으면 아무 일도 하지 않는다.
   *
   * `null`·`undefined` 를 받는 이유는 승인 데이터의 `assets?.sfx` 가 그대로
   * 넘어오기 때문이다. 부르는 쪽마다 가드를 두면 그중 하나는 빠진다.
   */
  play(assetId: string | null | undefined): void
  /** 소리를 낼지. 끄면 이후 `play()` 가 조용히 넘어간다 */
  setEnabled(enabled: boolean): void
  /** 0~1. 범위 밖은 잘라 넣는다 */
  setVolume(volume: number): void
}

export function createSfx(): Sfx {
  let enabled = true
  let volume = 1
  /** 경고를 ID 당 한 번만 남긴다. 매 프레임 부를 수 있으므로 안 그러면 콘솔이 잠긴다 */
  const warned = new Set<string>()

  return {
    play(assetId) {
      if (!enabled || assetId === null || assetId === undefined) return

      const url = assetUrl(assetId)
      if (url === null) {
        if (isDevBuild && !warned.has(assetId)) {
          warned.add(assetId)
          console.warn(
            `[소리] ${assetId} 에 해당하는 파일이 assets/final/ 에 없다. ` +
              '아직 안 붙인 구간이면 조용히 넘어가고, 아니면 ID 오타다',
          )
        }
        return
      }

      const audio = new Audio(url)
      audio.volume = volume
      // 자동 재생 거부는 거부된 Promise 로 온다. 게임을 멈출 이유가 아니다.
      void audio.play().catch(() => {})
    },

    setEnabled(next) {
      enabled = next
    },

    setVolume(next) {
      volume = Math.min(1, Math.max(0, next))
    },
  }
}
