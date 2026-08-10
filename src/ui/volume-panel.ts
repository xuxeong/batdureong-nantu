// 음량 조절 줄 세 개 (DEC-UI-027, DEC-UI-032)
//
// ── 왜 공용으로 두나 ───────────────────────────────────────
//
// 일시정지와 타이틀 설정이 같은 조절을 쓴다. `DEC-UI-032` 가 타이틀의 설정
// 입력을 *"`DEC-UI-027` 이 정한 음량 조절 항목만 연다. 새 설정 화면이나 새 설정
// 항목을 만들지 않는다"* 로 확정했다 — 두 벌로 만들면 한쪽만 고쳐지는 날이 오고,
// 그 순간 "같은 항목" 이라는 확정문이 코드에서 깨진다.
//
// 이 모듈은 줄만 만든다. 어디에 어떻게 띄우는지(일시정지 판 안 / 타이틀 팻말 옆)는
// 부르는 쪽이 정한다.

import type { Mixer, VolumeChannel } from '../audio/mixer.ts'
import './layout.css'

/** 확정문의 "전체, 배경음, 효과음" 순서를 그대로 쓴다 (DEC-UI-027) */
const VOLUME_ROWS: { channel: VolumeChannel; label: string }[] = [
  { channel: 'master', label: '전체' },
  { channel: 'bgm', label: '배경음' },
  { channel: 'sfx', label: '효과음' },
]

/**
 * 슬라이더 눈금.
 *
 * 0~100 정수로 다루고 `mixer` 에 0~1 로 넘긴다. 화면에 백분율을 같이 적는 것은
 * **끝까지 내렸는지 조금 남았는지가 손잡이 위치만으로는 안 갈리기 때문**이다 —
 * 소리가 안 나는 이유를 여기서 찾게 된다.
 */
const VOLUME_STEPS = 100

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className !== undefined) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/**
 * 채널 세 줄이 담긴 컨테이너를 만든다.
 *
 * 값은 만들 때 `mixer` 에서 읽는다 — 일시정지에서 내린 값이 타이틀 설정에도
 * 그대로 보이려면 두 화면이 같은 `mixer` 를 받아야 한다 (실제로 그렇다).
 */
export function createVolumeRows(mixer: Mixer): HTMLElement {
  const wrap = el('div', 'volume-rows')

  for (const row of VOLUME_ROWS) {
    const line = el('div', 'volume-rows__row')
    const slider = el('input', 'volume-rows__slider')
    slider.type = 'range'
    slider.min = '0'
    slider.max = String(VOLUME_STEPS)
    slider.step = '1'
    slider.value = String(Math.round(mixer.get(row.channel) * VOLUME_STEPS))
    slider.setAttribute('aria-label', row.label)
    // refreshVolumeRows 가 이걸로 채널을 다시 찾는다
    slider.dataset['volumeChannel'] = row.channel

    const readout = el('span', 'volume-rows__value', `${slider.value}%`)
    slider.addEventListener('input', () => {
      const steps = Number(slider.value)
      mixer.set(row.channel, steps / VOLUME_STEPS)
      readout.textContent = `${steps}%`
    })

    line.append(el('span', 'volume-rows__label', row.label), slider, readout)
    wrap.appendChild(line)
  }

  return wrap
}

/**
 * 슬라이더 표시값을 `mixer` 의 현재값으로 다시 맞춘다.
 *
 * **여는 순간마다 불러야 한다** (8/10 — "음량 조절이 공유가 되지 않음").
 * 실제 소리는 늘 같은 mixer 라 공유되고 있었는데, 슬라이더 값은 만들 때
 * 한 번 읽고 굳어서 — 타이틀에서 내린 뒤 일시정지를 열면 손잡이가 옛 자리에
 * 있었다. 값이 진실이고 손잡이는 표시일 뿐이므로 열 때 다시 읽는다.
 */
export function refreshVolumeRows(wrap: HTMLElement, mixer: Mixer): void {
  for (const slider of wrap.querySelectorAll<HTMLInputElement>('input[data-volume-channel]')) {
    const channel = slider.dataset['volumeChannel'] as VolumeChannel
    const steps = Math.round(mixer.get(channel) * VOLUME_STEPS)
    slider.value = String(steps)
    const readout = slider.nextElementSibling
    if (readout !== null) readout.textContent = `${steps}%`
  }
}
