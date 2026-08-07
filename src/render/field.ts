// 필드 렌더 (A1 에셋 + 플레이스홀더 혼재).
//
// 스프라이트는 논리 에셋 ID 로 조회한다. **실제 파일 경로가 여기 없다** —
// 경로를 아는 곳은 `render/assets.ts` 하나다 (AGENTS.md 6절).
// 아직 그림이 없는 것(플레이어·야생동물·주민·투사체)은 계속 도형으로 그린다.
//
// ── 그리는 순서 세 층 (아트 디렉션 12.2 A1) ────────────────
//
//   1. 배경 한 장            밭 바닥 + 밭 바깥 숲(뒤 겹)이 한 장이다
//   2. 필드 내용물           경작지·작물·플레이어·야생동물·주민·투사체
//   3. field_frame_front     밭 안쪽 가장자리에 걸치는 잎사귀(앞 겹)
//
// 3층이 야생동물보다 **위**인 것이 핵심이다. 동물이 그 밑에서 걸어 나오는 것처럼
// 보이게 하는 것이 목적이라, 아래로 내리면 앞 겹을 만든 이유가 없어진다.
//
// **배경과 앞 겹은 월드 좌표가 아니라 화면 중앙 기준이다.** 둘 다 1920×1080 인데
// 월드는 1600×900 이라 크기가 다르다 — 배경이 밭 바깥까지 포함하기 때문이다.
// 카메라가 월드보다 큰 뷰포트에서 월드를 가운데 두므로 화면 중앙 = 월드 중앙이고,
// 그래서 두 장을 무대 정중앙에 놓으면 밭이 정확히 맞는다.
//
// 좌표 변환은 전부 camera.ts 를 거친다. 여기서 직접 곱하지 않는다.

import { UI_ASSET, type AssetImages } from './assets.ts'
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

  /**
   * 이 칸 위에 그릴 작물의 논리 에셋 ID. 빈 칸이거나 그림이 없으면 null.
   *
   * **단계에 맞는 역할을 고르는 것은 부르는 쪽이다.** 씨앗은 맵의 `crop_seed`
   * 한 장이고(작물별로 두지 않는다 — `DEC-ART-002`) 성장·수확 가능은 작물 행의
   * `crop_growing`·`crop_ready` 다. 렌더가 그 규칙을 알면 데이터 구조가 두 곳에 생긴다.
   */
  cropAssetId?: string | null
}

/**
 * 필드가 쓰는 논리 에셋 ID 묶음.
 *
 * 콘텐츠 쪽(`maps`·`crops` 의 `assets`)에서 오는 것만 여기 있다. UI·시스템 에셋은
 * 어떤 콘텐츠에도 속하지 않아 `schema/enums.json` 고정 목록에서 오고 `assets.ts` 의
 * `UI_ASSET` 이 그 자리다 (`DEC-ART-002`).
 */
export interface FieldAssetIds {
  /** 밭 바닥 + 밭 바깥 숲이 한 장 (map 의 background) */
  background?: string | null
  /** 빈 경작지 (map 의 farm_plot) */
  farmPlot?: string | null
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
 * 경작지 한 변의 절반(월드 단위) — **스프라이트가 없을 때만 쓴다.**
 *
 * `farm_plots.csv` 에는 좌표만 있고 크기가 없다. 크기는 콘텐츠 값이 아니라 표현이라
 * 여기 둔다 (개발 로드맵 2절). 실제 스프라이트가 있으면 그림의 자연 크기를 쓴다 —
 * `DEC-ART-002` 이 월드 1단위 = 화면 1픽셀로 정해서 **에셋 크기가 곧 화면 크기다.**
 * 여기서 다시 배율을 곱하면 아트가 정한 크기를 코드가 뒤집는 것이 된다.
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
  /** 지원하는 영입 주민. 습격 전투에 한 명뿐이고 없으면 null (DEC-RESIDENT-021) */
  ally?: AllyView | null
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
   * 방금 휘두른 낫의 호 (아트 디렉션 12.2 — 이펙트 넷 중 "낫 휘두름").
   *
   * 전성민이 8/6 에 이펙트를 **별도 PNG 나 CSS 오버레이가 아니라 Canvas 2D 의
   * 코드 도형과 시간값**으로 구현하라고 정했다. `assets/final/effect/` 도
   * `content_assets.csv` 의 `effect` 행도 만들지 않는다.
   *
   * **호의 모양이 판정 모양 그대로다.** `swingSickle()` 이 사거리 안이면서
   * 조준 방향 ±90도 인 대상을 치므로 정확히 반원이다. 그리는 것과 맞는 것이
   * 갈리면 플레이어가 사거리를 잘못 배운다.
   */
  sickleSwing?: SickleSwingView | null

  /**
   * 회복 사용 게이지 (DEC-UI-017).
   *
   * 확정문이 **플레이어 캐릭터 바로 옆**에 표시하라고 정했다. HUD 의 회복 칸과
   * 다른 요소다 — 그쪽은 "무엇이 선택돼 있나", 이쪽은 "지금 먹는 중이고 얼마나
   * 남았나" 다. 진행 중이 아니면 null 이고 아무것도 그리지 않는다.
   */
  recovery?: { progress: number } | null

  /** 승인 데이터에서 온 논리 에셋 ID. 없으면 전부 플레이스홀더로 그린다 */
  assets?: FieldAssetIds

  /**
   * 플레이어의 `field_sprite` (`player_base_stats.csv` 의 `assets`).
   *
   * 없으면 사각형으로 그린다.
   *
   * **캔버스 좌우 반전은 쓰지 않는다.** `DEC-ART-002` 가 좌·우를 `field_sprite_left`·
   * `field_sprite_right` 실제 그림 두 장으로 확정했다 — 무기·소품을 든 인물이라
   * 단순 반전이 부자연스럽다는 판단이다. 그림이 오면 부르는 쪽이 이동 방향에 맞는
   * ID 를 골라 넘긴다. 상하 이동과 정지는 이 정면 그림을 그대로 쓴다.
   *
   * 이 주석은 8/7 까지 *"`scale(-1, 1)` 한 줄이면 된다"* 고 말하고 있었다.
   * `DEC-ART-001` 폐기·`DEC-ART-002` 대체로 그 길이 없어졌다.
   */
  playerAsset?: string | null
  /**
   * 걷는 흔들림의 위상 0~1. 멈춰 있으면 null (`DEC-ART-002`).
   *
   * 위상을 렌더가 아니라 부르는 쪽이 들고 있는다 — 실제로 움직였는지는
   * 상태를 가진 쪽만 알고, 렌더가 좌표를 프레임마다 기억하기 시작하면
   * 그리기와 상태가 섞인다.
   */
  playerBob?: number | null
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
  /**
   * `field_sprite` 논리 에셋 ID. 그림이 없으면 도형으로 그린다.
   *
   * 야생동물은 `wildlife.csv`, 적대 주민은 `residents.csv` 의 `assets` 에서 온다.
   * **상태 표시는 그림 위에 그대로 그린다** — 체력 막대·예고·둔화·지속 피해는
   * 확정 규칙이라(`DEC-CONTENT-007`, `DEC-CONTENT-013`) 그림이 왔다고 빠지지 않는다.
   */
  assetId?: string | null
  /**
   * 걷는 흔들림의 위상 0~1. 멈춰 있거나 대상이 아니면 null (`DEC-ART-002`).
   *
   * **적대 주민에게만 온다.** `DEC-ART-002` 는 bob 을 야생동물에 적용할지
   * 정하지 않았고, 까마귀가 통통 튀는 것이 맞는지도 판단이 필요하다.
   * 부르는 쪽이 주민 자리에서만 채운다 (main.ts `hostileViews()`).
   */
  bob?: number | null
}

export interface ProjectileView {
  x: number
  y: number
  radius: number
  /** 플레이어 것인지 적 것인지 — 색을 가른다 */
  hostile: boolean
  /**
   * `projectile` 논리 에셋 ID. 없으면 원으로 그린다.
   *
   * 플레이어 투척물은 `throwable_weapons.csv`, 적대 주민이 쏜 것은 쏜 주민의
   * `residents.csv` 에서 온다.
   */
  assetId?: string | null
}

/** 방금 휘두른 낫의 호. `FieldView.sickleSwing` 주석 참고 */
export interface SickleSwingView {
  /** 휘두른 순간의 조준 각도(라디안). 그리는 시점의 커서 방향이 아니다 */
  angle: number
  /** 낫 사거리. `player_base_stats.csv` 의 `sickle_range` 에서 온다 */
  range: number
  /** 남은 표시 시간 1~0 */
  life: number
}

/**
 * 지원하는 영입 주민 (DEC-UI-012).
 *
 * **체력을 두지 않는다.** 확정문이 "지원 주민에게 체력 표시를 두지 않는다"로
 * 정했고 애초에 체력이라는 상태가 없다 (DEC-RESIDENT-021). `HostileView` 와
 * 한 타입으로 합치지 않는 이유가 이것이다 — 합치면 체력 필드를 0이나 1로
 * 채워야 하고, 그 값이 언젠가 화면에 나온다.
 *
 * **다음 공격까지 남은 시간도 없다.** 같은 확정문이 금지했다. `attackFlash` 는
 * 이미 일어난 공격의 여운이지 예고가 아니다.
 */
export interface AllyView {
  x: number
  y: number
  /** 공격이 방금 일어났다는 표시가 남은 정도 1~0 */
  attackFlash: number
  /**
   * 지원하는 주민의 `field_sprite`. 없으면 도형으로 그린다.
   *
   * 그림이 와도 **밝은 테두리는 남긴다** — 적대 주민과 시각적으로 구분하라는 것이
   * `DEC-UI-012` 확정이고, 같은 사람의 같은 그림이라 그림만으로는 안 갈린다.
   */
  assetId?: string | null
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

/**
 * 낫 휘두름 호에서 날 뒤로 남는 꼬리 길이 (반원 대비 비율).
 *
 * 표현이라 승인 데이터가 아니다. 0.45 면 반원의 절반 못 미치게 남아 방향이
 * 읽히면서도 사거리 전체를 상시 표시하는 것처럼 보이지 않는다.
 */
const TRAIL = 0.45

/**
 * 이동 중 상하 흔들림(bob)의 크기. 전부 스프라이트 높이 대비 비율이고
 * **표현이라 승인 데이터가 아니다.**
 *
 * `DEC-ART-002` 가 *"걷기 동작은 예외에 넣지 않는다. 이동 중 흔들림은 예외가
 * 아니라 코드가 위치를 오르내리는 방식(bob)으로 표현하며 새 스프라이트를 만들지
 * 않는다"* 로 확정했다. 그림은 정면 한 장 그대로다.
 *
 * `SQUASH` 는 착지에서 세로로 눌리는 정도다. 같은 값만큼 가로로 퍼뜨려
 * 부피가 유지되는 것처럼 보이게 한다 — 세로만 줄이면 고무공이 아니라
 * 찌그러진 그림이 된다.
 */
const BOB_LIFT = 0.06
const BOB_SQUASH = 0.06

export function createFieldRenderer(
  container: HTMLElement,
  camera: Camera,
  images: AssetImages,
): FieldRenderer {
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
  /**
   * 그리기 좌표계 크기 (무대 기준 1920×1080).
   *
   * **캔버스 픽셀 수와 다르다.** 백킹은 화면에 실제로 덮이는 크기라 더 작을 수
   * 있고, 그 둘을 섞으면 화면 일부만 지워진다 — 8/5에 배경이 왼쪽 위만 칠해지고
   * 나머지에 이전 프레임이 잔상으로 남았다.
   */
  let stageWidth = 0
  let stageHeight = 0

  function resize(): void {
    const dpr = window.devicePixelRatio || 1
    const width = container.clientWidth
    const height = container.clientHeight
    if (width === 0 || height === 0) return

    // 그리기 좌표계 크기. **캔버스 픽셀 수가 아니다.**
    stageWidth = width
    stageHeight = height

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
    const width = stageWidth
    const height = stageHeight

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = BACKDROP
    ctx.fillRect(0, 0, width, height)
  }

  /**
   * 무대 정중앙에 원래 크기로 그린다. 배경과 앞 겹 두 장이 쓴다.
   *
   * 카메라를 거치지 않는다 — 둘은 월드에 놓인 물건이 아니라 화면을 덮는 판이고,
   * 크기도 월드(1600×900)가 아니라 화면(1920×1080)에 맞춰 그려져 있다.
   */
  function drawScreenLayer(assetId: string | null | undefined): boolean {
    const image = images.get(assetId)
    if (image === null) return false

    ctx.drawImage(
      image,
      (stageWidth - image.naturalWidth) / 2,
      (stageHeight - image.naturalHeight) / 2,
    )
    return true
  }

  /**
   * 월드 좌표를 중심으로 원래 크기로 그린다. 경작지·작물·강조 틀이 쓴다.
   *
   * `bob` 이 0~1 위상으로 오면 걷는 흔들림을 얹는다 (`DEC-ART-002`). null 이면
   * 원래 크기 그대로다 — **크기를 바꾸는 것이 "에셋 크기가 곧 화면 크기" 와
   * 부딪히지 않는 이유는 이것이 데이터에서 읽는 고정 배율이 아니라 시간에 따라
   * 변하는 표현이기 때문이다.** 기준 크기는 여전히 파일이 정한다.
   */
  function drawWorldSprite(
    assetId: string | null | undefined,
    at: Vec2,
    bob?: number | null,
  ): boolean {
    const image = images.get(assetId)
    if (image === null) return false

    const center = camera.worldToScreen(at)
    const width = image.naturalWidth
    const height = image.naturalHeight

    if (bob === null || bob === undefined) {
      ctx.drawImage(image, center.x - width / 2, center.y - height / 2)
      return true
    }

    // 위상 0~1 이 한 걸음이다. 0 과 1 이 착지, 0.5 가 정점이다.
    const lift = Math.sin(Math.PI * bob)
    // 정점에서 늘어나고 착지에서 눌린다. 발이 뜨지 않게 **아래 끝을 고정**한다 —
    // 중심을 기준으로 줄이면 눌릴 때 발이 같이 올라와 땅에서 떨어진 것처럼 보인다.
    const scaleY = 1 + (lift - 0.5) * 2 * BOB_SQUASH
    const scaleX = 1 - (scaleY - 1)
    const drawWidth = width * scaleX
    const drawHeight = height * scaleY
    const bottom = center.y + height / 2 - lift * height * BOB_LIFT

    ctx.drawImage(
      image,
      center.x - drawWidth / 2,
      bottom - drawHeight,
      drawWidth,
      drawHeight,
    )
    return true
  }

  function draw(view: FieldView): void {
    const width = stageWidth
    const height = stageHeight

    ctx.clearRect(0, 0, width, height)

    camera.follow(view.player)

    // ── 1층: 배경 (밭 바닥 + 밭 바깥 숲이 한 장) ────
    // 그림이 아직 없으면 바탕색으로 대신한다. 안 칠하면 이전 프레임이 잔상으로 남는다.
    if (!drawScreenLayer(view.assets?.background)) {
      ctx.fillStyle = BACKDROP
      ctx.fillRect(0, 0, width, height)
    }

    // ── 2층: 필드 내용물 ─────────────────────────────
    // 경작지는 플레이어보다 먼저 그린다. 겹칠 때 플레이어가 위로 와야 한다.
    for (const plot of view.plots ?? []) drawPlot(plot, view.assets)

    if (view.ally !== null && view.ally !== undefined) drawAlly(view.ally)
    for (const hostile of view.hostiles ?? []) drawHostile(hostile)
    for (const projectile of view.projectiles ?? []) drawProjectile(projectile)

    const screen = camera.worldToScreen(view.player)
    const radius = view.collisionRadius * WORLD_TO_PIXEL

    // 플레이어 — 그림이 있으면 그것을, 없으면 사각형을 그린다.
    // 기준점은 스프라이트 중심이고 논리 좌표를 그 중심에 맞춘다 (DEC-ART-002).
    if (!drawWorldSprite(view.playerAsset, view.player, view.playerBob)) {
      ctx.fillStyle = '#e8d9a0'
      ctx.fillRect(screen.x - radius, screen.y - radius, radius * 2, radius * 2)
    }

    // 낫 휘두름 (아트 디렉션 12.2 — 이펙트 넷 중 하나).
    //
    // 반원 전체를 한 번에 띄우지 않고 **날이 지나간 것처럼 쓸고 지나간다.**
    // 전체를 띄우면 사거리 표시로 읽히고, 쓸면 그 동작이 공격이라는 것이 읽힌다.
    // `swingSickle()` 의 판정이 조준 방향 ±90도 라 시작과 끝이 그 둘이다.
    if (view.sickleSwing !== null && view.sickleSwing !== undefined) {
      const swing = view.sickleSwing
      const reach = swing.range * WORLD_TO_PIXEL
      const from = swing.angle - Math.PI / 2
      // 남은 시간 1→0 이 진행 0→1 이다. 머리가 앞서고 꼬리가 따라온다.
      const progress = 1 - swing.life
      const head = from + Math.PI * progress
      const tail = from + Math.PI * Math.max(0, progress - TRAIL)

      ctx.save()
      // 끝의 40% 에서만 사라진다. 처음부터 옅으면 휘두른 것이 안 보인다.
      ctx.globalAlpha = Math.min(1, swing.life / 0.4)
      ctx.strokeStyle = '#f2e3a8'
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.arc(screen.x, screen.y, reach, tail, head)
      ctx.stroke()
      ctx.restore()
    }

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

    // ── 3층: 수풀 앞 겹 ──────────────────────────────
    //
    // **야생동물·주민·플레이어보다 위다.** 동물이 그 밑에서 걸어 나오는 것처럼
    // 보이게 하는 것이 이 겹의 목적이라(아트 디렉션 12.2 A1) 순서를 내리면
    // 앞 겹을 따로 만든 이유가 사라진다.
    //
    // 승인된 출현점 여덟 개가 전부 밭 가장자리에서 80px 안쪽이라 잎사귀 선에
    // 놓인다 — 출현 연출을 따로 만들지 않아도 생긴다. 그림이 성글어서 플레이어
    // 실루엣이 비치는 것도 의도다 (아트 디렉션 3절 판독 우선).
    drawScreenLayer(UI_ASSET.fieldFrameFront)

    // ── 앞 겹 위: 지금 무엇을 할 수 있는지 알리는 표시 ──
    //
    // 잎사귀에 가리면 안 되는 것들이다. 밭 가장자리에 선 플레이어의 회복 게이지가
    // 잎 뒤로 들어가면 취소되기 전까지 아무것도 못 읽는다.

    // 수확 획득 표시 — 사라지면서 위로 떠오른다 (DEC-UI-018)
    for (const popup of view.harvestPopups ?? []) {
      const at = camera.worldToScreen(popup)
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = `rgba(242, 227, 74, ${popup.life.toFixed(3)})`
      ctx.fillText(
        popup.text,
        at.x,
        at.y - PLOT_HALF_SIZE * WORLD_TO_PIXEL - 24 - (1 - popup.life) * 20,
      )
      ctx.textAlign = 'start'
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

    // 조준선 — 마우스 커서 방향. DEC-INPUT-002 는 판정 기준(커서 방향)만 정했고
    // 이 선을 그리라는 규칙은 없다. 길이·색은 2026-08-07 아트 디렉션 14.1 로 정했다 —
    // 제출 빌드에서도 계속 그릴지는 아직 미정이라 지금은 조건 없이 그린다.
    const aimLength = radius * 4.5
    ctx.strokeStyle = '#ff4d4d'
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

    // 몸통 — 그림이 있으면 그것을, 없으면 원을 그린다.
    const drawn = drawWorldSprite(hostile.assetId, hostile, hostile.bob)
    if (!drawn) {
      ctx.fillStyle = hostile.slowed ? '#6a7f9c' : '#9c5b4a'
      ctx.beginPath()
      ctx.arc(at.x, at.y, radius, 0, Math.PI * 2)
      ctx.fill()
    }

    // 상태 효과는 **그림이 있어도 그린다** (DEC-CONTENT-013).
    // 도형일 때는 채움색으로 둔화를 구분했는데 그림에는 그 자리가 없어서,
    // 그림이 있으면 테두리 링으로 대신한다 — 둘 다 없으면 효과가 안 보인다.
    if (drawn && hostile.slowed) {
      ctx.strokeStyle = '#6a7f9c'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(at.x, at.y, radius, 0, Math.PI * 2)
      ctx.stroke()
    }

    if (hostile.burning) {
      ctx.strokeStyle = '#e07b39'
      ctx.lineWidth = 3
      // 그림일 때는 위 `arc` 가 없어 새로 경로를 잡아야 한다
      if (drawn) {
        ctx.beginPath()
        ctx.arc(at.x, at.y, radius + 3, 0, Math.PI * 2)
      }
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

  /**
   * 지원하는 영입 주민 — 플레이스holder (`field_sprite` 가 아직 없다).
   *
   * **적대 주민과 시각적으로 구분한다** (DEC-UI-012). 적대는 붉은 계열 원이므로
   * 여기는 밝은 테두리를 쓴다 — 아트 디렉션 4.3 이 *"지원 주민은 밝은 테두리로
   * 구분한다"* 로 정했고, 4.2 가 적대 표시에 붉은색을 쓰지 못하게 해서 색만으로는
   * 갈리지 않는다.
   *
   * 체력 막대도, 다음 공격까지 남은 시간도 그리지 않는다 (DEC-UI-012).
   */
  function drawAlly(ally: AllyView): void {
    const at = camera.worldToScreen(ally)
    const radius = 16 * WORLD_TO_PIXEL

    // 공격이 발생하는 순간을 알 수 있게 표시한다 (DEC-UI-012).
    //
    // **두 가지로 표시한다.** 링 하나만 두었더니 페이드아웃 때문에 선명한 구간이
    // 0.1초 남짓이라 보고 있어도 놓쳤다 (8/6). 몸통이 같이 밝아지면 링을 놓쳐도
    // "방금 무슨 일이 있었다" 가 남는다.
    //
    // 예고가 아니라 이미 일어난 것의 여운이다 — 다음 공격까지 남은 시간을
    // 표시하는 것은 같은 확정문이 금지했다.
    const flash = ally.attackFlash

    if (!drawWorldSprite(ally.assetId, ally)) {
      ctx.fillStyle = flash > 0 ? '#9fc0cf' : '#5f7a8a'
      ctx.beginPath()
      ctx.arc(at.x, at.y, radius, 0, Math.PI * 2)
      ctx.fill()
    }

    // 지원 주민은 밝은 테두리로 구분한다 (아트 디렉션 4.3). 적대 표시에 붉은색을
    // 쓸 수 없어(4.2) 색만으로는 갈리지 않으므로 테두리가 구분의 본체다.
    ctx.strokeStyle = '#f4ecd0'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(at.x, at.y, radius, 0, Math.PI * 2)
    ctx.stroke()

    if (flash > 0) {
      // 알파를 선형으로 떨어뜨리지 않는다. 후반이 눈에 안 들어와서 표시 시간을
      // 늘려도 체감이 거의 안 늘었다. 제곱근을 쓰면 오래 밝게 남다가 끝에서 진다.
      const alpha = Math.sqrt(flash)
      ctx.strokeStyle = `rgba(244, 236, 208, ${alpha.toFixed(3)})`
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.arc(at.x, at.y, radius + 8 + (1 - flash) * 14, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  function drawProjectile(projectile: ProjectileView): void {
    if (drawWorldSprite(projectile.assetId, projectile)) return

    const at = camera.worldToScreen(projectile)
    ctx.fillStyle = projectile.hostile ? '#d4622f' : '#cfe07a'
    ctx.beginPath()
    ctx.arc(at.x, at.y, Math.max(3, projectile.radius * WORLD_TO_PIXEL), 0, Math.PI * 2)
    ctx.fill()
  }

  /**
   * 경작지와 작물.
   *
   * 스프라이트가 있으면 그것을 원래 크기로 그리고, 없으면 도형으로 대신한다.
   * `DEC-ART-002` 이 월드 1단위 = 화면 1픽셀로 정해서 **에셋 크기가 곧 화면 크기다** —
   * 여기서 배율을 다시 곱하면 아트가 정한 크기를 코드가 뒤집는 것이 된다.
   *
   * 겹치는지는 승인 좌표가 정한다. 8/5 승인분이 간격 200×180 이고 스프라이트가
   * 175×160 이라 칸 사이에 틈이 남는다. 좌표가 바뀌면 여기 손대지 않아도 따라간다.
   */
  function drawPlot(plot: PlotView, assets: FieldAssetIds | undefined): void {
    const center = camera.worldToScreen(plot)

    // 흙 바닥 — 스프라이트가 있으면 그것이 네 상태 공통 바닥이다.
    //
    // 가로·세로를 따로 잡는다. 스프라이트가 175×160 이라 한쪽만 쓰면 짧은 축에서
    // 8px 씩 밖으로 나가고, 그 8px 가 표식·라벨을 윗칸 위로 밀어 올린다.
    const ground = images.get(assets?.farmPlot)
    const halfW = ground === null ? PLOT_HALF_SIZE * WORLD_TO_PIXEL : ground.naturalWidth / 2
    const halfH = ground === null ? PLOT_HALF_SIZE * WORLD_TO_PIXEL : ground.naturalHeight / 2

    if (ground === null) {
      ctx.fillStyle = plot.stage === 'empty' ? '#3b2f22' : '#4a3a26'
      ctx.fillRect(center.x - halfW, center.y - halfH, halfW * 2, halfH * 2)
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)'
      ctx.lineWidth = 1
      ctx.strokeRect(center.x - halfW, center.y - halfH, halfW * 2, halfH * 2)
    } else {
      drawWorldSprite(assets?.farmPlot, plot)
    }

    // `E` 대상 강조 (DEC-UI-018). 강조 틀 그림이 없으면 테두리로 대신한다.
    if (plot.highlighted && !drawWorldSprite(UI_ASSET.plotHighlight, plot)) {
      ctx.strokeStyle = '#f4ecd0'
      ctx.lineWidth = 2
      ctx.strokeRect(center.x - halfW, center.y - halfH, halfW * 2, halfH * 2)
    }

    if (plot.stage === 'empty') return

    // 작물 — 스프라이트가 있으면 단계별 그림, 없으면 커지고 밝아지는 사각형.
    //
    // 어느 그림을 쓸지는 부르는 쪽이 이미 골라 넘겼다 (PlotView.cropAssetId).
    // 씨앗은 작물별로 두지 않고 맵에 한 장이라(DEC-ART-002) 여기서 작물 ID 로
    // 되찾을 수 없다 — 그 규칙이 렌더에 있으면 데이터 구조가 두 곳에 생긴다.
    if (!drawWorldSprite(plot.cropAssetId, plot)) {
      const sizeByStage = { seed: 0.25, growing: 0.55, ready: 0.85 } as const
      const colorByStage = { seed: '#6b6152', growing: '#5f8a3a', ready: '#c8d94a' } as const
      const size = Math.min(halfW, halfH) * sizeByStage[plot.stage]

      ctx.fillStyle = colorByStage[plot.stage]
      ctx.fillRect(center.x - size, center.y - size, size * 2, size * 2)
    }

    // 야생동물이 먹는 중이면 진행 상태를 이 칸에 그린다 (DEC-UI-018).
    // 목표를 가리키는 선이나 화살표는 그리지 않는다 — 같은 DEC 가 금지한다.
    //
    // **작물보다 뒤에 그린다.** 스프라이트가 칸을 거의 다 덮어서 작물 밑에 두면
    // 가장자리만 물들고 무슨 일이 일어나는지 안 보인다. 도형 플레이스홀더일 때는
    // 작물이 작아서 티가 안 났다.
    if (plot.eatingProgress !== null) {
      ctx.fillStyle = 'rgba(212, 98, 47, 0.35)'
      ctx.fillRect(center.x - halfW, center.y - halfH, halfW * 2, halfH * 2)

      ctx.fillStyle = '#2a1c16'
      ctx.fillRect(center.x - halfW, center.y + halfH - 8, halfW * 2, 6)
      ctx.fillStyle = '#d4622f'
      ctx.fillRect(center.x - halfW, center.y + halfH - 8, halfW * 2 * plot.eatingProgress, 6)
    }

    // 수확 가능 상태가 유지되는 동안 표식을 계속 표시한다 (DEC-UI-004).
    // 효과음이 없어도 이것만으로 수확 가능 여부를 판단할 수 있어야 한다.
    if (plot.stage === 'ready') {
      ctx.strokeStyle = '#f2e34a'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(center.x, center.y - halfH + 12, 5, 0, Math.PI * 2)
      ctx.stroke()

      // 전환 순간의 1회 강조. 반복하지 않는다 (DEC-UI-004).
      if (plot.readyFlash > 0) {
        const grow = 1 + (1 - plot.readyFlash) * 0.6
        ctx.strokeStyle = `rgba(242, 227, 74, ${plot.readyFlash.toFixed(3)})`
        ctx.lineWidth = 4
        ctx.strokeRect(
          center.x - halfW * grow,
          center.y - halfH * grow,
          halfW * grow * 2,
          halfH * grow * 2,
        )
      }
    }

    // 성장 중인 단계만 진행도 막대를 둔다. 수확 가능은 제한시간이 없다.
    if (plot.stage !== 'ready') {
      const barWidth = halfW * 1.4
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
      ctx.fillRect(center.x - barWidth / 2, center.y + halfH - 14, barWidth, 4)
      ctx.fillStyle = '#c8d94a'
      ctx.fillRect(center.x - barWidth / 2, center.y + halfH - 14, barWidth * plot.progress, 4)
    }

    // 성장 단계부터 종류를 공개한다 (DEC-FARM-001).
    //
    // **칸 안쪽 위에 그린다.** 칸 밖에 두면 승인 좌표의 세로 간격(180)과 스프라이트
    // 높이(160)의 차이가 20px 뿐이라, 아랫줄의 라벨이 윗줄 칸에 닿는다.
    // 흙 위에 밝은 글씨라 배경이 밝은 작물에서 묻히므로 그림자를 깐다.
    if (plot.cropLabel !== null) {
      ctx.font = 'bold 13px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)'
      ctx.fillText(plot.cropLabel, center.x + 1, center.y - halfH + 27)
      ctx.fillStyle = '#f4ecd0'
      ctx.fillText(plot.cropLabel, center.x, center.y - halfH + 26)
      ctx.textAlign = 'start'
    }
  }


  resize()
  window.addEventListener('resize', resize)

  return { resize, draw, clear, canvas, camera }
}
