// 런타임 JSON(generated/runtime/)의 타입.
//
// 이 파일은 손으로 쓴 설계가 아니라 schema/tables/*.json 에서 유도한 것이다.
// 스키마가 바뀌면 여기도 같이 바뀐다. 반대로 여기에 스키마에 없는 필드를 만들지 않는다.
// (DEC-PIPELINE-016 — 변경 가능한 게임 데이터의 단일 원본은 승인 데이터다)
//
// tools/build-runtime.mjs 가 만드는 형태를 그대로 따른다.
//
//   1. 테이블별 JSON 한 개 + manifest.json    generated/runtime/crops.json 등
//   2. 승인(approved) 행만 들어간다            content_status 는 런타임에 없다
//   3. 연결 CSV 는 부모 객체에 중첩된다        recipes[].inputs, endings[].conditions 등
//   4. 빈 칸은 null 이다                       필수 필드는 검증이 비어 있지 않음을 보장한다
//   5. 런타임 제외 열                          content_status, design_intent, source_fact_text
//
// 중첩된 자식 배열은 자식 행이 하나도 없으면 **속성 자체가 없다**. 그래서 전부 옵셔널이다.
// 로더가 `?? []` 로 뭉개지 말고, 있어야 하는데 없으면 검증 오류로 보고한다.
// (AGENTS.md 6절 — 데이터 누락을 코드 기본값으로 숨기지 않는다)

// ─────────────────────────────────────────────────────────────
// 고정 허용 목록 (schema/enums.json)
//
// 새 값의 추가는 데이터 행 추가가 아니라 시스템·스키마 변경이다.
// ─────────────────────────────────────────────────────────────

/** DEC-CONTENT-002 ~ DEC-CONTENT-019 */
export type Kind =
  | 'map'
  | 'crop_attribute'
  | 'crop'
  | 'material'
  | 'throwable_weapon'
  | 'recovery_item'
  | 'recipe'
  | 'wildlife'
  | 'wildlife_spawn_profile'
  | 'reward_bundle'
  | 'resident_personality_profile'
  | 'resident_combat_modifier'
  | 'resident_combat_profile'
  | 'resident_support_attack_profile'
  | 'resident'
  | 'story_scenario'
  | 'story_info'
  | 'dialogue_choice'
  | 'run_schedule'
  | 'fear_band'
  | 'ending'
  | 'player_base_stats'
  | 'raid_notice'
  | 'night_result_text'
  | 'fear_increment'
  // `schema/enums.json` 의 고정 목록에는 8/4부터 있었는데 여기만 빠져 있었다
  // (김민주 발견, 8/5). 튜토리얼 구현이 이 값을 읽는다 (DEC-CONTENT-025).
  | 'tutorial_step'

/** DEC-CONTENT-013 — 작물 속성이 전투에서 일으키는 효과 */
export type CombatMechanicKey = 'damage_over_time' | 'movement_slow'

/** DEC-CONTENT-009 */
export type DialoguePhase = 'precombat' | 'surrender'

/** DEC-CONTENT-009 — 전투 전 대화의 선택 기능 */
export type PrecombatChoiceFunction = 'empathy' | 'resource_negotiation' | 'threat'

/** DEC-CONTENT-009 — 투항 대화의 선택 기능 */
export type SurrenderChoiceFunction = 'recruit' | 'retreat_reward' | 'resume_combat'

export type ChoiceFunction = PrecombatChoiceFunction | SurrenderChoiceFunction

/** DEC-CONTENT-009 — 전투 전 대화 판정이 확정할 수 있는 결과 */
export type PrecombatSystemResultId =
  | 'system_result.precombat.resolve'
  | 'system_result.precombat.combat_weakened'
  | 'system_result.precombat.combat_normal'
  | 'system_result.precombat.combat_enraged'

/** DEC-CONTENT-009 — 투항 대화가 확정할 수 있는 결과 */
export type SurrenderSystemResultId =
  | 'system_result.surrender.recruit'
  | 'system_result.surrender.retreat_reward'
  | 'system_result.surrender.resume_combat'

export type SystemResultId = PrecombatSystemResultId | SurrenderSystemResultId

/** DEC-CONTENT-009 */
export type JudgementRuleId =
  | 'dialogue_judgement_rule.personality_choice'
  | 'dialogue_judgement_rule.personality_resource_offer'

/** DEC-CONTENT-009 — 주민 전투 상태 보정 */
export type CombatState = 'weakened' | 'normal' | 'enraged'

/** DEC-RESIDENT-052 — 주민 조우의 최종 결과. 조우 해결 시 정확히 한 번 확정한다 */
export type FinalOutcome =
  | 'empathy_resolve'
  | 'resource_negotiation_resolve'
  | 'recruited'
  | 'retreated'
  | 'killed'

/** DEC-CONTENT-008 */
export type AttackPatternKey = 'melee_chase' | 'ranged_chase'

/** DEC-CONTENT-007 — 야생동물이 무엇을 노리는가 */
export type TargetMode = 'crop_first' | 'player_only'

/** DEC-CONTENT-005 — 투척 무기 명중 판정 */
export type ImpactMode = 'direct' | 'area'

/** DEC-CONTENT-010 */
export type ResourceKind = 'money' | 'crop' | 'material' | 'throwable_weapon' | 'recovery_item'

/** DEC-CONTENT-010 — 자원 ID 자리에 오는 고정 통화 ID */
export type CurrencyId = 'currency.money'

/** DEC-CONTENT-015 — 제작 결과물 분류 */
export type ResultKind = 'throwable_weapon' | 'recovery_item'

/** DEC-CONTENT-015 — 제작 재료 분류 */
export type InputKind = 'crop' | 'material'

/** DEC-CONTENT-015 — 레시피 해금 방식 */
export type UnlockType = 'base' | 'crop_mastery'

/** DEC-CONTENT-002 — 그날 밤의 습격 종류 */
export type RaidType = 'none' | 'raid' | 'final_raid'

/** DEC-CONTENT-016 — 맵 위치의 역할 */
export type PointRole =
  | 'player_farming_start'
  | 'player_raid_start'
  | 'resident_spawn'
  | 'ally_support'
  | 'wildlife_spawn'

/** DEC-CONTENT-017 — 사연 정보의 공개 단계 */
export type InfoType = 'basic' | 'core'

/** DEC-CONTENT-011 — 엔딩 추가 조건의 종류 */
export type ConditionType =
  | 'relationship_count'
  | 'important_action_count'
  | 'specific_resident_relationship'
  | 'specific_resident_outcome'
  | 'dominant_crop'
  | 'dominant_crop_attribute'

/** DEC-CONTENT-011 — 엔딩 조건 비교 연산. AND 평가만 지원한다 */
export type Comparison = 'eq' | 'gte' | 'lte'

/** DEC-CONTENT-011 — relationship_count 가 세는 관계 상태 */
export type RelationshipCountSubject =
  | 'friendly'
  | 'trade'
  | 'companion'
  | 'coercive'
  | 'severed'

/** DEC-CONTENT-011 — important_action_count 가 세는 중요 행동 */
export type ImportantActionSubject =
  | 'empathy_resolve'
  | 'resource_negotiation_resolve'
  | 'resource_negotiation_rejected'
  | 'threat_selected'
  | 'surrender_recruit'
  | 'surrender_retreat_reward'
  | 'surrender_resume_combat'
  | 'resident_killed'

/** DEC-JOURNAL-003 — 일지 폴백을 고르는 공포도 변화 방향 */
export type JournalChangeDirection = 'up' | 'same' | 'down'

/** DEC-CONTENT-025 — 튜토리얼 안내가 붙는 단계 */
export type TutorialStage = 'farming' | 'combat' | 'maintenance'

/**
 * DEC-CONTENT-025 — 튜토리얼 안내를 넘기는 조작. **고정 일곱 개다.**
 *
 * 새 키가 필요하면 데이터 행 추가가 아니라 스키마·구현 변경으로 올린다.
 * 코드가 이 키를 판정하므로 여기 없는 값이 CSV 에 오면 아무도 그 안내를 넘길 수 없다.
 */
export type TutorialCompletionKey =
  | 'plant_crop'
  | 'harvest_crop'
  | 'use_sickle'
  | 'use_throwable'
  | 'sell_crop'
  | 'buy_material'
  | 'craft_item'
  | 'assign_quickslot'

/**
 * DEC-ART-001 — 콘텐츠에 붙는 논리 에셋의 역할.
 *
 * `content_assets.csv` 의 `asset_role` 이자 논리 에셋 ID `asset.<구간>.<이름>` 의
 * 구간이다. 둘은 같은 값을 쓴다. UI·시스템 에셋은 어떤 콘텐츠에도 속하지 않아
 * 이 목록이 아니라 `schema/enums.json` 의 `ui_system_asset_id` 고정 목록으로 간다.
 */
export type AssetRole =
  | 'field_sprite'
  | 'farm_plot'
  | 'crop_seed'
  | 'crop_growing'
  | 'crop_ready'
  | 'icon'
  | 'portrait'
  | 'projectile'
  | 'effect'
  | 'background'
  | 'cutscene'
  | 'sfx'
  | 'bgm'

/**
 * 콘텐츠 행에 중첩되는 논리 에셋 ID 묶음.
 *
 * **`content_assets.json` 은 만들어지지 않는다.** 연결 CSV 라 부모 행 안에
 * `assets` 객체로 들어간다 (`maps.json`·`crops.json` 등). 붙은 역할만 키로 있으므로
 * 전부 옵셔널이며, 없는 역할을 코드가 기본 경로로 메우지 않는다.
 */
export type ContentAssets = Partial<Record<AssetRole, string>>

// ─────────────────────────────────────────────────────────────
// 공통 콘텐츠 열 (schema/common_entry.json, DEC-CONTENT-001)
// ─────────────────────────────────────────────────────────────

/**
 * 독립 콘텐츠 CSV가 공통으로 가지는 열 중 런타임에 남는 것.
 *
 * content_status 와 design_intent 는 작성·승인 관리용이라 런타임 JSON에 없다.
 * display_name 은 콘텐츠 담당자의 내부 식별명이며 **플레이어에게 보여주는 이름이 아니다**
 * (엔딩은 ending_title 이 표시용이다 — DEC-CONTENT-011).
 */
export interface CommonEntry {
  /** `<kind>.<이름>` 형식. ID 첫 구간은 kind 와 일치한다 */
  id: string
  kind: Kind
  content_version: number
  display_name: string
}

/** 연결 CSV는 공통 열을 반복하지 않는다. 부모 객체에 중첩되어 들어온다 */
export interface LinkEntry {
  [field: string]: unknown
}

// ─────────────────────────────────────────────────────────────
// 맵 (DEC-CONTENT-016)
// ─────────────────────────────────────────────────────────────

export interface MapPoint extends LinkEntry {
  map_id: string
  point_id: string
  point_role: PointRole
  x: number
  y: number
}

export interface FarmPlot extends LinkEntry {
  map_id: string
  plot_id: string
  x: number
  y: number
}

export interface WorldMap extends CommonEntry {
  kind: 'map'
  world_width: number
  world_height: number
  /** E 상호작용이 닿는 거리. farm_plots 의 x/y 와 같은 월드 좌표계다 */
  farm_interaction_radius: number
  wildlife_spawn_edge_margin: number
  wildlife_spawn_min_player_distance: number

  points?: MapPoint[]
  farm_plots?: FarmPlot[]

  /**
   * 맵에 붙은 논리 에셋 (`background`·`farm_plot`·`crop_seed`).
   *
   * **씨앗은 작물이 아니라 맵에 하나만 있다.** `DEC-ART-001` 이 "씨앗은 종류를
   * 공개하지 않으므로 작물별로 두지 않는다"로 확정해서, 네 작물이 전부 이 한 장을
   * 가리킨다. `crops[].assets` 에는 `crop_growing`·`crop_ready` 둘뿐이다.
   */
  assets?: ContentAssets
}

// ─────────────────────────────────────────────────────────────
// 작물 (DEC-CONTENT-003, DEC-CONTENT-013)
// ─────────────────────────────────────────────────────────────

/**
 * 작물 속성 (DEC-CONTENT-013).
 *
 * `assets.icon` 은 속성 아이콘이다. 확정문이 "색상·아이콘과 이펙트 파일은 공통 에셋
 * 연결 CSV 에서 논리 에셋 ID 로 관리한다"로 정했고, 그래서 `crop_attributes.csv` 가
 * 8/6 에 에셋 연결 CSV 의 부모 후보에 들어갔다.
 */
export interface CropAttribute extends CommonEntry {
  kind: 'crop_attribute'
  player_description: string
  combat_mechanic_key: CombatMechanicKey
  ending_prompt_summary: string

  /** 속성 아이콘 (`icon`) */
  assets?: ContentAssets
}

export interface Crop extends CommonEntry {
  kind: 'crop'
  /** 파종 추첨 가중치. 0이면 뽑히지 않는다 (DEC-FARM-002) */
  spawn_weight: number
  seed_duration_seconds: number
  growth_duration_seconds: number
  base_yield: number
  sell_price: number
  is_raw_edible: boolean
  /** is_raw_edible 이 false 면 null */
  raw_heal_amount: number | null
  raw_use_duration_seconds: number | null
  raw_move_speed_multiplier: number | null
  crop_attribute_id: string

  /**
   * 작물에 붙은 논리 에셋 (`crop_growing`·`crop_ready`).
   *
   * 씨앗 단계는 여기 없다 — 맵 쪽 `crop_seed` 한 장을 공용으로 쓴다 (DEC-ART-001).
   */
  assets?: ContentAssets
}

// ─────────────────────────────────────────────────────────────
// 아이템·제작 (DEC-CONTENT-004, 005, 006, 015)
// ─────────────────────────────────────────────────────────────

export interface CraftingMaterial extends CommonEntry {
  kind: 'material'
  player_description: string
  buy_price: number

  /**
   * 이 재료를 쓰는 레시피의 결과 분류. CSV에 저장하지 않고 생성기가 역산한다
   * (DEC-CONTENT-004). recipes.csv 가 승인되지 않았으면 속성이 없다.
   */
  used_by?: ResultKind[]

  /** 재료 아이콘 (`icon`) */
  assets?: ContentAssets
}

export interface ThrowableWeapon extends CommonEntry {
  kind: 'throwable_weapon'
  player_description: string
  crop_attribute_id: string
  base_damage: number
  projectile_speed: number
  max_range: number
  cooldown_seconds: number
  collision_radius: number
  impact_mode: ImpactMode
  /** impact_mode 가 'direct' 면 null */
  area_radius: number | null

  /** 같은 효과가 겹칠 때 우선순위. 동급이면 최신으로 교체한다 (DEC-CONTENT-013) */
  effect_rank: number
  effect_duration_seconds: number
  /** combat_mechanic_key 가 damage_over_time 인 속성에서만 채워진다 */
  effect_damage_per_tick: number | null
  effect_tick_interval_seconds: number | null
  /** combat_mechanic_key 가 movement_slow 인 속성에서만 채워진다 */
  effect_move_speed_multiplier: number | null

  /**
   * 투척 무기에 붙은 논리 에셋 (`icon`·`projectile`).
   *
   * `projectile` 은 날아가는 동안의 그림이고 `icon` 은 보관함·퀵슬롯·목록의 그림이다.
   */
  assets?: ContentAssets
}

export interface RecoveryItem extends CommonEntry {
  kind: 'recovery_item'
  player_description: string
  heal_amount: number
  use_duration_seconds: number
  /** 회복 사용 중 이동속도 배율 (DEC-INPUT-008) */
  move_speed_multiplier: number

  /** 회복 아이템 아이콘 (`icon`) */
  assets?: ContentAssets
}

export interface RecipeInput extends LinkEntry {
  recipe_id: string
  input_kind: InputKind
  /** input_kind 에 따라 crop.* 또는 material.* */
  input_id: string
  quantity: number
}

/** 레시피당 최대 하나. 배열이 아니라 단일 객체로 중첩된다 */
export interface CropMasteryUnlock extends LinkEntry {
  recipe_id: string
  crop_id: string
  required_mastery: number
}

export interface Recipe extends CommonEntry {
  kind: 'recipe'
  result_kind: ResultKind
  /** result_kind 에 따라 throwable_weapon.* 또는 recovery_item.* */
  result_id: string
  result_quantity: number
  unlock_type: UnlockType

  inputs?: RecipeInput[]
  /** unlock_type 이 'crop_mastery' 일 때만 존재한다 */
  mastery_unlock?: CropMasteryUnlock
}

// ─────────────────────────────────────────────────────────────
// 야생동물 (DEC-CONTENT-007)
// ─────────────────────────────────────────────────────────────

export interface Wildlife extends CommonEntry {
  kind: 'wildlife'
  max_health: number
  move_speed: number
  collision_radius: number
  attack_damage: number
  attack_range: number
  attack_windup_seconds: number
  attack_cooldown_seconds: number
  crop_eat_duration_seconds: number
  target_mode: TargetMode

  /** 야생동물에 붙은 논리 에셋 (`field_sprite`·`icon`) */
  assets?: ContentAssets
}

export interface WildlifeSpawnEntry extends LinkEntry {
  wildlife_spawn_profile_id: string
  wildlife_id: string
  spawn_weight: number
}

export interface WildlifeSpawnProfile extends CommonEntry {
  kind: 'wildlife_spawn_profile'
  first_spawn_delay_seconds: number
  spawn_interval_seconds: number
  max_concurrent: number
  total_spawn_limit: number

  entries?: WildlifeSpawnEntry[]
}

// ─────────────────────────────────────────────────────────────
// 보상 묶음 (DEC-CONTENT-010, DEC-RESIDENT-042)
// ─────────────────────────────────────────────────────────────

export interface RewardBundleEntry extends LinkEntry {
  reward_bundle_id: string
  resource_kind: ResourceKind
  /** resource_kind 가 'money' 면 CurrencyId, 아니면 해당 분류의 콘텐츠 ID */
  resource_id: string | CurrencyId
  quantity: number
}

export interface RewardBundle extends CommonEntry {
  kind: 'reward_bundle'
  entries?: RewardBundleEntry[]
}

// ─────────────────────────────────────────────────────────────
// 주민 (DEC-CONTENT-008, 009, DEC-RESIDENT-049)
// ─────────────────────────────────────────────────────────────

/**
 * 성격 프로필 × 선택 기능 → 사전 승인된 결과.
 *
 * 판정은 선택지 **문장**이 아니라 이 표를 조회해서 한다 (DEC-RESIDENT-049).
 * 자연어를 런타임에 해석하지 않는다.
 */
export interface PersonalityChoiceOutcome extends LinkEntry {
  personality_profile_id: string
  choice_function: PrecombatChoiceFunction
  /** 선택을 실제로 사용할 수 있을 때의 결과 */
  result_when_available_id: PrecombatSystemResultId
  /**
   * 조건 미달로 선택을 사용할 수 없을 때의 결과.
   * 자원 협상처럼 사용 조건이 있는 기능에서만 채워진다. `resolve` 는 올 수 없다.
   */
  result_when_unavailable_id: Exclude<
    PrecombatSystemResultId,
    'system_result.precombat.resolve'
  > | null
}

export interface ResidentPersonalityProfile extends CommonEntry {
  kind: 'resident_personality_profile'
  /** 세 선택 기능(empathy·resource_negotiation·threat)에 하나씩 정확히 정의된다 */
  choice_outcomes?: PersonalityChoiceOutcome[]
}

export interface ResidentCombatModifier extends CommonEntry {
  kind: 'resident_combat_modifier'
  combat_state: CombatState
  max_health_multiplier: number
  move_speed_multiplier: number
  attack_damage_multiplier: number
  attack_cooldown_multiplier: number
}

export interface ResidentCombatProfile extends CommonEntry {
  kind: 'resident_combat_profile'
  max_health: number
  move_speed: number
  collision_radius: number
  attack_pattern_key: AttackPatternKey
  attack_damage: number
  attack_range: number
  attack_cooldown_seconds: number

  /** attack_pattern_key 가 'ranged_chase' 일 때만 채워진다 */
  projectile_speed: number | null
  projectile_radius: number | null
  /** 채워지면 attack_range 이상이어야 한다 (DEC-CONTENT-008) */
  projectile_max_range: number | null

  /** 최대 체력 대비 투항 발동 비율 (DEC-RESIDENT-016) */
  surrender_health_ratio: number
  retreat_reward_bundle_id: string
  kill_reward_bundle_id: string
}

export interface ResidentSupportAttackProfile extends CommonEntry {
  kind: 'resident_support_attack_profile'
  damage: number
  first_attack_delay_seconds: number
  attack_interval_seconds: number
}

export interface Resident extends CommonEntry {
  kind: 'resident'
  /** 표시·프롬프트용 자연어. 판정 입력이 아니다 (DEC-RESIDENT-049) */
  personality_summary: string
  combat_archetype_summary: string
  negotiation_tendency_summary: string

  personality_profile_id: string
  combat_profile_id: string
  support_attack_profile_id: string

  /**
   * 주민에게 붙은 논리 에셋 (`field_sprite`·`portrait`·`projectile`).
   *
   * `projectile` 은 **이 주민이 쏘는 투사체**다. 전투 프로필이 아니라 주민에 붙는
   * 이유는 `resident_combat_profiles.csv` 가 에셋 연결 CSV 의 부모 후보가 아니고
   * 쏘는 주체가 주민이기 때문이다 (만복의 엽전).
   */
  assets?: ContentAssets

  /**
   * 이 주민의 승인 사연 시나리오 ID 목록. CSV에 역참조를 저장하지 않고
   * 생성기가 story_scenarios 에서 역산한다 (DEC-RESIDENT-051).
   */
  story_scenario_ids?: string[]
}

// ─────────────────────────────────────────────────────────────
// 사연·대화 (DEC-CONTENT-017, DEC-CONTENT-009)
// ─────────────────────────────────────────────────────────────

export interface StoryInfo extends CommonEntry {
  kind: 'story_info'
  scenario_id: string
  info_type: InfoType
  /**
   * source_fact_text 는 숨겨진 설정 원본이라 런타임 JSON에 없다 (DEC-CONTENT-017).
   * 게임 화면과 엔딩 LLM 입력에는 ending_fact_text 만 전달한다.
   */
  ending_fact_text: string
}

export interface StoryScenario extends CommonEntry {
  kind: 'story_scenario'
  resident_id: string
  scenario_summary: string
  precombat_opening_text: string
  precombat_opening_story_info_id: string
  surrender_opening_text: string
  surrender_opening_story_info_id: string
}

export interface DialogueChoiceResponse extends LinkEntry {
  choice_id: string
  system_result_id: SystemResultId
  reaction_text: string
  /** 이 결과로 공개되는 사연 정보. 없으면 null */
  revealed_story_info_id: string | null
}

export interface DialogueChoice extends CommonEntry {
  kind: 'dialogue_choice'
  scenario_id: string
  dialogue_phase: DialoguePhase
  choice_function: ChoiceFunction
  choice_text: string

  /** 전투 전 대화는 성격 프로필을 조회해 판정한다 */
  judgement_rule_id: JudgementRuleId | null
  /** 투항 대화는 판정 없이 결과가 정해져 있다 (DEC-RESIDENT-019) */
  direct_system_result_id: SurrenderSystemResultId | null
  /** choice_function 이 'resource_negotiation' 일 때만 채워진다 (DEC-RESIDENT-050) */
  resource_offer_quantity: number | null

  /**
   * 결과별 반응 대사. 연결 CSV 라 부모에 중첩된다 (DEC-PIPELINE-010).
   *
   * 생성기는 처음부터 이렇게 내보내고 있었는데 이 타입에만 빠져 있었다.
   * 타입에 없으면 다음 사람이 "반응 대사는 따로 읽어야 하나" 하고 없는 경로를 찾는다.
   */
  responses?: DialogueChoiceResponse[]
}

// ─────────────────────────────────────────────────────────────
// 런 일정 (DEC-CONTENT-002)
// ─────────────────────────────────────────────────────────────

export interface RunScheduleDay extends LinkEntry {
  run_schedule_id: string
  day_number: number
  /** 그날 재배 단계의 야생동물 스폰. 없으면 null */
  wildlife_spawn_profile_id: string | null
  raid_type: RaidType
  /** raid_type 이 'none' 이면 null */
  hostile_resident_id: string | null
}

export interface RunSchedule extends CommonEntry {
  kind: 'run_schedule'
  map_id: string
  total_days: number
  /** 재배 단계 제한시간 (DEC-RUN-004) */
  farming_duration_seconds: number

  days?: RunScheduleDay[]
}

// ─────────────────────────────────────────────────────────────
// 공포도·엔딩·일지 (DEC-CONTENT-011, DEC-JOURNAL-003)
// ─────────────────────────────────────────────────────────────

export interface JournalFallback extends LinkEntry {
  fear_band_id: string
  change_direction: JournalChangeDirection
  fallback_journal_text: string
}

/**
 * 행동별 공포도 증가량 (DEC-RESIDENT-048).
 *
 * `cause` 는 `ImportantActionSubject` 중 공포도를 올리는 셋만 쓴다. 짧은 별칭을
 * 만들지 않는다 — `ending_conditions.csv` 가 같은 행동을 그 키로 가리킨다.
 */
export interface FearIncrement extends CommonEntry {
  kind: 'fear_increment'
  cause: 'threat_selected' | 'surrender_retreat_reward' | 'resident_killed'
  fear_amount: number
}

export interface FearBand extends CommonEntry {
  kind: 'fear_band'
  min_fear: number
  /** 가장 높은 구간만 null(상한 없음)이다 */
  max_fear: number | null
  ending_prompt_summary: string

  journal_fallbacks?: JournalFallback[]
}

export interface EndingCondition extends LinkEntry {
  ending_id: string
  condition_id: string
  condition_type: ConditionType
  /**
   * condition_type 에 따라 의미가 다르다.
   * relationship_count → RelationshipCountSubject
   * important_action_count → ImportantActionSubject
   * specific_resident_* → resident.* ID
   * dominant_crop* → 사용하지 않음(null)
   */
  subject_key: string | null
  comparison: Comparison
  /** 숫자 비교도 문자열로 들어온다. 조건 종류에 맞춰 해석한다 */
  target_value: string
}

export interface Ending extends CommonEntry {
  kind: 'ending'
  /** 전역 폴백 엔딩만 null */
  fear_band_id: string | null
  /** 조건 없는 기본 엔딩과 전역 폴백은 0, 조건 엔딩은 1 이상 */
  selection_priority: number
  /** 플레이어에게 표시할 확정 제목. display_name 은 내부 식별명이다 */
  ending_title: string
  ending_summary: string
  ending_prompt_direction: string
  /** LLM을 쓸 수 없을 때 그대로 표시하는 완성 문장 (DEC-JOURNAL-003) */
  fallback_record_text: string
  /** 정확히 하나만 true */
  is_global_fallback: boolean

  conditions?: EndingCondition[]
}

// ─────────────────────────────────────────────────────────────
// 플레이어 기본 수치 (DEC-CONTENT-019)
// ─────────────────────────────────────────────────────────────

/**
 * 승인 행은 정확히 하나다. 이 값들은 런 중 변하지 않는 **원본**이며
 * 현재 체력·위치 같은 런타임 상태를 여기에 섞지 않는다.
 *
 * 여러 시스템이 각자 읽지 않고 src/data/run-config.ts 한 통로로만 노출한다.
 */
export interface PlayerBaseStats extends CommonEntry {
  kind: 'player_base_stats'
  max_health: number
  starting_money: number
  /** 대각선 보정의 기준값 (DEC-INPUT-002) */
  move_speed: number
  collision_radius: number
  /** 낫은 수량 제한이 없는 기본 근접 무기다 (DEC-INPUT-004) */
  sickle_damage: number
  sickle_range: number
  sickle_cooldown_seconds: number

  /**
   * 플레이어에게 붙은 논리 에셋 (`field_sprite`·`portrait`).
   *
   * 플레이어는 콘텐츠 테이블이 따로 없어서 이 표가 유일한 자리다 —
   * 그래서 `player_base_stats.csv` 가 에셋 연결 CSV 의 부모 후보에 들어갔다
   * (아트 디렉션 14.7).
   */
  assets?: ContentAssets
}

// ─────────────────────────────────────────────────────────────
// 화면 고정 문구 (DEC-CONTENT-021)
// ─────────────────────────────────────────────────────────────

/**
 * 습격 예고 문구 (DEC-RUN-011).
 *
 * 승인 행은 `raid_type` 세 값마다 정확히 하나씩이다. `opening_text` 는 일차 시작
 * 연출용 문장, `hud_label` 은 재배 HUD·정비 허브용 짧은 표지이며 둘 다 필수다.
 */
export interface RaidNotice extends CommonEntry {
  kind: 'raid_notice'
  raid_type: RaidType
  opening_text: string
  hud_label: string
}

/**
 * 밤 결과 고정 문구 (DEC-RUN-015, DEC-UI-023).
 *
 * 밤 결과 화면은 그날의 실제 기록을 담지 않고 이 문구만 표시한다.
 * **여러 행 중 무엇을 고를지는 `DEC-CONTENT-018` 보류라 정해지지 않았다.**
 * 그래서 승인 행이 하나일 때만 화면이 그것을 쓴다 (ui/night-result.ts).
 */
export interface NightResultText extends CommonEntry {
  kind: 'night_result_text'
  text: string
}

// ─────────────────────────────────────────────────────────────
// 튜토리얼 (DEC-CONTENT-025, DEC-UI-030, DEC-RUN-003)
// ─────────────────────────────────────────────────────────────

/**
 * 튜토리얼 안내 한 단계.
 *
 * `guide_text` 는 승인 데이터에서만 온다 — `DEC-UI-030` 가 안내 문구를 코드에
 * 두는 것을 금지했다. `completion_key` 는 고정 일곱 개이며 코드가 판정한다.
 * `step_order` 는 1부터 빈틈 없이 이어지고 세 단계가 모두 한 번은 나온다
 * (스키마 규칙 `step_order_sequential`·`covers_all_stages`).
 */
export interface TutorialStep extends CommonEntry {
  kind: 'tutorial_step'
  step_order: number
  stage: TutorialStage
  completion_key: TutorialCompletionKey
  guide_text: string
}

// ─────────────────────────────────────────────────────────────
// 매니페스트와 전체 묶음
// ─────────────────────────────────────────────────────────────

/**
 * generated/runtime/manifest.json.
 *
 * 버전은 콘텐츠 행마다 반복하지 않고 여기 한 번만 기록한다 (DEC-PIPELINE-012).
 */
export interface RuntimeManifest {
  schema_version: number
  ending_input_schema_version: number
  ending_prompt_version: number
  journal_prompt_version: number
  /** 실제로 생성된 테이블 JSON 파일 이름. 승인 행이 0개면 파일이 없다 */
  files: string[]
}

/**
 * 로더가 채우는 전체 런타임 데이터.
 *
 * 모든 테이블이 옵셔널인 이유는 승인 행이 하나도 없으면 파일이 아예 안 만들어지기 때문이다.
 * **없는 것을 기본값으로 메우지 않는다.** 그 단계에 필요한 테이블이 비어 있으면
 * 데이터 오류로 보고한다 (DEC-UI-024, AGENTS.md 6절).
 */
export interface RuntimeData {
  manifest: RuntimeManifest

  maps?: WorldMap[]
  crop_attributes?: CropAttribute[]
  crops?: Crop[]
  crafting_materials?: CraftingMaterial[]
  throwable_weapons?: ThrowableWeapon[]
  recovery_items?: RecoveryItem[]
  recipes?: Recipe[]
  wildlife?: Wildlife[]
  wildlife_spawn_profiles?: WildlifeSpawnProfile[]
  reward_bundles?: RewardBundle[]
  resident_personality_profiles?: ResidentPersonalityProfile[]
  resident_combat_modifiers?: ResidentCombatModifier[]
  resident_combat_profiles?: ResidentCombatProfile[]
  resident_support_attack_profiles?: ResidentSupportAttackProfile[]
  residents?: Resident[]
  story_scenarios?: StoryScenario[]
  story_infos?: StoryInfo[]
  dialogue_choices?: DialogueChoice[]
  run_schedules?: RunSchedule[]
  fear_bands?: FearBand[]
  endings?: Ending[]
  player_base_stats?: PlayerBaseStats[]
  raid_notices?: RaidNotice[]
  night_result_texts?: NightResultText[]
  fear_increments?: FearIncrement[]
  tutorial_steps?: TutorialStep[]
}

/** RuntimeData 에서 테이블 이름만 뽑은 것. 로더가 적재 대상을 순회할 때 쓴다 */
export type RuntimeTableName = Exclude<keyof RuntimeData, 'manifest'>
