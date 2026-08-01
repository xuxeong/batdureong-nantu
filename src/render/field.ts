// 필드 렌더 (플레이스홀더).
//
// 실제 아트가 없으므로 사각형과 선으로만 그린다 (AGENTS.md 6절).
// 스프라이트가 붙을 때는 여기서 논리 에셋 ID로 조회하며, 실제 파일 경로를 코드에 두지 않는다.
//
// 좌표 변환은 전부 camera.ts 를 거친다. 여기서 직접 곱하지 않는다.

import { WORLD_TO_PIXEL } from './camera.ts'
import type { Camera, Vec2 } from './camera.ts'

export interface FieldView {
  player: Vec2
  /** 마우스 커서 방향(라디안) */
  aimAngle: number
  /** 충돌·상호작용 반경. player_base_stats 에서 온다 */
  collisionRadius: number
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
