// 배경음 재생 (DEC-ART-004, DEC-UI-027)
//
// ── 이 파일이 하는 것과 안 하는 것 ─────────────────────────
//
// **논리 에셋 ID 를 받아 그 트랙을 반복 재생한다. 그것뿐이다.** 어느 상황에 어느
// 트랙이 흐르는지는 부르는 쪽이 정하고, 어느 파일인지는 `render/assets.ts` 가 안다.
// `sfx.ts` 와 같은 규칙이다 — 여기에 파일 경로도 상황 판단도 두지 않는다.
//
// **아직 부르는 곳이 없다.** BGM 6종은 어떤 콘텐츠에도 안 붙는 시스템 레벨 소리라
// `content_assets.csv` 부모가 없고, 고정 목록(`ui_system_asset_id`)은 `DEC-ART-004`
// 가 구간을 `ui`·`logo`·`hud`·`font` 넷으로 못박아 `bgm` 을 넣을 수 없다.
// **`DEC-ART-005` 대체가 선행이다** (`docs/submission/SOUND_ASSET_INDEX.md`).
// 그 대체가 확정되면 여기가 아니라 호출부만 생긴다 — 이 파일은 어느 안으로
// 결정되든 그대로다.
//
// ── 왜 `Audio` 하나를 재사용하나 ───────────────────────────
//
// `sfx.ts` 와 정반대다. 효과음은 겹쳐 나야 해서 매번 새로 만들지만, **배경음은
// 겹치면 안 된다.** 두 트랙이 같이 흐르는 것은 어떤 경우에도 의도가 아니므로
// 요소 하나를 돌려쓰고 `src` 만 바꾼다. 새로 만들면 이전 것을 멈추는 책임이
// 호출부로 넘어가고, 그 책임은 언젠가 빠진다.
//
// **같은 트랙을 다시 요청하면 아무것도 하지 않는다.** 재배 → 정비가 같은
// `farm.mp3` 를 쓰는데(`SOUND_ASSET_INDEX.md`) 화면이 바뀔 때마다 다시 틀면
// 이어져야 할 음악이 매번 처음으로 튄다. 매 프레임 부르는 동기화 코드가
// 붙어도 안전해야 한다 — `ui/pause.ts` 의 `show()` 와 같은 이유다.
//
// ── 브라우저가 첫 트랙을 막는다 ────────────────────────────
//
// **여기서는 효과음보다 심각하다.** 첫 트랙은 타이틀 화면이라 플레이어가 아직
// 아무것도 누르지 않은 시점에 요청된다. 자동 재생은 거부되고, 효과음처럼
// 삼키기만 하면 **그 뒤로 영영 안 나온다** — 다음 요청은 화면이 바뀔 때까지
// 오지 않기 때문이다.
//
// 그래서 거부당한 트랙을 기억해 두고 **첫 조작 한 번에 다시 시도한다.**
// 브라우저 제약을 푸는 것이지 게임 규칙이 아니다.
//
// ── 페이드는 없다 ──────────────────────────────────────────
//
// 트랙 전환을 즉시로 둔다. 페이드 길이는 정해진 곳이 없고, 여기서 임의로
// 정하면 결정 로그에 없는 규칙이 코드에만 생긴다 (`AGENTS.md` 6절).
// 필요하다고 판단되면 기획 결정을 거쳐 넣는다.

import { assetUrl } from '../render/assets.ts'

const isDevBuild = import.meta.env.VITE_BUILD_MODE !== 'submission'

/** 자동 재생 제한을 푸는 조작. 어느 쪽이 먼저 와도 되므로 둘 다 듣는다 */
const UNLOCK_EVENTS = ['pointerdown', 'keydown'] as const

export interface Bgm {
  /**
   * 논리 에셋 ID 의 트랙을 반복 재생한다.
   *
   * 같은 ID 를 다시 주면 아무 일도 하지 않는다. `null`·`undefined` 는 정지다 —
   * 화면마다 트랙이 정해지지 않을 수 있어 "없음" 이 정상 입력이다.
   */
  play(assetId: string | null | undefined): void
  /** 재생을 멈추고 대기 중이던 트랙도 버린다 */
  stop(): void
  /** 소리를 낼지. 끄면 즉시 멈추고, 켜면 마지막 트랙을 이어 튼다 */
  setEnabled(enabled: boolean): void
  /** 0~1. 범위 밖은 잘라 넣는다 */
  setVolume(volume: number): void
  /** 이벤트 리스너를 걷는다. 테스트와 화면 해제에서 쓴다 */
  destroy(): void
}

export function createBgm(): Bgm {
  const audio = new Audio()
  audio.loop = true

  let enabled = true
  let volume = 1
  /** 지금 흐르고 있거나 흐르기로 한 트랙. 같은 요청을 걸러내는 기준이다 */
  let currentId: string | null = null
  /** 자동 재생이 거부돼 첫 조작을 기다리는 중인지 */
  let waitingForGesture = false
  /** 경고를 ID 당 한 번만. 화면 동기화에서 매 프레임 올 수 있다 */
  const warned = new Set<string>()

  function attempt(): void {
    // 거부는 예외가 아니라 거부된 Promise 로 온다. 게임을 멈출 이유가 아니다.
    void audio.play().catch(() => {
      waitingForGesture = true
    })
  }

  function onGesture(): void {
    if (!waitingForGesture) return
    waitingForGesture = false
    if (enabled && currentId !== null) attempt()
  }

  for (const type of UNLOCK_EVENTS) {
    window.addEventListener(type, onGesture)
  }

  return {
    play(assetId) {
      if (assetId === null || assetId === undefined) {
        this.stop()
        return
      }
      // 같은 트랙이면 건드리지 않는다. 여기서 걸러야 매 프레임 불러도 안전하다.
      if (assetId === currentId) return

      const url = assetUrl(assetId)
      if (url === null) {
        if (isDevBuild && !warned.has(assetId)) {
          warned.add(assetId)
          console.warn(
            `[배경음] ${assetId} 에 해당하는 파일이 assets/final/ 에 없다. ` +
              '아직 안 붙인 구간이면 조용히 넘어가고, 아니면 ID 오타다',
          )
        }
        return
      }

      currentId = assetId
      audio.src = url
      audio.volume = volume
      if (!enabled) return
      attempt()
    },

    stop() {
      currentId = null
      waitingForGesture = false
      audio.pause()
      // 다음에 같은 트랙을 틀 때 처음부터 나가게 한다. 이어 듣기는 규칙이 없다.
      audio.currentTime = 0
    },

    setEnabled(next) {
      enabled = next
      if (!enabled) {
        // 트랙 자체는 기억해 둔다. 다시 켰을 때 어느 화면인지 되물을 곳이 없다.
        audio.pause()
        return
      }
      if (currentId !== null) attempt()
    },

    setVolume(next) {
      volume = Math.min(1, Math.max(0, next))
      audio.volume = volume
    },

    destroy() {
      for (const type of UNLOCK_EVENTS) {
        window.removeEventListener(type, onGesture)
      }
      audio.pause()
      currentId = null
    },
  }
}
