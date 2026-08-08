// 음량 세 갈래 테스트 (DEC-UI-027).
//
// 확정문이 요구하는 것은 "전체·배경음·효과음을 각각" 인데, **각각 조절되는 것과
// 전체가 나머지에 곱해지는 것이 같이 성립해야** 한다. 화면에서는 슬라이더가
// 움직이므로 잘 된 것처럼 보이고, 실제로 내려가지 않은 쪽은 소리로만 드러난다 —
// 8/8 촬영에서 확인하기 어려운 종류라 여기서 잡는다.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createMixer } from '../src/audio/mixer.ts'
import type { VolumeSink } from '../src/audio/mixer.ts'

function sink(): VolumeSink & { value: number } {
  return {
    value: -1,
    setVolume(volume) {
      this.value = volume
    },
  }
}

test('만들자마자 두 갈래에 값을 내린다', () => {
  const bgm = sink()
  const sfx = sink()
  createMixer({ bgm, sfx })

  // 초기값을 안 내리면 슬라이더를 한 번 움직이기 전까지 요소의 기본값이 남는다.
  assert.equal(bgm.value, 1)
  assert.equal(sfx.value, 1)
})

test('전체는 두 갈래 모두에 곱해진다', () => {
  const bgm = sink()
  const sfx = sink()
  const mixer = createMixer({ bgm, sfx })

  mixer.set('master', 0.5)

  assert.equal(bgm.value, 0.5)
  assert.equal(sfx.value, 0.5)
})

test('한 갈래를 내려도 다른 갈래는 그대로다', () => {
  const bgm = sink()
  const sfx = sink()
  const mixer = createMixer({ bgm, sfx })

  mixer.set('bgm', 0.25)

  assert.equal(bgm.value, 0.25)
  assert.equal(sfx.value, 1)
})

test('전체를 나중에 움직여도 이미 내린 갈래에 반영된다', () => {
  const bgm = sink()
  const sfx = sink()
  const mixer = createMixer({ bgm, sfx })

  mixer.set('bgm', 0.5)
  mixer.set('master', 0.5)

  // 여기가 갈라지기 쉬운 자리다 — 전체를 바꿀 때만 둘을 다시 계산하는 식으로
  // 짜면 이 값이 0.5 로 남는다 (직전 갈래 값이 잊힌다).
  assert.equal(bgm.value, 0.25)
  assert.equal(sfx.value, 0.5)
})

test('범위 밖 값은 잘라 넣는다', () => {
  const bgm = sink()
  const sfx = sink()
  const mixer = createMixer({ bgm, sfx })

  mixer.set('master', 2)
  assert.equal(mixer.get('master'), 1)

  mixer.set('sfx', -1)
  assert.equal(mixer.get('sfx'), 0)
  assert.equal(sfx.value, 0)

  // 슬라이더 값이 빈 문자열이면 Number('') 가 0 이 아니라 NaN 으로 오는 경로가
  // 있다. NaN 이 그대로 내려가면 요소의 volume 대입이 예외를 던진다.
  mixer.set('bgm', Number.NaN)
  assert.equal(mixer.get('bgm'), 0)
  assert.equal(bgm.value, 0)
})

test('현재 값을 되읽을 수 있다', () => {
  const mixer = createMixer({ bgm: sink(), sfx: sink() })

  mixer.set('sfx', 0.3)

  // 일시정지 화면이 열릴 때마다 이 값으로 슬라이더 위치를 되살린다.
  assert.equal(mixer.get('sfx'), 0.3)
  assert.equal(mixer.get('master'), 1)
})
