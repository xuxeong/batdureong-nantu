// 필드 렌더 (플레이스홀더).
//
// 실제 아트가 없으므로 사각형과 선으로만 그린다 (AGENTS.md 6절).
// 스프라이트가 붙을 때는 여기서 논리 에셋 ID로 조회하며, 실제 파일 경로를 코드에 두지 않는다.
//
// 좌표 변환은 전부 camera.ts 를 거친다. 여기서 직접 곱하지 않는다.

import { WORLD_TO_PIXEL } from './camera.ts'
import type { Camera, Vec2 } from './camera.ts'

/**
 * 경작지 한 칸의 그리기용 표현.
 *
 * 재배 시스템의 상태를 그대로 받지 않고 이 모양으로 옮겨 담는다.
 * 렌더가 시스템을 직접 import 하면 나중에 둘을 따로 테스트할 수 없다.
 */
export interface PlotView {
  x: number
  y: number
  stage: 'empty' | 'seed' | 'growing' | 'ready'
  /**
   * 성장 단계부터 공개하는 작물 이름.
   * 씨앗 단계에서는 종류를 공개하지 않으므로 null 이다 (DEC-FARM-001).
   */
  cropLabel: string | null
  /** 현재 단계 진행도 0~1. 실제 아트가 오면 프레임 선택에 쓴다 */
  progress: number
  /** `E` 로 지금 상호작용할 대상인가 (DEC-INPUT-003) */
  highlighted: boolean
}

export interface FieldView {
  player: Vec2
  /** 마우스 커서 방향(라디안) */
  aimAngle: number
  /** 충돌·상호작용 반경. player_base_stats 에서 온다 */
  collisionRadius: number
  /** 승인 데이터가 없으면 빈 배열이다 */
  plots?: readonly PlotView[]
  /** 상호작용 안내 문구. 대상이 없으면 null (DEC-INPUT-003) */
  actionPrompt?: string | null
}

export interface FieldRenderer {
  /** 캔버스를 컨테이너 크기에 맞춘다. devicePixelRatio 를 반영한다 */
  resize(): void
  draw(view: FieldView): void
  readonly canvas: HTMLCanvasElement
  readonly camera: Camera
}

export function createFieldRenderer(container: HTMLElement, camera: Camera): FieldRenderer {
  const canvas = document.createElement('canvas')
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  container.appendChild(canvas)

  const context = canvas.getContext('2d')
  if (context === null) {
    throw new Error('2D 렌더링 컨텍스트를 만들 수 없다')
  }
  const ctx = context

  function resize(): void {
    const ratio = window.devicePixelRatio || 1
    const width = container.clientWidth
    const height = container.clientHeight
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    // 그리기 좌표를 CSS 픽셀로 통일한다. 안 하면 고해상도 화면에서만 어긋난다.
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    camera.resize(width, height)
  }

  function draw(view: FieldView): void {
    const width = canvas.width / (window.devicePixelRatio || 1)
    const height = canvas.height / (window.devicePixelRatio || 1)

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#1d2b1a'
    ctx.fillRect(0, 0, width, height)

    camera.follow(view.player)
    drawWorldGrid(width, height)

    // 경작지는 플레이어보다 먼저 그린다. 겹칠 때 플레이어가 위로 와야 한다.
    for (const plot of view.plots ?? []) drawPlot(plot)

    const screen = camera.worldToScreen(view.player)
    const radius = view.collisionRadius * WORLD_TO_PIXEL

    // 플레이어 — 플레이스홀더 사각형
    ctx.fillStyle = '#e8d9a0'
    ctx.fillRect(screen.x - radius, screen.y - radius, radius * 2, radius * 2)

    // 조준선 — 마우스 커서 방향 (DEC-INPUT-002)
    const aimLength = radius * 2.5
    ctx.strokeStyle = '#e8d9a0'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(screen.x, screen.y)
    ctx.lineTo(
      screen.x + Math.cos(view.aimAngle) * aimLength,
      screen.y + Math.sin(view.aimAngle) * aimLength,
    )
    ctx.stroke()

    // 상호작용 안내 (DEC-INPUT-003). 실제 HUD 는 8/3 에 DOM 으로 올라온다.
    if (view.actionPrompt) {
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#f4ecd0'
      ctx.fillText(view.actionPrompt, screen.x, screen.y - radius - 12)
      ctx.textAlign = 'start'
    }
  }

  /**
   * 경작지와 작물 — 전부 플레이스홀더다 (AGENTS.md 6절).
   * 3단계를 색과 크기로만 구분한다. 실제 스프라이트는 논리 에셋 ID로 교체한다.
   */
  function drawPlot(plot: PlotView): void {
    const center = camera.worldToScreen(plot)
    const half = WORLD_TO_PIXEL * 0.9

    // 흙 바닥
    ctx.fillStyle = plot.stage === 'empty' ? '#3b2f22' : '#4a3a26'
    ctx.fillRect(center.x - half, center.y - half, half * 2, half * 2)
    ctx.strokeStyle = plot.highlighted ? '#f4ecd0' : 'rgba(0, 0, 0, 0.45)'
    ctx.lineWidth = plot.highlighted ? 2 : 1
    ctx.strokeRect(center.x - half, center.y - half, half * 2, half * 2)

    if (plot.stage === 'empty') return

    // 작물 — 단계가 오를수록 커지고 밝아진다
    const sizeByStage = { seed: 0.25, growing: 0.55, ready: 0.85 } as const
    const colorByStage = { seed: '#6b6152', growing: '#5f8a3a', ready: '#c8d94a' } as const
    const size = half * sizeByStage[plot.stage]

    ctx.fillStyle = colorByStage[plot.stage]
    ctx.fillRect(center.x - size, center.y - size, size * 2, size * 2)

    // 성장 중인 단계만 진행도 막대를 둔다. 수확 가능은 제한시간이 없다.
    if (plot.stage !== 'ready') {
      const barWidth = half * 1.6
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
      ctx.fillRect(center.x - barWidth / 2, center.y + half - 6, barWidth, 4)
      ctx.fillStyle = '#c8d94a'
      ctx.fillRect(center.x - barWidth / 2, center.y + half - 6, barWidth * plot.progress, 4)
    }

    // 성장 단계부터 종류를 공개한다 (DEC-FARM-001)
    if (plot.cropLabel !== null) {
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#f4ecd0'
      ctx.fillText(plot.cropLabel, center.x, center.y - half - 4)
      ctx.textAlign = 'start'
    }
  }

  /** 월드 격자. 카메라가 실제로 따라오는지 눈으로 확인하기 위한 것이다 */
  function drawWorldGrid(width: number, height: number): void {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
    ctx.lineWidth = 1

    const startX = -(camera.x % WORLD_TO_PIXEL)
    const startY = -(camera.y % WORLD_TO_PIXEL)

    ctx.beginPath()
    for (let x = startX; x < width; x += WORLD_TO_PIXEL) {
      ctx.moveTo(Math.round(x) + 0.5, 0)
      ctx.lineTo(Math.round(x) + 0.5, height)
    }
    for (let y = startY; y < height; y += WORLD_TO_PIXEL) {
      ctx.moveTo(0, Math.round(y) + 0.5)
      ctx.lineTo(width, Math.round(y) + 0.5)
    }
    ctx.stroke()
  }

  resize()
  window.addEventListener('resize', resize)

  return { resize, draw, canvas, camera }
}
