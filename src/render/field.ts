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
  /**
   * 야생동물이 이 칸의 작물을 먹는 진행도 0~1. 먹는 중이 아니면 null.
   *
   * `DEC-UI-018` 이 "먹는 동안 진행 상태를 해당 경작지에 표시한다" 고 확정했다.
   * 이게 없으면 플레이어는 작물이 사라진 뒤에야 알고, 그때는 막을 수 없다.
   */
  eatingProgress: number | null
  /**
   * 수확 가능 전환 강조가 남은 정도 1~0.
   *
   * `DEC-UI-004` 는 전환 순간 한 번만 강조하고 반복하지 않는다고 정했다.
   * 시스템이 전환을 한 번 알리고 렌더가 그 여운을 짧게 재생한다.
   */
  readyFlash: number
}

/** 수확 시 획득 수량을 그 자리에 짧게 띄운 것 (DEC-UI-018) */
export interface HarvestPopupView {
  x: number
  y: number
  text: string
  /** 남은 표시 정도 1~0 */
  life: number
}

/**
 * 경작지 한 변의 절반(월드 단위).
 *
 * `farm_plots.csv` 에는 좌표만 있고 크기가 없다. 크기는 콘텐츠 값이 아니라
 * 플레이스홀더 아트의 표현이므로 여기 둔다 (개발 로드맵 2절).
 * 승인된 경작지 간격이 x 140 · y 120 이라 45면 칸 사이가 붙지 않는다.
 * 실제 스프라이트가 오면 `DEC-ART-001` 규격을 따른다.
 */
const PLOT_HALF_SIZE = 45

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
  /**
   * 재배 단계 남은 시간. HUD(`DEC-UI-017`)가 붙기 전까지 캔버스에 임시로 그린다.
   * `hud.ts` 가 생기면 이 필드는 사라진다.
   */
  remainingSeconds?: number | null
  /** 남은 시간이 임박한가 (DEC-UI-018) */
  timeUrgent?: boolean
  /** 수확 획득 표시 (DEC-UI-018) */
  harvestPopups?: readonly HarvestPopupView[]
  /** 필드 위 적대 개체 (야생동물·적대 주민) */
  hostiles?: readonly HostileView[]
  /** 날아가는 투사체 */
  projectiles?: readonly ProjectileView[]
  /**
   * 낫 재사용 대기 남은 정도 1~0. **개발 빌드에서만 넘긴다.**
   *
   * 확정 DEC 어디에도 낫 대기 표시가 없다 — `DEC-UI-017`·`018`·`019` 셋 다
   * 목록에 없고 투척과 달리 퀵슬롯 칸도 없다. 없는 UI 규칙을 지어내는 대신
   * `DEC-UI-024` 가 세운 "개발 빌드에만 보이는 표시" 로 둔다.
   * 표시가 필요하다고 판단되면 그때 결정 로그에 올린다.
   */
  devSickleCooldown?: number | null
}

/**
 * 적대 개체 하나의 그리기용 표현.
 *
 * 야생동물과 적대 주민을 한 타입으로 받는다. 렌더 입장에서 다른 것은
 * 색과 예고 표시뿐이고, 규칙 차이는 시스템 쪽에 있다.
 */
export interface HostileView {
  x: number
  y: number
  radius: number
  /** 0~1. 체력 막대 길이 */
  healthRatio: number
  /** 공격 예고 중인 정도 1~0. 야생동물만 쓴다 (DEC-CONTENT-007) */
  windup: number | null
  /** 둔화가 걸려 있는가 (DEC-CONTENT-013) */
  slowed: boolean
  /** 지속 피해가 걸려 있는가 */
  burning: boolean
}

export interface ProjectileView {
  x: number
  y: number
  radius: number
  /** 플레이어 것인지 적 것인지 — 색을 가른다 */
  hostile: boolean
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

    // 수확 획득 표시 — 사라지면서 위로 떠오른다 (DEC-UI-018)
    for (const popup of view.harvestPopups ?? []) {
      const at = camera.worldToScreen(popup)
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = `rgba(242, 227, 74, ${popup.life.toFixed(3)})`
      ctx.fillText(popup.text, at.x, at.y - PLOT_HALF_SIZE * WORLD_TO_PIXEL - 24 - (1 - popup.life) * 20)
      ctx.textAlign = 'start'
    }

    for (const hostile of view.hostiles ?? []) drawHostile(hostile)
    for (const projectile of view.projectiles ?? []) drawProjectile(projectile)

    const screen = camera.worldToScreen(view.player)
    const radius = view.collisionRadius * WORLD_TO_PIXEL

    // 플레이어 — 플레이스홀더 사각형
    ctx.fillStyle = '#e8d9a0'
    ctx.fillRect(screen.x - radius, screen.y - radius, radius * 2, radius * 2)

    // 낫 재사용 대기 — 개발 빌드에서만 온다. 플레이어 발밑에 호를 그린다.
    // 확정 UI 규칙이 없어 HUD 에 자리를 만들지 않는다 (FieldView 주석 참고).
    if (view.devSickleCooldown !== null && view.devSickleCooldown !== undefined) {
      ctx.strokeStyle = '#8a8f7a'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(
        screen.x,
        screen.y,
        radius + 8,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * view.devSickleCooldown,
      )
      ctx.stroke()
    }

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

    // 남은 재배 시간 — hud.ts 가 생기면 여기서 지운다.
    // 임박하면 강조한다 (DEC-UI-018).
    if (view.remainingSeconds !== null && view.remainingSeconds !== undefined) {
      const seconds = Math.ceil(view.remainingSeconds)
      ctx.font = view.timeUrgent ? 'bold 28px sans-serif' : '22px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = view.timeUrgent ? '#e8613c' : '#f4ecd0'
      ctx.fillText(`남은 시간 ${seconds}초`, width / 2, 36)
      ctx.textAlign = 'start'
    }
  }

  /**
   * 경작지와 작물 — 전부 플레이스홀더다 (AGENTS.md 6절).
   * 3단계를 색과 크기로만 구분한다. 실제 스프라이트는 논리 에셋 ID로 교체한다.
   */
  /**
   * 적대 개체 — 플레이스홀더 원.
   *
   * 공격 예고를 그린다. 야생동물만 예고가 있고(`DEC-CONTENT-007`) 적대 주민은
   * 예고를 쓰지 않으므로(`DEC-CONTENT-008`) `windup` 이 항상 null 로 온다.
   * **여기서 주민에게 예고를 그리면 확정 규칙 위반이 화면에서 시작된다.**
   */
  function drawHostile(hostile: HostileView): void {
    const at = camera.worldToScreen(hostile)
    const radius = hostile.radius * WORLD_TO_PIXEL

    // 상태 효과는 테두리 색으로 구분한다. 실제 아트가 오면 교체한다.
    ctx.fillStyle = hostile.slowed ? '#6a7f9c' : '#9c5b4a'
    ctx.beginPath()
    ctx.arc(at.x, at.y, radius, 0, Math.PI * 2)
    ctx.fill()

    if (hostile.burning) {
      ctx.strokeStyle = '#e07b39'
      ctx.lineWidth = 3
      ctx.stroke()
    }

    // 공격 예고 — 남은 정도가 줄면서 원이 좁아진다
    if (hostile.windup !== null) {
      ctx.strokeStyle = '#f2e34a'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(at.x, at.y, radius + 6 + hostile.windup * 14, 0, Math.PI * 2)
      ctx.stroke()
    }

    // 체력 막대
    const barWidth = radius * 2
    ctx.fillStyle = '#2a1c16'
    ctx.fillRect(at.x - radius, at.y - radius - 10, barWidth, 4)
    ctx.fillStyle = '#c94b3f'
    ctx.fillRect(at.x - radius, at.y - radius - 10, barWidth * hostile.healthRatio, 4)
  }

  function drawProjectile(projectile: ProjectileView): void {
    const at = camera.worldToScreen(projectile)
    ctx.fillStyle = projectile.hostile ? '#d4622f' : '#cfe07a'
    ctx.beginPath()
    ctx.arc(at.x, at.y, Math.max(3, projectile.radius * WORLD_TO_PIXEL), 0, Math.PI * 2)
    ctx.fill()
  }

  function drawPlot(plot: PlotView): void {
    const center = camera.worldToScreen(plot)
    const half = PLOT_HALF_SIZE * WORLD_TO_PIXEL

    // 흙 바닥
    ctx.fillStyle = plot.stage === 'empty' ? '#3b2f22' : '#4a3a26'
    ctx.fillRect(center.x - half, center.y - half, half * 2, half * 2)
    ctx.strokeStyle = plot.highlighted ? '#f4ecd0' : 'rgba(0, 0, 0, 0.45)'
    ctx.lineWidth = plot.highlighted ? 2 : 1
    ctx.strokeRect(center.x - half, center.y - half, half * 2, half * 2)

    // 야생동물이 먹는 중이면 진행 상태를 이 칸에 그린다 (DEC-UI-018).
    // 목표를 가리키는 선이나 화살표는 그리지 않는다 — 같은 DEC 가 금지한다.
    if (plot.eatingProgress !== null) {
      ctx.fillStyle = 'rgba(212, 98, 47, 0.35)'
      ctx.fillRect(center.x - half, center.y - half, half * 2, half * 2)

      ctx.fillStyle = '#2a1c16'
      ctx.fillRect(center.x - half, center.y + half - 8, half * 2, 6)
      ctx.fillStyle = '#d4622f'
      ctx.fillRect(center.x - half, center.y + half - 8, half * 2 * plot.eatingProgress, 6)
    }

    if (plot.stage === 'empty') return

    // 작물 — 단계가 오를수록 커지고 밝아진다
    const sizeByStage = { seed: 0.25, growing: 0.55, ready: 0.85 } as const
    const colorByStage = { seed: '#6b6152', growing: '#5f8a3a', ready: '#c8d94a' } as const
    const size = half * sizeByStage[plot.stage]

    ctx.fillStyle = colorByStage[plot.stage]
    ctx.fillRect(center.x - size, center.y - size, size * 2, size * 2)

    // 수확 가능 상태가 유지되는 동안 표식을 계속 표시한다 (DEC-UI-004).
    // 효과음이 없어도 이것만으로 수확 가능 여부를 판단할 수 있어야 한다.
    if (plot.stage === 'ready') {
      ctx.strokeStyle = '#f2e34a'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(center.x, center.y - half - 10, 5, 0, Math.PI * 2)
      ctx.stroke()

      // 전환 순간의 1회 강조. 반복하지 않는다 (DEC-UI-004).
      if (plot.readyFlash > 0) {
        const spread = half * (1 + (1 - plot.readyFlash) * 0.6)
        ctx.strokeStyle = `rgba(242, 227, 74, ${plot.readyFlash.toFixed(3)})`
        ctx.lineWidth = 4
        ctx.strokeRect(center.x - spread, center.y - spread, spread * 2, spread * 2)
      }
    }

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
