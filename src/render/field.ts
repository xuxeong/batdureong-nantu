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

  /**
   * 회복 사용 게이지 (DEC-UI-017).
   *
   * 확정문이 **플레이어 캐릭터 바로 옆**에 표시하라고 정했다. HUD 의 회복 칸과
   * 다른 요소다 — 그쪽은 "무엇이 선택돼 있나", 이쪽은 "지금 먹는 중이고 얼마나
   * 남았나" 다. 진행 중이 아니면 null 이고 아무것도 그리지 않는다.
   */
  recovery?: { progress: number } | null
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
  /**
   * 필드를 지운다. 독립 화면일 때 쓴다 (DEC-UI-014).
   *
   * 필드는 베이스 화면이고 독립 화면은 그것을 **대체하는 전환**이다. 그런데
   * 캔버스가 화면 층위와 무관하게 매 프레임 그려서, 런 실패 뒤 타이틀로 돌아가면
   * **죽은 플레이어와 적대 주민이 그대로 남아 있었다** (8/5 플레이 테스트).
   *
   * 정비 허브는 다르다 — 셔터가 덮는 오버레이라 필드가 살아 있고 계속 그린다.
   */
  clear(): void
  readonly canvas: HTMLCanvasElement
  readonly camera: Camera
}

/** 필드 바탕색. `draw()` 와 `clear()` 가 같은 값을 써야 전환할 때 색이 튀지 않는다 */
const BACKDROP = '#1d2b1a'

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

  /**
   * 캔버스 백킹 해상도를 **실제로 화면을 덮는 픽셀 수**에 맞춘다.
   *
   * 무대(`render/stage.ts`)가 1920×1080 상자를 통째로 축소하므로 컨테이너 크기는
   * 언제나 1920×1080 이다. 거기에 `devicePixelRatio` 를 그대로 곱하면 **창보다 훨씬
   * 큰 해상도로 그린 뒤 브라우저가 다시 줄이게 된다** — 1280×720 창·DPR 1.25 에서
   * 2400×1350 을 그리고 있었고 프레임이 83ms(12fps)까지 늘어졌다 (8/5 실측).
   *
   * 그래서 변환이 반영된 `getBoundingClientRect()` 로 실제 크기를 읽는다. 그리기
   * 좌표는 계속 1920×1080 이며 배율만 바뀐다.
   */
  function resize(): void {
    const dpr = window.devicePixelRatio || 1
    const width = container.clientWidth
    const height = container.clientHeight
    if (width === 0 || height === 0) return

    const rect = canvas.getBoundingClientRect()
    // 무대가 아직 배율을 안 걸었으면 rect 가 0 이다. 그때는 DPR 만 쓴다.
    const scale = rect.width > 0 ? (rect.width * dpr) / width : dpr

    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    // 그리기 좌표를 무대 좌표(1920×1080)로 통일한다.
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    camera.resize(width, height)
  }

  /** 바탕만 남기고 지운다. `draw()` 와 같은 바탕색을 쓴다 */
  function clear(): void {
    const width = canvas.width / (window.devicePixelRatio || 1)
    const height = canvas.height / (window.devicePixelRatio || 1)

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = BACKDROP
    ctx.fillRect(0, 0, width, height)
  }

  function draw(view: FieldView): void {
    const width = canvas.width / (window.devicePixelRatio || 1)
    const height = canvas.height / (window.devicePixelRatio || 1)

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = BACKDROP
    ctx.fillRect(0, 0, width, height)

    camera.follow(view.player)

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

    // 회복 사용 게이지와 취소 힌트 (DEC-UI-017).
    //
    // 확정문이 "진행 중에는 `Q`로 취소할 수 있다는 짧은 힌트 동반" 이라고 정했다.
    // 힌트가 없으면 취소가 되는지 화면에서 알 수 없다 — 8/5 플레이 테스트에서
    // 담당자가 그걸 확인하지 못했다.
    if (view.recovery !== null && view.recovery !== undefined) {
      const width = radius * 3
      const height = 6
      const left = screen.x - width / 2
      const top = screen.y - radius - 18

      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
      ctx.fillRect(left, top, width, height)
      ctx.fillStyle = '#cfe07a'
      ctx.fillRect(left, top, width * Math.max(0, Math.min(1, view.recovery.progress)), height)

      // 조작만 가리키는 라벨이라 코드에 둔다 (DEC-UI-029)
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#f4ecd0'
      ctx.fillText('Q — 취소', screen.x, top - 4)
      ctx.textAlign = 'start'
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

  }

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

  /**
   * 경작지와 작물 — 전부 플레이스홀더다 (AGENTS.md 6절).
   * 3단계를 색과 크기로만 구분한다. 실제 스프라이트는 논리 에셋 ID로 교체한다.
   */
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


  resize()
  window.addEventListener('resize', resize)

  return { resize, draw, clear, canvas, camera }
}
