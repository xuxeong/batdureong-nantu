// 음량 세 갈래 (DEC-UI-027)
//
// 확정문이 *"음량은 전체, 배경음, 효과음 세 가지를 각각 조절할 수 있게 한다"* 로
// 정했다. 배경음·효과음은 각자 자기 요소의 `volume` 을 갖고 있으므로, 여기서 하는
// 일은 **전체를 그 둘에 곱해서 내려보내는 것** 하나다.
//
// ── 왜 따로 두나 ───────────────────────────────────────────
//
// 곱셈 자체는 한 줄이지만 **그 한 줄이 빠지는 곳이 세 군데**다 — 슬라이더를 움직일
// 때, 전체를 움직일 때, 처음 값을 넣을 때. 세 곳에 복사하면 그중 하나는 안 따라온다
// (`main.ts` 의 `noteHitFlash` 가 같은 이유로 한 곳에 모였다).
//
// **DOM 을 모른다.** 받는 것은 `setVolume(0~1)` 을 가진 무엇이든이라 `bgm.ts`·`sfx.ts`
// 없이 단위 테스트할 수 있다.
//
// ── 기본값 ─────────────────────────────────────────────────
//
// 셋 다 1 이다. 기본 음량은 어느 결정에도 없고, 1 은 "아무것도 깎지 않음" 이라
// 믹서가 없던 지금까지의 상태와 같다. 임의의 수치를 기본값으로 정하지 않는다.
//
// **저장하지 않는다.** 설정을 다음 실행까지 남기라는 결정이 없다.

/** 확정문이 정한 세 갈래. 늘리려면 `DEC-UI-027` 을 고쳐야 한다 */
export type VolumeChannel = 'master' | 'bgm' | 'sfx'

export const VOLUME_CHANNELS: readonly VolumeChannel[] = ['master', 'bgm', 'sfx']

/** 음량을 받을 수 있는 것. `Bgm`·`Sfx` 가 이 모양을 이미 갖고 있다 */
export interface VolumeSink {
  setVolume(volume: number): void
}

export interface Mixer {
  /** 현재 값 (0~1). 슬라이더 초기 표시에 쓴다 */
  get(channel: VolumeChannel): number
  /** 값을 바꾸고 즉시 반영한다. 범위 밖은 잘라 넣는다 */
  set(channel: VolumeChannel, value: number): void
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export function createMixer(sinks: { bgm: VolumeSink; sfx: VolumeSink }): Mixer {
  // 기본은 중립(1)이다. 게임의 기본 음량(전체 35%, 8/10)은 부팅이 내린다 —
  // main.ts 의 createMixer 호출 직후. 여기 박으면 이 모듈의 뜻이
  // "섞는 것" 에서 "밭두렁난투의 소리 취향" 으로 넓어진다.
  const levels: Record<VolumeChannel, number> = { master: 1, bgm: 1, sfx: 1 }

  function apply(): void {
    sinks.bgm.setVolume(levels.master * levels.bgm)
    sinks.sfx.setVolume(levels.master * levels.sfx)
  }

  apply()

  return {
    get(channel) {
      return levels[channel]
    },

    set(channel, value) {
      levels[channel] = clamp01(value)
      // 어느 갈래를 움직였든 전부 다시 내린다. 전체를 움직였을 때만 둘,
      // 나머지는 하나로 갈라 두면 그 분기가 다음 갈래에서 틀린다.
      apply()
    },
  }
}
