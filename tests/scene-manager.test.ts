// 화면 매니저 테스트 (DEC-UI-014, DEC-INPUT-009).
//
// 여기 있는 것들은 전부 **실행해도 눈에 잘 안 띄는** 종류다.
// 필드가 멈춘 것과 입력이 잠긴 것은 화면상 똑같이 "안 움직인다"로 보이고,
// 원인이 정지 사유 하나가 안 지워진 것이면 재현 조건조차 잡기 어렵다.
// 실제로 알트탭 한 번에 필드가 영구히 멈추는 버그가 사람 손으로 발견됐다.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createEventBus } from '../src/core/bus.ts'
import { createSceneManager } from '../src/scenes/manager.ts'
import type { GameLoop, PauseCause } from '../src/core/loop.ts'

/** GameLoop 중 정지 사유만 흉내 낸다. requestAnimationFrame 은 필요 없다 */
function fakeLoop(): GameLoop & { causes: Set<PauseCause> } {
  const causes = new Set<PauseCause>()
  return {
    causes,
    start() {},
    stop() {},
    pause: (cause) => void causes.add(cause),
    resume: (cause) => void causes.delete(cause),
    resumeAll: () => causes.clear(),
    get paused() {
      return causes.size > 0
    },
    pauseCauses: () => [...causes],
    setTimeScale() {},
  }
}

function setup() {
  const bus = createEventBus()
  const loop = fakeLoop()
  const scenes = createSceneManager(bus, loop)
  return { bus, loop, scenes }
}

test('오버레이가 열리면 필드가 멈추고 닫히면 재개한다', () => {
  const { loop, scenes } = setup()
  scenes.enterFieldPreview('farming')
  assert.equal(loop.paused, false)

  scenes.openOverlay('maintenance_hub')
  assert.equal(loop.paused, true)

  scenes.closeOverlay('maintenance_hub')
  assert.equal(loop.paused, false)
})

test('포커스 이탈로 멈춘 뒤 일시정지를 닫으면 재개한다', () => {
  // 회귀 방지: 'dialogue' 사유만 지우면 'focus_lost' 가 남아
  // 알트탭 한 번에 필드가 영구히 멈춘다.
  const { loop, scenes } = setup()
  scenes.enterFieldPreview('farming')

  // 루프가 포커스 이탈을 감지하고 화면 매니저가 일시정지를 연다 (DEC-INPUT-009).
  loop.pause('focus_lost')
  scenes.openOverlay('pause')
  assert.equal(loop.paused, true)

  // 플레이어가 일시정지를 닫는다 — 이것이 포커스 이탈의 재개 경로다.
  scenes.handleEscape()
  assert.deepEqual(loop.pauseCauses(), [])
  assert.equal(loop.paused, false)
})

test('필수 대화는 Esc 로 닫히지 않고 일시정지만 겹친다', () => {
  const { scenes } = setup()
  scenes.enterFieldPreview('raid')
  scenes.openOverlay('precombat_dialogue')

  scenes.handleEscape()
  assert.deepEqual(scenes.openOverlays(), ['precombat_dialogue', 'pause'])

  // 일시정지를 닫아도 대화는 남는다 (DEC-UI-014).
  scenes.handleEscape()
  assert.deepEqual(scenes.openOverlays(), ['precombat_dialogue'])
})

test('회복 퀵메뉴는 Esc 로 닫힌다', () => {
  const { scenes } = setup()
  scenes.enterFieldPreview('farming')
  scenes.openOverlay('recovery_quickmenu')

  scenes.handleEscape()
  assert.deepEqual(scenes.openOverlays(), [])
})

test('정비 허브는 Esc 로 닫히지 않고 일시정지만 겹친다', () => {
  // DEC-UI-022: Esc 로 닫을 수 있는 오버레이는 회복 퀵메뉴뿐이다.
  // DEC-RUN-006: 정비 허브는 하단 진행 버튼으로만 종료한다.
  //
  // 이 테스트가 없던 동안 Esc 로 정비가 닫혔다. 화면상으로는 "정비를 마쳤다"와
  // 구분되지 않아서 사람 눈으로는 안 잡힌다 — 진행 버튼을 거치지 않았으므로
  // 습격 여부에 따른 분기(DEC-UI-014)를 통째로 건너뛴 상태가 된다.
  const { scenes } = setup()
  scenes.enterFieldPreview('farming')
  scenes.openOverlay('maintenance_hub')

  scenes.handleEscape()
  assert.deepEqual(scenes.openOverlays(), ['maintenance_hub', 'pause'])

  scenes.handleEscape()
  assert.deepEqual(scenes.openOverlays(), ['maintenance_hub'])
})

test('승인 데이터가 없으면 일차로 넘어갈 때 데이터 오류 화면으로 간다', () => {
  const { bus, scenes } = setup()
  let reported = 0
  bus.on('data.error', () => {
    reported += 1
  })

  scenes.send({ type: 'confirm' }) // 타이틀 → 이름 입력
  scenes.send({ type: 'confirm' }) // → 튜토리얼
  scenes.send({ type: 'confirm' }) // → 1일차: 일정이 없다

  assert.equal(scenes.currentScreen(), 'data_error')
  assert.equal(reported, 1)
})

test('화면이 바뀌면 이전 오버레이가 남지 않는다', () => {
  const { scenes } = setup()
  scenes.enterFieldPreview('farming')
  scenes.openOverlay('pause')

  scenes.send({ type: 'player_died' })
  assert.equal(scenes.currentScreen(), 'run_failed')
  assert.deepEqual(scenes.openOverlays(), [])
})

// ── 중첩 UI 우선순위와 입력 소유권 (DEC-UI-026) ──────────────

test('일시정지는 나중에 열려도 항상 가장 위에 온다', () => {
  const { scenes } = setup()
  scenes.enterFieldPreview('farming')

  scenes.openOverlay('pause')
  scenes.openOverlay('maintenance_hub')

  assert.deepEqual(scenes.openOverlays(), ['maintenance_hub', 'pause'])
  assert.equal(scenes.inputOwner(), 'pause', '가장 위 오버레이가 입력을 독점한다')
})

test('기능 오버레이 둘이 동시에 열리지 않는다', () => {
  const { scenes } = setup()
  scenes.enterFieldPreview('raid')

  scenes.openOverlay('precombat_dialogue')
  scenes.openOverlay('maintenance_hub')

  assert.deepEqual(
    scenes.openOverlays(),
    ['precombat_dialogue'],
    '나중 것을 열지 않는다. 조용히 바꿔치기하면 아래 오버레이 상태가 사라진다',
  )
})

test('오버레이가 없으면 필드가 입력을 갖는다', () => {
  const { scenes } = setup()
  scenes.enterFieldPreview('farming')

  assert.equal(scenes.inputOwner(), null)
})

test('포커스를 잃으면 회복 퀵메뉴를 닫고 일시정지를 연다', () => {
  const { scenes } = setup()
  scenes.enterFieldPreview('farming')
  scenes.openOverlay('recovery_quickmenu')

  scenes.handleFocusLost()

  assert.deepEqual(scenes.openOverlays(), ['pause'])
})

test('Esc 는 한 번에 한 층만 처리한다', () => {
  // 정비 허브와 회복 퀵메뉴를 함께 열어 검사하려다 위 규칙에 막혔다.
  // 실제로도 불가능한 조합이다 — 정비 중에는 필드 입력이 잠겨 `Q`를 누를 수 없다
  // (DEC-INPUT-008, DEC-INPUT-009). 규칙이 잘못된 테스트를 먼저 잡았다.
  const { scenes } = setup()
  scenes.enterFieldPreview('farming')
  scenes.openOverlay('recovery_quickmenu')

  // 회복 퀵메뉴가 열려 있으면 그것만 닫는다
  scenes.handleEscape()
  assert.deepEqual(scenes.openOverlays(), [])

  // 열려 있지 않으면 일시정지를 연다
  scenes.handleEscape()
  assert.deepEqual(scenes.openOverlays(), ['pause'])

  // 다시 누르면 일시정지를 닫는다
  scenes.handleEscape()
  assert.deepEqual(scenes.openOverlays(), [])
})
