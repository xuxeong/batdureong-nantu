// 밭두렁난투 진입점
//
// 구현 순서는 docs/planning/밭두렁난투_시스템_UIUX_기획서_현재본.md 3절의
// 런 구조(DEC-RUN-014)를 따른다.
//
// 변경 가능한 게임 데이터는 이 파일을 포함해 어떤 코드에도 하드코딩하지 않는다.
// 모든 값은 generated/runtime/ 의 런타임 JSON에서 읽는다. (DEC-PIPELINE-016)
//
// 여기서 하는 일은 배선뿐이다. 규칙은 각 모듈에 있다.

import { createEventBus } from './core/bus.ts'
import { createGameLoop } from './core/loop.ts'
import { createSceneManager } from './scenes/manager.ts'
import type { SceneManager } from './scenes/manager.ts'
import { createInput } from './input/input.ts'
import { createCamera } from './render/camera.ts'
import { createFieldRenderer } from './render/field.ts'
import { runConfig, usePlaceholderStats } from './data/run-config.ts'

const isDevBuild = import.meta.env.VITE_BUILD_MODE !== 'submission'

const gameRoot = document.getElementById('game')
if (gameRoot === null) throw new Error('#game 요소가 없다')

const bus = createEventBus()
const camera = createCamera()
const renderer = createFieldRenderer(gameRoot, camera)

// player_base_stats.csv 는 초안조차 없어 승인 행이 없다 (DEC-CONTENT-019).
// 임시 값은 폴백이 아니라 **명시적 선언**이며 콘솔에 경고가 남는다.
// 승인 행이 올라오면 이 호출만 지우면 된다 — 다른 곳에 흩어져 있지 않다.
usePlaceholderStats({
  moveSpeed: 4,
  collisionRadius: 0.4,
  worldWidth: 40,
  worldHeight: 24,
})

// 월드 크기도 maps.csv 승인 전까지는 임시 값이다.
camera.setWorldSize(40, 24)

const player = { x: 20, y: 12 }

const input = createInput(renderer.canvas, {
  onInteract: () => console.info('[입력] 상호작용 (E)'),
  onThrow: () => console.info('[입력] 투척'),
  onSickle: () => console.info('[입력] 낫'),
  onQuickslotSelect: (index) => console.info(`[입력] 퀵슬롯 ${index + 1}`),
  onQuickslotCycle: (dir) => console.info(`[입력] 퀵슬롯 순환 ${dir > 0 ? '다음' : '이전'}`),
  onRecoverUse: () => console.info('[입력] 회복 사용'),
  onRecoverMenuOpen: () => scenes.openOverlay('recovery_quickmenu'),
  onRecoverMenuClose: () => scenes.closeOverlay('recovery_quickmenu'),
  onEscape: () => scenes.handleEscape(),
})

const loop = createGameLoop(
  {
    update(dt) {
      // 이동만 있는 최소 루프. 충돌·상호작용·전투는 8/2 이후에 붙는다.
      const move = input.move()
      const speed = runConfig.moveSpeed
      player.x += move.x * speed * dt
      player.y += move.y * speed * dt
    },
    render() {
      renderer.draw({
        player,
        aimAngle: input.aimAngle(),
        collisionRadius: runConfig.collisionRadius,
      })
    },
  },
  {
    // 포커스를 잃으면 일시정지 화면을 연다 (DEC-INPUT-009, DEC-UI-014).
    // 자동 재개는 하지 않는다 — 재개 확인 절차는 DEC-UI-022 가 보류다.
    onFocusLost: () => scenes.openOverlay('pause'),
  },
)

const scenes: SceneManager = createSceneManager(bus, loop)

// 필드 입력 잠금을 화면 층위에 맞춘다 (DEC-INPUT-009).
// 재배·습격 단계에서만 이동과 전투 입력을 받는다.
function syncInputLock(): void {
  const onField = scenes.currentFieldMode() !== null
  const overlayOpen = scenes.openOverlays().length > 0
  input.setFieldLocked(!onField || overlayOpen)
}
bus.on('screen.changed', syncInputLock)
bus.on('field.entered', syncInputLock)
bus.on('field.exited', syncInputLock)
bus.on('overlay.opened', syncInputLock)
bus.on('overlay.closed', syncInputLock)
syncInputLock()

// 개발 빌드에서만 화면 전환을 콘솔에 찍는다.
// 제출 빌드에서는 개발용 표시를 모두 숨긴다 (DEC-UI-024, DEC-RESIDENT-047).
if (isDevBuild) {
  bus.on('screen.changed', ({ screen }) => console.info(`[화면] ${screen}`))
  bus.on('field.entered', ({ mode }) => console.info(`[필드] 진입 — ${mode}`))
  bus.on('field.exited', () => console.info('[필드] 이탈'))
  bus.on('overlay.opened', ({ overlay }) => console.info(`[오버레이] 열림 — ${overlay}`))
  bus.on('overlay.closed', ({ overlay }) => console.info(`[오버레이] 닫힘 — ${overlay}`))
  bus.on('data.error', ({ summary, detail }) =>
    console.error(`[데이터 오류] ${summary}: ${detail}`),
  )

  // 흐름을 손으로 밟아 보기 위한 개발용 통로.
  // 승인 데이터가 없으면 일차로 진입하는 순간 데이터 오류가 뜨는 것이 정상이다.
  Object.assign(window, { __scenes: scenes, __bus: bus, __loop: loop })

  // 필드 렌더·입력·카메라를 눈으로 확인하기 위해 필드를 바로 띄운다.
  // 시작 화면은 타이틀이고 필드 입력은 재배·습격 단계에서만 열리는데(DEC-INPUT-009),
  // run_schedules 승인 행이 없어 정상 흐름으로는 재배 단계까지 갈 수 없다.
  // **승인 데이터가 들어오면 이 두 줄을 지운다.**
  scenes.enterFieldPreview('farming')
}

loop.start()
