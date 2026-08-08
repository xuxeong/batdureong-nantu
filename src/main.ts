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
import type { ScreenId } from './core/events.ts'
import type { SceneManager } from './scenes/manager.ts'
import { createInput } from './input/input.ts'
import { fillPlayerName, subjectParticle } from './ui/korean.ts'
import { clampToWorld } from './systems/world-bounds.ts'
import { createAllySupport } from './systems/ally-support.ts'
import type { AllySupport, AllySupportProfile } from './systems/ally-support.ts'
import { BGM_ASSET, SOUND_ASSET, createAssetImages, UI_ASSET } from './render/assets.ts'
import { createCamera } from './render/camera.ts'
import { createFieldRenderer } from './render/field.ts'
import { createStage } from './render/stage.ts'
import type { FieldAssetIds, HostileView, PlotView } from './render/field.ts'
import { runConfig, setPlayerBaseStats } from './data/run-config.ts'
import { loadRuntimeData, requireTables } from './data/loader.ts'
import { createFarming } from './systems/farming.ts'
import type { FarmingSystem } from './systems/farming.ts'
import { createStageTimer } from './systems/stage-timer.ts'
import type { StageTimer } from './systems/stage-timer.ts'
import { createCombat } from './systems/combat.ts'
import type { CombatEvent, CombatSystem, CombatTarget } from './systems/combat.ts'
import { headingStep, walkStep } from './render/motion.ts'
import type { Facing } from './render/motion.ts'
import { createBgm } from './audio/bgm.ts'
import { createMixer } from './audio/mixer.ts'
import { createSfx } from './audio/sfx.ts'
import { createWildlife } from './systems/wildlife.ts'
import type { WildlifeSystem } from './systems/wildlife.ts'
import { createResidentCombat } from './systems/resident-combat.ts'
import type { HostileRuntime, ResidentCombatSystem } from './systems/resident-combat.ts'
import { createEncounter } from './systems/encounter.ts'
import type { Encounter } from './systems/encounter.ts'
import { createResolution } from './systems/resolution.ts'
import type { FearIncrements, Resolution } from './systems/resolution.ts'
import { createEndingJudge } from './systems/ending.ts'
import type { EndingJudge } from './systems/ending.ts'
import { buildEndingInput, requestEndingRecord } from './llm/ending.ts'
import type {
  ContentAssets,
  CraftingMaterial,
  Crop,
  FearBand,
  FearIncrement,
  FinalOutcome,
  JournalFallback,
  NightResultText,
  RaidNotice,
  RaidType,
  Recipe,
  RecoveryItem,
  RewardBundle,
  ThrowableWeapon,
  TutorialCompletionKey,
  TutorialStep,
  WildlifeSpawnEntry,
  WildlifeSpawnProfile,
} from './data/types.ts'
import { createRunState } from './state/run-state.ts'
import type { JournalBaseline, RunState } from './state/types.ts'
import { createHud } from './ui/hud.ts'
import type { Hud } from './ui/hud.ts'
import { createMaintenanceHub, createPopupShell } from './ui/maintenance-hub.ts'
import type { HubPopupId, InventoryRow, MaintenanceHub } from './ui/maintenance-hub.ts'
import { createNightResult, selectNightResultText } from './ui/night-result.ts'
import type { NightResultScreen, NightResultSelection } from './ui/night-result.ts'
import { createTitle } from './ui/title.ts'
import type { TitleScreen } from './ui/title.ts'
import { createNameInput } from './ui/name-input.ts'
import type { NameInputScreen } from './ui/name-input.ts'
import { createPause } from './ui/pause.ts'
import type { PauseScreen } from './ui/pause.ts'
import { createLoading } from './ui/loading.ts'
import type { LoadingScreen } from './ui/loading.ts'
import { createDataError } from './ui/data-error.ts'
import type { DataErrorScreen } from './ui/data-error.ts'
import { createTutorial } from './ui/tutorial.ts'
import type { TutorialScreen } from './ui/tutorial.ts'
import { createTutorialProgress } from './systems/tutorial.ts'
import type { TutorialProgress } from './systems/tutorial.ts'
import { createRecoveryMenu } from './ui/recovery-menu.ts'
import type { RecoveryMenu } from './ui/recovery-menu.ts'
import { createDayStart, selectRaidNotice } from './ui/day-start.ts'
import type { DayStartJournal, DayStartScreen } from './ui/day-start.ts'
import { createRunFailed } from './ui/run-failed.ts'
import type { RunFailedScreen } from './ui/run-failed.ts'
import { createEnding } from './ui/ending.ts'
import type { EndingScreen } from './ui/ending.ts'
import {
  buildJournalInput,
  fearDirection,
  requestJournal,
  selectJournalFallback,
} from './llm/journal.ts'
import { createEncounterResult } from './ui/encounter-result.ts'
import type {
  EncounterResourceLine,
  EncounterResultScreen,
  EncounterResultView,
} from './ui/encounter-result.ts'
import { createEconomy } from './systems/economy.ts'
import {
  advanceRecovery,
  recoveryOptions,
  startRecovery,
  syncSelection,
} from './systems/recovery.ts'
import type { RecoverySources } from './systems/recovery.ts'
import type { Economy } from './systems/economy.ts'
import { createShopModal } from './ui/shop-modal.ts'
import type { ShopItemView, ShopMode } from './ui/shop-modal.ts'
import { createCraftModal } from './ui/craft-modal.ts'
import type { CraftRecipeView, CraftStatView } from './ui/craft-modal.ts'
import type { TooltipStat } from './ui/tooltip.ts'
import { createQuickslotModal } from './ui/quickslot-modal.ts'
import type { QuickslotView } from './ui/quickslot-modal.ts'
import { createDialogueModal } from './ui/dialogue-modal.ts'
import type {
  DialogueChoiceView,
  DialogueModal,
  DialoguePhase,
} from './ui/dialogue-modal.ts'
import type { ItemStore } from './state/types.ts'

const isDevBuild = import.meta.env.VITE_BUILD_MODE !== 'submission'

// 기준 해상도 무대를 창에 맞춘다 (DEC-UI-025). 필드와 UI 가 함께 확대·축소된다.
const stageRoot = document.getElementById('stage')
if (stageRoot === null) throw new Error('#stage 요소가 없다')

const gameRoot = document.getElementById('game')
if (gameRoot === null) throw new Error('#game 요소가 없다')

const bus = createEventBus()
const camera = createCamera()
// 논리 에셋 ID → 그림. 파일 경로를 아는 곳은 render/assets.ts 하나다 (AGENTS.md 6절)
const assetImages = createAssetImages()
const renderer = createFieldRenderer(gameRoot, camera, assetImages)

// 배율이 정해진 뒤에 캔버스 백킹을 다시 잡는다. 순서가 반대면 렌더러가 이전
// 배율을 보고 창보다 큰 해상도로 그린다 (8/5에 12fps 까지 떨어졌다).
createStage(stageRoot, { onScaleChanged: () => renderer.resize() })

// 재배는 승인 데이터가 들어와야 시작된다. 없으면 null 로 남고 밭이 그려지지 않는다.
// 여기에 임시 경작지를 만들어 넣지 않는다 — 데이터가 없다는 사실이 화면에 보여야 한다.
let farming: FarmingSystem | null = null
let farmingTimer: StageTimer | null = null
let cropsById = new Map<string, Crop>()

/**
 * 필드가 그릴 논리 에셋 ID (DEC-ART-004).
 *
 * 승인 데이터가 오기 전에는 비어 있고, 그동안 필드는 플레이스홀더 도형으로 그려진다.
 * 여기에 임시 ID 를 넣지 않는다 — 없는 것은 없는 대로 보여야 한다.
 */
let fieldAssets: FieldAssetIds = {}
/**
 * 필드에 그리는 논리 에셋 ID (`DEC-ART-004`, 아트 디렉션 F·E 단계).
 *
 * **주민은 `residents.csv`, 야생동물은 `wildlife.csv`, 투척물은
 * `throwable_weapons.csv` 의 `assets` 에서 온다.** 적대 주민이 쏘는 투사체만
 * 쏘는 주민 쪽에 붙는다 — `resident_combat_profiles.csv` 는 에셋 연결 CSV 의
 * 부모 후보가 아니고 쏘는 주체가 주민이라서다.
 *
 * 그림이 없으면 값이 `undefined` 이고 렌더가 도형으로 대신한다.
 */
let playerSprite: string | undefined
/**
 * 플레이어·주민의 에셋 묶음 전체.
 *
 * `DEC-ART-004` 가 좌·우·공격 교체 스프라이트를 허용하면서 `field_sprite` 한 장만
 * 들고 있어서는 고를 수 없게 됐다. `characterSprite()` 가 여기서 방향과 공격
 * 상태에 맞는 것을 꺼낸다. 위 `playerSprite` 는 정면 한 장이 필요한 자리
 * (지원 주민·미리 받기)가 계속 쓴다.
 */
let playerAssets: ContentAssets | undefined
let residentAssets = new Map<string, ContentAssets>()
/** 대화 화면의 플레이어 그림. `portrait` 이 없으면 `field_sprite` 로 떨어진다 */
let playerPortrait: string | undefined
let residentSprites = new Map<string, string | undefined>()
let residentPortraits = new Map<string, string | undefined>()
let residentProjectiles = new Map<string, string | undefined>()
let throwableProjectiles = new Map<string, string | undefined>()
/** 씨앗 그림. 작물별로 두지 않고 맵에 한 장이다 (DEC-ART-004) */
let seedAssetId: string | null = null
/** 작물 ID → 성장·수확 가능 그림. 씨앗은 여기 없다 */
let cropAssetsById = new Map<string, ContentAssets>()
let throwablesById = new Map<string, ThrowableWeapon>()
let run: RunState | null = null
let economy: Economy | null = null
/** 보관함 표시 이름을 찾기 위한 통합 사전. 분류가 달라도 조회는 한 곳에서 한다 */
let displayNames = new Map<string, string>()
/**
 * 지금 열려 있는 정비 팝업. 한 번에 하나만 연다 (DEC-UI-020).
 *
 * **`string` 이 아니라 `HubPopupId` 다.** 넷으로 고정된 값인데 느슨하게 두면
 * 오타가 검사에 안 걸린다 — `buildPopup()` 의 마지막 갈래가 "팝업 종류가 늘었는데
 * 화면을 안 붙인 것" 을 잡으라고 있는데, 타입이 좁으면 그 전에 걸린다.
 */
let openPopup: HubPopupId | null = null
/**
 * 열려 있는 팝업을 갱신하는 함수. 닫혀 있으면 null.
 *
 * 거래·제작이 성공하면 소지금·보관함·제작 가능 상태를 **즉시** 갱신해야 한다
 * (DEC-UI-005, DEC-UI-006). 정비 허브처럼 매 프레임 갱신해서 그 요구를 만족시킨다.
 * 팝업 자체는 열 때 한 번만 만들고 여기서는 값만 다시 그린다 — 매 프레임 DOM 을
 * 새로 만들면 수량 입력칸의 포커스와 입력 중이던 값이 날아간다.
 */
let renderOpenPopup: (() => void) | null = null

/**
 * 지금 열려 있는 대화 (DEC-UI-008, DEC-UI-010).
 *
 * 전투 전 대화와 투항 대화가 같은 상태를 쓴다. 하루에 둘이 동시에 열리지 않고
 * (`DEC-UI-026` — 기능 오버레이는 하나뿐), 같은 화면 규칙을 쓰기 때문이다.
 *
 * `reaction` 이 채워지면 선택은 이미 확정됐고 되돌릴 수 없다 (DEC-UI-008).
 * `pending` 은 `확인` 을 눌렀을 때 무엇을 할지다 — 선택 시점에 확정해 둔다.
 */
let dialogue: {
  phase: DialoguePhase
  residentId: string
  residentName: string
  openingText: string
  choices: DialogueChoiceView[]
  reaction: string | null
  pending: (() => void) | null
} | null = null

/** 선택지 문장을 찾기 위한 사전. 판정은 encounter.ts 가 하고 문장은 여기서 읽는다 */
let dialogueChoicesById = new Map<string, import('./data/types.ts').DialogueChoice>()

/**
 * 항목별 설명과 수치 (`DEC-UI-034`, 아트 디렉션 14.8·14.9).
 *
 * 보관함·상점·제작 목록이 **같은 사전을 본다.** 세 화면이 각자 만들면 같은 아이템이
 * 화면마다 다른 수치를 보여줄 수 있다. 값은 전부 승인 데이터에서 오고 설명 문장에서
 * 읽지 않는다.
 *
 * 작물에는 `player_description` 열이 없어 설명이 비고 수치만 들어간다.
 */
let itemDescriptions = new Map<string, string>()
let itemStats = new Map<string, TooltipStat[]>()

/**
 * 항목별 아이콘 (`asset.icon.*`).
 *
 * 보관함·상점·제작 목록과 입력 표·퀵슬롯 칸·편성 팝업이 **같은 사전을 본다.**
 * 작물·재료·투척 무기·회복 아이템·작물 속성이 전부 여기 들어간다.
 */
let itemIcons = new Map<string, string | undefined>()

/** 상점·제작 모달이 읽는 승인 데이터 */
let shopMaterials: readonly CraftingMaterial[] = []
let craftRecipes: readonly Recipe[] = []
let recipesById = new Map<string, Recipe>()
let recoveryItemsById = new Map<string, RecoveryItem>()

// 전투와 야생동물도 승인 데이터가 있어야 만들어진다. 없으면 null 로 남고
// 우클릭·좌클릭이 아무 일도 하지 않는다 — 임시 수치를 지어내지 않는다.
let combat: CombatSystem | null = null
let wildlife: WildlifeSystem | null = null
let spawnEntries: WildlifeSpawnEntry[] = []
let spawnProfilesById = new Map<string, WildlifeSpawnProfile>()
/** 일차 → 그날의 출현 프로필 ID. 없는 일차는 야생동물이 없다 (DEC-CONTENT-007) */
let spawnProfileIdByDay = new Map<number, string | null>()

let residentCombat: ResidentCombatSystem | null = null
let encounter: Encounter | null = null
/** 조우 해결 — 최종 결과·관계·공포도·보상 (DEC-RESIDENT-052, 042) */
let resolution: Resolution | null = null
/** 이번 습격의 적대 주민. 한 번에 한 명이다 (DEC-CONTENT-002) */
let hostile: HostileRuntime | null = null
/**
 * 전투 시스템이 보는 적대 주민 대상.
 *
 * **매 프레임 새로 만들지 않는다.** `combat.ts` 는 투항이 발동하면 이 객체의
 * `surrenderOffered` 를 true 로 바꾸는데, 새로 만들면 그 표시가 매 프레임 지워져
 * "투항 대화는 주민 한 명당 최대 한 번" (DEC-RESIDENT-016) 이 깨진다.
 */
let hostileTarget: CombatTarget | null = null
/** 맵의 resident_spawn 지점 (DEC-CONTENT-016) */
let raidSpawnPoint: { x: number; y: number } | null = null
/**
 * 승인 맵의 크기 (DEC-CONTENT-016).
 *
 * 플레이어·야생동물·적대 주민의 이동을 여기 안으로 자른다. 승인 데이터가 오기
 * 전에는 null 이고 그때는 자르지 않는다 — 경계를 지어내면 그 값이 원본이 된다.
 */
let worldBounds: import('./systems/world-bounds.ts').WorldBounds | null = null
/** 맵의 ally_support 지점. 영입 주민이 여기 선다 (DEC-CONTENT-016, DEC-RESIDENT-021) */
let allySupportPoint: { x: number; y: number } | null = null
/** 주민 ID → 지원 공격 수치. `resident_support_attack_profiles.csv` 가 원본 (DEC-RESIDENT-045) */
let supportProfileByResident = new Map<string, AllySupportProfile>()
/**
 * 이번 습격을 지원하는 영입 주민 (DEC-RESIDENT-021). 지원자가 없으면 null.
 *
 * 습격 전투가 시작할 때 정해지고 조우가 끝날 때 치운다. 한 습격에 한 명뿐이다.
 */
let allySupport: AllySupport | null = null

/**
 * 습격 진입 시 "누가 지원하는지" 안내 (DEC-UI-012).
 *
 * `DEC-UI-036` 의 필드 HUD 공통 요소 목록에는 없지만 `DEC-UI-012` 가
 * *"습격 전투에 진입할 때 어느 주민이 지원하는지 알린다"* 로 따로 확정했다.
 * 잠깐 떴다 사라지는 알림이라 자리를 상시로 잡지 않는다.
 */
let allySupportNotice: { text: string; remaining: number } | null = null

/**
 * 이번 습격을 지원한 주민의 표시 이름 (DEC-UI-012).
 *
 * `allySupport` 는 조우가 끝나는 순간 치워지는데 조우 결과 화면은 그 뒤에 만들어진다.
 * **8/6까지 이 자리를 조우 상대의 `supportUsed` 로 읽고 있었다** — 상대는 적대
 * 주민이라 그 값이 항상 false 이고, 그래서 확정문이 요구한 줄이 한 번도 안 떴다.
 * 담당자가 "3일차에 영입한 뒤 4일차에 지원이 없다" 고 물어 드러났다.
 */
let raidSupporterName: string | null = null

/** 지원 안내가 떠 있는 시간(초). 표현이라 승인 데이터가 아니다 */
const ALLY_SUPPORT_NOTICE_SECONDS = 4
/** 습격 조우를 시작하는 데 필요한 승인 데이터 묶음 */
let raidData: {
  hostileResidentByDay: Map<number, string | null>
  combatProfileByResident: Map<string, string>
  profileById: Map<string, import('./data/types.ts').ResidentCombatProfile>
  modifierByState: Map<string, import('./data/types.ts').ResidentCombatModifier>
  scenarioByResident: Map<string, import('./data/types.ts').StoryScenario>
  /** 일차 → raid_type. 마지막 습격 뒤에 엔딩 판정으로 간다 (DEC-RUN-014) */
  raidTypeByDay: Map<number, string>
} | null = null
/** 주민 표시 이름. 조우 결과 화면이 ID 대신 이걸 쓴다 (DEC-UI-011) */
let residentNames = new Map<string, string>()
/** 보상 묶음. 조우 결과가 "실제 지급된 자원의 종류와 수량"을 여기서 읽는다 (DEC-UI-011) */
let rewardBundlesById = new Map<string, RewardBundle>()
/**
 * 사연 정보 ID → `ending_fact_text` (DEC-UI-011).
 *
 * `source_fact_text` 는 숨겨진 설정 원본이라 런타임 JSON 에 아예 없다
 * (DEC-CONTENT-017). 그래서 화면에 새어 나갈 경로가 구조적으로 없다.
 */
let storyFactById = new Map<string, string>()
/** 공포도 구간. 개발 빌드의 조우 결과 표시에만 쓴다 (DEC-UI-013) */
let fearBands: readonly FearBand[] = []

/**
 * 승인된 밤 결과 문구 전량 (DEC-RUN-015, DEC-CONTENT-021).
 *
 * 부팅 때 고르지 않는다 — `DEC-CONTENT-018` 이 **화면을 열 때 한 번** 고르라고
 * 확정했다. 부팅에서 고르면 한 런 안에서 밤 결과가 여러 번 나와도 같은 문구가 뜬다.
 */
let nightResultTexts: readonly NightResultText[] = []

/**
 * 이번 밤 결과 화면에 띄울 문구.
 *
 * `beginNightResult()` 가 화면이 열릴 때 한 번 고르고, 열려 있는 동안 다시
 * 고르지 않는다 (DEC-CONTENT-018). 매 프레임 고르면 문구가 깜빡인다.
 */
let nightResult: NightResultSelection = {
  ok: false,
  reason: '밤 결과 화면이 아직 열리지 않았다',
}

/**
 * 이번 조우에서 결과 화면에 전달할 것 (DEC-UI-011).
 *
 * 조우가 끝나는 순간에는 이미 알 수 없는 것들이라 **일어나는 시점에 모아 둔다** —
 * 협상으로 실제 빠져나간 작물은 `settleNegotiation()` 만 알고, 새로 확인한 사연은
 * 판정 순간에만 "새로"인지 알 수 있다. 나중에 런 상태에서 역산하려 하면
 * "이번 조우에서 새로 확인한 것"과 "예전에 확인한 것"을 구분할 수 없다.
 */
interface PendingEncounter {
  /** 자원 협상으로 실제 빠져나간 작물. 실행 후에만 알 수 있다 (DEC-RESIDENT-050) */
  consumedCrops: Record<string, number>
  /** 협상이 성격 프로필에 막혀 아무것도 소비되지 않았다 */
  negotiationRejected: boolean
  /** 이번 조우에서 **새로** 확인한 사연 정보 */
  revealedFactIds: string[]
}

let pendingEncounter: PendingEncounter | null = null

/** 조우 결과 화면이 그릴 내용. 조우가 끝나는 순간 확정한다 */
let encounterResultView: EncounterResultView | null = null

/** 엔딩 판정 (DEC-CONTENT-011) */
let endingJudge: EndingJudge | null = null

/**
 * 승인된 엔딩. 엔딩 화면이 제목과 요약을 여기서 읽는다 (DEC-UI-023).
 *
 * `run.ending` 에는 확정된 ID 와 기록문만 저장한다 — 제목·요약은 승인 데이터의
 * 값이라 런 상태에 복제하지 않는다.
 */
let endingsById = new Map<string, import('./data/types.ts').Ending>()

/**
 * 엔딩 기록문을 생성 중인가 (DEC-UI-023, DEC-UI-024).
 *
 * `run.ending.recordText` 는 확정 즉시 승인된 폴백으로 채워지므로 "문장이 있는가"
 * 로는 생성 중인지 알 수 없다. 재시도 중이라는 사실은 화면에 노출하지 않으므로
 * 이 값은 켜짐·꺼짐 둘뿐이다.
 */
let endingRecordPending = false
/**
 * 엔딩 기록문과 일지 입력을 만드는 데 필요한 승인 데이터
 * (DEC-CONTENT-011, DEC-JOURNAL-002).
 *
 * **두 시스템이 같은 승인 테이블을 읽는 것뿐이다.** `DEC-JOURNAL-004` 가 분리하라고
 * 한 것은 프롬프트 원본·버전·폴백 원본과 "일지 원문을 엔딩 입력에 넘기지 않는 것"
 * 이며, 같은 `residents.csv` 를 두 번 적재하라는 뜻이 아니다. 입력을 만드는 함수는
 * `llm/ending.ts` 와 `llm/journal.ts` 로 나뉘어 있고 서로를 부르지 않는다.
 */
let approvedForLlm: {
  manifest: import('./data/types.ts').RuntimeManifest
  residents: readonly import('./data/types.ts').Resident[]
  storyInfos: readonly import('./data/types.ts').StoryInfo[]
} | null = null

/**
 * 승인된 습격 예고 (DEC-RUN-011, DEC-CONTENT-021).
 *
 * 일차 시작 화면은 `opening_text`(문장), HUD·정비 허브는 `hud_label`(짧은 표지)를
 * 쓴다. **같은 행에서 온다** — 둘은 같은 정보를 길이만 달리 전달한다.
 */
let raidNotices: readonly RaidNotice[] = []

/** 폴백 일지 (DEC-JOURNAL-003). 공포도 구간 × 변화 방향으로 고른다 */
let journalFallbacks: readonly JournalFallback[] = []

/**
 * 일차 시작 화면이 그릴 일지 (DEC-UI-028).
 *
 * `null` 은 1일차 아침 하나뿐이며 "영역을 만들지 않는다" 는 뜻이다.
 */
let dayStartJournal: DayStartJournal = null

/**
 * 지금 일지를 생성 중인 일차.
 *
 * 응답이 늦게 도착했을 때 **그 사이에 아침이 바뀌었는지** 보기 위한 것이다.
 * 없으면 2일차 일지가 3일차 화면에 뒤늦게 나타난다.
 */
let journalRequestDay: number | null = null

/**
 * 새 런을 만들 때 필요한 승인 데이터 (로드맵 9-5).
 *
 * 부팅에서 한 번 담고 타이틀에서 다시 시작할 때마다 같은 것을 쓴다. 여기 담긴
 * 것은 전부 승인 데이터이며 런이 바뀌어도 변하지 않는다.
 */
let newRunSources: {
  stats: import('./data/types.ts').PlayerBaseStats
  schedule: import('./data/types.ts').RunSchedule
  residents: readonly import('./data/types.ts').Resident[]
  rewardBundles: readonly RewardBundle[]
  combatProfiles: readonly import('./data/types.ts').ResidentCombatProfile[]
  fearIncrements: FearIncrements | null
  crops: readonly Crop[]
  materials: readonly import('./data/types.ts').CraftingMaterial[]
  recipes: readonly Recipe[]
  plots: readonly import('./data/types.ts').FarmPlot[]
  interactionRadius: number
  spawnX: number
  spawnY: number
} | null = null

/**
 * 런을 통째로 새로 만든다 (`DEC-RESOURCE-004`, `DEC-RESIDENT-047`, 로드맵 9-5).
 *
 * **부분 초기화하지 않는다.** 상태 객체를 새로 만들어 교체한다 — 남은 값 하나가
 * 두 번째 런에서만 재현되는 버그가 된다. 그래서 `run` 을 붙들고 있는 것들
 * (`resolution`·`economy`·`farming`)도 여기서 같이 다시 만든다. 하나만 남겨 두면
 * 새 런 상태를 옛 시스템이 보게 된다.
 *
 * 리셋 대상은 로드맵 9-5 가 열거했다 — 소지금·보관함 4종·퀵슬롯 편성·회복 파우치·
 * 작물 숙련도·해금 레시피·주민 런 상태와 관계·공포도·경작지·일차·사연 시나리오·
 * 일지 기록. 앞의 것들은 `createRunState()` 가, 경작지는 `createFarming()` 이,
 * 화면에 걸린 나머지는 아래에서 지운다.
 *
 * **초기값은 데이터에서 읽는다.** 체력·소지금은 `player_base_stats` 승인 행에서
 * 오며 여기에 숫자를 두지 않는다 (`DEC-CONTENT-019`).
 */
function startNewRun(playerName: string): void {
  if (newRunSources === null) return
  const src = newRunSources

  run = createRunState({
    stats: src.stats,
    schedule: src.schedule,
    playerName,
    seed: 1,
    residents: [...src.residents],
  })

  // 조우 해결. 런 상태가 만들어진 뒤라야 붙는다 — 주민 런 상태를 직접 고친다.
  resolution = createResolution(run, {
    rewardBundles: [...src.rewardBundles],
    residents: [...src.residents],
    combatProfiles: [...src.combatProfiles],
    fearIncrements: src.fearIncrements,
  })

  economy = createEconomy(
    {
      resources: run.resources,
      cropMastery: run.record.cropMastery,
      unlockedRecipeIds: run.record.unlockedRecipeIds,
    },
    { crops: [...src.crops], materials: [...src.materials], recipes: [...src.recipes] },
  )

  // 경작지도 런 상태다 (로드맵 9-5). 작물 단계와 남은 성장 시간이 다음 날로
  // 넘어가는 것은 한 런 안에서만이다 (DEC-FARM-003).
  farming = createFarming({
    plots: [...src.plots],
    crops: [...src.crops],
    interactionRadius: src.interactionRadius,
  })

  // 필드 시뮬레이션과 화면에 걸려 있던 것들. 런 상태 밖이라 새 객체로 안 지워진다.
  combat?.reset()
  residentCombat?.reset()
  wildlife?.endFarming()
  farmingTimer?.reset()

  hostile = null
  hostileTarget = null
  // 지원 기회는 런 상태(`supportUsed`)에 있고 그것은 새 런 객체가 통째로 지운다.
  // 여기서 치우는 것은 필드에 서 있던 인스턴스와 화면 알림이다 (로드맵 9-5).
  allySupport = null
  allySupportNotice = null
  raidSupporterName = null
  dialogue = null
  pendingEncounter = null
  encounterResultView = null
  // 걷기 위상은 개체 키로 들고 있어서 새 런이 같은 키를 다시 쓴다 (DEC-ART-004).
  // 안 지우면 직전 런의 마지막 좌표와 비교해 첫 프레임에 순간이동으로 읽힌다.
  resetBob()

  // 재배 표시도 버린다 (8/8 플레이 테스트).
  //
  // **이 둘은 `advanceFeedback()` 이 줄이는데 그 함수는 재배 단계에서만 돈다.**
  // 그래서 튜토리얼 재배에서 쌓인 것이 전투·정비 동안 남은 시간 그대로 얼어
  // 있다가, 본 런 1일차 재배가 시작되는 순간부터 다시 흐른다 — 튜토리얼에서
  // 딴 고추가 소지품에는 없는데 `고추 +2` 만 1일차 시작에 떴다.
  //
  // 시간이 흐르지 않는 구간이 있는 표시는 **단계가 바뀔 때 버려야** 한다.
  harvestPopups = []
  readyFlashes.clear()

  dayStartJournal = null
  journalRequestDay = null
  endingRecordPending = false

  player.x = src.spawnX
  player.y = src.spawnY
}

/**
 * 회복 파우치가 읽는 승인 데이터 (DEC-RESOURCE-017).
 *
 * 파우치는 목록을 저장하지 않고 보관함에서 매번 계산한다. 그 계산에 필요한
 * 승인 행과 최대 체력을 여기 담아 둔다 — 최대 체력은 런 상태에 없다.
 */
let recoverySources: RecoverySources | null = null

/**
 * 회복 선택을 규칙대로 맞춘다 (DEC-RESOURCE-017, 018).
 *
 * **매 프레임 불러도 안전하다.** 현재 선택의 수량이 남아 있으면 아무것도 하지
 * 않는다. `회복 아이템 없음` 에서 뭔가를 얻으면 자동 선택되고, 선택한 것이
 * 소진되면 정해진 순서에서 다음으로 넘어간다. 이 두 경우 말고는 안 바뀐다.
 */
function syncRecoverySelection(): void {
  if (run === null || recoverySources === null) return

  const changed = syncSelection(run.pouch, recoveryOptions(run, recoverySources))
  if (changed && isDevBuild) {
    console.info(`[회복] 선택 — ${run.pouch.selectedId ?? '회복 아이템 없음'}`)
  }
}

/**
 * `Q` 를 짧게 눌렀다 — 사용 시작 또는 자발적 취소 (DEC-INPUT-005, DEC-INPUT-012).
 *
 * **진행 중이면 취소가 먼저다.** 같은 입력이 두 뜻을 갖는 것은 확정 규칙이고
 * (`DEC-INPUT-012` — 게이지가 도는 동안 `Q` 를 다시 누르면 자발적 취소),
 * 취소는 아이템을 소비하지 않으며 선택도 유지한다.
 *
 * 재배·습격 단계에서만 받는다 (`DEC-RESOURCE-018` — 정비에서는 쓸 수 없다).
 * 그 판단은 입력 잠금(`syncInputLock`)이 이미 하지만, 여기서도 한 번 본다 —
 * 입력 경로가 하나 더 생겨도 규칙이 새지 않게 한다.
 */
function onRecoverPressed(): void {
  if (run === null || recoverySources === null) return
  if (scenes.currentFieldMode() === null) return

  if (run.recovering !== null) {
    // 자발적 취소. 소비하지 않고 체력도 안 오른다 (DEC-INPUT-012)
    const cancelled = run.recovering.itemId
    run.recovering = null
    bus.emit('recovery.cancelled', { itemId: cancelled })
    if (isDevBuild) console.info(`[회복] 취소 — ${cancelled} (자발적)`)
    return
  }

  const started = startRecovery(run, recoveryOptions(run, recoverySources))
  if (!started.ok) {
    if (isDevBuild) console.warn(`[회복] 시작 못 함 — ${started.reason}`)
    return
  }

  run.recovering = {
    itemId: started.option.id,
    elapsedSeconds: 0,
    durationSeconds: started.option.useDurationSeconds,
  }
  bus.emit('recovery.started', {
    itemId: started.option.id,
    durationSeconds: started.option.useDurationSeconds,
  })
  if (isDevBuild) {
    console.info(
      `[회복] 시작 — ${started.option.displayName} · ${started.option.useDurationSeconds}초`,
    )
  }
}

/**
 * 회복 게이지를 진행한다. 재배·습격 양쪽에서 흐른다.
 *
 * 완료되면 소비와 회복이 한 처리로 끝난다 (`systems/recovery.ts`).
 */
function advanceRecoveryGauge(dt: number): void {
  if (run === null || recoverySources === null) return

  const finished = advanceRecovery(run, dt, recoverySources)
  if (finished === null) return

  bus.emit('recovery.completed', { itemId: finished.itemId, healedAmount: finished.healed })
  if (isDevBuild) {
    console.info(`[회복] 완료 — ${finished.itemId} · +${finished.healed} → 체력 ${finished.health}`)
  }
  // 마지막 하나를 썼으면 다음 것으로 넘어간다 (DEC-RESOURCE-018)
  syncRecoverySelection()
}

/**
 * 회복이 진행 중이면 취소한다. **소비하지 않는다.**
 *
 * 공격받았을 때(`DEC-INPUT-005`)와 대화로 전환될 때(로드맵 9-2) 쓴다.
 * 정지 후 재개가 아니라 취소다 — 재개로 만들면 대화를 열었다 닫는 것으로
 * 무적 시간을 만들 수 있다.
 */
function cancelRecovery(reason: 'damaged' | 'dialogue'): void {
  if (run === null || run.recovering === null) return

  const cancelled = run.recovering.itemId
  run.recovering = null
  // 계약에 사유가 없다. 이벤트는 "취소됐다" 만 알리고 왜인지는 개발 로그에 남긴다 —
  // 듣는 쪽이 사유로 갈라지는 규칙이 아직 없어서 필드를 늘리지 않았다.
  bus.emit('recovery.cancelled', { itemId: cancelled })
  if (isDevBuild) console.info(`[회복] 취소 — ${cancelled} (${reason})`)
}

/**
 * 회복 사용 중의 이동속도 배율 (DEC-INPUT-005).
 *
 * 진행 중이 아니면 1 이다. 배율은 승인 데이터(`use_duration_seconds` 옆의
 * `move_speed_multiplier`)에서 오며 코드에 숫자를 두지 않는다.
 */
function recoveryMoveMultiplier(): number {
  if (run === null || run.recovering === null || recoverySources === null) return 1

  const option = recoveryOptions(run, recoverySources).find(
    (o) => o.id === run!.recovering!.itemId,
  )
  return option?.moveSpeedMultiplier ?? 1
}

/** 선택된 회복 아이템의 표시 이름. 없으면 null 이고 HUD 가 `회복 아이템 없음` 을 쓴다 */
function selectedRecoveryName(): string | null {
  const id = run?.pouch.selectedId ?? null
  if (id === null) return null
  return displayNames.get(id) ?? id
}

/**
 * 선택된 회복 아이템의 보유 수량 (A1 목업 8/9 — 회복 칸에도 수량 배지).
 *
 * **퀵슬롯과 같은 뜻의 숫자다.** 칸에 무엇이 몇 개 남았는지가 던질 것과 먹을 것
 * 양쪽에서 같은 자리에 보여야 한다. 선택된 것이 없으면 배지도 없다.
 */
function selectedRecoveryCount(): number | null {
  const id = run?.pouch.selectedId ?? null
  if (id === null || run === null || recoverySources === null) return null
  return recoveryOptions(run, recoverySources).find((o) => o.id === id)?.held ?? null
}

const player = { x: 0, y: 0 }

/**
 * 승인 `fear_increments.csv` 를 행동별 증가량으로 바꾼다 (DEC-RESIDENT-048).
 *
 * **세 원인이 다 있을 때만 값을 돌려준다.** 일부만 있으면 없는 원인이 0으로
 * 취급되어 "위협은 공포도를 안 올린다" 같은 규칙이 조용히 생긴다. 그럴 바에는
 * 통째로 미승인으로 보고 공포도를 멈추는 편이 낫다 — 화면에 경고가 남는다.
 */
function readFearIncrements(rows: readonly FearIncrement[] | undefined): FearIncrements | null {
  const byCause = new Map((rows ?? []).map((r) => [r.cause, r.fear_amount]))

  const threat = byCause.get('threat_selected')
  const retreat = byCause.get('surrender_retreat_reward')
  const kill = byCause.get('resident_killed')
  if (threat === undefined || retreat === undefined || kill === undefined) return null

  return {
    threat_selected: threat,
    surrender_retreat_reward: retreat,
    resident_killed: kill,
  }
}

/**
 * 승인 데이터를 읽어 맵·작물·플레이어 수치를 붙인다.
 *
 * **실패하면 부팅하지 않는다** (DEC-UI-024 — "필수 데이터 누락 또는 검증 실패로
 * 부팅할 수 없으면 데이터 오류 화면을 표시한다"). 8/5까지는 여기서 임시 수치로
 * 넘어가 이동만 되는 상태로 계속 갔는데, 그것은 승인 데이터가 아직 없던 시절의
 * 임시 조치였고 지금은 **데이터가 깨진 것을 화면이 숨기는 셈**이 된다.
 */
async function bootData(): Promise<boolean> {
  try {
    const data = await loadRuntimeData()
    requireTables(data, ['maps', 'crops', 'player_base_stats', 'run_schedules'])

    setPlayerBaseStats(data.player_base_stats!)

    // 1차 프로토타입은 승인된 맵 하나만 쓴다 (DEC-CONTENT-016)
    const map = data.maps![0]
    camera.setWorldSize(map.world_width, map.world_height)

    // ── 논리 에셋 ID (DEC-ART-004) ──────────────────
    //
    // 붙어 있는 것만 온다. **없는 역할을 코드가 지어내지 않는다** — 그림이 없으면
    // 렌더가 플레이스홀더로 그리고, 그 사실이 화면에 보이는 것이 맞다.
    // 배경·경작지·씨앗은 맵에, 성장·수확 가능은 작물에 붙는다. 씨앗이 작물 쪽에
    // 없는 것은 누락이 아니라 확정 규칙이다 (씨앗은 종류를 공개하지 않는다).
    fieldAssets = { background: map.assets?.background, farmPlot: map.assets?.farm_plot }
    seedAssetId = map.assets?.crop_seed ?? null
    cropAssetsById = new Map(
      (data.crops ?? []).map((crop) => [crop.id, crop.assets ?? {}]),
    )

    // 필드 위 사람·짐승·투사체 (F·E 단계)
    playerSprite = data.player_base_stats![0].assets?.field_sprite
    playerAssets = data.player_base_stats![0].assets
    residentAssets = new Map(
      (data.residents ?? []).map((r) => [r.id, r.assets ?? {}]),
    )
    playerPortrait =
      data.player_base_stats![0].assets?.portrait ??
      data.player_base_stats![0].assets?.field_sprite
    residentSprites = new Map(
      (data.residents ?? []).map((r) => [r.id, r.assets?.field_sprite]),
    )
    // 대화 화면의 초상화 (A4). `portrait` 이 아직 없어 `field_sprite` 로 떨어진다 —
    // 같은 인물의 그림이라 누가 말하는지는 전달된다. 파일이 오면 이 줄이 알아서 바뀐다.
    residentPortraits = new Map(
      (data.residents ?? []).map((r) => [r.id, r.assets?.portrait ?? r.assets?.field_sprite]),
    )
    residentProjectiles = new Map(
      (data.residents ?? []).map((r) => [r.id, r.assets?.projectile]),
    )
    throwableProjectiles = new Map(
      (data.throwable_weapons ?? []).map((w) => [w.id, w.assets?.projectile]),
    )

    // 첫 프레임에 밭이 비어 보이지 않게 미리 받는다. 실패해도 진행을 막지 않는다 —
    // 아트는 아직 없을 수 있고 그것 때문에 런이 안 시작되면 안 된다.
    void assetImages.preload([
      fieldAssets.background,
      fieldAssets.farmPlot,
      seedAssetId,
      UI_ASSET.fieldFrameFront,
      UI_ASSET.plotHighlight,
      ...[...cropAssetsById.values()].flatMap((a) => [a.crop_growing, a.crop_ready]),
      // 사람과 짐승은 첫 프레임부터 보여야 한다. 습격에서 처음 받으면 주민이
      // 한 박자 늦게 나타난다.
      playerSprite,
      ...residentSprites.values(),
      ...residentProjectiles.values(),
      ...throwableProjectiles.values(),
      ...(data.wildlife ?? []).map((w) => w.assets?.field_sprite),
      // 초상화와 UI 부품도 같이 받는다 (8/8 플레이 테스트).
      //
      // **이것들은 캔버스가 아니라 CSS `background-image` 로 쓰인다.** 그래도
      // 여기 넣는 이유는 `new Image()` 가 브라우저 HTTP 캐시를 데워 두기 때문이다 —
      // 안 그러면 그 그림이 **화면에 나타나는 순간에** 받기 시작해서, 대화창이
      // 열린 뒤 초상화가 한 박자 늦게 뜨고 정비 창호지 두 짝이 순차로 나타난다.
      //
      // `UI_ASSET` 전체를 넣는다. 하나씩 고르면 부품이 늘 때마다 여기가 낡는다.
      playerPortrait,
      ...residentPortraits.values(),
      ...Object.values(UI_ASSET),
      // 좌·우·공격 교체 스프라이트도 같이 받는다 (DEC-ART-004). 미리 안 받으면
      // 방향이 바뀌는 첫 프레임에 그림이 없어 정면으로 한 번 껌뻑인다.
      ...[playerAssets, ...residentAssets.values()].flatMap((a) => [
        a?.field_sprite_left,
        a?.field_sprite_right,
        a?.field_sprite_attack,
      ]),
    ])
    player.x = map.world_width / 2
    player.y = map.world_height / 2

    const plots = map.farm_plots ?? []
    if (plots.length === 0) {
      throw new Error(`맵 ${map.id} 에 승인된 경작지가 없다`)
    }

    const crops = data.crops! as Crop[]
    cropsById = new Map(crops.map((crop) => [crop.id, crop]))

    // 1차 프로토타입은 승인된 런 일정 하나만 쓴다 (DEC-CONTENT-002)
    const schedule = data.run_schedules![0]
    farmingTimer = createStageTimer(schedule.farming_duration_seconds)

    throwablesById = new Map((data.throwable_weapons ?? []).map((w) => [w.id, w]))

    // 작물 속성 효과가 낼 소리 (mechanicSfx 주석 참고). 붙은 것만 들어간다.
    mechanicSfx = new Map(
      (data.crop_attributes ?? [])
        .filter((a) => a.assets?.sfx !== undefined)
        .map((a) => [a.combat_mechanic_key, a.assets!.sfx!]),
    )

    const weapons = data.throwable_weapons ?? []
    combat = createCombat({
      stats: data.player_base_stats![0],
      weapons,
      attributes: data.crop_attributes ?? [],
    })
    wildlife = createWildlife({
      map,
      species: data.wildlife ?? [],
      weapons,
    })

    // 1일차 재배의 출현 프로필. 일차가 넘어갈 때 다시 부른다.
    // 프로필 참조가 비어 있는 일차는 야생동물이 없다 (DEC-CONTENT-007).
    spawnEntries = (data.wildlife_spawn_profiles ?? []).flatMap((p) => p.entries ?? [])
    spawnProfilesById = new Map((data.wildlife_spawn_profiles ?? []).map((p) => [p.id, p]))

    const residentSpawn = (map.points ?? []).find((p) => p.point_role === 'resident_spawn')
    raidSpawnPoint = residentSpawn === undefined ? null : { x: residentSpawn.x, y: residentSpawn.y }

    // 지원 주민은 "화면의 정해진 위치" 에 선다 (DEC-RESIDENT-021). 그 자리는
    // 맵의 ally_support 지점이며 런 내내 움직이지 않는다.
    const allyPoint = (map.points ?? []).find((p) => p.point_role === 'ally_support')
    allySupportPoint = allyPoint === undefined ? null : { x: allyPoint.x, y: allyPoint.y }

    // 지원 공격 수치는 승인 데이터가 단일 원본이다 (DEC-RESIDENT-045).
    // 주민 행이 프로필 ID 를 들고 있어 한 번 이어 둔다.
    const supportProfileById = new Map(
      (data.resident_support_attack_profiles ?? []).map((p) => [p.id, p]),
    )
    supportProfileByResident = new Map(
      (data.residents ?? []).flatMap((resident) => {
        const profile = supportProfileById.get(resident.support_attack_profile_id)
        if (profile === undefined) return []
        return [[
          resident.id,
          {
            damage: profile.damage,
            firstAttackDelaySeconds: profile.first_attack_delay_seconds,
            attackIntervalSeconds: profile.attack_interval_seconds,
          },
        ] as const]
      }),
    )

    worldBounds = { width: map.world_width, height: map.world_height }
    residentCombat = createResidentCombat({ weapons, bounds: worldBounds })
    encounter = createEncounter({
      residents: data.residents ?? [],
      personalityProfiles: data.resident_personality_profiles ?? [],
      choiceOutcomes: (data.resident_personality_profiles ?? []).flatMap(
        (p) => p.choice_outcomes ?? [],
      ),
      choices: data.dialogue_choices ?? [],
      responses: (data.dialogue_choices ?? []).flatMap((c) => c.responses ?? []),
    })

    raidData = {
      hostileResidentByDay: new Map(
        (schedule.days ?? []).map((d) => [d.day_number, d.hostile_resident_id]),
      ),
      combatProfileByResident: new Map(
        (data.residents ?? []).map((r) => [r.id, r.combat_profile_id]),
      ),
      profileById: new Map((data.resident_combat_profiles ?? []).map((p) => [p.id, p])),
      modifierByState: new Map(
        (data.resident_combat_modifiers ?? []).map((m) => [m.combat_state, m]),
      ),
      scenarioByResident: new Map(
        (data.story_scenarios ?? []).map((s) => [s.resident_id, s]),
      ),
      raidTypeByDay: new Map((schedule.days ?? []).map((d) => [d.day_number, d.raid_type])),
    }

    endingJudge = createEndingJudge({
      fearBands: data.fear_bands ?? [],
      endings: data.endings ?? [],
      crops,
      cropAttributes: data.crop_attributes ?? [],
    })
    endingsById = new Map((data.endings ?? []).map((e) => [e.id, e]))

    // ── 결과 화면이 읽는 승인 데이터 ────────────────
    residentNames = new Map((data.residents ?? []).map((r) => [r.id, r.display_name]))
    rewardBundlesById = new Map((data.reward_bundles ?? []).map((b) => [b.id, b]))
    storyFactById = new Map(
      (data.story_infos ?? []).map((info) => [info.id, info.ending_fact_text]),
    )
    fearBands = data.fear_bands ?? []

    // 밤 결과 문구는 승인 행이 정확히 하나일 때만 쓴다 (DEC-CONTENT-018 보류).
    // 실패해도 부팅을 막지 않는다 — 문구 하나가 없다고 런 전체가 안 돌 이유는 없고,
    // 실제로 그 화면에 닿는 순간 데이터 오류로 올린다.
    // 고르는 것은 화면을 열 때다 (DEC-CONTENT-018). 여기서는 목록만 들고 있는다.
    nightResultTexts = data.night_result_texts ?? []

    // 튜토리얼 안내. 순서는 `step_order` 가 단일 원본이라 여기서 정렬하지 않는다
    // (DEC-CONTENT-025). 정렬은 진행 모듈이 한 번만 한다.
    tutorialSteps = data.tutorial_steps ?? []

    // 습격 예고와 폴백 일지는 고르지 않고 통째로 들고 있는다. 예고는 그날의
    // raid_type 이, 폴백은 그때의 공포도 구간과 변화 방향이 정해져야 고를 수 있다.
    raidNotices = data.raid_notices ?? []
    // 폴백 일지는 독립 테이블이 아니라 fear_bands 의 자식이다 (스키마 2, 연결 CSV).
    // 자식 행이 부모 키를 그대로 들고 있어 평탄화해도 구간 정보가 남는다.
    journalFallbacks = (data.fear_bands ?? []).flatMap((band) => band.journal_fallbacks ?? [])

    approvedForLlm = {
      manifest: data.manifest,
      residents: data.residents ?? [],
      // 사연 정보는 독립 콘텐츠다. 확인한 것만 골라 쓰는 것은 입력을 만드는
      // 쪽이 한다 (DEC-CONTENT-017 — 확인하지 않은 정보는 LLM 에 넘기지 않는다).
      storyInfos: data.story_infos ?? [],
    }

    // 새 런을 만들 재료를 담아 둔다. 타이틀에서 다시 시작할 때 같은 것을 쓴다 (로드맵 9-5)
    newRunSources = {
      stats: data.player_base_stats![0],
      schedule,
      residents: data.residents ?? [],
      rewardBundles: data.reward_bundles ?? [],
      combatProfiles: data.resident_combat_profiles ?? [],
      fearIncrements: readFearIncrements(data.fear_increments),
      crops,
      materials: data.crafting_materials ?? [],
      recipes: data.recipes ?? [],
      plots,
      interactionRadius: map.farm_interaction_radius,
      spawnX: map.world_width / 2,
      spawnY: map.world_height / 2,
    }

    // 흐름이 일차·습격을 판단할 근거를 승인 데이터로 갈아끼운다.
    // 여기서 일정을 지어내지 않는다 — 없으면 흐름이 데이터 오류로 보고한다.
    spawnProfileIdByDay = new Map(
      (schedule.days ?? []).map((d) => [d.day_number, d.wildlife_spawn_profile_id]),
    )

    const raidByDay = new Map((schedule.days ?? []).map((d) => [d.day_number, d.raid_type]))
    scenes.setContext({
      totalDays: schedule.total_days,
      raidTypeOf: (day) => raidByDay.get(day),
    })
    raidTypeOfDay = (day) => raidByDay.get(day) ?? 'none'

    // 보관함 표시 이름. 분류가 넷이라 조회를 한 곳으로 모은다.
    displayNames = new Map(
      [
        ...crops,
        ...(data.crafting_materials ?? []),
        ...(data.throwable_weapons ?? []),
        ...(data.recovery_items ?? []),
      ].map((entry) => [entry.id, entry.display_name]),
    )

    // 이름 입력 전이라 이름이 없는 런이다. 타이틀이 보이는 동안 화면에 닿지 않으며,
    // 이름을 확정하는 순간 `startNewRun()` 이 통째로 교체한다.
    startNewRun('')

    // 상점·제작 모달이 읽는 것. economy 와 **같은 배열**을 본다 —
    // 목록과 판정이 서로 다른 데이터를 보면 화면에는 있는데 못 만드는 레시피가 생긴다.
    dialogueChoicesById = new Map((data.dialogue_choices ?? []).map((c) => [c.id, c]))

    // 항목별 설명·수치 사전. 네 분류를 한 곳에 모은다 (아트 디렉션 14.8)
    itemDescriptions = new Map(
      [
        ...(data.crafting_materials ?? []),
        ...(data.throwable_weapons ?? []),
        ...(data.recovery_items ?? []),
      ].map((entry) => [entry.id, entry.player_description]),
    )
    itemStats = new Map([
      // 작물은 player_description 열이 없다. 수치만 넣는다
      ...crops.map(
        (crop) =>
          [
            crop.id,
            [
              { label: '판매가', value: String(crop.sell_price) },
              { label: '수확량', value: String(crop.base_yield) },
              ...(crop.is_raw_edible && crop.raw_heal_amount !== null
                ? [{ label: '생식 회복', value: String(crop.raw_heal_amount) }]
                : []),
            ],
          ] as [string, TooltipStat[]],
      ),
      ...(data.crafting_materials ?? []).map(
        (material) =>
          [material.id, [{ label: '구매가', value: String(material.buy_price) }]] as [
            string,
            TooltipStat[],
          ],
      ),
      ...(data.throwable_weapons ?? []).map(
        (weapon) => [weapon.id, throwableStats(weapon)] as [string, TooltipStat[]],
      ),
      ...(data.recovery_items ?? []).map(
        (item) => [item.id, recoveryStats(item)] as [string, TooltipStat[]],
      ),
    ])

    // 아이콘 사전. 다섯 테이블이 한 곳으로 모인다 (C단계 18종)
    itemIcons = new Map(
      [
        ...crops,
        ...(data.crafting_materials ?? []),
        ...(data.throwable_weapons ?? []),
        ...(data.recovery_items ?? []),
        ...(data.crop_attributes ?? []),
      ].map((entry) => [entry.id, entry.assets?.icon]),
    )
    // 정비 화면은 셔터가 덮은 뒤 열리므로 미리 받아 두지 않으면 첫 프레임이 빈다
    void assetImages.preload([...itemIcons.values()])

    shopMaterials = data.crafting_materials ?? []
    craftRecipes = data.recipes ?? []
    recipesById = new Map(craftRecipes.map((r) => [r.id, r]))
    recoveryItemsById = new Map((data.recovery_items ?? []).map((r) => [r.id, r]))

    // 최대 체력은 런 상태에 없다. 승인 행이 원본이다 (DEC-CONTENT-019)
    recoverySources = {
      items: data.recovery_items ?? [],
      crops,
      maxHealth: data.player_base_stats![0].max_health,
    }

    console.info(
      `[데이터] 맵 ${map.display_name} · 경작지 ${plots.length}칸 · 작물 ${crops.length}종 · ` +
        `${schedule.total_days}일 런 · 재배 ${schedule.farming_duration_seconds}초`,
    )
    return true
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    bus.emit('data.error', { summary: '승인 데이터를 읽지 못했다', detail })

    // **임시 수치로 넘어가지 않는다.** `usePlaceholderStats()` 로 이동만 되는
    // 상태를 만들면 화면에는 게임이 도는 것처럼 보이고 밭만 비어 있어서,
    // "데이터가 깨졌다" 가 "밭이 안 보인다" 로만 드러난다 (AGENTS.md 6절).
    return false
  }
}

/**
 * 화면 피드백의 수명(초).
 *
 * 표현이지 게임 데이터가 아니다 (개발 로드맵 2절). `DEC-UI-004`·`DEC-UI-018` 은
 * "짧게 표시한다"고만 정하고 길이를 정하지 않았으므로 **임의로 고른 값**이다.
 */
const READY_FLASH_SECONDS = 0.6
const HARVEST_POPUP_SECONDS = 1.2
/** 소진 자동 전환 강조와 빈 발사 안내 (DEC-UI-002 — "짧게"만 정해져 있다) */
const AUTO_SWITCH_FLASH_SECONDS = 1
const EMPTY_FIRE_NOTICE_SECONDS = 1.2
/**
 * 낫 휘두름 호가 보이는 시간.
 *
 * 전성민이 이펙트 넷을 코드 도형과 시간값으로 하라고 정하면서 지속시간은
 * 주지 않았다 (8/6). 낫 재사용 대기가 승인 데이터로 0.5초라 그보다 짧아야
 * 다음 휘두름과 겹치지 않는다.
 */
const SICKLE_SWING_SECONDS = 0.18

/**
 * 투척 퀵슬롯 피드백 (DEC-UI-002)과 낫 휘두름 표시.
 *
 * **재배·습격 양쪽에서 흐른다.** 아래 `advanceFeedback()` 은 재배 단계에서만
 * 불리는데 투척과 낫은 습격에서도 쓴다. 그래서 이것들만 따로 두고 단계와 무관하게
 * 줄인다 — 습격에서 소진 전환이 일어나면 강조가 영영 안 사라지는 것을 막는다.
 */
let autoSwitchFlash: { index: number; remaining: number } | null = null
let emptyFireRemaining = 0

/**
 * 방금 휘두른 낫의 조준 방향과 남은 표시 시간.
 *
 * **각도를 휘두른 순간에 붙잡는다.** 그리는 시점의 `input.aimAngle()` 을 쓰면
 * 호가 커서를 따라다녀서, 판정이 이미 끝난 방향이 아니라 지금 커서 방향을
 * 가리킨다. 판정은 `swingSickle()` 이 그 순간의 각도로 이미 끝냈다.
 */
let sickleSwing: { angle: number; remaining: number } | null = null

/**
 * 걷는 흔들림(bob)의 위상. 개체 키 → 위상 0~1 과 직전 좌표 (`DEC-ART-004`).
 *
 * **확정문이 걷기를 스프라이트 예외에서 빼고 코드 bob 으로 못박았다** —
 * *"이동 중 흔들림은 예외가 아니라 코드가 위치를 오르내리는 방식(bob)으로
 * 표현하며 새 스프라이트를 만들지 않는다."*
 *
 * 위상을 렌더가 아니라 여기서 들고 있는 이유는 **실제로 움직였는지를 좌표
 * 변화로만 알 수 있어서다.** 플레이어는 입력으로, 적대 주민은 자기 AI 로
 * 움직이므로 속도를 한곳에서 읽을 수 없다. 직전 좌표와 비교하면 어느 쪽이든
 * 같은 방법으로 판정된다.
 */
const bobStates = new Map<string, { phase: number; x: number; y: number }>()

/** 한 걸음에 걸리는 시간. 표현이라 승인 데이터가 아니다 */
const BOB_STEP_SECONDS = 0.42
/**
 * 이 속도 아래면 멈춘 것으로 본다 (월드 단위/초).
 *
 * 0 으로 두면 밀림·반올림 같은 미세한 좌표 변화에도 계속 튄다.
 */
const BOB_MOVING_SPEED = 4

/**
 * 좌표 변화로 이동을 판정해 위상을 진행시킨다. 멈췄으면 null.
 *
 * **걸음 속도를 실제 이동 속도에 비례시킨다.** 고정 주기로 두면 회복 중이거나
 * 둔화가 걸려 느리게 걸을 때도 같은 박자로 튀어서 미끄러지는 것처럼 보인다.
 */
/* 방향과 위상 계산은 `render/motion.ts` 에 있다 — 그 파일만 테스트가 붙는다 */

/**
 * 좌표 변화로 이동을 판정해 위상과 방향을 낸다. 멈췄으면 위상이 null 이다.
 *
 * **걸음 속도를 실제 이동 속도에 비례시킨다.** 고정 주기로 두면 회복 중이거나
 * 둔화가 걸려 느리게 걸을 때도 같은 박자로 튀어서 미끄러지는 것처럼 보인다.
 */
function advanceBob(
  key: string,
  x: number,
  y: number,
  dt: number,
): { phase: number | null; facing: Facing } {
  const prev = bobStates.get(key)
  if (prev === undefined) {
    bobStates.set(key, { phase: 0, x, y })
    return { phase: null, facing: null }
  }

  const step = walkStep(prev.phase, x - prev.x, y - prev.y, dt, runConfig.moveSpeed, {
    stepSeconds: BOB_STEP_SECONDS,
    movingSpeed: BOB_MOVING_SPEED,
  })
  prev.x = x
  prev.y = y
  // 멈추면 착지 자세로 되돌린다. 공중에서 굳으면 떠 있는 것처럼 보인다.
  prev.phase = step.phase ?? 0
  return step
}

/**
 * 필드가 입력을 갖고 있던 마지막 조준 각도.
 *
 * 그리는 시점의 `input.aimAngle()` 을 그대로 쓰면 일시정지·대화·정비가 열려
 * 있어도 조준선이 커서를 따라다닌다. 낫·투척은 계속 `input.aimAngle()` 을
 * 직접 읽는다 — 그쪽은 필드가 입력을 가질 때만 불리므로 굳힐 이유가 없다.
 */
let fieldAimAngle = 0

/**
 * 야생동물의 진행 방향. 인스턴스 ID → 각도와 직전 좌표 (`DEC-ART-004`).
 *
 * 확정문이 사람과 야생동물을 갈랐다 — 사람은 bob, **야생동물은 회전**이다.
 * *"탑뷰에서 머리가 진행 방향을 향하도록 이동 중인 야생동물의 기존 한 장짜리
 * 스프라이트를 현재 이동 벡터 방향으로 코드가 회전한다."*
 *
 * **멈추면 마지막 방향을 유지한다.** 그래서 각도를 들고 있어야 하고, 멈춘
 * 프레임에 각도를 버리면 설 때마다 홱 돌아간다.
 */
const wildlifeHeadings = new Map<string, { angle: number; x: number; y: number }>()

/**
 * 아직 안 움직인 개체의 방향. **회전 0 이 되는 각도다.**
 *
 * 그림이 화면 아래쪽(+Y)을 보고 있어서 `field.ts` 가 `heading - 90도` 로 돌린다.
 * 그래서 여기가 `+90도` 여야 처음 그림이 그려진 그대로 선다.
 */
const HEADING_REST = Math.PI / 2

function advanceWildlifeHeadings(dt: number): void {
  const alive = new Set<string>()
  for (const runtime of wildlife?.instances ?? []) {
    const id = runtime.entity.instanceId
    alive.add(id)

    const prev = wildlifeHeadings.get(id)
    if (prev === undefined) {
      wildlifeHeadings.set(id, { angle: HEADING_REST, x: runtime.entity.x, y: runtime.entity.y })
      // **이 개체를 처음 본 프레임이다.** 나타날 때 한 번 운다 — `wildlife.csv` 의
      // `sfx` 는 종류별 울음이고, 출현이 그 소리가 붙을 가장 자연스러운 순간이다.
      // 여기서 내는 이유는 출현을 알리는 별도 이벤트가 없어서다.
      sfx.play(runtime.species.assets?.sfx)
      continue
    }

    // 멈춰 있으면 각도를 그대로 둔다 (확정문 — 마지막 이동 방향 유지).
    prev.angle = headingStep(
      prev.angle,
      runtime.entity.x - prev.x,
      runtime.entity.y - prev.y,
      dt,
      BOB_MOVING_SPEED,
    )
    prev.x = runtime.entity.x
    prev.y = runtime.entity.y
  }

  // 사라진 개체는 버린다. 인스턴스 ID 가 재사용되면 직전 개체의 방향을 물려받는다.
  for (const id of [...wildlifeHeadings.keys()]) {
    if (!alive.has(id)) wildlifeHeadings.delete(id)
  }
}

/** 이번 프레임의 걷기 위상과 방향. 뷰를 만들 때 읽는다 */
let playerBob: number | null = null
let playerFacing: Facing = null
let hostileBob: number | null = null
let hostileFacing: Facing = null

/**
 * 적대 주민이 방금 공격했다는 표시가 남은 초 (`DEC-ART-004` 교체 스프라이트).
 *
 * `resident-combat.ts` 가 `attacked` 이벤트를 이미 내고 있었는데 **듣는 쪽이
 * 없었다.** 공격 순간이 화면에 아무 흔적도 남기지 않던 자리다.
 */
let hostileAttackRemaining = 0

/** 지원 주민이 방금 공격했다는 표시가 남은 초. 적대 쪽과 같은 길이를 쓴다 */
let allyAttackRemaining = 0

/**
 * 야생동물이 작물을 먹는 소리 — "챱챱챱" (8/9 담당자).
 *
 * 회복 시작음 한 장을 세 번 겹쳐 낸다. **파일을 세 개 만들지 않는 이유**는
 * 같은 소리의 반복이 필요한 것이지 다른 소리 셋이 필요한 게 아니기 때문이다.
 * `sfx.play()` 가 매번 새 `Audio` 를 만들어서 겹쳐 나는 것이 이미 보장된다.
 *
 * 간격은 화면 표시가 아니라 소리의 리듬이라 `layout.css` 가 아니라 여기 있다.
 */
const CHOMP_COUNT = 3
/**
 * 간격. **8/9 에 110 → 240 으로 늘렸다** — 110 은 씹는 소리가 아니라 연사음으로
 * 들렸다. 사람이 세 번 씹는 속도에 가까워야 "챱챱챱" 으로 읽힌다.
 */
const CHOMP_GAP_MS = 240

function playChomp(): void {
  for (let i = 0; i < CHOMP_COUNT; i += 1) {
    if (i === 0) sfx.play(SOUND_ASSET.recoveryStart)
    else window.setTimeout(() => sfx.play(SOUND_ASSET.recoveryStart), i * CHOMP_GAP_MS)
  }
}

/** 교체 스프라이트가 보이는 시간. 표현이라 승인 데이터가 아니다 */
const ATTACK_SPRITE_SECONDS = 0.2

/**
 * 방금 맞은 적대 개체의 명중 표시. 인스턴스 ID → 남은 초.
 *
 * `combat.ts` 의 `damaged` 이벤트가 `overTime` 구분자를 **"화면 표시를 가르는 데
 * 쓴다"** 는 주석과 함께 갖고 있었는데 듣는 쪽이 없었다. 지속 피해 틱에는 켜지
 * 않는다 — 틱마다 켜면 불타는 내내 충격선이 깜빡여 지속 피해 링과 뜻이 겹친다.
 */
const hitFlashes = new Map<string, number>()
const IMPACT_FLASH_SECONDS = 0.22

/** 효과음. 파일이 없으면 조용히 넘어간다 (src/audio/sfx.ts) */
const sfx = createSfx()

/**
 * 배경음.
 *
 * **아직 어디서도 `play()` 를 부르지 않는다.** BGM 6종은 붙을 콘텐츠 부모가 없어
 * 고정 목록으로 가야 하는데 `DEC-ART-004` 가 그 목록의 구간을 `ui`·`logo`·`hud`·
 * `font` 로 한정했다. `DEC-ART-005` 대체가 선행이다 (`docs/submission/
 * SOUND_ASSET_INDEX.md` 의 "막혀 있는 것"). 여기서 만들어 두는 이유는 음량
 * 설정(`DEC-UI-027`)이 배경음 갈래를 요구하기 때문이다 — 대체가 확정되면
 * 화면 전환에 `bgm.play(...)` 를 붙이는 것만 남는다.
 */
const bgm = createBgm()

/** 전체·배경음·효과음 (DEC-UI-027). 일시정지 화면이 이걸 조작한다 */
const mixer = createMixer({ bgm, sfx })

/**
 * 작물 속성 효과가 낼 소리. `combat_mechanic_key` → 논리 에셋 ID.
 *
 * **효과에는 속성 ID 가 없고 `mechanicKey` 만 있다** (`systems/combat.ts`).
 * 그런데 같은 기전을 쓰는 속성 둘이 같은 파일을 가리키므로(화끈함·짓무름 →
 * `burn_tick`, 미끄러움·끈적함 → `slow_tick`) 기전으로 골라도 모호하지 않다.
 * **속성마다 다른 소리를 주게 되면 이 map 이 먼저 깨진다** — 그때는 효과가
 * 속성 ID 를 들고 다녀야 한다.
 */
let mechanicSfx = new Map<string, string>()

/** 둔화가 방금 걸린 것을 잡으려고 직전 상태를 들고 있는다 */
const slowedBefore = new Set<string>()

/**
 * 명중 표시를 켠다. **`combat` 의 이벤트를 받는 곳은 전부 이걸 부른다.**
 *
 * 받는 곳이 넷이다 — 재배와 습격의 `combat.update()` 가 각각, 지원 공격의
 * `applySupportDamage()`, 그리고 낫은 `swingSickle()` 반환값이라 이벤트가
 * 아니다. 8/7 에 습격 쪽만 연결하고 완료로 적었다가 재배에서 안 뜨는 것을
 * 담당자가 잡았고, 그 직전에는 지원 공격을 빠뜨렸다. **판단을 한 곳에 모아야
 * 다음 호출자가 생겨도 같은 규칙을 쓴다.**
 *
 * 지속 피해 틱은 뺀다 — `overTime` 이 정확히 그것을 가르라고 있는 구분자다.
 * 틱마다 켜면 불타는 내내 충격선이 깜빡여 지속 피해 링과 뜻이 겹친다.
 */
function noteHitFlash(event: CombatEvent): void {
  if (event.type !== 'damaged') return
  if (event.overTime === true) {
    // 지속 피해 틱은 화면 표시를 안 켜는 대신 소리로 알린다 (DEC-CONTENT-013).
    sfx.play(mechanicSfx.get('damage_over_time'))
    return
  }
  // 투척 명중음도 여기서 낸다. 이 함수가 `damaged` 를 받는 네 경로의 유일한
  // 합류점이라, 발행 지점에 붙이면 그중 하나는 반드시 빠진다.
  // `impactMode` 가 없는 것은 낫과 지원 주민 공격이라 투척음을 내지 않는다.
  if (event.impactMode === 'area') sfx.play(SOUND_ASSET.impactArea)
  else if (event.impactMode === 'direct') sfx.play(SOUND_ASSET.impactDirect)

  if (event.targetId === undefined) return
  hitFlashes.set(event.targetId, IMPACT_FLASH_SECONDS)
}

/** 플레이어가 방금 맞았다는 표시가 남은 초 */
let playerHitRemaining = 0
const PLAYER_HIT_SECONDS = 0.45

/**
 * 튜토리얼 `use_throwable` 완료까지 남은 초. 대기 중이 아니면 null.
 *
 * **던지는 것을 보고 나서 넘어가게 하려는 지연이다.** 8/7 플레이 테스트에서
 * *"투척 무기를 던지는 걸 못 보고 좌클릭 누르자마자 넘어간다"* 가 나왔다.
 * 마지막 단계라 완료되는 즉시 종료 화면이 필드를 덮어서, 자기가 뭘 했는지
 * 못 본 채로 튜토리얼이 끝난다.
 *
 * **`DEC-UI-030` 의 "실제로 성공하면 다음으로 넘어간다" 를 바꾸지 않는다** —
 * 성공 여부가 아니라 알리는 시점만 미룬다. 실패하면 애초에 이벤트가 안 온다.
 */
let throwableStepDelay: number | null = null
const THROWABLE_STEP_DELAY_SECONDS = 0.9

/** 런이 바뀌면 개체 키가 재사용되므로 위상을 버린다 */
function resetBob(): void {
  bobStates.clear()
  playerBob = null
  playerFacing = null
  hostileBob = null
  hostileFacing = null
  hostileAttackRemaining = 0
  allyAttackRemaining = 0
  // 인스턴스 ID 로 들고 있어서 새 런이 같은 키를 다시 쓴다
  hitFlashes.clear()
  wildlifeHeadings.clear()
  // 안 지우면 새 런의 첫 프레임에 이미 둔화된 것으로 읽혀 소리를 건너뛴다
  slowedBefore.clear()
  playerHitRemaining = 0
  // 튜토리얼을 건너뛰거나 런이 끝나면 대기 중인 완료 알림을 버린다.
  // 안 버리면 본 런 1일차에서 뒤늦게 튜토리얼 단계가 완료된다.
  throwableStepDelay = null
}

/**
 * 방향과 공격 상태에 맞는 `field_sprite` 를 고른다 (`DEC-ART-004`).
 *
 * **없으면 정면으로 떨어진다.** 교체 스프라이트 15장이 아직 제작 전이라
 * 지금은 전부 정면이 나오고, 파일이 와서 `content_assets.csv` 에 행이 붙으면
 * 코드 수정 없이 바뀐다. 공격이 방향보다 우선이다 — 휘두르는 중에 좌우로
 * 움직여도 공격 그림이 유지돼야 한다.
 */
function characterSprite(
  assets: ContentAssets | undefined,
  facing: Facing,
  attacking: boolean,
): string | undefined {
  if (attacking && assets?.field_sprite_attack !== undefined) {
    return assets.field_sprite_attack
  }
  if (facing === 'left' && assets?.field_sprite_left !== undefined) {
    return assets.field_sprite_left
  }
  if (facing === 'right' && assets?.field_sprite_right !== undefined) {
    return assets.field_sprite_right
  }
  return assets?.field_sprite
}

function advanceCombatFeedback(dt: number): void {
  if (autoSwitchFlash !== null) {
    autoSwitchFlash.remaining -= dt
    if (autoSwitchFlash.remaining <= 0) autoSwitchFlash = null
  }
  if (emptyFireRemaining > 0) emptyFireRemaining = Math.max(0, emptyFireRemaining - dt)
  if (sickleSwing !== null) {
    sickleSwing.remaining -= dt
    if (sickleSwing.remaining <= 0) sickleSwing = null
  }
  if (hostileAttackRemaining > 0) {
    hostileAttackRemaining = Math.max(0, hostileAttackRemaining - dt)
  }
  if (allyAttackRemaining > 0) {
    allyAttackRemaining = Math.max(0, allyAttackRemaining - dt)
  }
  if (playerHitRemaining > 0) {
    playerHitRemaining = Math.max(0, playerHitRemaining - dt)
  }
  for (const [id, remaining] of hitFlashes) {
    const next = remaining - dt
    if (next <= 0) hitFlashes.delete(id)
    else hitFlashes.set(id, next)
  }
  if (throwableStepDelay !== null) {
    throwableStepDelay -= dt
    if (throwableStepDelay <= 0) {
      throwableStepDelay = null
      completeTutorialStep('use_throwable')
    }
  }

  // 둔화가 **방금 걸린** 순간에만 소리를 낸다 (DEC-CONTENT-013).
  //
  // 지속 피해와 달리 둔화에는 틱이 없어서 알릴 순간이 걸리는 때뿐이다. 걸려 있는
  // 동안 계속 내면 소음이 되고, 효과를 거는 이벤트가 따로 없어 상태 전이로 잡는다.
  const slowNow = new Set<string>()
  for (const runtime of wildlife?.instances ?? []) {
    if (runtime.entity.effects.some((e) => e.mechanicKey === 'movement_slow')) {
      slowNow.add(runtime.entity.instanceId)
    }
  }
  if (hostile !== null && hostile.entity.effects.some((e) => e.mechanicKey === 'movement_slow')) {
    slowNow.add(hostile.entity.instanceId)
  }
  for (const id of slowNow) {
    if (!slowedBefore.has(id)) sfx.play(mechanicSfx.get('movement_slow'))
  }
  slowedBefore.clear()
  for (const id of slowNow) slowedBefore.add(id)
}

/** 전환 강조가 남은 경작지. plot_id → 남은 초 */
const readyFlashes = new Map<string, number>()
/** 수확 획득 표시 */
let harvestPopups: { x: number; y: number; text: string; remaining: number }[] = []

/** 표시용 수명을 줄인다. 재배 단계에서만 흐른다 */
function advanceFeedback(dt: number): void {
  for (const [plotId, remaining] of readyFlashes) {
    const next = remaining - dt
    if (next <= 0) readyFlashes.delete(plotId)
    else readyFlashes.set(plotId, next)
  }

  for (const popup of harvestPopups) popup.remaining -= dt
  harvestPopups = harvestPopups.filter((p) => p.remaining > 0)
}

/**
 * 지금 재배 단계인가.
 *
 * 필드 모드가 `farming` 이어도 정비 허브 오버레이가 덮고 있으면 재배가 아니다
 * (정비는 화면 전환이 아니라 셔터 오버레이라 필드 모드가 그대로 유지된다).
 * 작물 성장·재배 타이머·심기·수확이 전부 이 판정 하나를 쓴다.
 */
function inFarmingStage(): boolean {
  return scenes.currentFieldMode() === 'farming' && scenes.openOverlays().length === 0
}

function inRaidStage(): boolean {
  return scenes.currentFieldMode() === 'raid' && scenes.openOverlays().length === 0
}

/**
 * 습격 한 프레임.
 *
 * 투항 대화가 열려 있으면 `inRaidStage()` 가 false 라 여기 오지 않는다.
 * 그것이 `DEC-RESIDENT-039` 가 정한 "전투 타이머 정지" 다 — 정지 플래그를
 * 따로 두지 않는다.
 */
function updateRaid(dt: number): void {
  if (residentCombat === null || combat === null || hostile === null || run === null) return

  // 체력 0이면 어떤 경로로 여기 들어왔든 전투가 돌지 않는다 (DEC-RUN-008).
  //
  // 화면 전환만으로 막으면 화면을 우회하는 경로가 생겼을 때 그대로 뚫린다 —
  // 실제로 개발 통로가 `run_failed` 위에 필드를 다시 띄워서, 체력 0인 플레이어가
  // 주민을 투항 직전까지 때리는 상태가 나왔다 (그 통로는 8/5에 지웠다).
  // 화면이 아니라 **상태로** 판단하는 이유가 이것이다.
  if (run.health <= 0) {
    failRunIfDead()
    return
  }

  for (const event of residentCombat.update(dt, { ...player, collisionRadius: runConfig.collisionRadius })) {
    // 공격 순간 교체 스프라이트 (DEC-ART-004). 이 이벤트는 8/3부터 나오고 있었는데
    // 듣는 쪽이 없어서 공격이 화면에 아무 흔적도 남기지 않았다.
    if (event.type === 'attacked') hostileAttackRemaining = ATTACK_SPRITE_SECONDS
    // 만복의 엽전만 실제 투사체다 (DEC-CONTENT-008 — 나머지 지원 공격은 즉시
    // 확정 피해라 던지는 것이 없다). 플레이어 투척과 같은 소리를 쓴다 — 같은
    // 동작이고, 던지는 사람마다 소리를 가르는 규칙이 없다.
    if (event.type === 'projectileFired') sfx.play(SOUND_ASSET.throw)
    if (event.type !== 'playerDamaged') continue
    run.health = Math.max(0, run.health - event.amount)
    bus.emit('combat.playerDamaged', { amount: event.amount, remainingHealth: run.health })
  }

  // 플레이어 → 주민. 야생동물과 같은 시스템을 쓰되 대상만 바뀐다.
  combat.setTargets(currentTargets())
  for (const event of combat.update(dt)) {
    noteHitFlash(event)
    if (event.type === 'surrenderOffered') onSurrenderOffered()
    if (event.type === 'killed') {
      onTargetKilled(event.targetId ?? '')
      return
    }
  }

  // 영입 주민의 지원 공격 (DEC-RESIDENT-021).
  //
  // **플레이어 피해 처리 뒤, 같은 프레임 안에서 돈다.** 피해는 `combat` 을 거치므로
  // 투항 발동이 낫·투척과 같은 판정을 지난다. 처치는 구조적으로 불가능하다 —
  // `applySupportDamage()` 가 체력 1 아래로 못 내려간다.
  if (allySupport !== null && hostileTarget !== null) {
    const damage = allySupport.update(dt)
    if (damage !== null) {
      // 공격 자세 교체 (DEC-ART-005 — 주민이 공격하는 순간 스프라이트 1장).
      // 적대 주민에는 8/7 에 붙였는데 지원 주민이 빠져 있었다. **지원 공격은
      // 투사체가 없어서**(DEC-CONTENT-008) 자세가 안 바뀌면 밝은 테두리만 있는
      // 사람이 가만히 서 있는 동안 상대 체력이 줄어드는 것으로 보인다.
      allyAttackRemaining = ATTACK_SPRITE_SECONDS
      for (const event of combat.applySupportDamage(hostileTarget.entity.instanceId, damage)) {
        // 지원 공격은 투사체가 없으므로(DEC-CONTENT-008) **명중 표시가 유일한
        // 흔적이다.** 확정문이 "필요한 것은 시각적인 발사·명중 효과뿐" 이라고
        // 정했는데 발사 쪽(attackFlash)만 있고 명중 쪽이 비어 있었다.
        noteHitFlash(event)
        if (event.type === 'surrenderOffered') onSurrenderOffered()
      }
    }
  }

  if (allySupportNotice !== null) {
    allySupportNotice.remaining -= dt
    if (allySupportNotice.remaining <= 0) allySupportNotice = null
  }

  // 습격 중 체력 0도 즉시 런 실패다 (DEC-RUN-008)
  failRunIfDead()
}

/**
 * 공포도 구간 이름. **개발 빌드의 조우 결과 표시에만 쓴다** (DEC-UI-013).
 *
 * 제출 빌드는 구간 이름도 표시하지 않으므로 이 값이 화면까지 가지 않는다.
 */
function fearBandNameOf(fear: number): string | null {
  return fearBandOf(fear)?.display_name ?? null
}

/**
 * 주민 투사체의 반지름 (DEC-CONTENT-008).
 *
 * `sourceId` 는 쏜 주민의 전투 프로필 ID 다. 승인 데이터에 `projectile_radius` 가
 * 있으므로 못 찾으면 데이터가 어긋난 것이다 — 그때는 보이기라도 하도록 최소값을
 * 쓰고 개발 빌드에 남긴다. 조용히 0으로 두면 다시 안 보이는 투사체가 된다.
 */
function hostileProjectileRadius(profileId: string): number {
  const radius = raidData?.profileById.get(profileId)?.projectile_radius ?? null
  if (radius !== null) return radius

  if (isDevBuild) {
    console.warn(`[전투] ${profileId} 의 projectile_radius 를 찾지 못했다`)
  }
  return 4
}

/**
 * 공포도가 속한 구간 (DEC-RESIDENT-046).
 *
 * 일지 입력은 구간 자체를 요구하고(수치가 아니라) 폴백 일지도 구간으로 고르므로
 * 표시용 이름만 돌려주는 위 함수와 나눴다. 상한이 비어 있으면 무한대다.
 */
function fearBandOf(fear: number): FearBand | null {
  return (
    fearBands.find((b) => fear >= b.min_fear && (b.max_fear === null || fear <= b.max_fear)) ?? null
  )
}

/**
 * 자원 한 항목을 결과 화면의 한 줄로.
 *
 * 소지금은 콘텐츠 테이블이 아니라 통화라 보관함 표시 사전에 없다. 여기서만
 * 이름을 붙이고 정비 허브와 같은 말(`소지금`)을 쓴다 — 같은 것을 두 화면이
 * 다르게 부르면 플레이어가 다른 자원으로 읽는다.
 */
function resourceLine(kind: string, id: string, quantity: number): EncounterResourceLine {
  return {
    name: kind === 'money' ? '소지금' : (displayNames.get(id) ?? id),
    quantity,
  }
}

/**
 * 조우 결과 화면이 그릴 내용을 확정한다 (DEC-UI-011, DEC-UI-013).
 *
 * **결과가 확정되는 그 시점에 만든다.** 화면이 열릴 때 런 상태에서 역산하면
 * "이번 조우에서 실제로 지급·소비된 것"이 아니라 "지금 보관함에 있는 것"이 되고,
 * 그 둘은 다음 처리가 하나만 끼어도 갈린다.
 */
function buildEncounterResultView(
  residentId: string,
  outcome: FinalOutcome,
  rewardBundleId: string | null,
  fearDelta: number,
): EncounterResultView | null {
  const resident = run?.residents[residentId]
  if (resident === undefined) return null

  const bundle = rewardBundleId === null ? undefined : rewardBundlesById.get(rewardBundleId)
  const collected = pendingEncounter
  const fear = run?.record.fear ?? 0

  return {
    residentName: residentNames.get(residentId) ?? residentId,
    outcome,
    lifeState: resident.lifeState,
    allegiance: resident.allegiance,
    relationship: resident.relationship,

    // 보상 묶음은 전부 지급되거나 전혀 지급되지 않는다 (DEC-RESIDENT-042).
    // 그래서 승인 묶음의 항목이 곧 실제 지급 내역이다. 보상이 없는 결과면
    // 빈 배열이고 화면이 영역 자체를 그리지 않는다 (DEC-UI-011).
    rewards: (bundle?.entries ?? []).map((entry) =>
      resourceLine(entry.resource_kind, entry.resource_id, entry.quantity),
    ),
    consumedCrops: Object.entries(collected?.consumedCrops ?? {}).map(([cropId, quantity]) =>
      resourceLine('crop', cropId, quantity),
    ),
    negotiationRejected: collected?.negotiationRejected ?? false,

    // 이번 조우에서 **새로** 확인한 것만 모여 있다. 걸러 넣는 것은 판정 시점이다
    revealedFacts: (collected?.revealedFactIds ?? [])
      .map((id) => storyFactById.get(id))
      .filter((text): text is string => typeof text === 'string' && text.length > 0),
    // **조우 상대가 아니라 이번 습격을 지원한 주민이다** (DEC-UI-012).
    // 상대의 supportUsed 를 읽으면 항상 false 다 — 해결된 주민은 다시 적대로
    // 나오지 않으므로(DEC-RESIDENT-043) 적대 주민이 지원했을 수가 없다.
    supportedBy: raidSupporterName,

    // 제출 빌드에서는 점수·구간·변화량을 어떤 형태로도 두지 않는다 (DEC-UI-013)
    fear: isDevBuild
      ? { total: fear, delta: fearDelta, bandName: fearBandNameOf(fear) }
      : null,
  }
}

/**
 * 조우를 끝낸다 — 최종 결과 확정, 관계·공포도, 보상 지급 (DEC-RESIDENT-052, 042).
 *
 * **여기가 조우를 끝내는 유일한 경로다.** 처치·투항·대화 해결이 각자 상태를 고치면
 * "처치했는데 관계가 단절이 아닌" 조합이 만들어지고, 엔딩 판정이 그걸 그대로 읽는다.
 *
 * @returns 실제로 확정됐으면 true. 중복 입력이나 보상 데이터 오류면 false.
 */
function finishEncounter(residentId: string, outcome: FinalOutcome): boolean {
  if (resolution === null) return false

  const result = resolution.resolve(residentId, outcome)
  if (!result.ok) {
    // 조용히 넘어가지 않는다. 중복 확정은 막힌 것이 정상이고,
    // 보상 데이터 오류는 승인 데이터를 고쳐야 하는 문제다.
    if (result.reason === 'already_resolved') {
      console.warn(`[조우] ${residentId} 는 이미 해결됐다 — 중복 확정을 막았다`)
    } else {
      bus.emit('data.error', {
        summary: '조우를 끝낼 수 없다',
        detail: `${residentId} · ${outcome} · ${result.reason}`,
      })
    }
    return false
  }

  const { rewardBundleId, fearDelta, fearPending } = result.value

  // 조우가 끝나면 지원 주민은 필드에서 사라진다 (DEC-RESIDENT-021 — 지원은 습격
  // 전투 하나에 붙는다). `supportUsed` 는 세울 때 이미 켰으므로 여기서 손대지
  // 않는다. 생존·영입 상태도 유지된다.
  allySupport = null
  allySupportNotice = null

  // 결과 화면 내용을 여기서 확정한다. 화면 전환보다 앞이라야 한다 —
  // 아래 `scenes.send()` 가 곧바로 조우 결과 화면을 열고 그때 이 값을 읽는다.
  encounterResultView = buildEncounterResultView(residentId, outcome, rewardBundleId, fearDelta)

  bus.emit('encounter.finished', { residentId, finalOutcome: outcome })
  if (rewardBundleId !== null) {
    bus.emit('reward.granted', { residentId, bundleId: rewardBundleId })
  }

  console.info(
    `[조우] ${residentId} → ${outcome} · 관계 ${run?.residents[residentId]?.relationship} · ` +
      `공포도 +${fearDelta} (누적 ${run?.record.fear})` +
      (rewardBundleId === null ? '' : ` · 보상 ${rewardBundleId}`),
  )
  if (fearPending) warnFearPending()

  // 마지막 습격의 조우 결과와 모든 상태 변경을 끝낸 뒤에 엔딩을 판정한다
  // (DEC-CONTENT-011). 여기보다 앞이면 방금 바뀐 관계·공포도가 반영되지 않는다.
  if (raidData?.raidTypeByDay.get(run?.dayNumber ?? 0) === 'final_raid') decideEnding()

  // **버스 이벤트만 쏘면 화면이 안 넘어간다.** `encounter.finished` 는 UI 에게
  // 알리는 결과 이벤트이고, 흐름을 옮기는 것은 `encounter_finished` 입력이다.
  // 둘을 헷갈려서 체력 0에도 계속 움직였던 것과 같은 구조다 (failRunIfDead).
  //
  // 조우 결과 화면에서 `확인` 을 눌러야 다음 일차 또는 엔딩으로 간다 (DEC-RUN-015).
  if (scenes.step().at === 'raid') {
    scenes.send({ type: 'encounter_finished' })
  } else {
    // **여기 오면 버그다.** 조우는 습격 단계에서만 시작되므로 끝날 때도 습격이어야
    // 한다. 8/5 까지는 개발 통로가 흐름을 건너뛰고 필드를 띄워 정상적으로 도달했고
    // 그때는 경고만 남겼는데, 그 통로를 지웠으므로 이제는 흐름과 조우 상태가
    // 갈라졌다는 뜻이다. 조용히 넘기면 하루가 끝나지 않는다.
    bus.emit('data.error', {
      summary: '조우가 끝났는데 흐름이 습격 단계가 아니다',
      detail: `현재 단계 ${scenes.step().at} · ${residentId} · ${outcome}`,
    })
  }
  return true
}

/**
 * 엔딩 판정 (DEC-CONTENT-011).
 *
 * 시스템이 엔딩을 먼저 확정하고 그 값을 런 결과에 저장한 **뒤에만** LLM 기록문을
 * 요청한다. 기록문 생성이 실패해도 엔딩 진행을 막지 않는다 — 확정 즉시 승인된
 * 폴백 문장으로 채워 두므로 화면에 보여 줄 문장이 항상 있다.
 */
function decideEnding(): void {
  if (endingJudge === null || run === null) return

  const judgement = endingJudge.judge({ record: run.record, residents: run.residents })

  if (judgement.ending === null) {
    // 전역 폴백조차 없다. 승인 데이터가 잘못된 것이라 화면에 그대로 올린다.
    bus.emit('data.error', {
      summary: '엔딩을 확정할 수 없다',
      detail: `공포도 ${judgement.fearScore} · ${judgement.fallbackReason}`,
    })
    return
  }

  // **확정한 엔딩을 런 결과에 저장한 뒤에만** 기록문 생성을 요청한다
  // (DEC-CONTENT-011). 먼저 승인된 폴백 문장으로 채워 두므로, LLM 이 실패하거나
  // 응답이 늦어도 화면에 보여 줄 문장이 항상 있다.
  run.ending = {
    endingId: judgement.ending.id,
    endingContentVersion: judgement.ending.content_version,
    fear: judgement.fearScore,
    fearBandId: judgement.fearBand?.id ?? null,
    dominantCropId: judgement.dominantCrop?.cropId ?? null,
    recordText: judgement.ending.fallback_record_text,
    usedFallback: true,
  }

  bus.emit('ending.decided', {
    endingId: judgement.ending.id,
    endingTitle: judgement.ending.ending_title,
  })

  // 폴백은 판정 실패의 결과지 기본값이 아니다. 왜 그렇게 됐는지를 남긴다.
  if (judgement.fallbackReason !== null) {
    console.warn(
      `[엔딩] 전역 폴백으로 떨어졌다 — ${judgement.fallbackReason}. ` +
        `공포도 ${judgement.fearScore} · 구간 ${judgement.fearBand?.id ?? '없음'}`,
    )
  }

  console.info(
    `[엔딩] ${judgement.ending.ending_title} (${judgement.ending.id}) · ` +
      `공포도 ${judgement.fearScore} · 구간 ${judgement.fearBand?.display_name ?? '없음'} · ` +
      `대표 작물 ${judgement.dominantCrop?.displayName ?? '없음'}`,
  )

  // 기록문은 비동기로 채운다. **기다리지 않는다** — LLM 요청이 엔딩 진행을 막지
  // 않아야 한다 (DEC-CONTENT-011). 응답이 오면 폴백 문장을 대체한다.
  //
  // 승인 데이터가 없으면 요청 자체를 못 하므로 대기 표시를 켜지 않는다. 켜면
  // 엔딩 화면이 영영 `기록을 남기는 중…` 에 머문다.
  endingRecordPending = approvedForLlm !== null
  void fillEndingRecord(judgement.ending, judgement)
}

/**
 * 엔딩 기록문을 LLM 으로 채운다 (DEC-CONTENT-011).
 *
 * 실패하면 아무것도 하지 않는다 — `run.ending.recordText` 에 이미 승인된
 * `fallback_record_text` 가 들어 있고, 그것이 규칙상 정상 경로다.
 */
async function fillEndingRecord(
  ending: import('./data/types.ts').Ending,
  judgement: import('./systems/ending.ts').EndingJudgement,
): Promise<void> {
  if (run === null || approvedForLlm === null) return

  const input = buildEndingInput({
    manifest: approvedForLlm.manifest,
    playerName: run.playerName,
    finalDay: run.dayNumber,
    ending,
    fearBand: judgement.fearBand,
    dominantCrop: judgement.dominantCrop,
    record: run.record,
    residents: run.residents,
    residentData: approvedForLlm.residents,
    storyInfos: approvedForLlm.storyInfos,
  })

  const result = await requestEndingRecord(input, ending.fallback_record_text)

  // 성공이든 폴백이든 여기 오면 대기는 끝났다. 화면 갱신보다 먼저 끈다 —
  // 아래 `return` 으로 빠지는 경우에도 대기 표시가 남으면 안 된다.
  endingRecordPending = false

  if (run === null || run.ending === null) return // 그 사이 런이 초기화됐다

  run.ending.recordText = result.recordText
  run.ending.usedFallback = result.usedFallback

  bus.emit('ending.recordReady', {
    recordText: result.recordText,
    usedFallback: result.usedFallback,
  })

  console.info(
    result.usedFallback
      ? '[엔딩] 승인된 폴백 기록문을 쓴다 (LLM 미사용 또는 실패 — 정상 경로)'
      : `[엔딩] 기록문 생성됨 · 모델 ${result.generatorModelId} · 재시도 ${result.retryCount}회`,
  )
}

/**
 * 판정으로 공개된 사연 정보를 기록한다 (DEC-UI-011, DEC-CONTENT-017).
 *
 * **"이번 조우에서 새로 확인했는가"는 이 순간에만 알 수 있다.** 런 상태에 넣고 나면
 * 예전에 확인한 것과 구분이 안 되고, 그러면 조우 결과가 이미 본 사연을 다시 띄운다.
 * 그래서 넣기 전에 한 번 거르고 이번 조우 목록에도 같이 남긴다.
 *
 * 런 상태의 `revealedStoryInfoIds` 는 엔딩 기록문 입력도 읽는다 — 확인한 사연만
 * LLM 에 넘긴다 (llm/ending.ts).
 */
function recordRevealedStoryInfo(residentId: string, storyInfoId: string | null): void {
  if (storyInfoId === null || run === null) return

  const resident = run.residents[residentId]
  if (resident === undefined) return
  if (resident.revealedStoryInfoIds.includes(storyInfoId)) return

  resident.revealedStoryInfoIds.push(storyInfoId)
  pendingEncounter?.revealedFactIds.push(storyInfoId)

  // 기록됐다는 것이 화면에 바로 안 보인다 — 조우 결과까지 가야 드러난다.
  // 그래서 개발 빌드에 남긴다. 이게 없으면 "기록한다" 와 "안 한다" 가 같아 보인다.
  if (isDevBuild) console.info(`[사연] ${residentId} · ${storyInfoId} 확인함`)
}

// ── 대화 (DEC-UI-007, 008, 009, 010, DEC-RESIDENT-015) ──────
//
// 전투 전 대화는 습격 모드 진입과 동시에 열리고(scenes/manager.ts), 투항 대화는
// 주민이 투항 기준 이하로 처음 내려갈 때 열린다 (DEC-RESIDENT-016).
// 둘 다 오버레이가 열리는 순간 여기서 내용을 준비한다.

/** 그날의 적대 주민과 사연 시나리오 */
function raidActorOf(dayNumber: number): { residentId: string; scenarioId: string } | null {
  if (raidData === null) return null

  const residentId = raidData.hostileResidentByDay.get(dayNumber) ?? null
  if (residentId === null || residentId === '') return null

  const scenario = raidData.scenarioByResident.get(residentId)
  if (scenario === undefined) return null
  return { residentId, scenarioId: scenario.id }
}

/**
 * 전투 전 대화를 연다 (DEC-UI-008).
 *
 * 한 조우에서 **전투 전에 한 번만** 진행한다 (DEC-RESIDENT-015).
 */
function openPrecombatDialogue(): void {
  if (encounter === null || run === null || raidData === null) return

  const actor = raidActorOf(run.dayNumber)
  if (actor === null) {
    bus.emit('data.error', {
      summary: '전투 전 대화를 열 수 없다',
      detail: `${run.dayNumber}일차의 적대 주민 또는 사연 시나리오가 승인 데이터에 없다`,
    })
    return
  }

  // 해결된 주민과는 대화도 다시 열리지 않는다 (DEC-RESIDENT-043)
  if (resolution !== null && !resolution.canAppearAsHostile(actor.residentId)) {
    bus.emit('data.error', {
      summary: '전투 전 대화를 열 수 없다',
      detail: `${actor.residentId} 는 이미 조우가 해결된 주민이다 (DEC-RESIDENT-043)`,
    })
    return
  }

  const scenario = raidData.scenarioByResident.get(actor.residentId)!

  // 이번 런에서 실제로 쓰는 사연 시나리오를 런 상태에 남긴다.
  // 엔딩 기록문 입력이 이 값을 읽는다 (llm/ending.ts).
  const residentState = run.residents[actor.residentId]
  if (residentState !== undefined) residentState.scenarioId = scenario.id

  // 조우가 시작되는 지점이다. 결과 화면 재료를 여기서 연다 (DEC-UI-011).
  pendingEncounter = { consumedCrops: {}, negotiationRejected: false, revealedFactIds: [] }

  // 시작 대사가 공개하는 `basic` 사연을 확인한 정보로 기록한다 (DEC-CONTENT-024).
  //
  // **선택보다 앞이다.** 대사를 읽은 시점에 이미 안 것이므로 무엇을 고르든,
  // 싸워서 죽이든 남는다. 이게 없으면 대화를 열고 바로 전투로 간 런은 엔딩 LLM 에
  // 넘길 사실이 하나도 없다. `pendingEncounter` 를 연 뒤라야 이번 조우 목록에도
  // 같이 들어간다 (DEC-UI-011 — 새로 확인한 것만 결과 화면에 뜬다).
  recordRevealedStoryInfo(actor.residentId, scenario.precombat_opening_story_info_id)

  // 판정에 쓰는 사용 가능 여부는 encounter 가, 화면에 띄울 문장은 승인 선택지가 준다.
  // 선택지 문장은 아무것도 결정하지 않는다 (DEC-RESIDENT-049).
  const availability = encounter.availableChoices(scenario.id, run.resources.crops)

  dialogue = {
    phase: 'precombat',
    residentId: actor.residentId,
    residentName: residentNames.get(actor.residentId) ?? actor.residentId,
    openingText: scenario.precombat_opening_text,
    choices: availability.map((choice) => ({
      id: choice.choiceId,
      text: dialogueChoicesById.get(choice.choiceId)?.choice_text ?? '',
      // 자원 협상에만 수량 정보를 붙인다 (DEC-UI-007, DEC-UI-008)
      offer:
        choice.offerQuantity === null
          ? null
          : { quantity: choice.offerQuantity, heldTotal: choice.heldTotal },
      usable: choice.usable,
    })),
    reaction: null,
    pending: null,
  }

  bus.emit('dialogue.opened', {
    residentId: actor.residentId,
    scenarioId: scenario.id,
    phase: 'precombat',
  })
}

/**
 * 투항 대화를 연다 (DEC-UI-010, DEC-RESIDENT-019).
 *
 * 투항 선택지에는 수량 조건이 없으므로 **고를 수 없는 선택지를 두지 않는다.**
 * 판정도 없다 — 선택 기능이 곧 시스템 결과다 (DEC-CONTENT-009).
 */
function openSurrenderDialogue(): void {
  if (run === null || hostile === null || raidData === null) return

  const residentId = hostile.entity.residentId
  const scenario = raidData.scenarioByResident.get(residentId)
  if (scenario === undefined) {
    bus.emit('data.error', {
      summary: '투항 대화를 열 수 없다',
      detail: `${residentId} 의 사연 시나리오가 승인 데이터에 없다`,
    })
    return
  }

  // 투항 시작 대사가 공개하는 `core` 사연을 확인한 정보로 기록한다.
  //
  // **`DEC-CONTENT-017` 이 원래부터 확정해 둔 규칙인데 기록하는 곳이 없었다.**
  // 김민주는 전투 전 쪽만 비었다고 알렸으나 실제로는 양쪽 다 빠져 있었다.
  // `core` 는 사연의 핵심이라 여기서 놓치면 투항까지 간 런도 엔딩에 넘길 것이 얇아진다.
  recordRevealedStoryInfo(residentId, scenario.surrender_opening_story_info_id)

  const choices = [...dialogueChoicesById.values()].filter(
    (choice) => choice.scenario_id === scenario.id && choice.dialogue_phase === 'surrender',
  )

  dialogue = {
    phase: 'surrender',
    residentId,
    residentName: residentNames.get(residentId) ?? residentId,
    openingText: scenario.surrender_opening_text,
    choices: choices.map((choice) => ({
      id: choice.id,
      text: choice.choice_text,
      offer: null,
      usable: true,
    })),
    reaction: null,
    pending: null,
  }

  bus.emit('dialogue.opened', { residentId, scenarioId: scenario.id, phase: 'surrender' })
}

/** 선택 확정. 확정 뒤에는 되돌아갈 수 없다 (DEC-UI-008) */
function chooseDialogue(choiceId: string): void {
  if (dialogue === null || dialogue.reaction !== null) return
  if (dialogue.phase === 'precombat') choosePrecombat(choiceId)
  else chooseSurrender(choiceId)
}

function choosePrecombat(choiceId: string): void {
  if (dialogue === null || encounter === null || run === null || resolution === null) return

  const choice = dialogue.choices.find((c) => c.id === choiceId)
  if (choice === undefined || !choice.usable) return

  const residentId = dialogue.residentId
  const judgement = encounter.judge(residentId, choiceId, run.resources.crops)
  recordRevealedStoryInfo(residentId, judgement.revealedStoryInfoId)

  // 위협·대립은 조우를 해결하지 않지만 중요 행동이고 공포도를 올린다
  // (DEC-RESIDENT-046, DEC-RESIDENT-052).
  if (judgement.choiceFunction === 'threat') {
    const { fearPending } = resolution.recordThreat(residentId)
    if (fearPending) warnFearPending()
  }

  bus.emit('dialogue.resolved', {
    choiceId,
    choiceFunction: judgement.choiceFunction,
    systemResultId: judgement.systemResultId,
    reactionText: judgement.reactionText,
    revealedStoryInfoId: judgement.revealedStoryInfoId,
  })

  // 판정 결과는 오직 반응 대사로 전달한다. 결과 이름이나 성공·실패를 따로
  // 표시하지 않는다 (DEC-UI-009).
  dialogue.reaction = judgement.reactionText
  const offerQuantity = choice.offer?.quantity ?? null
  dialogue.pending = () => finishPrecombat(residentId, judgement, offerQuantity)
}

/** 반응 대사를 읽은 뒤 — 조우 해결이거나 전투 진입이다 (DEC-RESIDENT-015) */
function finishPrecombat(
  residentId: string,
  judgement: import('./systems/encounter.ts').PrecombatJudgement,
  offerQuantity: number | null,
): void {
  if (run === null || encounter === null || resolution === null) return

  if (judgement.resolved) {
    if (offerQuantity !== null) {
      // 수확물 차감과 관계 변경이 하나의 처리다 (DEC-RESIDENT-050).
      // 어떤 작물이 나갈지는 실행 후에만 알 수 있다.
      const settled = encounter.settleNegotiation(
        run.resources.crops,
        `encounter.day${run.dayNumber}`,
        judgement.choiceId,
        offerQuantity,
        run.seed,
      )
      if (!settled.ok) {
        // 대가를 치르지 않고 거래 관계가 되는 경로를 만들지 않는다
        bus.emit('data.error', {
          summary: '자원 협상을 성립시킬 수 없다',
          detail: `${residentId} · ${settled.reason}`,
        })
        return
      }
      if (pendingEncounter !== null) pendingEncounter.consumedCrops = settled.consumed
      bus.emit('negotiation.accepted', { residentId, consumed: settled.consumed })
    }

    // 조우 해결은 전투에 진입하지 않고 조우 결과 화면으로 넘어가는 것으로 전달한다
    // (DEC-UI-009). 어느 선택으로 해결됐는지가 최종 결과를 가른다 (DEC-RESIDENT-052).
    finishEncounter(
      residentId,
      judgement.choiceFunction === 'empathy' ? 'empathy_resolve' : 'resource_negotiation_resolve',
    )
    return
  }

  // 자원 협상이 성격 프로필에 막힌 것도 중요 행동이다 (DEC-CONTENT-011)
  if (judgement.choiceFunction === 'resource_negotiation') {
    resolution.recordNegotiationRejected(residentId)
    // 수확물이 소비되지 않았다는 사실을 조우 결과에서 알린다 (DEC-UI-011)
    if (pendingEncounter !== null) pendingEncounter.negotiationRejected = true
  }

  // 조우가 해결되지 않으면 **반드시** 전투에 진입한다 (DEC-RESIDENT-015).
  // 전투 보정 키는 시스템 결과 ID 에서 온다 (DEC-CONTENT-009).
  const combatState = judgement.systemResultId.replace('system_result.precombat.combat_', '')
  scenes.closeOverlay('precombat_dialogue')
  hostile = spawnHostile(run.dayNumber, combatState)
}

function chooseSurrender(choiceId: string): void {
  if (dialogue === null || resolution === null) return

  const choice = dialogueChoicesById.get(choiceId)
  const resultId = choice?.direct_system_result_id ?? null
  if (choice === undefined || resultId === null) {
    bus.emit('data.error', {
      summary: '투항 선택을 처리할 수 없다',
      detail: `${choiceId} 에 direct_system_result_id 가 없다 (DEC-CONTENT-009)`,
    })
    return
  }

  const residentId = dialogue.residentId
  const fn = choice.choice_function as import('./data/types.ts').SurrenderChoiceFunction

  // 무엇을 골랐는지는 최종 결과와 별개로 남는다 (DEC-RESIDENT-042)
  resolution.recordSurrenderChoice(residentId, fn)

  const response = (choice.responses ?? []).find((r) => r.system_result_id === resultId)
  recordRevealedStoryInfo(residentId, response?.revealed_story_info_id ?? null)

  bus.emit('dialogue.resolved', {
    choiceId,
    choiceFunction: fn,
    systemResultId: resultId,
    reactionText: response?.reaction_text ?? '',
    revealedStoryInfoId: response?.revealed_story_info_id ?? null,
  })

  dialogue.reaction = response?.reaction_text ?? ''
  dialogue.pending = () => finishSurrender(residentId, fn)
}

function finishSurrender(
  residentId: string,
  fn: import('./data/types.ts').SurrenderChoiceFunction,
): void {
  if (fn === 'resume_combat') {
    // 최종 결과가 아니다. 실제로 처치했을 때만 killed 를 확정한다 (DEC-RESIDENT-052).
    // 별도의 재개 알림을 두지 않는다 (DEC-UI-010) — 오버레이가 닫히면 전투가 돈다.
    resolution?.recordSurrenderResumed(residentId)
    scenes.closeOverlay('surrender_dialogue')
    return
  }

  // 영입·대가 요구는 조우를 끝낸다. 보상과 상태 변경이 하나의 처리다 (DEC-RESIDENT-042)
  if (!finishEncounter(residentId, fn === 'recruit' ? 'recruited' : 'retreated')) return

  scenes.closeOverlay('surrender_dialogue')
  hostile = null
  hostileTarget = null
  // 조우가 해결되면 남은 투사체와 공격을 제거한다 (DEC-UI-019)
  residentCombat?.reset()
}

/**
 * 반응 대사를 읽고 넘어간다.
 *
 * `pending` 을 먼저 비워 같은 확정이 두 번 실행되는 것을 막는다. 흐름이 오버레이를
 * 닫았으면 대화도 끝난 것이고, 안 닫혔으면(데이터 오류) 대화를 남겨 화면이 비지 않게 한다.
 */
function proceedDialogue(): void {
  if (dialogue === null) return

  const action = dialogue.pending
  dialogue.pending = null
  action?.()

  const open = scenes.openOverlays()
  if (!open.includes('precombat_dialogue') && !open.includes('surrender_dialogue')) {
    dialogue = null
  }
}

/** 공포도 증가량 미승인 안내. 개발 빌드에서만, 한 런에 한 번만 (DEC-RESIDENT-048) */
let fearPendingWarned = false
function warnFearPending(): void {
  if (!isDevBuild || fearPendingWarned) return
  fearPendingWarned = true
  console.warn(
    '[조우] 공포도가 오르지 않는다 — DEC-RESIDENT-048(공포도 증가량)이 보류라 ' +
      '승인 CSV 에 수치가 없다. 임시값을 넣지 않는다. 확정되면 엔딩 판정이 정상 동작한다.',
  )
}

/**
 * 체력 0이면 런 전체를 실패로 끝낸다 (DEC-RUN-008).
 *
 * **이벤트만 쏘면 안 된다.** `run.failed` 는 UI 에게 알리는 결과 이벤트이고,
 * 흐름을 옮기는 것은 `player_died` 입력이다. 이벤트만 쐈더니 체력이 0인 채로
 * 계속 움직이고 야생동물도 계속 때렸다 — 화면에서는 "체력 바가 비었는데 안 죽네"
 * 로만 보인다. 엔딩으로 가지 않고 런 실패 화면으로 간다 (DEC-UI-014).
 */
function failRunIfDead(): void {
  if (run === null || run.health > 0) return
  if (scenes.step().at === 'run_failed') return

  bus.emit('run.failed', {})
  scenes.send({ type: 'player_died' })
}

/**
 * 투항 발동 (DEC-RESIDENT-016, DEC-RESIDENT-039).
 *
 * 전투를 정지하고 진행 중인 공격을 취소한 뒤 투항 대화를 연다. 오버레이가 열리면
 * `inRaidStage()` 가 false 가 되어 전투가 멈추고, 그 자리에서 대화 내용이 준비된다
 * (`overlay.opened` 구독 → `openSurrenderDialogue()`).
 *
 * 별도의 예고 없이 전환하고 투항 기준값과 남은 체력의 비율을 표시하지 않는다
 * (DEC-UI-010).
 */
function onSurrenderOffered(): void {
  // 회복은 대화 전환 시 **취소**된다. 정지 후 재개가 아니다 (로드맵 9-2) —
  // 재개로 만들면 대화를 열었다 닫는 것으로 무적 구간을 만들 수 있다.
  cancelRecovery('dialogue')

  if (hostile === null) return

  residentCombat?.suspendForSurrender()
  scenes.openOverlay('surrender_dialogue')

  bus.emit('surrender.offered', {
    residentId: hostile.entity.residentId,
    remainingHealth: hostile.entity.health,
  })
}

/** `E` — 심기·수확 문맥 상호작용 (DEC-INPUT-003) */
function onInteract(): void {
  if (farming === null) {
    console.warn('[입력] 승인 데이터가 없어 재배 상호작용을 할 수 없다')
    return
  }
  // 습격 단계에서는 작물을 심거나 수확할 수 없다 (DEC-FARM-004)
  if (!inFarmingStage()) return
  const event = farming.interact(player)
  if (event === null) return

  if (event.type === 'planted') {
    // 씨앗 단계에서는 종류를 공개하지 않으므로 cropId 를 싣지 않는다 (DEC-FARM-001)
    bus.emit('farm.planted', { plotId: event.plot.plotId })
  } else {
    const name = cropsById.get(event.cropId)?.display_name ?? event.cropId
    bus.emit('farm.harvested', {
      plotId: event.plot.plotId,
      cropId: event.cropId,
      quantity: event.amount,
    })

    // 수확물 보관함과 총수확 기록에 반영한다.
    // farming.harvested 는 재배 시스템 안의 집계이고, 판매·제작이 보는 원본은 런 상태다.
    if (run !== null) {
      run.resources.crops[event.cropId] = (run.resources.crops[event.cropId] ?? 0) + event.amount
      run.record.cropHarvested[event.cropId] =
        (run.record.cropHarvested[event.cropId] ?? 0) + event.amount
    }

    // 획득한 작물과 수량을 그 자리에 짧게 표시한다 (DEC-UI-018)
    harvestPopups.push({
      x: event.plot.x,
      y: event.plot.y,
      text: `${name} +${event.amount}`,
      remaining: HARVEST_POPUP_SECONDS,
    })
  }
}

/** 재배 상태를 렌더가 쓰는 모양으로 옮긴다 */
function plotViews(): readonly PlotView[] {
  if (farming === null) return []
  const target = farming.targetAt(player)

  return farming.plots.map((plot) => {
    const crop = plot.cropId === null ? null : (cropsById.get(plot.cropId) ?? null)

    // 단계 전체 길이를 알아야 진행도를 낼 수 있다. 수확 가능은 제한시간이 없다.
    let progress = 0
    if (crop !== null && (plot.stage === 'seed' || plot.stage === 'growing')) {
      const total =
        plot.stage === 'seed' ? crop.seed_duration_seconds : crop.growth_duration_seconds
      progress = total > 0 ? 1 - plot.remainingSeconds / total : 0
    }

    return {
      x: plot.x,
      y: plot.y,
      stage: plot.stage,
      // 씨앗 단계는 종류를 숨긴다 (DEC-FARM-001)
      cropLabel: plot.stage === 'seed' || crop === null ? null : crop.display_name,
      progress: Math.min(Math.max(progress, 0), 1),
      highlighted: target?.plot.plotId === plot.plotId,
      readyFlash: (readyFlashes.get(plot.plotId) ?? 0) / READY_FLASH_SECONDS,
      eatingProgress: eatingProgressOf(plot.plotId),
      cropAssetId: cropAssetOf(plot.stage, plot.cropId),
    }
  })
}

/**
 * 경작지 단계에 맞는 작물 그림을 고른다 (DEC-ART-004).
 *
 * **씨앗은 작물을 보지 않는다.** 씨앗 단계에서 종류를 공개하지 않는 것이 확정
 * 규칙(`DEC-FARM-001`)이라 그림도 작물별로 두지 않고 맵에 한 장이다. 여기서 작물
 * 그림을 쓰면 스프라이트만 보고 무엇이 심겼는지 알 수 있게 된다.
 */
function cropAssetOf(stage: PlotView['stage'], cropId: string | null): string | null {
  if (stage === 'empty') return null
  if (stage === 'seed') return seedAssetId
  if (cropId === null) return null

  const assets = cropAssetsById.get(cropId)
  return (stage === 'growing' ? assets?.crop_growing : assets?.crop_ready) ?? null
}

/**
 * 이 칸을 먹고 있는 야생동물의 진행도 0~1. 없으면 null (DEC-UI-018).
 *
 * 야생동물 쪽 남은 시간을 역산한다. 진행도를 따로 저장하면 두 곳이 어긋난다.
 */
function eatingProgressOf(plotId: string): number | null {
  for (const runtime of wildlife?.instances ?? []) {
    if (runtime.entity.targetPlotId !== plotId) continue
    if (runtime.eatingSeconds === null) continue

    const total = runtime.species.crop_eat_duration_seconds
    return Math.min(Math.max(1 - runtime.eatingSeconds / total, 0), 1)
  }
  return null
}

/**
 * 그날의 적대 주민을 필드에 세운다 (DEC-CONTENT-008).
 *
 * `combatState` 는 전투 전 대화 판정이 확정한다. 여기서 기본값을 고르지 않는다 —
 * 판정 없이 습격을 시작하는 경로를 만들면 `DEC-RESIDENT-049` 가 정한
 * "대화 결과가 지정한 전투 보정" 이 우회된다.
 */
function spawnHostile(dayNumber: number, combatState: string): HostileRuntime | null {
  if (residentCombat === null || raidData === null) return null

  const residentId = raidData.hostileResidentByDay.get(dayNumber) ?? null
  if (residentId === null || residentId === '') return null // 습격 없는 날

  // 해결된 주민은 같은 런에서 다시 적대로 등장하지 않는다 (DEC-RESIDENT-043).
  // 승인 일정이 같은 주민을 두 번 배치하지 않으므로 정상 흐름에서는 걸리지 않지만,
  // 걸린다면 일정 데이터나 흐름이 잘못된 것이라 조용히 세우면 안 된다.
  if (resolution !== null && !resolution.canAppearAsHostile(residentId)) {
    bus.emit('data.error', {
      summary: '습격을 시작할 수 없다',
      detail: `${residentId} 는 이미 조우가 해결된 주민이다 (DEC-RESIDENT-043)`,
    })
    return null
  }

  const profileId = raidData.combatProfileByResident.get(residentId)
  const profile = profileId === undefined ? undefined : raidData.profileById.get(profileId)
  const modifier = raidData.modifierByState.get(combatState)

  if (profile === undefined || modifier === undefined) {
    bus.emit('data.error', {
      summary: '습격을 시작할 수 없다',
      detail: `${residentId} 의 전투 프로필(${profileId}) 또는 보정(${combatState}) 이 없다`,
    })
    return null
  }

  // 시작 위치는 맵의 resident_spawn 지점에서 온다 (DEC-CONTENT-016).
  const spawn = raidSpawnPoint ?? { x: player.x + 400, y: player.y }

  const runtime = residentCombat.spawn({
    instanceId: `hostile.${dayNumber}`,
    residentId,
    profile,
    modifier,
    x: spawn.x,
    y: spawn.y,
  })

  hostileTarget = {
    entity: runtime.entity,
    collisionRadius: runtime.collisionRadius,
    surrenderThreshold: runtime.surrenderThreshold,
    surrenderOffered: false,
  }

  // 이 습격을 지원할 영입 주민을 세운다 (DEC-RESIDENT-021).
  // 전투가 실제로 시작하는 지점이라 여기서 정한다 — 확정문이 "다음에 **실제로
  // 발생하는 습격 전투**부터" 로 정했고, 전투 전 협상으로 해결되면 이 함수가
  // 아예 불리지 않아 지원 기회도 소비되지 않는다.
  startAllySupport()
  return runtime
}

/**
 * 이번 습격을 지원할 영입 주민을 고른다 (DEC-RESIDENT-021).
 *
 * **한 습격에 한 명뿐이다.** 대상은 영입돼 있고 살아 있고 아직 지원 기회를 쓰지
 * 않은 주민이며, 여럿이면 **먼저 영입된 쪽**이다. 확정문이 누구를 고를지까지는
 * 정하지 않았는데, `DEC-RESIDENT-045` 가 *"영입 시점이 이를수록 피해가 낮고
 * 공격이 잦게, 늦을수록 피해가 높고 간격이 길게 둔다"* 로 수치를 배치해서
 * 데이터가 이미 그 순서를 전제하고 있다. 영입 순서는 각 주민의 습격 일차로
 * 판단한다 — 승인 일정이 주민을 하루에 한 명씩만 배치하므로 일차가 곧 순서다.
 */
function startAllySupport(): void {
  allySupport = null
  raidSupporterName = null
  if (run === null || raidData === null) return

  if (allySupportPoint === null) {
    bus.emit('data.error', {
      summary: '지원 주민을 세울 수 없다',
      detail: '맵에 ally_support 지점이 없다 (DEC-CONTENT-016)',
    })
    return
  }

  // 주민 → 그 주민이 적대로 나온 일차. 영입은 그 조우에서 일어나므로 순서가 같다.
  const dayOf = new Map<string, number>()
  for (const [day, residentId] of raidData.hostileResidentByDay) {
    if (residentId !== null && residentId !== '') dayOf.set(residentId, day)
  }

  const candidate = Object.values(run.residents)
    .filter(
      (r) =>
        r.allegiance === 'recruited' &&
        r.lifeState === 'alive' &&
        !r.supportUsed,
    )
    .sort((a, b) => (dayOf.get(a.residentId) ?? 0) - (dayOf.get(b.residentId) ?? 0))[0]

  if (candidate === undefined) return

  const profile = supportProfileByResident.get(candidate.residentId)
  if (profile === undefined) {
    // 스키마가 주민마다 1:1 참조를 요구하므로 없으면 데이터가 어긋난 것이다.
    // 조용히 넘기면 영입해도 아무 일이 없고 화면만 지원한다고 말한다.
    bus.emit('data.error', {
      summary: '지원 주민을 세울 수 없다',
      detail: `${candidate.residentId} 의 지원 공격 프로필이 없다 (DEC-RESIDENT-045)`,
    })
    return
  }

  allySupport = createAllySupport({
    residentId: candidate.residentId,
    x: allySupportPoint.x,
    y: allySupportPoint.y,
    profile,
  })

  // 지원 기회는 이 습격 전투를 지원하는 순간 소비된다 (DEC-RESIDENT-021).
  // 첫 공격을 기다리지 않는 이유는 확정문이 "한 번의 습격 전투를 **지원하면**"
  // 이라고만 정했고, 첫 공격 전에 투항이 끝나도 그 습격은 지원받은 것이기 때문이다.
  candidate.supportUsed = true

  // 습격 전투에 진입할 때 어느 주민이 지원하는지 알린다 (DEC-UI-012)
  const name = residentNames.get(candidate.residentId) ?? candidate.residentId
  allySupportNotice = {
    text: `${name}${subjectParticle(name)} 돕는다`,
    remaining: ALLY_SUPPORT_NOTICE_SECONDS,
  }
  // 조우 결과가 "누구의 지원 기회가 소비됐는지" 를 말해야 한다 (DEC-UI-012).
  // `allySupport` 는 조우가 끝날 때 치워지므로 이름을 따로 들고 있는다.
  raidSupporterName = name
}

/** 낫 재사용 대기 0~1. 개발 빌드가 아니거나 대기가 없으면 null */
function devSickleRatio(): number | null {
  if (!isDevBuild || combat === null || !runConfig.loaded) return null

  const remaining = combat.sickleCooldownRemaining
  if (remaining <= 0) return null
  return Math.min(remaining / runConfig.sickleCooldownSeconds, 1)
}

/** 야생동물과 적대 주민을 렌더가 쓰는 모양으로 옮긴다 */
function hostileViews(): HostileView[] {
  // 적대 주민은 예고를 쓰지 않는다 (DEC-CONTENT-008). windup 이 항상 null 이다.
  const resident: HostileView[] =
    hostile === null
      ? []
      : [
          {
            x: hostile.entity.x,
            y: hostile.entity.y,
            radius: hostile.collisionRadius,
            healthRatio: hostile.entity.health / hostile.maxHealth,
            windup: null,
            slowed: hostile.entity.effects.some((e) => e.mechanicKey === 'movement_slow'),
            burning: hostile.entity.effects.some((e) => e.mechanicKey === 'damage_over_time'),
            // 방향·공격 교체 스프라이트 (DEC-ART-004). 파일이 아직 없어서
            // 지금은 전부 정면으로 떨어진다.
            assetId: characterSprite(
              residentAssets.get(hostile.entity.residentId),
              hostileFacing,
              hostileAttackRemaining > 0,
            ),
            // 걷는 흔들림은 적대 주민에만 붙인다. DEC-ART-004 가 야생동물에
            // bob 을 적용할지는 정하지 않았다 (field.ts HostileView.bob 주석).
            bob: hostileBob,
            hitFlash: flashRatio(hostile.entity.instanceId),
          },
        ]

  return resident.concat((wildlife?.instances ?? []).map((runtime) => ({
    x: runtime.entity.x,
    y: runtime.entity.y,
    radius: runtime.species.collision_radius,
    healthRatio: runtime.entity.health / runtime.species.max_health,
    // 공격 예고는 야생동물만 있다. 적대 주민은 예고를 쓰지 않는다 (DEC-CONTENT-008)
    windup:
      runtime.windupSeconds === null
        ? null
        : runtime.windupSeconds / runtime.species.attack_windup_seconds,
    slowed: runtime.entity.effects.some((e) => e.mechanicKey === 'movement_slow'),
    burning: runtime.entity.effects.some((e) => e.mechanicKey === 'damage_over_time'),
    assetId: runtime.species.assets?.field_sprite,
    // 명중 표시는 야생동물에도 준다. 이건 DEC-CONTENT-013 이 요구한 효과 구분이지
    // DEC-ART-004 의 스프라이트 예외가 아니다.
    hitFlash: flashRatio(runtime.entity.instanceId),
    // 야생동물은 bob 을 안 쓰고 진행 방향으로 회전한다 (DEC-ART-004).
    heading: wildlifeHeadings.get(runtime.entity.instanceId)?.angle ?? null,
  })))
}

/** 명중 표시 남은 정도 1~0. 렌더는 초가 아니라 비율을 받는다 */
function flashRatio(instanceId: string): number {
  return (hitFlashes.get(instanceId) ?? 0) / IMPACT_FLASH_SECONDS
}

/** 상호작용 가능한 대상이 있을 때 행동을 안내한다 (DEC-INPUT-003) */
function actionPrompt(): string | null {
  if (farming === null) return null
  const target = farming.targetAt(player)
  if (target === null) return null
  return target.kind === 'harvest' ? 'E — 수확' : 'E — 심기'
}

/**
 * 지금 때릴 수 있는 대상.
 *
 * **모드로 갈린다.** 재배에서는 야생동물, 습격에서는 적대 주민이다.
 * 이걸 한 곳에 모으지 않았더니 `onSickle` 이 습격 중에도 야생동물 목록(0마리)을
 * 넘겨서 낫이 아무도 못 때렸고, 그 호출이 `updateRaid` 가 세워 둔 대상까지 덮었다.
 * **대상 선택이 두 군데 있으면 반드시 한쪽이 틀린다.**
 */
function currentTargets(): CombatTarget[] {
  if (scenes.currentFieldMode() === 'raid') {
    return hostileTarget === null ? [] : [hostileTarget]
  }
  if (wildlife === null) return []

  // 야생동물이 죽거나 새로 나오면 목록이 바뀌므로 매 프레임 만든다.
  // `entity` 를 참조로 들고 있어 체력을 깎으면 원본이 바뀐다.
  return wildlife.instances.map((runtime) => ({
    entity: runtime.entity,
    collisionRadius: runtime.species.collision_radius,
    // 야생동물에게는 투항이 없다 (DEC-RESIDENT-016 은 주민 규칙이다)
    surrenderThreshold: null,
    surrenderOffered: false,
  }))
}

/**
 * 대상이 죽었을 때. **처치 처리는 이 함수 하나다.**
 *
 * 처치가 두 경로로 온다 — 투사체와 지속 피해는 `combat.update()` 안에서,
 * 낫 직접 명중은 `swingSickle()` 이 그 자리에서 돌려준다. 두 곳에서 각각 처리했더니
 * **낫으로 주민을 죽였을 때만 조우가 안 끝났다.** 야생동물만 지우고 주민은 아무 일도
 * 일어나지 않아서, 화면에서는 "죽었는데 아무것도 안 뜬다" 로만 보인다.
 * 8/3 에 대상 선택이 두 군데라서 낫이 아무도 못 때렸던 것과 같은 모양이다.
 */
function onTargetKilled(targetId: string): void {
  if (scenes.currentFieldMode() === 'raid') {
    if (hostile === null || targetId !== hostile.entity.instanceId) return

    // 보상 지급과 상태 변경이 실패하면 주민을 지우지 않는다 (DEC-RESIDENT-042)
    if (!finishEncounter(hostile.entity.residentId, 'killed')) return

    hostile = null
    hostileTarget = null
    // 조우가 해결되면 남은 투사체와 공격을 제거한다 (DEC-UI-019)
    residentCombat?.reset()
    return
  }

  // 야생동물 처치는 공통 소리 하나다 (종류를 가르지 않는다).
  sfx.play(SOUND_ASSET.wildlifeDefeat)
  wildlife?.remove(targetId)
}

/** 우클릭 — 낫 (DEC-INPUT-004) */
function onSickle(): void {
  if (combat === null) return

  combat.setTargets(currentTargets())
  const aimAngle = input.aimAngle()
  const result = combat.swingSickle(player, aimAngle)
  if (!result.swung) return // 재사용 대기 중

  // 휘두른 방향을 그 순간의 각도로 붙잡는다. 명중과 무관하게 그린다 —
  // 빗나간 휘두름이 안 보이면 사거리를 배울 수가 없다.
  sickleSwing = { angle: aimAngle, remaining: SICKLE_SWING_SECONDS }

  // 휘두른 것 자체가 조작 성공이다 — 명중과 무관하다 (DEC-RUN-003).
  // 튜토리얼의 `use_sickle` 안내가 이 이벤트로 넘어간다.
  bus.emit('combat.sickleSwung', { hitCount: result.hits.length })

  // 휘두름과 명중을 따로 낸다 (DEC-ART-005). 빗나간 휘두름에도 소리가 나야
  // 사거리를 소리로도 배운다. 여러 대상을 맞혀도 명중음은 한 번이다 —
  // 대상 수만큼 겹치면 한 번의 휘두름이 여러 번 때린 것처럼 들린다.
  sfx.play(SOUND_ASSET.sickleSwing)
  if (result.hits.length > 0) sfx.play(SOUND_ASSET.sickleHit)

  for (const hit of result.hits) {
    // 낫은 `swingSickle()` 이 명중을 그 자리에서 돌려주므로 `combat.update()` 의
    // `damaged` 를 타지 않는다. 충격선을 여기서 따로 켠다.
    hitFlashes.set(hit.targetId, IMPACT_FLASH_SECONDS)
    // 피해를 받은 crop_first 야생동물은 플레이어에게 영구 적대한다 (DEC-CONTENT-007).
    // 이 알림이 그 전환의 유일한 경로다. 습격 중에는 해당 없다.
    wildlife?.notifyDamagedByPlayer(hit.targetId)
    if (hit.outcome === 'killed') onTargetKilled(hit.targetId)
    if (hit.outcome === 'surrender_offered') onSurrenderOffered()
  }
}

/** 좌클릭 — 투척 (DEC-INPUT-004, 005) */
function onThrow(): void {
  if (combat === null || run === null) return

  const result = combat.throwWeapon(player, input.aimAngle(), run)
  if (result.ok) {
    // 소진 자동 전환과 `투척 무기 없음` 을 UI 에 알린다 (DEC-INPUT-007, DEC-UI-002)
    if (result.slot.autoSwitchedTo !== null) {
      bus.emit('quickslot.autoSwitched', {
        fromIndex: run.quickslots.selectedIndex,
        toIndex: result.slot.autoSwitchedTo,
      })
      // 새로 선택된 무기의 이름을 짧게 강조한다 (DEC-UI-002)
      autoSwitchFlash = {
        index: result.slot.autoSwitchedTo,
        remaining: AUTO_SWITCH_FLASH_SECONDS,
      }
    }
    if (result.slot.allEmpty) bus.emit('quickslot.allEmpty', {})
    bus.emit('combat.throwableSpent', {
      throwableId: result.weaponId,
      remaining: run.resources.throwables[result.weaponId] ?? 0,
    })
    return
  }

  // 투척할 무기가 없는데 좌클릭했으면 짧은 안내를 띄운다 (DEC-UI-002).
  // 재사용 대기는 안내 대상이 아니다 — 무기는 있고 아직 못 던질 뿐이라,
  // 매번 띄우면 연타할 때 안내가 계속 깜빡인다.
  //
  // 확정문이 함께 요구하는 **빈 발사음은 아직 없다.** 오디오가 별도 서브시스템이고
  // 6절 P2 라 붙지 않았다. 소리 없이 안내만 나가는 상태다.
  if (result.reason === 'no_slot_selected' || result.reason === 'out_of_ammo') {
    emptyFireRemaining = EMPTY_FIRE_NOTICE_SECONDS
  }
  if (isDevBuild && result.reason !== 'cooldown') {
    console.info(`[투척] 거절 — ${result.reason}`)
  }
}

const input = createInput(renderer.canvas, {
  onInteract,
  onThrow,
  onSickle,
  // 선택은 재배·습격 중에도 할 수 있다. 편성만 정비 단계 전용이다 (DEC-INPUT-013).
  // 선택 전환음은 여기서 낸다 (DEC-ART-005). **버스를 못 쓴다** —
  // `quickslot.select` 는 시스템 이벤트가 아니라 입력 의도라 `bus.on` 이 안 받는다.
  // 소진 자동 전환(`quickslot.autoSwitched`)은 시스템 이벤트라 그쪽에 붙어 있다.
  onQuickslotSelect: (index) => {
    if (combat === null || run === null) return
    combat.selectSlot(run, index)
    sfx.play(SOUND_ASSET.quickslotSwitch)
  },
  onQuickslotCycle: (dir) => {
    if (combat === null || run === null) return
    combat.cycleSlot(run, dir > 0 ? 1 : -1)
    sfx.play(SOUND_ASSET.quickslotSwitch)
  },
  onRecoverShortPress: () => onRecoverPressed(),
  // 회복 퀵메뉴 (DEC-UI-001, DEC-INPUT-008).
  //
  // `Q` 를 누르고 있는 동안에만 열린다. 오버레이로 올리면 화면 매니저가 시간을
  // 늦춘다 — 다른 오버레이처럼 멈추지 않는 것이 확정 규칙이다 (`syncSimulation`).
  onRecoverMenuOpen: () => scenes.openOverlay('recovery_quickmenu'),
  onRecoverMenuClose: () => scenes.closeOverlay('recovery_quickmenu'),
  onEscape: () => scenes.handleEscape(),
})

const uiRoot = document.getElementById('ui')
if (uiRoot === null) throw new Error('#ui 요소가 없다')

/**
 * 부팅 화면 둘 (DEC-UI-024).
 *
 * 흐름(`scenes/flow.ts`) 밖이다 — 흐름은 타이틀에서 시작하는데 그 타이틀조차
 * 승인 데이터가 들어온 뒤라야 의미가 있다. 부팅은 입력으로 오가는 단계가 아니라
 * 한 번 끝나면 돌아오지 않으므로 상태기계에 넣지 않는다.
 */
const loadingScreen: LoadingScreen = createLoading(uiRoot)
const dataErrorScreen: DataErrorScreen = createDataError(uiRoot)

/**
 * 부팅 중에 올라온 데이터 오류.
 *
 * 화면이 원인을 그리려면 이벤트를 모아 둬야 한다 — `bus` 는 지나간 것을 다시
 * 주지 않는다. **부팅이 끝난 뒤에는 쌓지 않는다.** 플레이 중 오류는 이 화면의
 * 몫이 아니고(같은 확정문이 "부팅할 수 없으면" 으로 한정했다) 계속 쌓으면
 * 메모리에 남기만 한다.
 */
const bootErrors: { summary: string; detail: string }[] = []
let booting = true
bus.on('data.error', ({ summary, detail }) => {
  if (booting) bootErrors.push({ summary, detail })
})

const hud: Hud = createHud(uiRoot, {
  onPause: () => scenes.handleEscape(),
})

const hub: MaintenanceHub = createMaintenanceHub(uiRoot, {
  // 필드 HUD 의 일시정지 버튼과 같은 경로다 (A3 목업의 우측 상단 톱니바퀴)
  onPause: () => scenes.handleEscape(),
  openPopup: (popup) => {
    // 한 번에 하나만 연다. 이미 같은 팝업이 열려 있으면 아무 일도 하지 않는다 (DEC-UI-020)
    if (openPopup === popup) return
    openPopup = popup
    hub.setPopup(buildPopup(popup))
  },
  finish: () => {
    // 습격 여부에 따라 버튼이 하나만 나온다. 흐름이 둘을 대조해 어긋나면 오류로 잡는다.
    const raidType = raidTypeOfDay(run?.dayNumber ?? 1)
    scenes.send({
      type: 'maintenance_finished',
      intent: raidType !== 'none' ? 'scout_field' : 'sleep_until_morning',
    })
  },
})

// ── 결과 화면 2종 (DEC-RUN-015, DEC-UI-023) ──────────────────
//
// 하루에 하나만 뜬다. 둘 다 없으면 하루가 끝나지 않고, 둘 다 뜨면 결과 화면이
// 두 번 나온다 — 폐기된 DEC-RUN-012 에서 문제가 됐던 지점이다.
// 어느 쪽이 뜰지는 흐름(scenes/flow.ts)이 습격 여부로 이미 갈라 놨다.
//
// 진행 입력은 각 화면에 하나뿐이고 둘 다 `confirm` 을 보낸다 (DEC-UI-023).
// 조우 결과는 마지막 습격이면 엔딩으로, 아니면 다음 일차로 간다 (DEC-RUN-015).

const nightResultScreen: NightResultScreen = createNightResult(uiRoot, {
  onContinue: () => scenes.send({ type: 'confirm' }),
})

// ── 런이 시작되는 세 화면 (DEC-UI-030) ───────────────────────
//
// 8/5까지 셋 다 뼈대여서 개발 통로(`devSkipToFarming()`)가 흐름을 대신 밀었다.
// 그래서 제출 빌드로 바꾸면 첫 화면에서 못 나갔고, 이름이 없어 일지와 엔딩
// 기록문에 빈 `player_name` 이 넘어갔다.

const titleScreen: TitleScreen = createTitle(uiRoot, {
  onStart: () => scenes.send({ type: 'confirm' }),
})

const nameInputScreen: NameInputScreen = createNameInput(uiRoot, {
  onConfirm: (name) => {
    // **런은 여기서 시작된다.** 이름이 확정돼야 런 상태가 그 이름을 갖는다.
    // 타이틀에서 다시 온 경우에도 여기서 통째로 교체되므로 이전 런이 남지 않는다
    // (로드맵 9-5).
    startNewRun(name)
    scenes.send({ type: 'confirm' })
  },
})

const tutorialScreen: TutorialScreen = createTutorial(uiRoot, {
  onSkip: () => finishTutorial(),
  onContinue: () => finishTutorial(),
})

/**
 * 튜토리얼 진행 (DEC-UI-030, DEC-RUN-003, DEC-CONTENT-025).
 *
 * 튜토리얼 밖에서는 null 이다. 흐름이 `tutorial` 에 들어올 때 만들고 나갈 때 버린다.
 */
let tutorial: TutorialProgress | null = null
/** 승인 안내. 순서는 `step_order` 가 단일 원본이다 (DEC-CONTENT-025) */
let tutorialSteps: readonly TutorialStep[] = []

/** 지금 튜토리얼 중인가. 재배 타이머·야생동물을 가르는 조건이다 */
function inTutorial(): boolean {
  return scenes.step().at === 'tutorial'
}

/**
 * 튜토리얼을 끝내고 1일차로 간다 (DEC-RUN-003).
 *
 * **런을 통째로 새로 만든다.** 확정문이 *"튜토리얼에서 소비하거나 획득한 체력·작물·
 * 자원은 본 런에 반영하지 않는다"* 로 정했다. 항목을 골라 되돌리지 않는 이유는
 * 되돌릴 목록을 유지해야 하고 하나를 빠뜨리면 조용히 새기 때문이다 — 버리는 쪽이
 * 규칙과 같은 모양이다 (로드맵 9-5 의 런 리셋과 같은 통로).
 */
function finishTutorial(): void {
  tutorial = null
  tutorialScreen.hide()
  scenes.closeOverlay('maintenance_hub')
  startNewRun(run?.playerName ?? '')
  scenes.send({ type: 'confirm' })
}

/**
 * 현재 안내를 화면에 맞춘다.
 *
 * `stage` 가 `maintenance` 면 정비 허브를 연다 — 팔고 사고 만드는 것은 거기서만
 * 할 수 있다 (`DEC-INPUT-013` — 정비 단계에서만 편성·거래). 다른 단계면 닫는다.
 */
function syncTutorial(): void {
  if (tutorial === null) return

  if (tutorial.finished) {
    scenes.closeOverlay('maintenance_hub')
    tutorialScreen.showFinished()
    return
  }

  const step = tutorial.current!
  if (step.stage === 'maintenance') scenes.openOverlay('maintenance_hub')
  else scenes.closeOverlay('maintenance_hub')

  tutorialScreen.render({
    guideText: step.guide_text,
    position: tutorial.position,
    total: tutorial.total,
    // 안내가 설 자리를 가른다 — 정비면 허브 기능 버튼을 덮지 않게 아래로 내린다
    stage: step.stage,
  })
}

/**
 * 조작 성공을 튜토리얼에 알린다.
 *
 * 튜토리얼 밖에서는 아무 일도 하지 않는다 — 본 런에서 심었다고 진행도가 움직이면
 * 안 된다. `completion_key` 는 고정 여덟 개이고 코드가 판정한다 (DEC-CONTENT-025).
 */
function completeTutorialStep(key: TutorialCompletionKey): void {
  if (tutorial === null || !inTutorial()) return
  if (tutorial.complete(key)) syncTutorial()
}

// 일차 시작 화면 (DEC-UI-016). 결과 화면 2종과 층위가 다르다 — 하루의 끝이 아니라
// 시작이고, 자동으로 넘어가지 않는 것은 같지만 일지 영역이 있고 없고가 갈린다.
// 회복 퀵메뉴 (DEC-UI-001). 고르기만 하고 소비하지 않는다 (DEC-INPUT-008).
const recoveryMenu: RecoveryMenu = createRecoveryMenu(uiRoot, {
  onSelect: (itemId) => {
    if (run === null) return
    // **선택만 바꾼다.** 사용 시작은 `Q` 를 짧게 누를 때다.
    run.pouch.selectedId = itemId
    if (isDevBuild) console.info(`[회복] 선택 변경 — ${itemId}`)
  },
})

const dayStartScreen: DayStartScreen = createDayStart(uiRoot, {
  onContinue: () => scenes.send({ type: 'confirm' }),
})

// ── 런 종료 2종 (DEC-UI-014, DEC-UI-023) ─────────────────────
//
// 둘 다 "런 종료" 계열이지만 **분리해 구현한다.** 체력 0 실패에는 엔딩 판정도
// 기록문도 없으므로 런 실패 화면은 보여 줄 것이 애초에 다르다.
//
// 진행 입력은 각각 하나뿐이고 둘 다 타이틀로 간다 (scenes/flow.ts).

const runFailedScreen: RunFailedScreen = createRunFailed(uiRoot, {
  onReturnToTitle: () => scenes.send({ type: 'confirm' }),
})

const endingScreen: EndingScreen = createEnding(uiRoot, {
  onReturnToTitle: () => scenes.send({ type: 'confirm' }),
})

const encounterResultScreen: EncounterResultScreen = createEncounterResult(uiRoot, {
  onContinue: () => scenes.send({ type: 'confirm' }),
})

/**
 * 일시정지 (DEC-UI-027).
 *
 * 독립 화면이 아니라 **오버레이**다 — `DEC-UI-022` 가 일시정지를 필드 위에 겹치는
 * 것으로 정했고 `DEC-UI-026` 이 항상 최상위로 뒀다. 그래서 `syncScreens()` 가
 * 아니라 오버레이 동기화 쪽에서 켜고 끈다.
 */
const pauseScreen: PauseScreen = createPause(uiRoot, {
  // `Esc` 를 다시 누른 것과 같다. 화면 매니저가 정지 사유까지 되돌린다
  // (포커스 이탈로 걸린 정지도 여기서 풀린다 — manager.ts 의 syncSimulation).
  onResume: () => scenes.closeOverlay('pause'),

  // 확인은 화면이 이미 거쳤다 (DEC-UI-027). 흐름은 무엇을 확인했는지 모르므로
  // 여기서 다시 묻지 않는다. 오버레이는 `apply()` 가 층위를 바꾸며 같이 닫는다.
  onReturnToTitle: () => scenes.send({ type: 'abandon_run' }),

  // 오디오가 있으므로 음량 셋을 표시한다 (DEC-UI-027). 이 인자를 빼면 화면이
  // 항목 자체를 그리지 않는다 — "오디오를 구현하지 않는 빌드" 의 처리다.
  mixer,
})

// 전투 전 대화와 투항 대화는 같은 표시·입력 규칙을 쓴다 (DEC-UI-010).
// 하나뿐인 이 모달이 둘 다 그린다 — 동시에 열리지 않는다 (DEC-UI-026).
const dialogueModal: DialogueModal = createDialogueModal(uiRoot, {
  choose: chooseDialogue,
  proceed: proceedDialogue,
  // 순차 출력의 타자 소리 (DEC-UI-008). 대화창은 어느 소리인지 모르고
  // "몇 자 찍혔다" 만 알린다 — 논리 에셋 ID 는 이쪽 자리다.
  onType: () => sfx.play(SOUND_ASSET.recordTyping),
})

/**
 * 지금 떠 있어야 할 독립 화면을 맞춘다.
 *
 * **각 화면이 "내가 열려 있나"를 스스로 보지 않는다.** 화면 매니저 하나가 답을
 * 갖고 있고 여기서 한 번에 반영한다 — 정비 허브가 `openOverlays().includes()` 로
 * 판단했다가 일시정지와 겹쳤을 때 입력을 계속 받던 것과 같은 종류의 실수를 막는다.
 *
 * 프레임마다 부르지 않고 화면이 바뀔 때만 부른다. 결과 화면의 내용은 조우가
 * 끝나는 순간 확정된 스냅샷이라 매 프레임 다시 그릴 이유가 없다.
 */
function syncScreens(): void {
  const screen = scenes.currentScreen()

  // HUD 는 **필드 공통** 요소다 (DEC-UI-036). 독립 화면은 필드를 대체하는 전환이라
  // (DEC-UI-014) HUD 를 남기지 않는다. 독립 화면의 배경이 완전 불투명이 아니라서
  // 그냥 두면 엔딩·런 실패 화면 위로 체력과 일차가 비친다.
  //
  // 정비 허브는 반대다 — 셔터가 필드를 덮는 오버레이라 필드 모드가 살아 있고
  // HUD 도 그대로 남는다.
  hud.setVisible(scenes.currentFieldMode() !== null)

  // 런 시작 세 화면. 표시 외에 할 일이 없어 한 줄씩이다.
  if (screen === 'title') titleScreen.show()
  else titleScreen.hide()

  if (screen === 'name_input') nameInputScreen.show()
  else nameInputScreen.hide()

  // 튜토리얼은 화면이 아니라 필드다 (DEC-UI-030). 여기서 다루지 않는다 —
  // `field.entered` 가 시작하고 `finishTutorial()` 이 끝낸다.

  if (screen === 'day_start') {
    const step = scenes.step()
    const day = 'day' in step ? step.day : 1
    const raidType = raidTypeOfDay(day)
    const notice = selectRaidNotice(raidNotices, raidType)

    if (notice.ok) {
      dayStartScreen.render({
        dayNumber: day,
        raidType,
        // 일차 시작 연출은 문장 형태다. 짧은 표지(hud_label)는 HUD·정비 허브 몫이다
        raidNoticeText: notice.notice.opening_text,
        journal: dayStartJournal,
      })
    } else {
      // 예고 문구를 코드에 둘 수 없으므로(DEC-RUN-011) 비운 채 올리고 오류로 드러낸다.
      // 진행 버튼은 남으므로 아침이 막히지는 않는다 (DEC-UI-024).
      dayStartScreen.render({
        dayNumber: day,
        raidType,
        raidNoticeText: '',
        journal: dayStartJournal,
      })
      bus.emit('data.error', {
        summary: '습격 예고를 표시할 수 없다',
        detail: notice.reason,
      })
    }
    dayStartScreen.show()
  } else {
    dayStartScreen.hide()
  }

  if (screen === 'night_result') {
    if (nightResult.ok) {
      nightResultScreen.render({ text: nightResult.text })
    } else {
      // 승인 문구가 없거나 여럿이다. 임시 문장을 지어내지 않고 비운 채 올린다 —
      // 진행 버튼은 남으므로 하루가 막히지는 않는다 (DEC-UI-024).
      nightResultScreen.render({ text: '' })
      bus.emit('data.error', {
        summary: '밤 결과 문구를 표시할 수 없다',
        detail: nightResult.reason,
      })
    }
    nightResultScreen.show()
  } else {
    nightResultScreen.hide()
  }

  if (screen === 'encounter_result') {
    if (encounterResultView !== null) {
      encounterResultScreen.render(encounterResultView)
      encounterResultScreen.show()
    } else {
      // 조우가 끝나면 반드시 채워진다. 비어 있다면 흐름과 조우 확정이 어긋난
      // 것이므로 빈 화면을 올려 넘기지 않고 드러낸다.
      encounterResultScreen.hide()
      bus.emit('data.error', {
        summary: '조우 결과를 표시할 수 없다',
        detail: '조우가 확정되지 않은 채 조우 결과 화면으로 넘어왔다',
      })
    }
  } else {
    encounterResultScreen.hide()
  }

  if (screen === 'run_failed') {
    // 도달한 일차만 넣는다. 런 통계도 엔딩 정보도 넣지 않는다 (DEC-UI-023).
    runFailedScreen.render({ dayNumber: run?.dayNumber ?? 1 })
    runFailedScreen.show()
  } else {
    runFailedScreen.hide()
  }

  if (screen === 'ending') {
    const decided = run?.ending ?? null
    const ending = decided === null ? null : (endingsById.get(decided.endingId) ?? null)

    if (decided !== null && ending !== null) {
      endingScreen.render({
        // 제목·요약은 승인 데이터의 값이다. 런 상태에 복제해 두지 않는다
        title: ending.ending_title,
        // 승인 문구의 {player_name} 을 입력받은 이름으로 채운다. 조사도 같이
        // 고른다 — 데이터에는 읽기 좋은 한 형태만 적혀 있다 (ui/korean.ts).
        summary: fillPlayerName(ending.ending_summary, run?.playerName ?? ''),
        // 폴백인지 아닌지는 넘기지 않는다 — 구분하지 않는 것이 규칙이다 (DEC-UI-023)
        record: endingRecordPending
          ? { state: 'pending' }
          : { state: 'ready', text: decided.recordText },
        // 제출 빌드에서는 공포도 수치와 구간 이름을 표시하지 않는다 (DEC-RESIDENT-047)
        fear: isDevBuild
          ? { total: decided.fear, bandName: fearBandNameOf(decided.fear) }
          : null,
      })
      endingScreen.show()
    } else {
      // 엔딩이 확정되지 않았거나 승인 데이터에 그 엔딩이 없다. 빈 화면으로 넘기지
      // 않고 드러낸다 — 조우 결과가 비어 있을 때와 같은 처리다.
      endingScreen.hide()
      bus.emit('data.error', {
        summary: '엔딩을 표시할 수 없다',
        detail:
          decided === null
            ? '엔딩이 확정되지 않은 채 엔딩 화면으로 넘어왔다'
            : `확정된 ${decided.endingId} 가 승인 데이터에 없다`,
      })
    }
  } else {
    endingScreen.hide()
  }
}

/**
 * 승인된 일정에서 해당 일차의 습격 종류를 읽는다.
 *
 * 반환형이 `string` 이 아니라 `RaidType` 인 이유는 일차 시작 화면이 이 값으로
 * 예고 세 종류를 고르기 때문이다 (DEC-RUN-011). 넓은 타입이면 오타가 런타임까지 간다.
 */
let raidTypeOfDay: (day: number) => RaidType = () => 'none'

const POPUP_TITLES: Record<string, string> = {
  sell: '판매',
  buy: '구매',
  craft: '제작',
  // 아트가 붙으면 이 제목이 안 보인다 — 탭이 `편성` 이라고 적혀 있고 팝업 왼쪽
  // 판이 `투척 퀵슬롯 편성` 을 들고 있다. 그림 없는 빌드의 플레이스홀더 문구다.
  quickslots: '투척 퀵슬롯 편성',
}

/**
 * 열려 있던 팝업을 버린다.
 *
 * **화면에 닫기 입력이 없다** (2026-08-08). 팝업은 항상 하나 열려 있고 기능 버튼
 * 넷이 갈아 끼우므로 플레이어가 닫는 경로가 없다. 이 함수는 정비 허브 자체를
 * 떠날 때 상태를 비우는 데만 쓴다.
 */
function discardPopup(): void {
  openPopup = null
  renderOpenPopup = null
  hub.setPopup(null)
}

/**
 * 거래·제작이 거절됐다.
 *
 * **여기 오는 것은 정상이 아니다.** 모달이 보유·소지금·해금·수량을 미리 검사해
 * 불가능한 실행 버튼을 꺼 두기 때문이다 (DEC-UI-005, DEC-UI-006). 그런데도
 * 거절됐다면 화면이 보는 값과 시스템이 보는 값이 어긋난 것이라 `data_missing` 으로
 * 올린다. 조용히 넘기면 "눌렀는데 아무 일도 안 일어난다"로만 보인다.
 */
function reportTradeRejected(request: 'shop.sell' | 'shop.buy' | 'craft.make', reason: string): void {
  bus.emit('request.rejected', { request, reason: 'data_missing' })
  console.warn(`[정비] ${request} 거절 — ${reason}. 버튼이 켜져 있었는데 실패했다`)
}

/** 상점 모달이 그릴 목록. 판매는 승인 작물, 구매는 승인 재료다 */
function shopItems(mode: ShopMode): ShopItemView[] {
  if (mode === 'sell') {
    // 판매할 수 있는 자원은 수확물뿐이다 (DEC-RESOURCE-007).
    // 보유 0인 작물도 목록에 두고 실행만 막는다 — 목록이 프레임마다 늘었다 줄면
    // 고르던 행이 발밑에서 사라진다.
    return [...cropsById.values()].map((crop) => ({
      id: crop.id,
      name: crop.display_name,
      unitPrice: crop.sell_price,
      held: run?.resources.crops[crop.id] ?? 0,
      description: itemDescriptions.get(crop.id),
      stats: itemStats.get(crop.id),
      icon: itemIcons.get(crop.id),
    }))
  }

  // 구매할 수 있는 자원은 조합 재료뿐이고 재고는 무제한이다
  // (DEC-RESOURCE-008, DEC-RESOURCE-009). 1차 프로토타입은 전부 해금 상태다.
  return shopMaterials.map((material) => ({
    id: material.id,
    name: material.display_name,
    unitPrice: material.buy_price,
    held: run?.resources.materials[material.id] ?? 0,
    description: itemDescriptions.get(material.id),
    stats: itemStats.get(material.id),
    icon: itemIcons.get(material.id),
  }))
}

/**
 * 투척 무기의 수치 (DEC-UI-006).
 *
 * **설명 문장에서 읽지 않고 승인 데이터에서 읽는다.** `player_description` 은
 * 따로 표시하며 이 목록과 섞지 않는다.
 *
 * 보관함 안내·상점 안내·제작 안내가 **이 함수 하나를 같이 쓴다.** 화면마다 따로
 * 만들면 같은 무기가 자리에 따라 다른 수치를 보여줄 수 있다.
 */
function throwableStats(weapon: ThrowableWeapon): TooltipStat[] {
  const stats: TooltipStat[] = [
    { label: '피해', value: String(weapon.base_damage) },
    { label: '사거리', value: String(weapon.max_range) },
    { label: '재사용 대기', value: `${weapon.cooldown_seconds}초` },
  ]
  // 범위 무기만 반경이 있다 (DEC-CONTENT-005)
  if (weapon.impact_mode === 'area' && weapon.area_radius !== null) {
    stats.push({ label: '범위 반경', value: String(weapon.area_radius) })
  }
  // 전투 효과는 작물 속성이 정한다. 둘 중 하나만 채워진다 (DEC-CONTENT-013)
  if (weapon.effect_damage_per_tick !== null) {
    stats.push({
      label: '지속 피해',
      value: `${weapon.effect_damage_per_tick} · ${weapon.effect_duration_seconds}초`,
    })
  }
  if (weapon.effect_move_speed_multiplier !== null) {
    stats.push({
      label: '이동 둔화',
      value: `×${weapon.effect_move_speed_multiplier} · ${weapon.effect_duration_seconds}초`,
    })
  }
  return stats
}

/** 회복 아이템의 수치 (DEC-UI-006). 위와 같은 이유로 한 곳에 둔다 */
function recoveryStats(item: RecoveryItem): TooltipStat[] {
  return [
    { label: '회복량', value: String(item.heal_amount) },
    { label: '사용 시간', value: `${item.use_duration_seconds}초` },
    { label: '사용 중 이동속도', value: `×${item.move_speed_multiplier}` },
  ]
}

/** 제작 결과물의 수치. 분류에 따라 위 둘 중 하나를 고른다 (DEC-CRAFT-005) */
function resultStatsOf(recipe: Recipe): CraftStatView[] {
  if (recipe.result_kind === 'throwable_weapon') {
    const weapon = throwablesById.get(recipe.result_id)
    return weapon === undefined ? [] : throwableStats(weapon)
  }

  const item = recoveryItemsById.get(recipe.result_id)
  return item === undefined ? [] : recoveryStats(item)
}

/** 결과물의 표시 이름과 설명. 분류에 따라 다른 테이블에서 온다 (DEC-CRAFT-005) */
function resultTextOf(recipe: Recipe): { name: string; description: string } {
  const entry =
    recipe.result_kind === 'throwable_weapon'
      ? throwablesById.get(recipe.result_id)
      : recoveryItemsById.get(recipe.result_id)

  return {
    name: entry?.display_name ?? recipe.result_id,
    description: entry?.player_description ?? '',
  }
}

/** 잠긴 레시피인데 해금 조건이 없다고 한 번만 알린다 */
let unlockDataWarned = false

/** 제작 모달이 그릴 목록. 정렬은 모달이 한다 (DEC-UI-006) */
function craftRecipeViews(): CraftRecipeView[] {
  if (economy === null) return []
  const views: CraftRecipeView[] = []

  for (const recipe of craftRecipes) {
    const base = recipe.unlock_type === 'base'
    const { name, description } = resultTextOf(recipe)

    if (economy.isUnlocked(recipe.id)) {
      views.push({
        id: recipe.id,
        locked: false,
        resultKind: recipe.result_kind,
        base,
        resultName: name,
        resultIcon: itemIcons.get(recipe.result_id),
        resultDescription: description,
        resultStats: resultStatsOf(recipe),
        inputs: (recipe.inputs ?? []).map((input) => ({
          name: displayNames.get(input.input_id) ?? input.input_id,
          perCraft: input.quantity,
          held:
            (input.input_kind === 'crop'
              ? run?.resources.crops[input.input_id]
              : run?.resources.materials[input.input_id]) ?? 0,
          icon: itemIcons.get(input.input_id),
        })),
        resultQuantity: recipe.result_quantity,
        maxTimes: economy.maxCraftTimes(recipe.id),
      })
      continue
    }

    // 잠긴 레시피는 존재와 해금 조건만 보인다 (DEC-CRAFT-006, DEC-UI-006).
    // 조건이 없으면 그릴 수 없다 — 임의 조건을 지어내지 않고 빼고 알린다.
    const unlock = recipe.mastery_unlock
    if (unlock === undefined) {
      if (!unlockDataWarned) {
        unlockDataWarned = true
        bus.emit('data.error', {
          summary: '잠긴 레시피의 해금 조건이 없다',
          detail: `${recipe.id} 의 unlock_type 이 base 가 아닌데 crop_mastery_unlocks 행이 없다`,
        })
      }
      continue
    }

    views.push({
      id: recipe.id,
      locked: true,
      resultKind: recipe.result_kind,
      base,
      resultName: name,
      resultIcon: itemIcons.get(recipe.result_id),
      unlock: {
        cropName: cropsById.get(unlock.crop_id)?.display_name ?? unlock.crop_id,
        // 해금 조건에 대상 작물의 논리 에셋을 함께 보인다 (DEC-UI-006)
        cropAssetId: itemIcons.get(unlock.crop_id) ?? null,
        currentMastery: run?.record.cropMastery[unlock.crop_id] ?? 0,
        requiredMastery: unlock.required_mastery,
      },
    })
  }

  return views
}

/**
 * 팝업 본문을 만든다.
 *
 * 판정과 자원 변경은 전부 `economy.ts` 가 한다. 여기서는 그것을 부르고 결과
 * 이벤트를 발행할 뿐이며 보관함·소지금을 직접 만지지 않는다 (core/events.ts).
 */
function buildPopup(popup: string): HTMLElement {
  if ((popup === 'sell' || popup === 'buy') && economy !== null) {
    const mode: ShopMode = popup
    const modal = createShopModal(mode, {
      submit(itemId, quantity) {
        const result =
          mode === 'sell' ? economy!.sell(itemId, quantity) : economy!.buy(itemId, quantity)

        if (!result.ok) {
          reportTradeRejected(mode === 'sell' ? 'shop.sell' : 'shop.buy', result.reason)
          return { ok: false, reason: result.reason }
        }

        // 확정된 뒤에만 결과 이벤트를 쏜다. 이 시점에 자원 변경이 이미 끝났다
        if (mode === 'sell') {
          bus.emit('shop.sold', { cropId: itemId, quantity, gainedMoney: result.value })
        } else {
          bus.emit('shop.bought', { materialId: itemId, quantity, spentMoney: result.value })
        }
        return { ok: true, reason: null }
      },
    })

    renderOpenPopup = () => modal.render({ money: run?.resources.money ?? 0, items: shopItems(mode) })
    return modal.root
  }

  if (popup === 'craft' && economy !== null) {
    const modal = createCraftModal({
      submit(recipeId, times) {
        const result = economy!.craft(recipeId, times)
        if (!result.ok) {
          reportTradeRejected('craft.make', result.reason)
          return { ok: false, unlockedNames: [], reason: result.reason }
        }

        const recipe = recipesById.get(recipeId)
        if (recipe !== undefined) {
          bus.emit('craft.made', {
            recipeId,
            times,
            resultId: recipe.result_id,
            resultQuantity: recipe.result_quantity * times,
          })
        }

        // 해금은 제작 결과로만 발생한다 (DEC-CRAFT-007)
        const unlockedNames: string[] = []
        for (const id of result.value.unlockedRecipeIds) {
          const unlockedRecipe = recipesById.get(id)
          unlockedNames.push(resultTextOf(unlockedRecipe ?? recipe!).name)
          bus.emit('craft.recipeUnlocked', {
            recipeId: id,
            cropId: unlockedRecipe?.mastery_unlock?.crop_id ?? '',
          })
        }
        return { ok: true, unlockedNames, reason: null }
      },
    })

    renderOpenPopup = () => modal.render({ recipes: craftRecipeViews() })
    return modal.root
  }

  if (popup === 'quickslots') {
    const modal = createQuickslotModal({
      assign: assignQuickslot,
    })
    renderOpenPopup = () => modal.render(quickslotView())
    return modal.root
  }

  // 여기 오면 팝업 종류가 늘었는데 화면을 안 붙인 것이다. 빈 껍데기로 넘기지 않는다.
  const { root, body } = createPopupShell(POPUP_TITLES[popup] ?? popup)
  const note = document.createElement('div')
  note.className = 'hub__preview'
  note.textContent = '이 팝업의 목록 UI는 아직 붙지 않았다.'
  body.appendChild(note)
  renderOpenPopup = null

  return root
}

/** 편성 팝업이 그릴 내용 (DEC-UI-034) */
function quickslotView(): QuickslotView {
  const slots = run?.quickslots.slots ?? []
  const held = run?.resources.throwables ?? {}

  return {
    slots: slots.map((weaponId, index) => ({
      index,
      weaponId,
      weaponName: weaponId === null ? null : (throwablesById.get(weaponId)?.display_name ?? weaponId),
      // 수량은 퀵슬롯이 아니라 **무기 보관함**에서 읽는다 (DEC-RESOURCE-002).
      // 편성된 채 수량이 0이 되면 키가 지워지므로 0으로 떨어진다 (DEC-RESOURCE-015).
      count: weaponId === null ? 0 : (held[weaponId] ?? 0),
      icon: weaponId === null ? undefined : itemIcons.get(weaponId),
    })),

    // 편성 목록은 무기 보관함에 실제로 있는 것뿐이다. 없는 무기를 지어내지 않는다.
    weapons: Object.entries(held).map(([id, count]) => ({
      id,
      name: throwablesById.get(id)?.display_name ?? id,
      count,
      assignedElsewhere: slots.includes(id),
      icon: itemIcons.get(id),
    })),
  }
}

/**
 * 퀵슬롯 편성 (DEC-RESOURCE-019, DEC-INPUT-013).
 *
 * **수량을 옮기지 않는다.** 칸은 무기 종류만 보관함에 연결하므로 여기서 바뀌는 것은
 * `slots` 배열 하나뿐이고 보관함은 그대로다.
 *
 * 같은 종류를 여러 칸에 중복 편성할 수 없다. 모달이 이미 그런 무기를 고를 수 없게
 * 막지만 여기서도 확인한다 — 규칙을 화면 한 곳에만 두면 다음 호출자가 그냥 통과한다.
 */
function assignQuickslot(slotIndex: number, weaponId: string | null): void {
  if (run === null) return
  const slots = run.quickslots.slots
  if (slotIndex < 0 || slotIndex >= slots.length) return

  if (weaponId !== null && slots.some((id, i) => id === weaponId && i !== slotIndex)) {
    console.warn(
      `[정비] ${weaponId} 는 이미 다른 칸에 편성돼 있다. ` +
        '같은 종류를 여러 칸에 두지 않는다 (DEC-RESOURCE-019).',
    )
    return
  }

  slots[slotIndex] = weaponId

  // 편성이 **실제로 바뀐 뒤에만** 알린다. 위 거절 경로를 지나온 호출은 여기 못 온다.
  // 튜토리얼의 `assign_quickslot` 안내가 이 이벤트로 완료된다 (DEC-CONTENT-025).
  bus.emit('quickslot.assigned', { slotIndex, throwableId: weaponId })
}

/** 보관함 한 분류를 표시용 줄로 바꾼다. 수량 0인 키는 애초에 없다 */
function rowsOf(store: ItemStore): InventoryRow[] {
  return Object.entries(store)
    .map(([id, count]) => ({
      id,
      name: displayNames.get(id) ?? id,
      count,
      // 설명과 수치는 마우스를 올렸을 때 뜬다 (DEC-UI-034, 아트 디렉션 14.8)
      description: itemDescriptions.get(id),
      stats: itemStats.get(id),
      icon: itemIcons.get(id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
}

/**
 * 이미 올린 습격 예고 데이터 오류. 매 프레임 같은 것을 다시 올리지 않는다.
 *
 * `hudView()` 가 프레임마다 불리므로 가드가 없으면 오류 하나가 초당 60번 발행된다.
 */
const raidNoticeErrorsReported = new Set<RaidType>()

/**
 * HUD·정비 허브가 쓰는 습격 예고 **짧은 표지** (DEC-RUN-011, DEC-UI-036).
 *
 * 일차 시작 화면의 문장(`opening_text`)과 같은 행에서 온다 — 둘은 같은 정보를
 * 길이만 달리 전달한다. 8/5까지 이 자리가 `null` 고정이었고 주석은 "승인되면
 * 여기에 들어간다" 인 채였다. `raid_notices.csv` 는 8/4에 이미 승인됐다.
 *
 * 없거나 여럿이면 문구를 지어내지 않고 비운 채 데이터 오류로 올린다.
 */
function raidNoticeLabelOf(day: number): string | null {
  const raidType = raidTypeOfDay(day)
  const notice = selectRaidNotice(raidNotices, raidType)
  if (notice.ok) return notice.notice.hud_label

  if (!raidNoticeErrorsReported.has(raidType)) {
    raidNoticeErrorsReported.add(raidType)
    bus.emit('data.error', {
      summary: '습격 예고를 표시할 수 없다',
      detail: notice.reason,
    })
  }
  return null
}

function hubView() {
  const raidType = raidTypeOfDay(run?.dayNumber ?? 1)
  return {
    dayNumber: run?.dayNumber ?? 1,
    money: run?.resources.money ?? 0,
    inventory: {
      crops: rowsOf(run?.resources.crops ?? {}),
      materials: rowsOf(run?.resources.materials ?? {}),
      throwables: rowsOf(run?.resources.throwables ?? {}),
      recoveries: rowsOf(run?.resources.recoveries ?? {}),
    },
    raidNoticeLabel: raidNoticeLabelOf(run?.dayNumber ?? 1),
    // 표지 판의 그림을 고른다. 문구와 출처가 달라 따로 넘긴다 (DEC-RUN-011)
    raidType,
    // 문구는 DEC-RUN-006 이 정한 두 가지다
    finishLabel: raidType !== 'none' ? '밭을 정찰하러 간다' : '아침까지 잔다',
    // 튜토리얼 중에는 정비를 끝낼 수 없다. 흐름이 아직 `tutorial` 단계라
    // `maintenance_finished` 가 처리할 수 없는 입력이 된다 (HubView.canFinish).
    canFinish: !inTutorial(),
    // 튜토리얼에는 판매 안내가 없는데(8/6 에 `sell_crop` 행을 뺐다) 버튼은
    // 살아 있어서, 수확물을 팔아 버리면 제작 재료가 없어져 `craft_item` 을
    // 완료할 수 없다. **데이터에서 단계를 뺀 것으로는 플레이어가 스스로 파는
    // 것을 못 막는다** — 8/6 에 "45% 막힘" 으로 잡았던 구멍의 화면 쪽이다.
    lockedPopups: inTutorial() ? (['sell'] as const) : [],
    // 어느 기능을 보고 있는지 버튼에서 알린다 (8/8 플레이 테스트).
    openPopup,
  }
}

/** 런 상태를 HUD 가 쓰는 모양으로 옮긴다 */
function hudView() {
  const quickslots = (run?.quickslots.slots ?? []).map((id, index) => ({
    name: id === null ? null : (throwablesById.get(id)?.display_name ?? id),
    count: id === null ? 0 : (run?.resources.throwables[id] ?? 0),
    selected: index === (run?.quickslots.selectedIndex ?? 0),
    // 소진 자동 전환 강조가 이름과 아이콘을 함께 쓴다 (DEC-UI-002)
    icon: id === null ? undefined : itemIcons.get(id),
  }))

  // 남은 시간은 비율로 넘긴다. 화면이 숫자를 쓰지 않으므로(A1) 초를 넘기면
  // 받는 쪽이 전체 길이를 따로 알아야 하고, 그 값은 승인 데이터라 HUD 몫이 아니다.
  // 튜토리얼에는 시간제한이 없으므로 게이지를 아예 숨긴다 (DEC-RUN-003).
  // 안 가리면 60초짜리 게이지가 멈춘 채 떠 있어 "고장났나" 로 읽힌다.
  const timer = inFarmingStage() && !inTutorial() ? farmingTimer : null

  return {
    playerName: run?.playerName ?? '',
    health: run?.health ?? 0,
    maxHealth: runConfig.loaded ? runConfig.maxHealth : 0,
    dayNumber: run?.dayNumber ?? 1,
    timeRatio:
      timer === null || timer.durationSeconds <= 0
        ? null
        : timer.remainingSeconds / timer.durationSeconds,
    timeUrgent: farmingTimer?.urgent ?? false,
    quickslots,
    // **ID 가 아니라 표시 이름이다.** 8/5까지 `selectedId` 를 그대로 넘겨서,
    // 선택돼 있어도 화면에 `recovery_item.honey_banana` 가 뜰 자리였다.
    recoveryName: selectedRecoveryName(),
    recoveryCount: selectedRecoveryCount(),
    // 선택된 회복 아이템의 아이콘. 퀵슬롯과 같은 표에서 온다 (8/9)
    recoveryIcon: run?.pouch.selectedId === null || run?.pouch.selectedId === undefined
      ? undefined
      : itemIcons.get(run.pouch.selectedId),
    // 소진 자동 전환 강조와 빈 발사 안내 (DEC-UI-002)
    autoSwitchedIndex: autoSwitchFlash?.index ?? null,
    emptyFireNotice: emptyFireRemaining > 0 ? '던질 무기가 없다' : null,
    // 대화·정비·일시정지가 입력을 가져가면 위쪽 안내를 띄우지 않는다.
    // 조준선을 굳히는 것과 같은 판단이다 (DEC-UI-026, DEC-UI-031).
    fieldInputLocked: scenes.inputOwner() !== null,
    // 습격 진입 시 어느 주민이 지원하는지 (DEC-UI-012)
    allySupportNotice: allySupportNotice?.text ?? null,
    // 습격 예고는 **재배 모드 전용 요소**다 (DEC-UI-036). 습격 모드에서는 표시하지
    // 않는다 — 그날 밤 습격이 이미 시작됐으므로 예고할 것이 남아 있지 않다.
    // 재배·습격 두 모드에서 같은 판·같은 자리에 남는다 (DEC-UI-036). 8/9 까지는
    // 재배 전용이라 습격 중에 판의 크림 칸만 비어 고장난 것처럼 보였다.
    raidNoticeLabel: raidNoticeLabelOf(run?.dayNumber ?? 1),
    // 판 그림은 문구와 같은 값에서 나온다 (DEC-RUN-011). 재배 밖에서도 판은
    // 남으므로 종류는 늘 넘긴다 — 사라지는 것은 문구 쪽이다.
    raidType: raidTypeOfDay(run?.dayNumber ?? 1),
  }
}

const loop = createGameLoop(
  {
    update(dt) {
      const move = input.move()
      // 회복 사용 중에는 이동속도가 감소한다 (DEC-INPUT-005). 배율은 승인 데이터에서 온다.
      const speed = runConfig.moveSpeed * recoveryMoveMultiplier()
      player.x += move.x * speed * dt
      player.y += move.y * speed * dt
      // 이동 위치는 맵 경계 안으로 제한한다 (DEC-CONTENT-016).
      // 승인 데이터가 오기 전에는 경계를 모르므로 제한하지 않는다 — 그때는
      // 임시 수치로 움직여 보는 상태이고 밭도 그려지지 않는다.
      if (worldBounds !== null) clampToWorld(player, worldBounds)

      // 조준선은 **필드가 입력을 갖고 있을 때만** 따라간다 (DEC-UI-026).
      //
      // 캔버스는 화면 층위와 무관하게 매 프레임 그려서(위 `renderer.draw` 주석),
      // 일시정지나 대화가 열려 있어도 조준선이 커서를 쫓아다녔다. 멈춘 화면에서
      // 선만 움직이면 조작이 살아 있는 것처럼 보인다. 마지막 각도로 굳힌다.
      if (scenes.inputOwner() === null) fieldAimAngle = input.aimAngle()

      // 걷는 흔들림 (DEC-ART-004). 경계 제한 뒤에 재야 벽에 붙어 밀고 있을 때
      // 좌표가 안 바뀌는 것이 그대로 "멈춤" 으로 읽힌다.
      const playerStep = advanceBob('player', player.x, player.y, dt)
      playerBob = playerStep.phase
      playerFacing = playerStep.facing

      const hostileStep =
        hostile === null
          ? null
          : advanceBob('hostile', hostile.entity.x, hostile.entity.y, dt)
      hostileBob = hostileStep?.phase ?? null
      hostileFacing = hostileStep?.facing ?? null

      // 야생동물은 bob 대신 진행 방향으로 회전한다 (DEC-ART-004).
      // 재배 밖에서는 개체가 없어 아무 일도 하지 않는다.
      advanceWildlifeHeadings(dt)

      // 투척 피드백은 재배·습격 양쪽에서 흐른다 (DEC-UI-002)
      advanceCombatFeedback(dt)

      // 회복 게이지도 양쪽에서 흐른다. 완료되면 소비와 회복이 한 처리로 끝난다.
      advanceRecoveryGauge(dt)

      // 보관함이 바뀌면 선택이 규칙대로 따라간다 (DEC-RESOURCE-017, 018).
      // 수확·제작·구매가 각자 부르지 않고 한 곳에서 본다 — 부르는 곳을 늘리면
      // 하나를 빠뜨렸을 때 "얻었는데 회복 아이템 없음" 이 다시 생긴다.
      syncRecoverySelection()

      // 습격 모드 — 주민만 돈다. 작물은 자라지 않고 재배 타이머도 없다.
      if (inRaidStage()) {
        updateRaid(dt)
        return
      }

      // 작물 성장과 재배 타이머는 같은 조건에서만 흐른다 (DEC-FARM-003, DEC-RUN-004).
      // 정비·대화·습격에서는 이 블록이 통째로 빠지므로 잔여 시간이 그대로 보존되고,
      // 다음 날 재배 단계에서 이어서 자란다. 일시정지는 루프가 update 자체를 멈춘다.
      if (!inFarmingStage()) return

      farming?.update(dt)
      advanceFeedback(dt)

      // 야생동물 → 전투 순서로 돈다.
      // 야생동물이 먼저 움직여야 투사체가 이번 프레임의 실제 위치를 맞힌다.
      const events = wildlife?.update(dt, player, farming?.plots ?? []) ?? []
      for (const event of events) {
        if (event.type === 'playerDamaged' && run !== null) {
          run.health = Math.max(0, run.health - event.amount)
          bus.emit('combat.playerDamaged', {
            amount: event.amount,
            remainingHealth: run.health,
          })
        }
        if (event.type === 'cropEaten') {
          // 먹는 소리 (8/9 담당자). 회복 시작음을 그대로 쓴다 — 둘 다 무언가를
          // 먹는 짧은 소리이고, 야생동물 전용 소리를 따로 만들지 않기로 했다.
          // **세 번 겹쳐 낸다.** 한 번이면 "챱" 하나라 한 입 문 것처럼 들리는데
          // 실제로는 작물 하나를 통째로 없애는 사건이다.
          playChomp()
          // 먹힌 작물은 보관함에 넣지 않는다 (DEC-FARM-006).
          // 여기서 수확 처리를 부르면 잃은 작물이 오히려 쌓인다.
          //
          // 사라진 사실을 그 자리에 짧게 표시한다 (DEC-UI-018). 이게 없으면
          // 플레이어는 자기가 수확한 것과 먹힌 것을 구분할 수 없다.
          const eaten = farming?.plots.find((p) => p.plotId === event.plotId)
          if (eaten !== undefined) {
            harvestPopups.push({
              x: eaten.x,
              y: eaten.y,
              text: '먹혔다',
              remaining: HARVEST_POPUP_SECONDS,
            })
          }
        }
      }

      if (combat !== null) {
        combat.setTargets(currentTargets())
        for (const event of combat.update(dt)) {
          // 재배에서 던진 것도 명중 표시가 뜬다. **여기가 빠져 있었다** —
          // 습격 쪽만 연결하고 완료로 적었는데 야생동물에 던지는 것이 훨씬
          // 자주 일어난다.
          noteHitFlash(event)
          if (event.type === 'killed' && event.targetId !== undefined) {
            wildlife?.remove(event.targetId)
          }
          // 지속 피해도 적대 전환의 계기다 (DEC-CONTENT-007 — 플레이어 공격으로
          // 피해를 받으면). 투척 무기의 지속 피해는 플레이어 공격이다.
          if (event.type === 'damaged' && event.overTime === true && event.targetId !== undefined) {
            wildlife?.notifyDamagedByPlayer(event.targetId)
          }
        }
      }

      // 재배 중 체력이 0이면 즉시 런 실패다 (DEC-RUN-008)
      failRunIfDead()

      // 수확 가능으로 바뀐 순간을 한 번만 강조한다 (DEC-UI-004).
      // 강조는 여기서 직접 그리지만 효과음은 버스로 나간다 — 오디오가 붙을 때
      // 재배 시스템을 다시 건드리지 않게 계약을 지금부터 살려 둔다.
      for (const plotId of farming?.justBecameReady ?? []) {
        readyFlashes.set(plotId, READY_FLASH_SECONDS)
        bus.emit('farm.plotReady', { plotId })
      }

      // 제한시간이 끝나면 재배 단계를 자동 종료한다 (DEC-RUN-004).
      // 조기 종료 조건을 만들지 않는다 — DEC-RUN-005 는 보류다.
      //
      // **튜토리얼에서는 흘리지 않는다** (DEC-RUN-003 — 시간제한을 두지 않는다).
      // HUD 쪽은 `hudView()` 가 `inFarmingStage()` 로 이미 가리고 있다.
      if (inTutorial()) return
      if (farmingTimer?.tick(dt)) {
        bus.emit('farm.timeExpired', {})
        scenes.send({ type: 'farming_time_expired' })
      }
    },
    render() {
      // 필드는 베이스 화면이고 독립 화면은 그것을 **대체하는 전환**이다 (DEC-UI-014).
      // 그런데 캔버스가 화면 층위와 무관하게 매 프레임 그려서, 런 실패 뒤 타이틀로
      // 돌아가면 죽은 플레이어와 적대 주민이 그대로 남아 있었다 (8/5 플레이 테스트).
      //
      // 정비 허브는 여기 걸리지 않는다 — 셔터가 덮는 오버레이라 필드 모드가 살아 있다.
      //
      // **여기서 return 하지 않는다.** 아래 오버레이 숨김이 같이 건너뛰어지면
      // 정비 허브가 열린 채 밤 결과로 넘어갔을 때 허브가 화면에 남는다.
      if (scenes.currentFieldMode() === null) renderer.clear()
      else renderer.draw({
        player,
        aimAngle: fieldAimAngle,
        collisionRadius: runConfig.collisionRadius,
        assets: fieldAssets,
        // 방향·공격 교체 스프라이트 (DEC-ART-004). 낫을 휘두르는 동안은
        // 공격 그림이고, 파일이 없으면 정면으로 떨어진다.
        playerAsset: characterSprite(playerAssets, playerFacing, sickleSwing !== null),
        playerBob,
        playerHit: playerHitRemaining / PLAYER_HIT_SECONDS,
        plots: plotViews(),
        actionPrompt: actionPrompt(),
        harvestPopups: harvestPopups.map((p) => ({
          x: p.x,
          y: p.y,
          text: p.text,
          life: p.remaining / HARVEST_POPUP_SECONDS,
        })),
        hostiles: hostileViews(),
        // 지원 주민은 습격 전투에만 있다 (DEC-RESIDENT-021). 체력도 대기 표시도 없다.
        ally:
          allySupport === null
            ? null
            : {
                x: allySupport.x,
                y: allySupport.y,
                attackFlash: allySupport.attackFlash,
                // 공격 중에는 공격 자세로 갈아 끼운다 (DEC-ART-005). 방향은 null 이다 —
                // 지원 주민은 제자리에서 쏘므로 좌우로 향할 방향이 없다.
                assetId: characterSprite(
                  residentAssets.get(allySupport.residentId),
                  null,
                  allyAttackRemaining > 0,
                ),
              },
        // 확정 UI 규칙이 없어 개발 빌드에만 보인다 (field.ts 주석 참고).
        // 렌더는 0~1 을 받는다 — 초를 그대로 넘기면 대기시간이 바뀔 때 호가 한 바퀴를 넘는다.
        devSickleCooldown: devSickleRatio(),
        // 낫 휘두름 호. 사거리는 승인 데이터에서 오고 남은 시간만 0~1 로 넘긴다.
        sickleSwing:
          sickleSwing === null
            ? null
            : {
                angle: sickleSwing.angle,
                range: runConfig.sickleRange,
                life: sickleSwing.remaining / SICKLE_SWING_SECONDS,
              },
        // 회복 사용 게이지는 플레이어 옆에 그린다 (DEC-UI-036). 0~1 로 넘긴다.
        recovery:
          run?.recovering == null
            ? null
            : {
                progress:
                  run.recovering.durationSeconds > 0
                    ? run.recovering.elapsedSeconds / run.recovering.durationSeconds
                    : 1,
              },
        // **플레이어 것과 주민 것을 둘 다 그린다.**
        //
        // 8/5까지 `combat.projectiles`(플레이어 투척)만 넘기고 있었다. 주민
        // 투사체는 `residentCombat` 이 따로 들고 있어서 화면에 아예 안 나왔고,
        // 그래서 만복(`ranged_chase`)과 싸우면 **아무것도 안 보이는데 체력만
        // 줄었다.** 담당자 플레이 테스트에서 나왔다 (로드맵 11-2).
        //
        // 반지름 원본이 다르다 — 투척 무기는 `collision_radius`, 주민 투사체는
        // 전투 프로필의 `projectile_radius` 다 (DEC-CONTENT-008). 한 맵에서
        // 둘 다 찾으면 주민 쪽이 늘 기본값으로 떨어진다.
        projectiles: [
          ...(combat?.projectiles ?? []).map((p) => ({
            x: p.x,
            y: p.y,
            radius: throwablesById.get(p.sourceId)?.collision_radius ?? 4,
            hostile: false,
            assetId: throwableProjectiles.get(p.sourceId),
          })),
          ...(residentCombat?.projectiles ?? []).map((p) => ({
            x: p.x,
            y: p.y,
            radius: hostileProjectileRadius(p.sourceId),
            hostile: true,
            // 적대 주민 투사체는 쏜 주민에게 붙는다. `sourceId` 는 전투 프로필이라
            // 지금 습격 중인 주민에게서 찾는다 — 습격은 한 번에 한 명이다.
            assetId:
              hostile === null
                ? undefined
                : residentProjectiles.get(hostile.entity.residentId),
          })),
        ],
      })
      hud.render(hudView())

      // ── 표시와 입력을 나눈다 (DEC-UI-026) ──────────────────
      //
      // **열려 있는가**로 표시를, **입력을 소유하는가**로 조작 가능 여부를 정한다.
      // 8/5 플레이 테스트에서 브라우저 저장 대화상자로 포커스를 잃자 대화창이
      // 통째로 사라졌다 — 자동 일시정지가 겹치며 `inputOwner()` 가 `pause` 가 됐고
      // 표시 판단이 그 값을 보고 있었기 때문이다. 확정문은 "가장 위가 입력을
      // 독점하고 아래 층위는 **표시만** 한다" 이므로 사라지면 안 된다.
      const open = scenes.openOverlays()
      const owner = scenes.inputOwner()

      if (open.includes('maintenance_hub')) {
        // ── 판매를 기본으로 열어 둔다 (2026-08-08) ────────────
        //
        // 팝업에 닫기 버튼이 없어졌고 기능 버튼 넷이 갈아 끼우는 방식이라,
        // 아무것도 열려 있지 않으면 오른쪽 두 판이 빈 종이로 남는다.
        //
        // **잠긴 기능은 열지 않는다.** 튜토리얼이 판매를 막아 두는데(수확물을
        // 팔아 버리면 제작 안내를 완료할 수 없다) 그때 자동으로 열면 막아 둔
        // 것을 화면이 먼저 펼쳐 보이는 셈이다.
        if (openPopup === null && !inTutorial()) {
          openPopup = 'sell'
          hub.setPopup(buildPopup('sell'))
        }

        hub.render(hubView())
        // 거래·제작이 성공하면 소지금·보관함·제작 가능 상태를 즉시 갱신한다
        // (DEC-UI-005, DEC-UI-006). 열려 있는 팝업도 같은 프레임에 다시 그린다.
        renderOpenPopup?.()
        hub.show()
        hub.setInteractive(owner === 'maintenance_hub')
      } else {
        // 여기서만 팝업을 버린다. 입력 소유만 잃었을 때 버리면 포커스를 되찾아도
        // 열려 있던 상점·제작 팝업이 사라져 있다.
        hub.hide()
        discardPopup()
      }

      // 회복 퀵메뉴. 목록은 보관함에서 매번 계산한다 (DEC-RESOURCE-017)
      if (open.includes('recovery_quickmenu') && run !== null && recoverySources !== null) {
        recoveryMenu.render({
          items: recoveryOptions(run, recoverySources).map((option) => ({
            id: option.id,
            displayName: option.displayName,
            healAmount: option.healAmount,
            held: option.held,
          })),
          selectedId: run.pouch.selectedId,
        })
        recoveryMenu.show()
      } else {
        recoveryMenu.hide()
      }

      const talking =
        open.includes('precombat_dialogue') || open.includes('surrender_dialogue')
      if (talking && dialogue !== null) {
        dialogueModal.render({
          phase: dialogue.phase,
          residentName: dialogue.residentName,
          portraitAsset: residentPortraits.get(dialogue.residentId),
          // A4 는 두 사람이 마주 보는 화면이다 (아트 디렉션 12.2·14.7).
          // 주민과 같은 이유로 `portrait` 이 없으면 `field_sprite` 로 떨어진다.
          playerPortraitAsset: playerPortrait,
          openingText: dialogue.openingText,
          choices: dialogue.choices,
          reaction: dialogue.reaction,
        })
        dialogueModal.show()
        dialogueModal.setInteractive(
          owner === 'precombat_dialogue' || owner === 'surrender_dialogue',
        )
      } else {
        dialogueModal.hide()
      }

      // 일시정지 (DEC-UI-027). **가장 위 층위라 입력 소유를 따로 보지 않는다** —
      // `DEC-UI-026` 이 일시정지를 최상위로 정했으므로 열려 있으면 곧 입력 소유자다.
      if (open.includes('pause')) pauseScreen.show()
      else pauseScreen.hide()
    },
  },
  {
    // 포커스를 잃으면 일시정지 화면을 연다 (DEC-INPUT-009, DEC-UI-022).
    // 자동 재개는 하지 않는다. 회복 퀵메뉴가 열려 있으면 그것도 닫는다 (DEC-UI-026).
    onFocusLost: () => scenes.handleFocusLost(),
  },
)

const scenes: SceneManager = createSceneManager(bus, loop)

/**
 * 런 상태의 일차를 흐름에 맞춘다.
 *
 * **일차의 단일 원본은 흐름이다** (`scenes/flow.ts`). 런 상태는 그 값을 따라간다.
 * 지금까지 아무도 이 둘을 잇지 않아서 `run.dayNumber` 가 1에 멈춰 있었고, 그래서
 * 2일차 정비를 끝내면 흐름은 습격(`raid`)으로 가려는데 정비 허브는 1일차 기준으로
 * `아침까지 잔다` 를 보내 **흐름이 데이터 오류로 떨어졌다.** 화면에는 "정비를 끝냈는데
 * 오류가 났다" 로만 보이고 원인이 일차 불일치라는 것은 드러나지 않는다.
 *
 * HUD 의 일차 표시, 정비 종료 버튼 문구, 그날의 야생동물 출현 프로필, 적대 주민
 * 배치, 엔딩 기록문의 `finalDay` 가 전부 이 값을 읽는다.
 *
 * **야생동물 출현 프로필을 고르는 `field.entered` 구독보다 먼저 등록해야 한다.**
 * 뒤에 두면 그 구독이 한 일차 전의 프로필로 재배를 시작한다.
 */
function syncRunDay(): void {
  const step = scenes.step()
  if (run !== null && 'day' in step) run.dayNumber = step.day
}
bus.on('screen.changed', syncRunDay)
bus.on('field.entered', syncRunDay)

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

/**
 * 총합을 센다. 일지가 보는 것은 작물별 내역이 아니라 "어제 얼마나 거뒀나" 다.
 */
function sumOf(store: Record<string, number>): number {
  return Object.values(store).reduce((total, n) => total + n, 0)
}

/** 지금 상태를 일지 기준점으로 찍는다 (DEC-JOURNAL-002) */
function snapshotJournalBaseline(state: RunState, day: number): JournalBaseline {
  return {
    dayNumber: day,
    fear: state.record.fear,
    resolvedResidentIds: Object.values(state.residents)
      .filter((r) => r.resolved)
      .map((r) => r.residentId),
    harvestedTotal: sumOf(state.record.cropHarvested),
    craftConsumedTotal: sumOf(state.record.cropCraftConsumed),
  }
}

/**
 * 아침이 열렸다. 전날 일지를 준비한다 (DEC-JOURNAL-001, DEC-UI-028).
 *
 * **1일차 아침에는 아무것도 하지 않는다.** 전날 기록이 없어 생성도 표시도 하지
 * 않는다고 `DEC-JOURNAL-001` 이 확정했고, `DEC-UI-028` 은 영역 자체를 만들지
 * 말라고 한다 — 그래서 빈 문자열이 아니라 `null` 이다.
 *
 * 생성은 여기서 시작만 하고 기다리지 않는다. **일지 생성 실패도 지연도 일차 진행을
 * 막지 않는다** (DEC-JOURNAL-003). 진행 버튼은 처음부터 눌린다.
 *
 * `DEC-JOURNAL-001` 은 "전날 취침 전환 시점에 수행할 수 있다" 로 열어 두었다.
 * 아침에 부르는 쪽을 골랐다 — 취침 전환은 습격일과 비습격일에서 서로 다른 두
 * 지점이라 같은 호출을 두 군데 두게 되고, 화면 안 대기 표시가 이미 허용돼 있어
 * (DEC-UI-028) 미리 만들어 둘 이득이 없다.
 */
function beginDayStart(): void {
  const step = scenes.step()
  if (step.at !== 'day_start' || run === null) return

  const day = step.day
  const baseline = run.record.journalBaseline

  // 기준점이 없으면 비교할 전날이 없다. 1일차이거나 새 런의 첫 아침이다.
  if (day <= 1 || baseline === null) {
    dayStartJournal = null
    journalRequestDay = null
    run.record.journalBaseline = snapshotJournalBaseline(run, day)
    return
  }

  // 승인 데이터가 없으면 입력을 만들 수 없다. 빈 매니페스트·빈 주민 목록으로
  // 대신 채우지 않는다 — 그러면 프롬프트 버전 0 짜리 일지가 정상처럼 생성된다.
  if (approvedForLlm === null) {
    dayStartJournal = null
    journalRequestDay = null
    run.record.journalBaseline = snapshotJournalBaseline(run, day)
    bus.emit('data.error', {
      summary: '일지를 만들 수 없다',
      detail: '승인 데이터를 읽지 못해 일지 입력을 구성할 수 없다',
    })
    return
  }

  const band = fearBandOf(run.record.fear)
  const direction = fearDirection(run.record.fear, baseline.fear)

  const input = buildJournalInput({
    manifest: approvedForLlm.manifest,
    playerName: run.playerName,
    dayNumber: day,
    baseline,
    fear: run.record.fear,
    fearBand: band,
    residents: run.residents,
    residentData: approvedForLlm.residents,
    storyInfos: approvedForLlm.storyInfos,
    harvestedTotal: sumOf(run.record.cropHarvested),
    craftConsumedTotal: sumOf(run.record.cropCraftConsumed),
  })

  // **입력을 만든 직후에 기준점을 옮긴다.** 응답을 기다렸다 옮기면 요청이 실패했을 때
  // 다음 아침이 이틀치를 전날로 착각한다.
  run.record.journalBaseline = snapshotJournalBaseline(run, day)

  const fallback = selectJournalFallback(journalFallbacks, band?.id ?? null, direction)
  if (!fallback.ok) {
    // 폴백 문구가 없으면 LLM 이 실패했을 때 보여줄 승인 문장이 없다. 지어내지 않고
    // 비운 채 진행한다 — 오류가 화면에 남는다 (DEC-UI-024).
    bus.emit('data.error', {
      summary: '폴백 일지를 고를 수 없다',
      detail: fallback.reason,
    })
  }

  dayStartJournal = { state: 'pending' }
  journalRequestDay = day

  void requestJournal(input, fallback.ok ? fallback.text : '').then((result) => {
    // 그 사이에 아침이 바뀌었으면 버린다. 늦은 응답이 다른 날의 화면을 덮으면
    // 플레이어에게는 "일지가 하루 밀렸다" 로 보인다.
    if (journalRequestDay !== day) return
    journalRequestDay = null

    dayStartJournal = { state: 'ready', text: result.text }
    // 폴백인지 아닌지는 기록에만 남기고 화면은 구분하지 않는다 (DEC-UI-028)
    run?.record.journalEntries.push({
      dayNumber: day,
      text: result.text,
      usedFallback: result.usedFallback,
    })

    if (isDevBuild) {
      console.info(
        `[일지] ${day}일차 — ${result.usedFallback ? '폴백' : result.generatorModelId ?? 'LLM'}`,
      )
    }

    syncScreens()
  })
}

/**
 * 밤 결과 화면이 열렸다. 표시할 문구를 **한 번** 고른다 (DEC-CONTENT-018).
 *
 * 승인 행 중 무작위 하나이며, 행이 하나면 그 행이 항상 뽑히므로 행 수가 바뀌어도
 * 코드를 고치지 않는다. 여기서 고르는 이유는 확정 규칙이 "그날의 밤 결과 화면을
 * 열 때 한 번" 이기 때문이다 — 부팅에서 고르면 한 런 안의 여러 밤이 전부 같은
 * 문구가 되고, 매 프레임 고르면 깜빡인다.
 */
function beginNightResult(): void {
  if (scenes.currentScreen() !== 'night_result') return

  nightResult = selectNightResultText(nightResultTexts)
  if (!nightResult.ok) {
    console.warn(`[데이터] 밤 결과 문구를 고르지 못했다 — ${nightResult.reason}`)
  }
}

/**
 * 배경음 전환 (DEC-ART-005, `docs/submission/SOUND_ASSET_INDEX.md`).
 *
 * ── 안 바꾸는 것이 기본이다 ────────────────────────────────
 *
 * **아래에 없는 화면은 흐르던 트랙을 그대로 둔다.** 조우 결과·밤 결과의 배경음은
 * 아직 정해지지 않았고(직전 트랙 유지인지 전용 트랙인지), 전투 전 대화와 투항
 * 대화는 *"진입 시점에 이미 흐르던 트랙을 그대로 유지한다"* 로 정해져 있다.
 * 정해지지 않은 자리에 임의로 트랙을 고르면 그게 곧 결정이 된다.
 *
 * ── 재배와 정비가 같은 트랙이다 ────────────────────────────
 *
 * 정비 허브는 화면 전환이 아니라 필드 위 오버레이라 `screen.changed` 가 오지
 * 않는다. 그런데 같은 `farm` 트랙이므로 **아무것도 안 해도 이어진다** — 여기서
 * `overlay.opened` 를 따로 듣지 않는 이유다. `bgm.play()` 가 같은 ID 를 무시하는
 * 것과 맞물려, 재배 → 정비 → 다음 날 재배가 한 곡으로 이어진다.
 */
function bgmForScreen(screen: ScreenId): string | null {
  if (screen === 'title' || screen === 'name_input') return BGM_ASSET.title
  if (screen === 'run_failed') return BGM_ASSET.defeat
  if (screen === 'ending') return BGM_ASSET.ending
  return null
}

bus.on('screen.changed', ({ screen }) => {
  const track = bgmForScreen(screen)
  if (track !== null) bgm.play(track)
})

/**
 * 부팅 시점의 화면에도 트랙을 건다.
 *
 * **첫 `screen.changed` 는 이 구독보다 먼저 지나간다.** `createSceneManager()` 가
 * 만들어지는 그 자리에서 `apply(INITIAL_STEP)` 을 부르고, 그게 타이틀의
 * `screen.changed` 를 발행한다 — 위 구독은 180줄 뒤에 등록되므로 못 듣는다.
 *
 * 놓치면 **대기 중인 트랙이 없어서 화면을 눌러도 아무 일이 안 일어난다.**
 * 자동 재생 거부는 거부된 트랙을 기억했다가 첫 조작에 다시 트는 구조인데,
 * 애초에 요청이 없었으니 기억할 것도 없다. 8/8 에 담당자가 *"타이틀에서 아무
 * 데나 눌러도 안 나고 버튼을 눌러야 난다"* 로 잡았다 — 버튼을 누르면 다음
 * 화면의 `screen.changed` 가 와서 그제야 걸렸던 것이다.
 */
const bootTrack = bgmForScreen(scenes.currentScreen() ?? 'title')
if (bootTrack !== null) bgm.play(bootTrack)

/*
  효과음 배선 (DEC-ART-005).

  **전부 버스 구독이다.** 소리를 내는 조건을 발행 지점마다 적으면 발행자가 하나
  더 생길 때 빠진다 — 8/7 에 명중 표시로 네 번 반복한 자리다 (3-B-1).
  낫 소리만 예외인데 `swingSickle()` 이 이벤트가 아니라 반환값이라 구조가 다르다.
*/
bus.on('screen.changed', () => sfx.play(SOUND_ASSET.screenTransition))
bus.on('overlay.opened', () => sfx.play(SOUND_ASSET.modalOpen))
bus.on('request.rejected', () => sfx.play(SOUND_ASSET.buttonReject))

bus.on('farm.planted', () => sfx.play(SOUND_ASSET.plantSeed))
bus.on('farm.harvested', () => sfx.play(SOUND_ASSET.harvest))
// `DEC-UI-004` 가 "수확 가능으로 바뀔 때 짧은 효과음" 을 확정문으로 요구한다.
bus.on('farm.plotReady', () => sfx.play(SOUND_ASSET.harvestReady))

// 판매·구매·보상이 같은 소리다. 셋 다 "받았다" 는 같은 사실을 알린다.
bus.on('shop.sold', () => sfx.play(SOUND_ASSET.tradeConfirm))
bus.on('shop.bought', () => sfx.play(SOUND_ASSET.tradeConfirm))
bus.on('reward.granted', () => sfx.play(SOUND_ASSET.tradeConfirm))

bus.on('quickslot.autoSwitched', () => sfx.play(SOUND_ASSET.quickslotSwitch))
bus.on('quickslot.allEmpty', () => sfx.play(SOUND_ASSET.quickslotEmpty))
bus.on('combat.throwableSpent', () => sfx.play(SOUND_ASSET.throw))

bus.on('recovery.started', () => sfx.play(SOUND_ASSET.recoveryStart))
bus.on('recovery.completed', () => sfx.play(SOUND_ASSET.recoveryComplete))

bus.on('dialogue.opened', () => sfx.play(SOUND_ASSET.dialogueOpen))
bus.on('run.failed', () => sfx.play(SOUND_ASSET.runFailed))
bus.on('ending.decided', () => sfx.play(SOUND_ASSET.endingDecided))

/**
 * 일차 시작 스팅어 (`DEC-RUN-011`).
 *
 * 오늘 밤에 무엇이 오는지를 소리로도 알린다. **일차가 아니라 승인 일정의
 * `raid_type` 으로 고른다** — 화면에 뜨는 예고 문구를 고르는 기준과 같아야
 * 소리와 글이 어긋나지 않는다.
 */
bus.on('screen.changed', ({ screen }) => {
  if (screen !== 'day_start') return
  const raidType = raidTypeOfDay(run?.dayNumber ?? 1)
  if (raidType === 'final_raid') sfx.play(SOUND_ASSET.dayStartFinal)
  else if (raidType === 'raid') sfx.play(SOUND_ASSET.dayStartRaid)
  else sfx.play(SOUND_ASSET.dayStartNone)
})
bus.on('encounter.finished', ({ finalOutcome }) => {
  // 막타일 때만이다. 공감·협상·영입·퇴각은 죽인 것이 아니다 (DEC-RESIDENT-052).
  if (finalOutcome === 'killed') sfx.play(SOUND_ASSET.residentDefeat)
})

/*
  버튼 클릭음은 버스가 아니라 DOM 에 건다.

  누를 수 있는 것이 화면마다 흩어져 있고 그 전부가 이벤트를 쏘지는 않는다 —
  조작 안내 펼치기나 팝업 닫기처럼 게임 상태를 안 바꾸는 버튼이 그렇다.
  버튼마다 손으로 붙이면 다음에 만드는 버튼이 반드시 빠진다.

  **막힌 버튼은 울리지 않는다.** `disabled` 는 클릭 이벤트가 아예 안 오고,
  눌렀는데 거절된 경우는 `request.rejected` 가 따로 거절음을 낸다.
*/
uiRoot.addEventListener('click', (event) => {
  const target = event.target
  if (!(target instanceof Element)) return
  if (target.closest('button') === null) return
  sfx.play(SOUND_ASSET.buttonClick)
})

bus.on('field.entered', ({ mode }) => {
  if (mode !== 'raid') {
    bgm.play(BGM_ASSET.farm)
    return
  }
  // 마지막 습격만 다른 곡이다. 일차가 아니라 승인 일정의 raid_type 으로 가른다 —
  // "5일차" 는 지금 일정이 그럴 뿐이고 코드가 알 값이 아니다 (DEC-RUN-011).
  const final = raidTypeOfDay(run?.dayNumber ?? 1) === 'final_raid'
  bgm.play(final ? BGM_ASSET.boss : BGM_ASSET.raid)
})

// 일지 준비와 밤 결과 문구 선택을 **화면 반영보다 먼저** 등록한다. 뒤에 두면 첫
// 그리기가 지난 값을 그대로 쓰고 한 박자 늦게 바뀐다.
bus.on('screen.changed', beginDayStart)
bus.on('screen.changed', beginNightResult)

// 독립 화면 표시도 같은 두 신호를 본다. 필드로 나가면 화면이 없어지는데
// 그때는 `screen.changed` 가 오지 않고 `field.entered` 만 온다.
bus.on('screen.changed', syncScreens)
bus.on('field.entered', syncScreens)

// 기록문이 늦게 도착하면 대기 표시를 실제 문장으로 바꾼다 (DEC-UI-023).
// 화면은 그대로인데 내용만 바뀌는 경우라 위 두 신호로는 오지 않는다.
// 일지 쪽은 요청을 건 자리에서 직접 다시 그린다 — 그쪽은 늦은 응답을 버리는
// 판단(`journalRequestDay`)이 같이 필요해서 구독으로 나누지 않았다.
bus.on('ending.recordReady', syncScreens)

syncScreens()

/**
 * 재배에 들어갈 때 야생동물 출현을 시작하고 나갈 때 전부 제거한다.
 *
 * 출현 프로필은 그 일차의 데이터에서 온다. 프로필 참조가 비어 있는 일차는
 * 야생동물이 없다 (DEC-CONTENT-007). 여기서 기본 프로필을 지어내지 않는다.
 *
 * 전역 투척 재사용 대기도 단계 진입마다 초기화한다 (DEC-CONTENT-005).
 *
 * **재배 제한시간도 여기서 다시 시작한다** (DEC-RUN-004). 경작지와 반대다 —
 * 작물 상태와 남은 성장 시간은 다음 날로 그대로 넘어가지만(DEC-FARM-003)
 * 제한시간은 "그 일차의 재배 단계" 길이라 일차마다 처음부터다.
 *
 * `stage-timer.ts` 는 8/3에 `reset()` 을 만들어 두고 **부르는 곳이 없었다.**
 * 그래서 2일차 재배는 남은 시간 0 · 만료 통지 소진 상태로 시작했고, `tick()` 이
 * 영영 true 를 안 돌려줘 재배가 끝나지 않았다. 단위 테스트 6개는 통과 중이었다 —
 * 타이머 자체는 맞고 부르는 곳만 없었다.
 */
bus.on('field.entered', ({ mode }) => {
  combat?.reset()
  if (mode !== 'farming') {
    wildlife?.endFarming()
    return
  }

  // 튜토리얼은 재배 필드를 쓰지만 **1일차가 아니다** (DEC-RUN-003 — 1일차 타이머와
  // 분리하고 시간제한을 두지 않는다). 그래서 타이머를 돌리지 않고 야생동물도
  // 세우지 않는다. 조작을 배우는 자리에 제한시간과 적을 같이 두면 배울 수 없다.
  if (inTutorial()) {
    wildlife?.endFarming()
    tutorial = createTutorialProgress(tutorialSteps)

    if (tutorial.total === 0) {
      // 안내가 없으면 튜토리얼이 성립하지 않는다. 임시 문구를 지어내지 않고
      // 데이터 오류로 올린 뒤 넘어간다 (DEC-UI-030 — 문구는 승인 데이터에서만).
      bus.emit('data.error', {
        summary: '튜토리얼 안내가 없다',
        detail: 'tutorial_steps 에 승인 행이 없다 (DEC-CONTENT-025)',
      })
      finishTutorial()
      return
    }
    syncTutorial()
    return
  }

  farmingTimer?.reset()

  const day = run?.dayNumber ?? 1
  const profileId = spawnProfileIdByDay.get(day) ?? null
  const profile = profileId === null ? null : (spawnProfilesById.get(profileId) ?? null)

  if (profileId !== null && profile === undefined) {
    bus.emit('data.error', {
      summary: '출현 프로필을 찾지 못했다',
      detail: `${day}일차가 참조하는 ${profileId} 가 승인 데이터에 없다`,
    })
    return
  }
  wildlife?.beginFarming(profile, spawnEntries)
})

bus.on('field.exited', () => wildlife?.endFarming())

/**
 * 튜토리얼 완료 판정 (DEC-CONTENT-025, DEC-RUN-003).
 *
 * **일곱 개가 전부 이미 있는 이벤트에 붙는다.** 튜토리얼용 판정을 시스템 안에
 * 따로 만들지 않았다 — 그러면 "진짜 조작" 과 "튜토리얼이 인정하는 조작" 이 갈리고,
 * 갈리는 순간 안내를 따라 했는데 안 넘어가는 상태가 생긴다.
 *
 * 반대로 `use_sickle` 만 이벤트가 없어서 새로 만들었다(`combat.sickleSwung`).
 * 낫은 명중과 무관하게 휘두른 것이 성공이다.
 */
bus.on('farm.planted', () => completeTutorialStep('plant_crop'))
bus.on('farm.harvested', () => completeTutorialStep('harvest_crop'))
bus.on('shop.sold', () => completeTutorialStep('sell_crop'))
bus.on('shop.bought', () => completeTutorialStep('buy_material'))
bus.on('craft.made', () => completeTutorialStep('craft_item'))
// 편성 확정만 듣는다. 요청(`quickslot.assign`)은 중복 편성으로 거절될 수 있어
// 아무것도 안 바뀐 채 다음 안내로 넘어간다 (DEC-RESOURCE-019).
bus.on('quickslot.assigned', () => completeTutorialStep('assign_quickslot'))
bus.on('combat.sickleSwung', () => completeTutorialStep('use_sickle'))
// 투척만 곧바로 알리지 않는다. 마지막 단계라 완료되는 순간 종료 화면이 필드를
// 덮어서, 던진 것이 날아가는 것을 못 본 채 튜토리얼이 끝난다 (8/7 플레이 테스트).
// 대기 중에 또 던져도 시계를 새로 감지 않는다 — 처음 던진 것을 기준으로 센다.
bus.on('combat.throwableSpent', () => {
  if (tutorial === null || !inTutorial()) return
  if (throwableStepDelay === null) throwableStepDelay = THROWABLE_STEP_DELAY_SECONDS
})
/**
 * 공격받으면 진행 중인 회복이 취소된다 (DEC-INPUT-005). 아이템은 소비하지 않는다.
 *
 * **피해를 주는 쪽마다 부르지 않고 이벤트 한 곳에서 듣는다.** 처음에는 습격의
 * 주민 피해 자리에만 넣었는데 야생동물 피해가 빠져 있었다 — 재배에서는 맞아도
 * 회복이 계속 진행됐다. 피해 경로가 늘 때마다 같은 호출을 기억해야 하는 구조는
 * 반드시 하나를 빠뜨린다.
 */
bus.on('combat.playerDamaged', () => cancelRecovery('damaged'))
// 맞았다는 것을 화면으로도 알린다 (8/7 플레이 테스트). 때리는 쪽 표시는 있었는데
// 맞는 쪽이 없어서 체력 숫자 말고는 신호가 없었다.
bus.on('combat.playerDamaged', () => {
  playerHitRemaining = PLAYER_HIT_SECONDS
})
// 깜빡임의 짝이 되는 소리 (DEC-ART-005). **발행 지점이 아니라 여기에 붙인다** —
// `combat.playerDamaged` 를 내는 곳이 습격(주민)과 재배(야생동물) 둘이라 발행
// 쪽에 붙이면 한쪽을 빠뜨린다. 8/7 에 명중 표시로 정확히 그 실수를 했다 (3-B-1).
bus.on('combat.playerDamaged', () => sfx.play(SOUND_ASSET.playerHit))

bus.on('overlay.opened', syncInputLock)
bus.on('overlay.closed', syncInputLock)
syncInputLock()

// 대화 내용은 오버레이가 열리는 순간 준비한다.
// 전투 전 대화는 습격 모드 진입과 함께 화면 매니저가 열고(scenes/manager.ts),
// 투항 대화는 주민이 투항 기준 이하로 처음 내려갈 때 열린다 (DEC-RESIDENT-016).
bus.on('overlay.opened', ({ overlay }) => {
  if (overlay === 'precombat_dialogue') openPrecombatDialogue()
  if (overlay === 'surrender_dialogue') openSurrenderDialogue()
})

bus.on('overlay.closed', ({ overlay }) => {
  if (overlay === 'precombat_dialogue' || overlay === 'surrender_dialogue') dialogue = null
})

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

  // 전투 결과 이벤트. UI 가 붙기 전까지 이걸로만 확인된다.
  //
  // 없는 동안 `quickslot.allEmpty` 가 나가는지 아무도 알 수 없었다 — 버스로 쏘고
  // 듣는 쪽이 없으면 "구현했다" 와 "구현 안 했다" 가 화면에서 똑같이 보인다.
  bus.on('combat.playerDamaged', ({ amount, remainingHealth }) =>
    console.info(`[전투] 피격 ${amount} → 체력 ${remainingHealth}`),
  )
  bus.on('combat.throwableSpent', ({ throwableId, remaining }) =>
    console.info(`[투척] ${throwableId} 소비 — 남은 ${remaining}`),
  )
  bus.on('quickslot.autoSwitched', ({ fromIndex, toIndex }) =>
    console.info(`[퀵슬롯] 소진 자동 전환 ${fromIndex + 1} → ${(toIndex ?? 0) + 1}`),
  )
  bus.on('quickslot.allEmpty', () =>
    console.warn('[퀵슬롯] 투척 무기 없음 — 전체 비활성. 낫은 계속 쓸 수 있다'),
  )
  bus.on('surrender.offered', ({ residentId, remainingHealth }) =>
    console.warn(`[조우] 투항 발동 — ${residentId} 체력 ${remainingHealth}`),
  )
  bus.on('run.failed', () => console.warn('[런] 체력 0 — 런 실패 (DEC-RUN-008)'))
  bus.on('encounter.finished', ({ residentId, finalOutcome }) =>
    console.warn(`[조우] 종료 — ${residentId} · ${finalOutcome}`),
  )
  bus.on('reward.granted', ({ residentId, bundleId }) =>
    console.info(`[보상] ${residentId} · ${bundleId} 지급`),
  )
  bus.on('ending.decided', ({ endingId, endingTitle }) =>
    console.warn(`[엔딩] 확정 — ${endingTitle} (${endingId})`),
  )

  // 흐름을 손으로 들여다보기 위한 노출. **상태를 바꾸는 통로는 없다.**
  //
  // 개발 통로는 8/5에 전부 지웠다. `__dev` 넷(`fillThrowables`·`goToDay`·
  // `startRaid`·`surrender`)은 대신하던 UI 가 도착해서, `devSkipToFarming()` 은
  // 타이틀·이름 입력·튜토리얼 화면이 생겨서다. 특히 `goToDay` 는 `syncRunDay()` 가
  // 들어온 뒤로 **런 상태만 옮기고 흐름은 그대로 둬서** 5일차 습격을 1일차로
  // 판정하게 만들었다 (로드맵 11-2).
  Object.assign(window, {
    __scenes: scenes,
    __bus: bus,
    __loop: loop,
  })

  console.info(
    '[개발 전용] __scenes.step() 으로 현재 흐름을, __scenes.send({type:...}) 로 ' +
      '흐름 입력을 넣을 수 있다. 상태를 직접 바꾸는 통로는 없다 — 무기는 제작·편성으로, ' +
      '일차는 정상 흐름으로 넘긴다.',
  )

}

// 데이터 적재는 `data.error` 구독이 모두 끝난 뒤에 시작한다.
// 먼저 부르면 오류 이벤트가 아무 데도 도달하지 않고 화면만 비어 보인다.
//
// 부팅 중에는 로딩 표시를 덮는다 (DEC-UI-024). 타이틀은 `INITIAL_STEP` 이라
// 이미 떠 있는데, 승인 데이터가 없는 타이틀은 눌러도 갈 곳이 없다.
loadingScreen.show()

void bootData().then((ok) => {
  booting = false
  loadingScreen.hide()

  if (!ok) {
    // 부팅할 수 없으면 데이터 오류 화면이고 여기서 끝이다 (DEC-UI-024).
    // **루프를 시작하지 않는다** — 돌 것이 없고, 돌리면 빈 필드가 오류 화면
    // 뒤에서 계속 그려진다.
    dataErrorScreen.render(bootErrors)
    dataErrorScreen.show()
    return
  }

  // **흐름을 밀지 않는다.** 타이틀 화면이 생겼으므로 플레이어가 직접 시작한다.
  // 8/5까지는 `devSkipToFarming()` 이 여기서 네 화면을 건너뛰었다 — 마지막
  // 개발 통로였고 타이틀·이름 입력·튜토리얼이 들어오면서 지웠다 (로드맵 11-2).
  loop.start()
})
