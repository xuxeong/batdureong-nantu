// 걷기 표현 계산 (src/render/motion.ts, DEC-ART-004)
//
// 여기서 지키는 것은 전부 확정문에서 온 규칙이다. 표현이라 깨져도 게임이 멈추지
// 않고, 그래서 조용히 깨진다 — 8/8 에 야생동물 회전 보정 부호가 뒤집혀 있던 것을
// 담당자가 화면을 보고서야 잡았다.

import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { headingStep, walkStep } from '../src/render/motion.ts'

/** 표현값이라 승인 데이터가 아니다. main.ts 가 쓰는 값과 같은 자리 */
const CONFIG = { stepSeconds: 0.42, movingSpeed: 4 }
/** 승인 데이터의 기준 이동속도 (player_base_stats.move_speed) */
const BASE_SPEED = 260

describe('walkStep — 걷기 위상과 방향', () => {
  it('멈춰 있으면 위상이 null 이다', () => {
    const step = walkStep(0.5, 0, 0, 1 / 60, BASE_SPEED, CONFIG)
    assert.equal(step.phase, null)
    assert.equal(step.facing, null)
  })

  it('임계 속도보다 느리면 멈춘 것으로 본다', () => {
    // 밀림·반올림 같은 미세한 좌표 변화에 계속 튀면 안 된다
    const dt = 1 / 60
    const crawl = (CONFIG.movingSpeed - 1) * dt
    assert.equal(walkStep(0, crawl, 0, dt, BASE_SPEED, CONFIG).phase, null)
  })

  it('걸으면 위상이 나아간다', () => {
    const dt = 1 / 60
    const step = walkStep(0, BASE_SPEED * dt, 0, dt, BASE_SPEED, CONFIG)
    assert.notEqual(step.phase, null)
    assert.ok(step.phase! > 0)
  })

  it('위상은 0~1 을 넘지 않는다 — 한 바퀴가 한 걸음이다', () => {
    const dt = 1 / 60
    let phase = 0
    for (let i = 0; i < 600; i += 1) {
      const step = walkStep(phase, BASE_SPEED * dt, 0, dt, BASE_SPEED, CONFIG)
      phase = step.phase!
      assert.ok(phase >= 0 && phase < 1, `위상이 범위를 벗어났다: ${phase}`)
    }
  })

  it('걸음 속도가 실제 이동 속도에 비례한다', () => {
    // 회복 중이거나 둔화가 걸려 느리게 걸을 때 같은 박자로 튀면 미끄러져 보인다
    const dt = 1 / 60
    const full = walkStep(0, BASE_SPEED * dt, 0, dt, BASE_SPEED, CONFIG).phase!
    const half = walkStep(0, (BASE_SPEED / 2) * dt, 0, dt, BASE_SPEED, CONFIG).phase!
    assert.ok(Math.abs(full - half * 2) < 1e-9, `${full} 이 ${half} 의 두 배여야 한다`)
  })

  it('가로로 걸으면 좌·우 방향이 생긴다', () => {
    const dt = 1 / 60
    const move = BASE_SPEED * dt
    assert.equal(walkStep(0, -move, 0, dt, BASE_SPEED, CONFIG).facing, 'left')
    assert.equal(walkStep(0, move, 0, dt, BASE_SPEED, CONFIG).facing, 'right')
  })

  it('세로로 걸으면 정면이다 (DEC-ART-004 — 상하 이동은 정면 스프라이트)', () => {
    const dt = 1 / 60
    const move = BASE_SPEED * dt
    assert.equal(walkStep(0, 0, -move, dt, BASE_SPEED, CONFIG).facing, null)
    assert.equal(walkStep(0, 0, move, dt, BASE_SPEED, CONFIG).facing, null)
  })

  it('대각선은 큰 쪽이 이긴다. 같으면 정면이다', () => {
    const dt = 1 / 60
    const move = BASE_SPEED * dt
    assert.equal(walkStep(0, move, move * 0.5, dt, BASE_SPEED, CONFIG).facing, 'right')
    assert.equal(walkStep(0, move * 0.5, move, dt, BASE_SPEED, CONFIG).facing, null)
    // 정확히 45도면 세로 쪽으로 붙인다 — 어느 쪽이든 한 규칙이어야 깜빡이지 않는다
    assert.equal(walkStep(0, move, move, dt, BASE_SPEED, CONFIG).facing, null)
  })

  it('기준 속도가 0 이면 멈춘 것으로 다룬다', () => {
    // 승인 데이터가 오기 전에 불려도 위상이 NaN 이 되면 그림이 사라진다
    const step = walkStep(0, 100, 0, 1 / 60, 0, CONFIG)
    assert.equal(step.phase, null)
  })

  it('dt 가 0 이면 속도를 잴 수 없어 멈춘 것으로 다룬다', () => {
    assert.equal(walkStep(0, 100, 0, 0, BASE_SPEED, CONFIG).phase, null)
  })
})

describe('headingStep — 야생동물 진행 방향', () => {
  const REST = Math.PI / 2

  it('이동 방향을 향한다', () => {
    const dt = 1 / 60
    // 화면 좌표는 y 가 아래로 자란다. 오른쪽으로 가면 0
    assert.ok(Math.abs(headingStep(REST, 10, 0, dt, 4)) < 1e-9)
    // 아래로 가면 +90도
    assert.ok(Math.abs(headingStep(REST, 0, 10, dt, 4) - Math.PI / 2) < 1e-9)
  })

  it('멈추면 마지막 각도를 유지한다 (DEC-ART-004)', () => {
    // 멈춘 프레임에 각도를 버리면 설 때마다 홱 돌아간다
    const walked = headingStep(REST, -10, 0, 1 / 60, 4)
    assert.equal(headingStep(walked, 0, 0, 1 / 60, 4), walked)
  })

  it('임계 속도보다 느린 밀림은 방향을 바꾸지 않는다', () => {
    const dt = 1 / 60
    const crawl = 3 * dt
    assert.equal(headingStep(REST, crawl, 0, dt, 4), REST)
  })

  it('dt 가 0 이면 각도를 유지한다', () => {
    assert.equal(headingStep(REST, 10, 0, 0, 4), REST)
  })
})
