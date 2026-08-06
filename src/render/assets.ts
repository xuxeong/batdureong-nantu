// 논리 에셋 ID 해석과 이미지 적재 (DEC-ART-001, AGENTS.md 6절)
//
// ── 경로를 아는 곳은 여기 하나다 ───────────────────────────
//
// `AGENTS.md` 6절이 *"코드와 콘텐츠는 실제 파일 경로가 아니라 논리 에셋 ID를
// 참조한다"* 로 정했다. 그래서 렌더도 시스템도 ID 만 넘기고, 그것이 어느 파일인지는
// 이 파일만 안다.
//
//   asset.<구간>.<이름>   →   assets/final/<구간>/<이름>.<확장자>
//
// **카탈로그 표를 따로 두지 않는다.** 이 대응은 아트 디렉션 13.2 와
// `schema/tables/content_assets.json` 주석이 규칙으로 확정한 것이라 조회표가
// 필요 없고, 표를 만들면 파일과 표가 갈릴 자리가 하나 더 생긴다.
//
// ── 파일이 없는 구간이 아직 있다 ───────────────────────────
//
// `field_sprite`·`portrait`·`icon`·`projectile`·`effect`·`logo`·`font` 는
// `assets/final/` 에 아직 비어 있다. 그래서 **없는 것은 오류가 아니라 null 이고**
// 부르는 쪽이 플레이스홀더로 그린다 (`AGENTS.md` 6절 — 실제 아트가 없으면 명확한
// 플레이스홀더를 쓴다).
//
// 승인 데이터의 누락과는 다르다. 데이터가 없으면 검증 오류지만, 아트는 후반에
// 논리 에셋 ID 로 교체하는 것이 처음부터 정해진 순서다.
//
// 다만 **조용히 넘어가지는 않는다** — 개발 빌드에서 ID 당 한 번 경고한다.
// 오타 난 ID 와 아직 안 그린 그림이 화면에서 똑같이 "아무것도 없음" 으로 보이기 때문이다.

import enums from '../../schema/enums.json'

const isDevBuild = import.meta.env.VITE_BUILD_MODE !== 'submission'

/**
 * 빌드 시점에 확정되는 파일 목록.
 *
 * `import.meta.glob` 이라 번들에 포함되고, 개발 서버와 빌드 결과가 같은 URL 로
 * 동작한다. `assets/` 는 `publicDir`(= `public/`) 밖이라 정적 경로로 fetch 할 수 없다 —
 * `generated/runtime/` 을 읽는 `data/loader.ts` 와 같은 이유다.
 */
const FILES = import.meta.glob<string>('/assets/final/**/*.{png,webp,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
})

/**
 * `asset.<구간>.<이름>` → 번들 URL.
 *
 * 구간과 이름은 영문 소문자·숫자·밑줄만 쓴다 (아트 디렉션 13.2). 그 형식에서
 * 벗어난 파일(`.gitkeep` 등)은 에셋이 아니므로 조용히 건너뛴다.
 */
const URL_BY_ID = new Map<string, string>()

for (const [path, url] of Object.entries(FILES)) {
  const matched = /^\/assets\/final\/([a-z0-9_]+)\/([a-z0-9_]+)\.[a-z0-9]+$/.exec(path)
  if (matched === null) continue
  URL_BY_ID.set(`asset.${matched[1]}.${matched[2]}`, url)
}

/**
 * UI·시스템 에셋의 고정 허용 목록 (`schema/enums.json` 의 `ui_system_asset_id`).
 *
 * 이 구간은 어떤 콘텐츠에도 속하지 않아 `content_assets.csv` 로 관리할 수 없고
 * 고정 목록이 유일한 자리다 (`DEC-ART-001`, 아트 디렉션 14.3). 코드가 쓰는 ID 를
 * 그 목록과 대조해서, 목록에서 빠졌는데 코드는 계속 부르는 상태를 막는다.
 */
const UI_ASSET_IDS: readonly string[] = enums.ui_system_asset_id.values

/**
 * 필드가 쓰는 UI 에셋 ID.
 *
 * **문자열을 여기 두는 것은 하드코딩이 아니다.** `DEC-PIPELINE-016` 이 막는 것은
 * 변경 가능한 게임 데이터이고, 이 ID 는 `DEC-ART-001` 이 확정한 고정 목록의 값이라
 * 승인 CSV 에 넣을 자리가 없다. 대신 아래에서 그 목록에 실제로 있는지 확인한다.
 */
export const UI_ASSET = {
  /** 수풀 앞 겹. 야생동물보다 위에 그린다 (아트 디렉션 12.2 A1) */
  fieldFrameFront: 'asset.ui.field_frame_front',
  /** `E` 대상 경작지 강조 틀 (DEC-UI-018) */
  plotHighlight: 'asset.ui.plot_highlight',
  /** 일차와 습격 예고가 한 틀 (DEC-UI-017, DEC-RUN-011) */
  signboard: 'asset.ui.signboard',
  /** 숫자 없는 가로 게이지 (DEC-UI-017) */
  farmingTimer: 'asset.ui.farming_timer',
  /** 초상화·이름·체력 바가 한 틀 */
  playerStatusCard: 'asset.ui.player_status_card',
  /** 투척 퀵슬롯 빈 칸 / 선택된 칸 (DEC-UI-002) */
  quickslot: 'asset.ui.quickslot',
  quickslotSelected: 'asset.ui.quickslot_selected',
  /** 선택된 회복 아이템 칸 (DEC-UI-017) */
  recoverySlot: 'asset.ui.recovery_slot',
  /** 일시정지·설정 겸용 버튼 하나 (아트 디렉션 14.3) */
  settingsButton: 'asset.ui.settings_button',
  /**
   * 전투 전·투항 대화의 선택지 말풍선 (아트 디렉션 12.2 A4).
   *
   * 세 선택지가 같은 그림을 쓴다. **기능별로 다른 그림을 주지 않는다** —
   * `DEC-UI-007` 이 "구분이 기능 이름을 드러내지 않게" 로 확정했고, 그림이 갈리면
   * 그것이 곧 기능 태그가 된다. 구분은 자리 순서로만 준다 (ui/dialogue-modal.ts).
   */
  choiceBalloon: 'asset.ui.choice_balloon',
} as const

for (const id of Object.values(UI_ASSET)) {
  if (UI_ASSET_IDS.includes(id)) continue
  // 목록에서 빠진 ID 는 스키마 변경으로 다시 넣어야 한다. 코드가 임의로 쓰지 않는다.
  throw new Error(
    `${id} 가 schema/enums.json 의 ui_system_asset_id 고정 목록에 없다. ` +
      '새 ID 추가는 데이터 행 추가가 아니라 스키마 변경이다 (DEC-ART-001)',
  )
}

/** 논리 에셋 ID 로 파일이 실제로 있는지. 화면을 그리기 전에 물어볼 때 쓴다 */
export function hasAssetFile(assetId: string | null | undefined): boolean {
  return assetId !== null && assetId !== undefined && URL_BY_ID.has(assetId)
}

/**
 * DOM 이 배경 이미지로 쓸 URL. 파일이 없으면 null.
 *
 * **CSS 파일에 경로를 적지 않기 위한 통로다.** `layout.css` 는 위치·크기·색의
 * 원본이지만(`DEC-ART-001`, 8/4) 파일 경로까지 갖게 하면 경로를 아는 곳이 둘이 되고,
 * 번들러가 해시를 붙이므로 CSS 에 적은 이름은 빌드에서 깨진다.
 *
 * 그래서 TS 가 `--...-image` 커스텀 프로퍼티에 URL 만 넣고 CSS 가 그것을 참조한다.
 * 어디에 얼마나 크게 그릴지는 계속 CSS 가 정한다.
 */
export function assetCssUrl(assetId: string): string | null {
  const url = URL_BY_ID.get(assetId)
  return url === undefined ? null : `url("${url}")`
}

export interface AssetImages {
  /**
   * 그릴 준비가 된 이미지. 아직 적재 중이거나 파일이 없으면 null 이다.
   *
   * **null 을 오류로 다루지 않는다.** 부르는 쪽이 플레이스홀더로 그린다.
   */
  get(assetId: string | null | undefined): HTMLImageElement | null
  /**
   * 필요한 것을 미리 받아 둔다.
   *
   * 없어도 동작하지만(첫 프레임에 없으면 다음 프레임부터 나온다) 화면이 한 번
   * 껌뻑인다. 실패한 ID 가 있어도 거부하지 않는다 — 아트는 없을 수 있고,
   * 그것 때문에 런 시작이 막히면 안 된다.
   */
  preload(assetIds: readonly (string | null | undefined)[]): Promise<void>
}

export function createAssetImages(): AssetImages {
  /** 적재가 끝난 이미지. 파일이 없거나 실패했으면 null 을 넣어 다시 시도하지 않는다 */
  const ready = new Map<string, HTMLImageElement | null>()
  /** 적재 중인 것. 같은 ID 로 두 번 요청해도 한 번만 받는다 */
  const pending = new Map<string, Promise<void>>()
  /** 경고를 ID 당 한 번만 남긴다. 매 프레임 부르므로 안 그러면 콘솔이 잠긴다 */
  const warned = new Set<string>()

  function warnOnce(assetId: string, message: string): void {
    if (!isDevBuild || warned.has(assetId)) return
    warned.add(assetId)
    console.warn(`[에셋] ${message}`)
  }

  function load(assetId: string): Promise<void> {
    const existing = pending.get(assetId)
    if (existing !== undefined) return existing

    const url = URL_BY_ID.get(assetId)
    if (url === undefined) {
      ready.set(assetId, null)
      warnOnce(
        assetId,
        `${assetId} 에 해당하는 파일이 assets/final/ 에 없다. ` +
          '아직 안 그린 구간이면 플레이스홀더로 그려지고, 아니면 ID 오타다',
      )
      return Promise.resolve()
    }

    const image = new Image()
    const task = new Promise<void>((resolve) => {
      image.onload = () => {
        ready.set(assetId, image)
        resolve()
      }
      image.onerror = () => {
        ready.set(assetId, null)
        warnOnce(assetId, `${assetId} 를 불러오지 못했다 (${url})`)
        resolve()
      }
    })
    image.src = url

    pending.set(assetId, task)
    return task
  }

  return {
    get(assetId) {
      if (assetId === null || assetId === undefined) return null
      const known = ready.get(assetId)
      if (known !== undefined) return known
      // 아직 안 받았으면 지금 시작하고 이번 프레임은 플레이스홀더로 넘어간다.
      void load(assetId)
      return null
    },

    async preload(assetIds) {
      const targets = assetIds.filter(
        (id): id is string => id !== null && id !== undefined,
      )
      await Promise.all(targets.map((id) => load(id)))
    },
  }
}
