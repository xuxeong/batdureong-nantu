// 미닫이문 전환 (아트 디렉션 12.5.5 B5, 8/9 플로우)
//
// ── 왜 공용으로 두나 ───────────────────────────────────────
//
// 일차 시작·조우 결과·습격 진입이 같은 문을 쓴다. 화면마다 문짝을 두면 속도가
// 서서히 갈리고 셋째 화면부터 세 벌이 된다 — 정비 화면이 `panel.ts` 로 한지 판을
// 공용화한 것과 같은 이유다.
//
// **그림은 정비 화면 문짝과 같은 파일이다.** `shutter_left`·`shutter_right` 는
// 각 960×1080 이고, 아트 디렉션이 *"두 장으로 나뉜 이유는 나중에 좌우로 여는
// 연출을 위해서다"* 라고 적어 둔 그 용도가 여기다.
//
// ── 두 동작뿐이다 (8/9 플로우) ─────────────────────────────
//
// `closeThen(swap)` — 문이 닫히고, 닫힌 사이에 화면이 바뀌고, 문이 **그냥
//   사라진다.** 뒤 화면의 배경이 닫힌 창호지라(조우·밤 결과, 정비) 문이 사라져도
//   그림이 이어진다 — 여는 동작을 하면 같은 창호지 위로 이음매만 지나간다.
//
// `openOver(swap)` — 문이 **닫힌 채로 나타나고**, 그 뒤에서 화면이 바뀐 다음
//   양옆으로 열린다. 앞 화면의 배경이 이미 창호지일 때(조우·밤 결과에서 다음
//   일차로) 닫는 동작 없이 시작할 수 있다 — 닫는 문을 또 보여주면 이미 닫힌
//   그림 위에서 헛돈다.
//
// 이 모듈은 문짝만 움직인다. 화면을 바꾸는 것은 부르는 쪽이 콜백 안에서 한다 —
// 문이 가리고 있는 동안이라 바뀌는 순간이 보이지 않는다. 연출이 없어도(그림이
// 없거나 움직임을 꺼 둔 경우) 게임은 같은 순서로 진행된다.

import { assetCssUrl, UI_ASSET } from '../render/assets.ts'
import './layout.css'

/**
 * 닫힘·열림 시간. `layout.css` 의 전환 시간과 같아야 한다.
 *
 * 닫힘이 열림보다 빠르다 — 닫힐 때는 "탁" 하고 끊어 주고(8/9 요청), 열릴 때는
 * 뒤 화면을 보여 주는 것이 목적이라 서둘 이유가 없다.
 */
const CLOSE_MS = 260
const OPEN_MS = 420

/** 닫힌 채로 머무는 시간. 이 사이에 바뀐 화면이 한 프레임 그려진다 */
const HOLD_MS = 120

export interface ShutterTransition {
  /**
   * 문을 닫고, 닫힌 사이에 `swap` 을 부르고, 문을 치운다.
   *
   * 여는 동작이 없다 — 바뀐 화면의 배경이 닫힌 창호지일 때 쓴다.
   * 이미 연출 중이면 아무 일도 하지 않고 `false` 를 돌려준다.
   */
  closeThen(swap: () => void): boolean
  /**
   * 문이 닫힌 채로 나타나 `swap` 을 부르고, 양옆으로 열린 뒤 사라진다.
   *
   * 닫는 동작이 없다 — 앞 화면의 배경이 이미 닫힌 창호지일 때 쓴다.
   * 이미 연출 중이면 아무 일도 하지 않고 `false` 를 돌려준다.
   */
  openOver(swap: () => void): boolean
  destroy(): void
}

/**
 * 요소의 배경을 닫힌 문 두 짝으로 깐다.
 *
 * 조우·밤 결과의 배경이 이것이다 (8/9 — *"창호지는 열리기 전까지 계속 유지"*).
 * 전용 배경 파일(`bg_night_result` 등)이 아직 없을 때의 폴백인데, 사실 폴백이
 * 더 정확하다 — 정비 화면의 문짝·전환 층과 **같은 파일**이라 화면이 바뀌어도
 * 픽셀까지 이어진다. 전용 그림은 따로 뽑은 것이라 미세하게 어긋날 수 있다.
 *
 * 그림이 없으면 아무것도 하지 않고 `false` 다 — 부르는 쪽의 플레이스홀더
 * (어두운 배경)가 그대로 남는다.
 */
export function applyClosedDoors(node: HTMLElement): boolean {
  const left = assetCssUrl(UI_ASSET.shutterLeft)
  const right = assetCssUrl(UI_ASSET.shutterRight)
  if (left === null || right === null) return false

  node.style.setProperty('--paper-doors-left', left)
  node.style.setProperty('--paper-doors-right', right)
  node.classList.add('paper-doors')
  return true
}

export function createShutterTransition(container: HTMLElement): ShutterTransition {
  const leftUrl = assetCssUrl(UI_ASSET.shutterLeft)
  const rightUrl = assetCssUrl(UI_ASSET.shutterRight)

  // 그림이 하나라도 없으면 연출을 만들지 않는다. 반투명 사각형이 지나가는 것보다
  // 전환이 없는 편이 낫다 (AGENTS.md 6절 — 플레이스홀더는 명확해야 한다).
  if (leftUrl === null || rightUrl === null) {
    return {
      closeThen(swap) {
        swap()
        return true
      },
      openOver(swap) {
        swap()
        return true
      },
      destroy() {},
    }
  }

  const root = document.createElement('div')
  root.className = 'shutter'
  root.hidden = true

  const left = document.createElement('div')
  left.className = 'shutter__panel shutter__panel--left'
  left.style.setProperty('--shutter-image', leftUrl)

  const right = document.createElement('div')
  right.className = 'shutter__panel shutter__panel--right'
  right.style.setProperty('--shutter-image', rightUrl)

  root.append(left, right)
  container.appendChild(root)

  /** 연출 중인가. 두 번 겹쳐 부르면 문짝이 중간에서 되돌아간다 */
  let playing = false
  const timers: number[] = []

  function later(fn: () => void, ms: number): void {
    timers.push(window.setTimeout(fn, ms))
  }

  function reducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  function finish(): void {
    root.hidden = true
    root.classList.remove('shutter--closed', 'shutter--instant')
    playing = false
  }

  return {
    closeThen(swap) {
      if (playing) return false
      if (reducedMotion()) {
        swap()
        return true
      }
      playing = true

      root.hidden = false
      // 열린 자리에서 시작한다. 같은 프레임에 `--closed` 를 켜면 전환이 일어나지
      // 않고 처음부터 닫힌 채 그려진다.
      root.classList.remove('shutter--closed', 'shutter--instant')

      requestAnimationFrame(() => {
        root.classList.add('shutter--closed')
        later(() => {
          // 문 뒤에서 화면을 바꾼다. 바뀌는 순간이 보이지 않는 유일한 시점이다.
          swap()
          // 새 화면의 배경이 같은 창호지라 문은 열지 않고 치운다. 한 박자 두는
          // 것은 새 화면이 먼저 그려질 시간을 주기 위해서다.
          later(finish, HOLD_MS)
        }, CLOSE_MS)
      })
      return true
    },

    openOver(swap) {
      if (playing) return false
      if (reducedMotion()) {
        swap()
        return true
      }
      playing = true

      // 닫힌 채로 나타난다. `--instant` 가 전환을 꺼서 닫히는 움직임이 없다 —
      // 앞 화면의 배경이 이미 닫힌 창호지라 그림이 이어진다.
      root.classList.add('shutter--instant', 'shutter--closed')
      root.hidden = false

      later(() => {
        swap()
        later(() => {
          // 두 프레임에 나눠 푼다. `--instant` 를 빼는 프레임에 `--closed` 까지
          // 같이 빼면 전환이 켜지기 전에 위치가 바뀌어 문이 순간이동한다.
          root.classList.remove('shutter--instant')
          requestAnimationFrame(() => {
            root.classList.remove('shutter--closed')
            later(finish, OPEN_MS)
          })
        }, HOLD_MS)
      }, 30)
      return true
    },

    destroy() {
      for (const id of timers) window.clearTimeout(id)
      root.remove()
    },
  }
}
