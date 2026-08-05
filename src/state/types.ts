// 런 상태의 타입.
//
// src/data/types.ts 가 "바뀌지 않는 승인 데이터"라면 이 파일은 "런 중에 바뀌는 것"이다.
// 둘을 섞지 않는다. 여기에는 작물 가격·성장 시간 같은 원본 수치가 없고, 모두 ID 참조다.
//
// 지키는 규칙 세 가지:
//
//   1. 수량의 단일 원본 (DEC-RESOURCE-002)
//      투척 퀵슬롯과 회복 파우치는 **저장 공간이 아니라 선택 인터페이스**다.
//      수량을 복사해 들고 있지 않고 보관함을 참조만 한다. 그래서 아래 타입에도
//      quantity 필드가 없다. 있으면 원본이 두 곳이 되어 반드시 어긋난다.
//
//   2. 원자적 변경 (DEC-RESOURCE-011, DEC-CRAFT-004, DEC-RESIDENT-033, DEC-RESIDENT-042)
//      거래·제작·협상·보상은 "사본에 전부 적용해 보고 전부 성공했을 때만 교체"한다.
//      그래서 상태 객체는 통째로 갈아끼우기 쉬운 평평한 모양으로 둔다.
//
//   3. 런 리셋 (DEC-RESOURCE-004, DEC-RESIDENT-047)
//      새 런은 이 객체를 새로 만들어 통째로 교체한다. 필드를 하나씩 되돌리지 않는다.
//      부분 리셋이 남으면 두 번째 런에서만 재현되는 버그가 된다.

import type {
  CombatState,
  FinalOutcome,
  ImportantActionSubject,
  RelationshipCountSubject,
  SurrenderChoiceFunction,
} from '../data/types.ts'

// ─────────────────────────────────────────────────────────────
// 자원 (DEC-RESOURCE-001 ~ 003)
// ─────────────────────────────────────────────────────────────

/**
 * 보관함 하나. 아이템 종류당 슬롯 하나이고 같은 아이템은 수량으로 중첩한다.
 * 종류 수와 최대 중첩 수량에 제한을 두지 않는다 (DEC-RESOURCE-003).
 *
 * 키는 콘텐츠 ID(`crop.*`, `material.*` 등)이고 값은 1 이상의 정수다.
 * **수량이 0이 되면 키를 지운다.** 0인 키를 남기면 "보유 목록" 판정이 두 갈래로 갈린다.
 */
export type ItemStore = Record<string, number>

/**
 * 자원 전체. 씨앗은 무제한 공용이라 자원이 아니다 (DEC-RESOURCE-005).
 * 생식 가능한 수확물도 별도 보관함에 복사하지 않고 crops 에서 관리한다.
 */
export interface Resources {
  /** 소지금 */
  money: number
  /** 수확물 보관함 — 판매·제작·자원 협상의 대상 */
  crops: ItemStore
  /** 재료 보관함 — 구매·제작의 대상 */
  materials: ItemStore
  /** 무기 보관함 — 제작한 투척 무기. 퀵슬롯이 참조하는 원본 */
  throwables: ItemStore
  /** 소모품 보관함 — 제작한 회복 아이템. 회복 파우치가 참조하는 원본 */
  recoveries: ItemStore
}

// ─────────────────────────────────────────────────────────────
// 투척 퀵슬롯 (DEC-INPUT-006, DEC-RESOURCE-014 ~ 016)
// ─────────────────────────────────────────────────────────────

/** 퀵슬롯은 5칸으로 고정한다 (DEC-INPUT-006) */
export const THROWABLE_QUICKSLOT_COUNT = 5

/**
 * 퀵슬롯 편성. 칸마다 무기 **종류 ID만** 담는다. 비어 있으면 null.
 *
 * 수량은 여기 없다 — Resources.throwables 를 본다 (DEC-RESOURCE-002).
 * 수량이 0이 돼도 편성은 자동 해제하지 않고 사용 불가 상태로만 둔다 (DEC-RESOURCE-015).
 * 같은 종류를 여러 칸에 중복 편성할 수 없다 (DEC-RESOURCE-014).
 */
export interface ThrowableQuickslots {
  /** 길이 THROWABLE_QUICKSLOT_COUNT 고정 */
  slots: (string | null)[]
  /** 현재 선택된 칸 번호(0-based). 편성과 선택은 일차·단계가 바뀌어도 유지한다 */
  selectedIndex: number
}

// ─────────────────────────────────────────────────────────────
// 회복 파우치 (DEC-INPUT-008, DEC-RESOURCE-017, 018)
// ─────────────────────────────────────────────────────────────

/**
 * 회복 파우치. 칸 수 제한도 장착 과정도 없다 (DEC-RESOURCE-017).
 *
 * 목록을 저장하지 않는다 — 소모품 보관함의 회복 아이템과 수확물 보관함의
 * 생식 가능한 수확물에서 **매번 계산**한다. 저장하면 제작·수확 직후 어긋난다.
 * 그래서 이 상태에 남는 것은 "지금 무엇을 고르고 있는가"뿐이다.
 */
export interface RecoveryPouch {
  /**
   * 현재 선택된 회복 아이템 ID. `recovery_item.*` 또는 생식 가능한 `crop.*`.
   * 사용 가능한 것이 하나도 없으면 null.
   */
  selectedId: string | null
}

/**
 * 진행 중인 회복 사용 (DEC-INPUT-008).
 *
 * 완료 전에 공격받으면 취소되고 아이템을 소비하지 않는다.
 * 대화로 전환될 때도 정지 후 재개가 아니라 **취소**다 (개발 로드맵 9-2).
 */
export interface RecoveryInProgress {
  itemId: string
  elapsedSeconds: number
  /** 데이터에서 읽은 총 소요 시간. 코드에 상수로 두지 않는다 */
  durationSeconds: number
}

// ─────────────────────────────────────────────────────────────
// 주민 런 상태 (DEC-RESIDENT-012, 041, 042, 043, 052)
// ─────────────────────────────────────────────────────────────

/**
 * 주민 관계 (DEC-RESIDENT-012, DEC-CONTENT-022).
 *
 * `unformed` 는 런 시작 시 모든 주민의 초기 관계이며 **이 타입의 정식 값이다.**
 * 확정 전에는 미형성을 가리키는 키가 없어 `null` 로 우회했는데,
 * 그러면 "아직 안 정해짐"과 "미형성으로 확정됨"이 같은 값이 된다.
 * DEC-CONTENT-022 가 키를 정해서 걷어냈다.
 *
 * `RelationshipCountSubject` 와 한 글자 차이로 다르다 — 그쪽은 엔딩 조건이 세는
 * 대상이라 `unformed` 를 포함하지 않는다. 둘을 합치지 않는다.
 */
export type RelationshipState = RelationshipCountSubject | 'unformed'

/** 생존 여부 (DEC-RESIDENT-052) */
export type ResidentLifeState = 'alive' | 'killed'

/** 플레이어와의 소속 관계 (DEC-RESIDENT-041, 052) */
export type ResidentAllegiance = 'neutral' | 'recruited' | 'hostile'

/**
 * 주민 한 명의 런 상태.
 *
 * 해결된 주민은 같은 런에서 다시 적대 주민으로 등장하지 않는다 (DEC-RESIDENT-043).
 */
export interface ResidentRunState {
  residentId: string

  /** 조우가 끝났는가. 끝나기 전에는 outcome·relationship 이 모두 미확정이다 */
  resolved: boolean
  /**
   * 조우 해결 순간 정확히 한 번 확정하고 이후 바꾸지 않는다 (DEC-RESIDENT-052).
   * 플레이어 사망으로 런이 실패하면 새로 확정하지 않는다.
   */
  finalOutcome: FinalOutcome | null
  lifeState: ResidentLifeState
  allegiance: ResidentAllegiance
  /** 런 시작 시 `unformed`. 조우 해결 순간 바뀐다 (DEC-CONTENT-022) */
  relationship: RelationshipState

  /** 이번 런에서 실제로 뽑힌 사연 시나리오. 조우 전에 정해진다 */
  scenarioId: string | null
  /** 대화로 공개된 사연 정보 ID */
  revealedStoryInfoIds: string[]

  /** 투항 대화는 주민 한 명당 최대 한 번이다 (DEC-RESIDENT-016) */
  surrenderOffered: boolean
  /** 투항 대화에서 무엇을 골랐는가. 열리지 않았으면 null */
  surrenderChoice: SurrenderChoiceFunction | null

  /**
   * 대가·처치 보상을 이미 지급했는가. 한 런에서 한 번만 지급한다 (DEC-RESIDENT-042).
   * 중복 지급 차단의 근거이므로 보상 지급과 같은 원자적 처리 안에서 켠다.
   */
  rewardGranted: boolean

  /**
   * 영입 주민의 지원 기회를 이미 썼는가 (DEC-RESIDENT-021).
   * 한 번 지원하면 소비되며, 소비 후에도 생존·영입 상태는 유지한다.
   */
  supportUsed: boolean
}

// ─────────────────────────────────────────────────────────────
// 진행·기록 (DEC-RESIDENT-046, DEC-CRAFT-007, 008, DEC-CONTENT-011)
// ─────────────────────────────────────────────────────────────

/**
 * 엔딩 판정에 쓰는 누적 기록 (DEC-CONTENT-011).
 *
 * 대표 작물은 저장하지 않고 엔딩 판정 시점에 계산한다 — 숙련도 → 제작 소비 →
 * 총수확 → 작물 ID 오름차순 순서로 비교한다. 그래서 세 카운터를 각각 들고 있다.
 */
export interface RunRecord {
  /**
   * 공포도. 런 시작 0, 감소하지 않는 누적 전역 정수 (DEC-RESIDENT-046).
   * 제출 빌드에서는 수치를 플레이어에게 표시하지 않는다 (DEC-RESIDENT-047).
   */
  fear: number

  /** 중요 행동 횟수. important_action_count 조건의 입력이다 */
  importantActions: Record<ImportantActionSubject, number>

  /** 작물별 숙련도. 제작으로 소비한 수량만큼 는다 (DEC-CRAFT-007) */
  cropMastery: Record<string, number>
  /** 작물별 제작 소비 누적 수량. 숙련도와 규칙이 달라질 수 있어 따로 센다 */
  cropCraftConsumed: Record<string, number>
  /** 작물별 총수확 수량. 판매·생식과 무관하게 수확한 전량 */
  cropHarvested: Record<string, number>

  /** 해금된 레시피 ID. 런이 끝날 때까지 유지한다 (DEC-CRAFT-006, 008) */
  unlockedRecipeIds: string[]

  /** 일차별 생성된 일지. 1일차 아침은 표시하지 않는다 (DEC-JOURNAL-001) */
  journalEntries: JournalEntry[]

  /**
   * 직전 일차 시작 시점의 스냅샷 (DEC-JOURNAL-002).
   *
   * 일지 입력은 "전날 조우 결과", "전날 변경된 관계", "전날 대비 공포도 변화 방향"
   * 처럼 **변화**를 요구하는데 위 누적값만으로는 어제 무엇이 달라졌는지 알 수 없다.
   * 일차 시작마다 새로 찍는다. 1일차 아침에는 비교 대상이 없어 null 이다.
   */
  journalBaseline: JournalBaseline | null
}

export interface JournalEntry {
  /** 이 일지를 보여주는 일차 */
  dayNumber: number
  text: string
  /** LLM 생성이 실패해 폴백 문구를 쓴 경우 true (DEC-JOURNAL-003) */
  usedFallback: boolean
}

/**
 * 일지의 "전날 대비" 를 재기 위한 기준점 (DEC-JOURNAL-002).
 *
 * 런 상태 쪽에 둔다 — `llm/journal.ts` 가 이것을 읽지만, 무엇을 기억할지는
 * 런 상태의 계약이지 LLM 호출의 계약이 아니다.
 */
export interface JournalBaseline {
  /** 이 스냅샷을 찍은 일차 */
  dayNumber: number
  fear: number
  /** 그 시점에 이미 조우가 끝난 주민 */
  resolvedResidentIds: string[]
  /** 그 시점까지의 총수확 수량 */
  harvestedTotal: number
  /** 그 시점까지 제작으로 소비한 총수량 */
  craftConsumedTotal: number
}

// ─────────────────────────────────────────────────────────────
// 런 전체
// ─────────────────────────────────────────────────────────────

/**
 * 한 런의 전체 상태.
 *
 * 새 런과 런 실패 후 타이틀 복귀에서 이 객체를 **새로 만들어 통째로 교체**한다
 * (DEC-RESOURCE-004, DEC-RESIDENT-047, 개발 로드맵 9-5).
 * 초기값은 데이터에서 읽는다 — max_health·starting_money 는 player_base_stats
 * 승인 행에서 오며 코드에 숫자를 넣지 않는다 (DEC-CONTENT-019).
 */
export interface RunState {
  /** 이름 입력 화면에서 받은 값 */
  playerName: string

  /**
   * 무작위 재현용 시드. 자원 협상의 수확물 추첨이 같은 런 상태와 선택에서
   * 같은 결과를 내야 한다 (DEC-RESIDENT-050).
   */
  seed: number

  /** 적용 중인 습격 일정 ID. total_days·map_id 는 이 데이터에서 읽는다 */
  runScheduleId: string

  /**
   * 현재 일차. **단일 원본은 흐름이다** (`scenes/flow.ts`) — 런 상태는 그 값을
   * 따라간다 (`syncRunDay()`).
   *
   * 단계(`RunPhase`)는 여기 같이 있었는데 8/5에 지웠다. 원본이 흐름인데 런 상태에도
   * 두면 두 곳이 갈라지고, 실제로 **아무도 읽지 않은 채 선언만 남아 있었다.**
   * 계약에 있는 것을 다음 사람이 믿고 짜게 되므로 동기화 대신 제거를 골랐다
   * (김민주가 8/5에 발견, 로드맵 11-2).
   */
  dayNumber: number

  /** 현재 체력. 최대 체력은 player_base_stats 원본에 있다 */
  health: number
  resources: Resources
  quickslots: ThrowableQuickslots
  pouch: RecoveryPouch
  /** 회복 중이 아니면 null */
  recovering: RecoveryInProgress | null

  /** 주민 ID → 런 상태. 런 시작 시 승인된 모든 주민으로 채운다 */
  residents: Record<string, ResidentRunState>

  record: RunRecord

  /**
   * 확정된 엔딩. 마지막 습격의 모든 상태 변경이 끝난 뒤에만 채운다.
   * LLM 기록문 요청은 이 값을 저장한 뒤에 한다 (DEC-CONTENT-011).
   */
  ending: EndingResult | null
}

export interface EndingResult {
  endingId: string
  /** 확정 시점의 엔딩 콘텐츠 버전. 런 결과에 함께 저장한다 */
  endingContentVersion: number
  /** 최종 공포도와 그때 결정된 구간 */
  fear: number
  fearBandId: string | null
  /** 대표 작물. 조건 판정과 기록문 입력에 쓴다 */
  dominantCropId: string | null
  /** 표시할 기록문 */
  recordText: string
  /** LLM 실패로 fallback_record_text 를 쓴 경우 true */
  usedFallback: boolean
}

// ─────────────────────────────────────────────────────────────
// 필드 시뮬레이션 상태
// ─────────────────────────────────────────────────────────────

/**
 * 경작지 한 칸 (DEC-FARM-001 ~ 005).
 *
 * 마지막 단계 키는 `ready` 다. 이 계약 파일이 먼저 `harvestable` 로 적었는데
 * 구현(`systems/farming.ts`)과 렌더가 `ready` 로 갔고, 그래서 계약 쪽 타입을
 * 아무도 쓰지 않는 상태였다. 퍼져 있는 쪽에 맞춘다.
 */
export type PlotStage = 'empty' | 'seed' | 'growing' | 'ready'

/**
 * 경작지 상태.
 *
 * 씨앗 단계에서는 작물 종류를 플레이어에게 공개하지 않는다 (DEC-FARM-002).
 * 종류는 파종 시점에 이미 정해져 있으므로 cropId 는 채워 두고 **표시만** 감춘다.
 */
export interface PlotState {
  plotId: string
  stage: PlotStage
  /** stage 가 'empty' 면 null */
  cropId: string | null
  /** 현재 단계에서 흐른 시간. 재배 단계에서만 흐른다 (DEC-FARM-004) */
  stageElapsedSeconds: number
}

/**
 * 필드 위 개체의 공통 부분.
 *
 * `effects` 가 여기 있는 이유: DEC-CONTENT-013 은 전투 효과를 **재배 단계의 적대
 * 야생동물과 습격 단계의 적대 주민 양쪽에** 적용한다. 처음에 주민에만 달아 뒀는데,
 * 그러면 야생동물에게 둔화 무기를 던졌을 때 조용히 아무 일도 안 일어난다.
 */
export interface FieldEntity {
  /** 런 안에서 고유한 실행 ID. 콘텐츠 ID 가 아니다 */
  instanceId: string
  x: number
  y: number
  health: number
  effects: ActiveEffect[]
}

export interface WildlifeInstance extends FieldEntity {
  wildlifeId: string
  /** 노리고 있는 경작지. 없으면 플레이어를 쫓는다 */
  targetPlotId: string | null
}

export interface HostileResidentInstance extends FieldEntity {
  residentId: string
  /** 전투 전 대화 판정으로 확정된 보정 (DEC-CONTENT-009) */
  combatState: CombatState
}

/**
 * 진행 중인 전투 효과 (DEC-CONTENT-013).
 *
 * 같은 효과는 중첩하지 않는다. effect_rank 가 높은 쪽이 이기고,
 * 동급이면 최신으로 교체한다.
 */
export interface ActiveEffect {
  /** 이 효과를 건 투척 무기. 수치는 그 데이터에서 읽는다 */
  sourceThrowableId: string
  mechanicKey: 'damage_over_time' | 'movement_slow'
  effectRank: number
  remainingSeconds: number
  /** damage_over_time 의 다음 틱까지 남은 시간 */
  nextTickSeconds: number
}

export interface ProjectileInstance {
  instanceId: string
  /** 플레이어가 던진 것인지 주민이 쏜 것인지. 자해·아군 오사는 없다 (DEC-CONTENT-005) */
  source: 'player' | 'resident'
  /** source 에 따라 throwable_weapon.* 또는 발사한 주민의 combat_profile */
  sourceId: string
  x: number
  y: number
  velocityX: number
  velocityY: number
  /** 최대 사거리 판정용 누적 이동 거리 */
  travelledDistance: number
}

/**
 * 필드(재배 모드/습격 모드)의 시뮬레이션 상태.
 *
 * 대화가 열리면 이 전체가 정지한다. 정지 시점의 위치·체력·효과가 그대로
 * 복원돼야 하므로 여기 없는 곳에 전투 상태를 흘리지 않는다 (개발 로드맵 9-2).
 */
export interface FieldState {
  mode: 'farming' | 'raid'
  playerX: number
  playerY: number
  /** 마우스 커서 방향(라디안). 투척·낫의 기준이다 (DEC-INPUT-002) */
  aimAngle: number
  /** 낫 재사용 대기. 남은 시간이 0이면 사용 가능 */
  sickleCooldownSeconds: number

  plots: PlotState[]
  wildlife: WildlifeInstance[]
  /** 습격 모드에서 한 명 */
  hostiles: HostileResidentInstance[]
  projectiles: ProjectileInstance[]

  /** 재배 단계 제한시간의 남은 시간. 습격 모드에서는 null (DEC-RUN-004) */
  farmingRemainingSeconds: number | null
}
