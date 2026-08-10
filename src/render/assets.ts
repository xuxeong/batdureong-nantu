// 논리 에셋 ID 해석과 이미지 적재 (DEC-ART-004, AGENTS.md 6절)
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
// `cutscene` 은 `assets/final/` 에 아직 비어 있다 (2026-08-08). `field_sprite`·`icon`·
// `projectile` 은 8/6 에, `portrait` 은 8/7 에, `logo`·`field_sprite_left/right/attack` 과
// `bgm`·`sfx` 는 8/8 에 채워졌다.
//
// **`sfx` 는 2026-08-08 에 일부가 연결됐다** — 야생동물 울음 3, 화상·감속 4.
// glob 이 `wav`·`mp3` 도 잡으므로 `URL_BY_ID` 에 들어오고, 재생은 `Image` 가 아니라
// `Audio` 라 `src/audio/` 가 따로 맡는다 (`assetUrl()` 로 주소만 받아 간다).
//
// 나머지 SFX 19종과 BGM 6종은 아직 못 붙는다 — 붙일 콘텐츠 부모가 없어서 고정
// 목록으로 가야 하는데 `DEC-ART-004` 가 그 목록의 구간을 `ui`·`logo`·`hud`·`font`
// 로 한정했다 (`docs/submission/SOUND_ASSET_INDEX.md` 의 "막혀 있는 것").
// 낫 소리 3종은 부모가 `player_base_stats` 하나로 몰려 `(content_id, asset_role)`
// 고유키에 걸린다 — 한 콘텐츠에 같은 역할은 하나뿐이다.
// `effect` 는 빈 구간이 아니라 **Canvas 2D 코드 구현 대상**이라 PNG 가 오지 않고,
// `font` 는 시스템 폰트를 쓰기로 해 파일을 만들지 않는다 (전성민 8/7).
// 그래서 **없는 것은 오류가 아니라 null 이고**
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
const FILES = import.meta.glob<string>('/assets/final/**/*.{png,webp,jpg,jpeg,wav,mp3,ttf}', {
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
 * 고정 목록이 유일한 자리다 (`DEC-ART-004`, 아트 디렉션 14.3). 코드가 쓰는 ID 를
 * 그 목록과 대조해서, 목록에서 빠졌는데 코드는 계속 부르는 상태를 막는다.
 */
const UI_ASSET_IDS: readonly string[] = enums.ui_system_asset_id.values

/**
 * 필드가 쓰는 UI 에셋 ID.
 *
 * **문자열을 여기 두는 것은 하드코딩이 아니다.** `DEC-PIPELINE-016` 이 막는 것은
 * 변경 가능한 게임 데이터이고, 이 ID 는 `DEC-ART-004` 이 확정한 고정 목록의 값이라
 * 승인 CSV 에 넣을 자리가 없다. 대신 아래에서 그 목록에 실제로 있는지 확인한다.
 */
export const UI_ASSET = {
  /** 수풀 앞 겹. 야생동물보다 위에 그린다 (아트 디렉션 12.2 A1) */
  fieldFrameFront: 'asset.ui.field_frame_front',
  /** `E` 대상 경작지 강조 틀 (DEC-UI-018) */
  plotHighlight: 'asset.ui.plot_highlight',
  /** 일차와 습격 예고가 한 틀 (DEC-UI-036, DEC-RUN-011) */
  signboard: 'asset.ui.signboard',
  /** 숫자 없는 가로 게이지 (DEC-UI-036) */
  farmingTimer: 'asset.ui.farming_timer',
  /** 초상화·이름·체력 바가 한 틀 */
  playerStatusCard: 'asset.ui.player_status_card',
  /** 투척 퀵슬롯 빈 칸 / 선택된 칸 (DEC-UI-002) */
  quickslot: 'asset.ui.quickslot',
  quickslotSelected: 'asset.ui.quickslot_selected',
  /**
   * 투척 퀵슬롯 수량 배지 46×40 (전성민 8/9).
   *
   * **투척 퀵슬롯 전용이다.** 회복 칸에는 자동 적용하지 않는다 — 같은 뜻의
   * 숫자지만 그림을 준 쪽이 퀵슬롯만 지정했다. 회복 칸은 CSS 판을 쓴다.
   */
  quickslotCountBadge: 'asset.ui.quickslot_count_badge',
  /**
   * 회복 사용 게이지 38×139 (DEC-UI-032).
   *
   * **세로다.** 확정문이 *"플레이어 캐릭터 바로 옆에 표시"* 라고 정했고 그림도
   * 세로라 캐릭터 옆에 세운다 — 8/9 까지는 머리 위 가로 막대였다.
   */
  healGauge: 'asset.ui.heal_gauge',
  /** 선택된 회복 아이템 칸 (DEC-UI-036) */
  recoverySlot: 'asset.ui.recovery_slot',
  /** 일시정지·설정 겸용 버튼 하나 (아트 디렉션 14.3) */
  settingsButton: 'asset.ui.settings_button',
  /**
   * 마우스 커서 (작업 15번, 2026-08-09).
   *
   * **파일보다 먼저 등록했다** — `assets/final/ui/cursor.png` 가 들어오면
   * 코드 변경 없이 커서가 바뀐다 (main.ts 가 부팅 때 확인한다). 그때까지는
   * 시스템 커서다. 브라우저 제한상 128px 이하여야 하고 32px 안팎을 권장한다.
   */
  cursor: 'asset.ui.cursor',
  /**
   * 눌린 순간의 긁힘 자국 (2026-08-10, 전성민 요청).
   *
   * 커서 그림을 바꾸는 것이 아니라 **누른 자리에 잠깐 남는 표시**다. 커서와
   * 별개 파일인 이유가 그것이다 — 커서는 늘 떠 있고 이쪽은 순간이다.
   */
  cursorClickScratch: 'asset.ui.cursor_click_scratch',
  /**
   * 닫기 버튼.
   *
   * **정비 팝업은 더 이상 쓰지 않는다** (2026-08-08). 팝업이 항상 하나 열려 있고
   * 기능 버튼 넷이 갈아 끼우게 되면서 닫는 입력 자체가 없어졌다. 다른 창에서
   * 쓸 자리가 남아 있어 목록과 이 이름은 그대로 둔다 — 파일도 있다.
   */
  closeButton: 'asset.ui.close_button',
  /**
   * 전투 전·투항 대화의 선택지 말풍선 (아트 디렉션 12.2 A4).
   *
   * 세 선택지가 같은 그림을 쓴다. **기능별로 다른 그림을 주지 않는다** —
   * `DEC-UI-007` 이 "구분이 기능 이름을 드러내지 않게" 로 확정했고, 그림이 갈리면
   * 그것이 곧 기능 태그가 된다. 구분은 자리 순서로만 준다 (ui/dialogue-modal.ts).
   */
  choiceBalloon: 'asset.ui.choice_balloon',
  /**
   * 대사창 9-slice 두 장 (아트 디렉션 12.2 A4).
   *
   * `panel_border` 가 테두리, `panel_texture` 가 안쪽 바탕이다.
   * **`panel_texture` 는 타일링하지 않는다** — 위아래 끝 색차가 674 라 세로로
   * 반복하면 가로줄이 규칙적으로 생긴다. `background-size: 100% 100%` 로 늘린다.
   */
  panelBorder: 'asset.ui.panel_border',
  panelTexture: 'asset.ui.panel_texture',
  /**
   * 발화자 이름판과 선택지 버튼 (아트 디렉션 12.2 A4).
   *
   * 눌림 상태는 `button_pressed` 파일이 있지만 쓰지 않는다 — CSS `:active` 로
   * 처리하는 것이 8/6 에 정해졌다. 그래서 고정 목록에도 넣지 않았다.
   */
  buttonNormal: 'asset.ui.button_normal',
  buttonDisabled: 'asset.ui.button_disabled',
  /**
   * 타이틀 화면 배경과 로고 (아트 디렉션 A0, 전성민 8/8).
   *
   * 배경은 1672×941 로 16:9 라 1920×1080 무대에 그대로 늘어난다. 오른쪽 기둥은
   * **배경 그림의 일부**다 — 팻말만 `buttonNormal` 로 얹는다.
   */
  bgTitle: 'asset.ui.bg_title',
  logoTitle: 'asset.logo.title',
  /**
   * 팀 크레딧 (8/10) — 타이틀 우측 상단. 로고(103×107)를 누르면 말풍선
   * (190×89)이 켜졌다 꺼진다. 효과음은 `SOUND_ASSET.teamLogoCluck`.
   */
  teamLogo: 'asset.logo.team_nanwoosudak',
  teamCreditBalloon: 'asset.ui.team_credit_balloon',

  /**
   * 정비 화면 배경 (아트 디렉션 12.5.5 B5, A3 목업).
   *
   * 닫힌 미닫이문 한 장을 가운데서 자른 것이라 각 960×1080 이고 붙이면 1920×1080 이
   * 된다. **두 장으로 나뉜 이유는 나중에 좌우로 여는 연출을 위해서다** — 지금은
   * 닫힌 채로만 쓴다. 가운데 세로 기둥은 이 그림에 이미 있다.
   */
  shutterLeft: 'asset.ui.shutter_left',
  shutterRight: 'asset.ui.shutter_right',

  /**
   * 보관함 칸 (아트 디렉션 12.5.2 B2).
   *
   * **퀵슬롯과 다른 물건이다.** 둘 다 나무 정사각형이지만 보관함 칸은 수량 배지가
   * 모서리에 물려 있다. `quickslot` 으로 대신하지 않는다고 아트 디렉션이 못 박았다.
   * 수량이 있으면 `itemSlotBadge`, 없으면 `itemSlot` 이고 크기가 미세하게 다르다
   * (105×107 대 111×113 — 배지가 칸 밖으로 물려 나온 만큼이다).
   */
  itemSlot: 'asset.ui.item_slot',
  itemSlotBadge: 'asset.ui.item_slot_badge',
  /** 소지금 틀. 엽전 그림이 판 안에 이미 있어 숫자만 얹는다 (B2) */
  moneyPlate: 'asset.ui.money_plate',
  /**
   * 낱개 엽전 (2026-08-08).
   *
   * 정비 화면에서 값 앞에 서는 작은 그림이다 — 판매·구매 목록의 단가, 오른쪽 판의
   * 총액과 거래 후 남는 소지금. **`moneyPlate` 안의 엽전은 판과 한 덩어리라
   * 떼어 쓸 수 없다.**
   *
   * 파일보다 먼저 등록했다 (만들어져 있고 반입 대기 — 전성민 8/8). `bg_*` 아홉을
   * 같은 이유로 먼저 등록한 적이 있다. `assets/final/ui/coin.png` 가 들어오면
   * 코드를 고치지 않고 그림이 나타난다.
   */
  coin: 'asset.ui.coin',
  /** 잠긴 레시피 표시 (B2, DEC-UI-006) */
  lockIcon: 'asset.ui.lock_icon',
  /** 수량 증감 버튼 (B4). 79×58 과 79×61 로 높이가 다르다 */
  stepPlus: 'asset.ui.step_plus',
  stepMinus: 'asset.ui.step_minus',

  /**
   * 정비 화면의 습격 예고 표지 세 종 (아트 디렉션 12.5.3 B3, DEC-RUN-011).
   *
   * **재배 HUD 는 이 판을 쓰지 않는다.** 거기서는 `signboard` 아래칸에 문구만 들어가고
   * 세 종류의 구분은 `layout.css` 의 색이 한다. 여기서는 판이 그림 자리와 문구 자리로
   * 나뉘어 있어 `moneyPlate` 와 같은 구조다 — 그림은 판에 있고 `hud_label` 문구를
   * 코드가 옆칸에 얹는다.
   */
  raidNoticeNone: 'asset.ui.raid_notice_none',
  raidNoticeRaid: 'asset.ui.raid_notice_raid',
  raidNoticeFinal: 'asset.ui.raid_notice_final',

  /**
   * 일차 시작 화면 (A5 목업, 전성민 8/9).
   *
   * 배경 1919×1080 은 16:9 라 무대에 그대로 늘어난다. 오른쪽 나무 기둥은
   * **배경 그림의 일부**다 — 족자만 그 위에 건다.
   *
   * `dayStartScroll` 830×1106 은 농장 일지가 적히는 족자다. **1일차에는 걸지
   * 않는다** — 그날은 지난밤이 없어 일지도 없고, 목업도 기둥만 비워 뒀다.
   */
  bgDayStart: 'asset.ui.bg_day_start',
  dayStartScroll: 'asset.ui.day_start_scroll',

  /** 조우 결과·밤 결과 화면 배경 (DEC-UI-023) */
  bgEncounterResult: 'asset.ui.bg_encounter_result',
  bgNightResult: 'asset.ui.bg_night_result',
  /**
   * 엔딩 기록문 대자보 1148×1148 (A8 목업, 8/10 배선).
   *
   * 화면 오른쪽에 서고 LLM 기록문이 이 판의 흰 종이 위에 적힌다.
   * 등록은 8/9 에 해 뒀고 배선이 이날 붙었다.
   */
  endingRecordBoard: 'asset.ui.ending_record_board',
  /**
   * 런 실패 화면 배경 — 타이틀 배경에서 표지판을 뺀 판 (8/9 폴리싱).
   *
   * ID 는 8/8 에 선등록했고 **파일이 아직 없다** (전성민 제작 대기). 올 때까지
   * 런 실패 화면은 아래 `CUTSCENE_GLOBAL_FALLBACK` 으로 떨어진다.
   */
  bgRunFailed: 'asset.ui.bg_run_failed',
} as const

/**
 * 공용 폴백 컷신 (8/9 폴리싱).
 *
 * `endings.csv` 의 `ending.global_fallback` 에 연결된 그림과 같은 파일이다.
 * 런 실패 배경(전용 그림 대기)과 컷신이 없는 화면의 폴백으로 쓴다.
 *
 * **`UI_ASSET` 에 넣지 않는 이유** — 저 표는 고정 목록(`ui_system_asset_id`)과
 * 대조하는데 `cutscene` 은 콘텐츠 연결 구간이라 그 목록에 없다. 콘텐츠 쪽
 * 정식 경로는 `endings.json` 의 `assets.cutscene` 이고, 이 상수는 화면이 자기
 * 엔딩을 모를 때의 마지막 폴백이다.
 */
export const CUTSCENE_GLOBAL_FALLBACK = 'asset.cutscene.global_fallback'

/**
 * 본문 폰트의 논리 에셋 ID (`DEC-ART-004`).
 *
 * **WOFF2 가 아니라 TTF 다.** 저장소 관례(`assets/README.md`)는 WOFF2 지만
 * 이 폰트는 라이선스가 파일 수정을 금지해서 변환할 수 없다. 자세한 것은
 * `docs/submission/CREDITS.md` 와 `schema_manifest` 16→17 에 적었다.
 *
 * **CSS `@font-face` 를 쓰지 않는 이유.** `src:` 는 CSS 변수를 못 읽어서 경로를
 * 스타일시트에 직접 적어야 하는데, 그러면 경로를 아는 곳이 이 파일 말고 하나 더
 * 생긴다. 대신 `ui/font.ts` 가 이 ID 로 URL 을 받아 `FontFace` 로 등록한다.
 */
export const FONT_ASSET = {
  /** 화면 전체의 본문·제목. 굵기 하나뿐이라 역할을 나누지 않는다 */
  body: 'asset.font.griun_x_hangeul_equal',
} as const

/** `@font-face` 와 `ctx.font` 가 함께 쓰는 이름. 파일이 없으면 아래 대체 폰트로 내려간다 */
export const FONT_FAMILY = 'GriunXHangeul Equal'

/**
 * 배경음의 논리 에셋 ID (`DEC-ART-005`).
 *
 * **`UI_ASSET` 과 같은 자리다.** 2026-08-08 에 `DEC-ART-004` 를 폐기·대체하면서
 * 고정 목록이 쓸 수 있는 구간에 `bgm`·`sfx` 가 열렸다. 배경음은 화면·단계에
 * 붙는 소리라 어떤 콘텐츠에도 속하지 않아 `content_assets.csv` 로는 관리할 수 없다.
 *
 * **어느 화면에 어느 트랙인지는 여기 없다.** 그 판단은 `main.ts` 가 하고 이
 * 파일은 이름만 준다 — `audio/bgm.ts` 가 경로를 모르는 것과 같은 이유다.
 */
export const BGM_ASSET = {
  /** 타이틀 화면 */
  title: 'asset.bgm.title',
  /** 재배와 정비 공용. 두 단계가 이어지는 동안 트랙을 끊지 않는다 */
  farm: 'asset.bgm.farm',
  /** 습격 전투 (2~4일차) */
  raid: 'asset.bgm.raid',
  /** 마지막 습격 — 이장 결투 (5일차) */
  boss: 'asset.bgm.boss',
  /** 런 실패 화면 */
  defeat: 'asset.bgm.defeat',
  /** 엔딩 화면 공용 */
  ending: 'asset.bgm.ending',
} as const

/**
 * 콘텐츠에 붙일 수 없는 효과음의 논리 에셋 ID (`DEC-ART-005`).
 *
 * **셋뿐인 이유가 있다.** 효과음 대부분은 부모 콘텐츠가 있어 `content_assets.csv`
 * 로 붙는다(야생동물 울음 3·화상 2·감속 2). 낫 소리 셋은 부모가
 * `player_base_stats.prototype` 하나로 몰리는데 그 표의 고유키가
 * `(content_id, asset_role)` 이라 **한 콘텐츠에 `sfx` 는 하나뿐**이다.
 * 그래서 이 셋만 고정 목록으로 온다.
 *
 * 나머지 효과음 19종은 아직 어느 트리거에 붙일지 정리가 안 끝나 등록하지 않았다
 * (`docs/submission/SOUND_ASSET_INDEX.md`). 여기 이름을 먼저 적어 두지 않는다 —
 * 목록에 없는 ID 는 아래 검사가 거절한다.
 */
export const SOUND_ASSET = {
  /** 휘두르는 순간. 명중과 무관하게 난다 */
  sickleSwing: 'asset.sfx.sickle_swing',
  /** 낫이 실제로 맞았을 때 */
  sickleHit: 'asset.sfx.sickle_hit',
  /** 플레이어가 맞았을 때. 피격 깜빡임의 짝이다 */
  playerHit: 'asset.sfx.player_hit',

  /** 버튼 클릭 전반. 어느 화면이든 같은 소리다 */
  buttonClick: 'asset.sfx.button_click',
  /** 타이틀 팀 크레딧 로고를 누를 때 — 누를 때마다 난다 (8/10) */
  teamLogoCluck: 'asset.sfx.team_logo_cluck',
  /** 눌렸지만 거절된 것 (`request.rejected`) */
  buttonReject: 'asset.sfx.button_reject',
  /** 오버레이가 열릴 때 */
  modalOpen: 'asset.sfx.modal_open',
  /** 독립 화면 전환 */
  screenTransition: 'asset.sfx.screen_transition',

  plantSeed: 'asset.sfx.plant_seed',
  /** 수확 가능으로 바뀌는 순간. `DEC-UI-004` 가 요구하는 소리다 */
  harvestReady: 'asset.sfx.harvest_ready',
  harvest: 'asset.sfx.harvest',
  /** 판매·구매·보상 획득 공용 */
  tradeConfirm: 'asset.sfx.trade_confirm',

  /** 퀵슬롯 선택 전환과 소진 자동 전환 공용 */
  quickslotSwitch: 'asset.sfx.quickslot_switch',
  /** 던질 것이 하나도 안 남았다 */
  quickslotEmpty: 'asset.sfx.quickslot_empty',
  throw: 'asset.sfx.throw',
  /** 투척 명중 — `impact_mode` 로 가른다 (DEC-CONTENT-005) */
  impactDirect: 'asset.sfx.impact_direct',
  impactArea: 'asset.sfx.impact_area',

  recoveryStart: 'asset.sfx.recovery_start',
  recoveryComplete: 'asset.sfx.recovery_complete',

  dialogueOpen: 'asset.sfx.dialogue_open',
  /** 야생동물 처치 (공통) */
  wildlifeDefeat: 'asset.sfx.wildlife_defeat',
  /** 주민을 죽여서 조우가 끝났다 */
  residentDefeat: 'asset.sfx.resident_defeat',

  /**
   * 일차 시작 화면의 습격 예고 스팅어 셋 (`DEC-RUN-011`, 전성민 8/8).
   *
   * **화면 전환음과 별개다.** 전환음은 "화면이 바뀌었다" 이고 이쪽은 "오늘 밤에
   * 무엇이 오는가" 라 서로 다른 정보다. 원래 습격 예고 3종과 일차 시작 1종으로
   * 나뉘어 있던 것을 하나로 합친 결과다.
   *
   * `none` 과 `raid` 는 같은 소리를 쓴다 — 파일 둘이 내용이 같고 의도된 재사용이다.
   * ID 를 나눠 두면 나중에 갈라도 코드가 안 바뀐다.
   */
  dayStartNone: 'asset.sfx.day_start_none',
  dayStartRaid: 'asset.sfx.day_start_raid',
  dayStartFinal: 'asset.sfx.day_start_final',

  /** 런이 실패한 순간의 스팅어. `defeat.mp3`(배경음)와 별개로 둔다 */
  runFailed: 'asset.sfx.run_failed',
  /** 엔딩이 확정된 순간의 스팅어 */
  endingDecided: 'asset.sfx.ending_decided',

  /**
   * 글자가 찍히는 소리 (`DEC-UI-008` 순차 출력).
   *
   * **글자마다 내지 않는다.** 28ms 간격으로 매 글자 내면 초당 36번이라 소리가
   * 아니라 잡음이 된다. 부르는 쪽이 몇 글자에 한 번만 낸다.
   */
  recordTyping: 'asset.sfx.record_typing',
} as const

for (const id of [
  ...Object.values(BGM_ASSET),
  ...Object.values(SOUND_ASSET),
  ...Object.values(FONT_ASSET),
]) {
  if (UI_ASSET_IDS.includes(id)) continue
  throw new Error(
    `${id} 가 schema/enums.json 의 ui_system_asset_id 고정 목록에 없다. ` +
      '새 ID 추가는 데이터 행 추가가 아니라 스키마 변경이다 (DEC-ART-005)',
  )
}

for (const id of Object.values(UI_ASSET)) {
  if (UI_ASSET_IDS.includes(id)) continue
  // 목록에서 빠진 ID 는 스키마 변경으로 다시 넣어야 한다. 코드가 임의로 쓰지 않는다.
  throw new Error(
    `${id} 가 schema/enums.json 의 ui_system_asset_id 고정 목록에 없다. ` +
      '새 ID 추가는 데이터 행 추가가 아니라 스키마 변경이다 (DEC-ART-004)',
  )
}

/** 논리 에셋 ID 로 파일이 실제로 있는지. 화면을 그리기 전에 물어볼 때 쓴다 */
export function hasAssetFile(assetId: string | null | undefined): boolean {
  return assetId !== null && assetId !== undefined && URL_BY_ID.has(assetId)
}

/**
 * 논리 에셋 ID 의 번들 URL. 파일이 없으면 null.
 *
 * **`assetCssUrl()` 과 달리 `url("…")` 로 감싸지 않는다.** 소리는 CSS 가 아니라
 * `Audio` 가 받으므로 주소 그대로여야 한다 (`src/audio/`).
 */
export function assetUrl(assetId: string | null | undefined): string | null {
  if (assetId === null || assetId === undefined) return null
  return URL_BY_ID.get(assetId) ?? null
}

/**
 * DOM 이 배경 이미지로 쓸 URL. 파일이 없으면 null.
 *
 * **CSS 파일에 경로를 적지 않기 위한 통로다.** `layout.css` 는 위치·크기·색의
 * 원본이지만(`DEC-ART-004`, 8/4) 파일 경로까지 갖게 하면 경로를 아는 곳이 둘이 되고,
 * 번들러가 해시를 붙이므로 CSS 에 적은 이름은 빌드에서 깨진다.
 *
 * 그래서 TS 가 `--...-image` 커스텀 프로퍼티에 URL 만 넣고 CSS 가 그것을 참조한다.
 * 어디에 얼마나 크게 그릴지는 계속 CSS 가 정한다.
 */
export function assetCssUrl(assetId: string | null | undefined): string | null {
  // 붙어 있지 않은 역할은 `undefined` 로 온다 (`crops[].assets?.icon` 등).
  // 부르는 쪽마다 가드를 두면 그중 하나는 빠지므로 여기서 받는다 — `hasAssetFile()`
  // 과 같은 규칙이다.
  if (assetId === null || assetId === undefined) return null
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
