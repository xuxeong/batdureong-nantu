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

const isDevBuild = import.meta.env.VITE_BUILD_MODE !== 'submission'

const bus = createEventBus()

const loop = createGameLoop(
  {
    update() {
      // 필드 시뮬레이션. 재배·전투가 붙기 전까지는 비어 있다.
    },
    render() {
      // 캔버스 렌더. src/render/ 가 붙기 전까지는 비어 있다.
    },
  },
  {
    // 포커스를 잃으면 일시정지 화면을 연다 (DEC-INPUT-009, DEC-UI-014).
    // 자동 재개는 하지 않는다 — 재개 확인 절차는 DEC-UI-022 가 보류다.
    onFocusLost: () => scenes.openOverlay('pause'),
  },
)

const scenes: SceneManager = createSceneManager(bus, loop)

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
}

loop.start()
