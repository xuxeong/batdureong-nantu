// 표별 교차 규칙
//
// 스키마 rules[].id 하나에 함수 하나를 대응시킨다.
// 여기에 없는 rule id 는 validate 가 "미구현"으로 보고한다. 조용히 넘어가지 않는다.
//
// 필드 정의만으로 되는 검사(자료형·범위·조건부 필수·참조·복합키)는 checks.mjs 가
// 이미 수행하므로 여기서 다시 하지 않는다.

const APPROVED = 'approved'

/**
 * checks.mjs 의 필드 정의 검사가 이미 수행하는 규칙.
 * 자료형·범위·조건부 필수·복합 고유키·참조·열거형에서 자동으로 나온다.
 */
export const COVERED_BY_FIELD_CHECKS = new Set([
  // 자료형·범위
  'map.positive_dimensions',
  'material.positive_price',
  'wildlife.value_ranges',
  'wildlife_spawn_profile.value_ranges',
  'recovery_item.value_ranges',
  'support_profile.value_ranges',
  'combat_modifier.positive_multipliers',
  'resident_combat_profile.surrender_ratio_range',
  'resident.required_summaries',
  'crop_attribute.implemented_mechanic_key',
  // 조건부 필수 / 비움
  'crop.raw_edible_conditional_fields',
  'throwable_weapon.effect_fields_match_mechanic',
  'resident_combat_profile.projectile_fields_match_pattern',
  'run_schedule_days.raid_requires_resident',
  'personality_choice_outcomes.unavailable_only_for_negotiation',
  'dialogue_choice.phase_field_combination',
  // 복합 고유키
  'recipe_inputs.no_duplicate_pair',
  'wildlife_spawn_entries.no_duplicate_pair',
  'dialogue_choice_responses.no_duplicate_pair',
  'reward_bundle_entries.no_duplicate_resource',
  // 참조 존재·승인 상태
  'reward_bundle_entries.approved_resource',
  'resident_combat_profile.both_reward_bundles',
  'journal_fallbacks.parent_approved',
  // 열거형
  'reward_bundle_entries.no_state_reward',
  // 헤더 검사 (스키마에 없는 열 차단)
  'resident.no_list_reference',
])

/**
 * CSV 단계에서는 검사할 수 없고 런타임 데이터 생성 단계에서 보장하는 규칙.
 * tools/build-runtime.mjs 가 담당한다.
 */
export const ENFORCED_AT_RUNTIME = new Set([
  // source_fact_text 는 런타임 JSON과 LLM 입력에 넣지 않는다
  'story_info.source_not_exposed',
  // 전투 전 대화 블록에서 투항 블록으로 가는 연결을 만들지 않는다.
  // 스키마에 그런 열 자체가 없어 CSV에는 표현할 수단이 없다.
  'dialogue_choice.no_direct_surrender_link',
])

/** 검사용 도우미 */
function helpers(dataset) {
  const rows = (file) => dataset.tables.get(file)?.records ?? []
  const approved = (file) =>
    rows(file).filter((r) => (r.cells.content_status ?? '').trim() === APPROVED)
  const num = (r, f) => Number((r.cells[f] ?? '').trim())
  const val = (r, f) => (r.cells[f] ?? '').trim()
  return { rows, approved, num, val }
}

/**
 * rule id → (ctx) => void
 * ctx: { report, schema, dataset, h }
 */
export const RULES = {
  // ── 맵 ────────────────────────────────────────────────────────────────
  'map.exactly_one_approved'({ report, h }) {
    const n = h.approved('maps.csv').length
    if (n !== 1) {
      report.block({
        file: 'maps.csv',
        problem: `승인 맵이 ${n}개다. 정확히 하나여야 한다`,
        basis: 'DEC-CONTENT-016',
        fix: n === 0 ? '맵 하나를 approved 로 승인한다' : '하나만 남기고 나머지를 retired 로 바꾼다',
      })
    }
  },

  'player_base_stats.exactly_one_approved'({ report, h }) {
    const n = h.approved('player_base_stats.csv').length
    if (n !== 1) {
      report.block({
        file: 'player_base_stats.csv',
        problem: `승인 플레이어 기본 수치가 ${n}개다. 정확히 하나여야 한다`,
        basis: 'DEC-CONTENT-019',
        fix: n === 0 ? '수치 행 하나를 approved 로 승인한다' : '하나만 남기고 나머지를 retired 로 바꾼다',
      })
    }
  },

  'map.has_farm_plot'({ report, h }) {
    for (const map of h.approved('maps.csv')) {
      const id = h.val(map, 'id')
      const plots = h.rows('farm_plots.csv').filter((r) => h.val(r, 'map_id') === id)
      if (plots.length === 0) {
        report.block({
          file: 'maps.csv',
          line: map.lineNumber,
          problem: `맵 \`${id}\` 에 경작지가 없다`,
          basis: 'DEC-CONTENT-016 · 맵에는 경작지가 1개 이상 있어야 한다',
          fix: 'farm_plots.csv 에 경작지를 추가한다',
        })
      }
    }
  },

  'map.has_valid_wildlife_spawn'({ report, h }) {
    for (const map of h.approved('maps.csv')) {
      const id = h.val(map, 'id')
      const points = h.rows('map_points.csv').filter((r) => h.val(r, 'map_id') === id)
      const spawns = points.filter((r) => h.val(r, 'point_role') === 'wildlife_spawn')
      const start = points.find((r) => h.val(r, 'point_role') === 'player_farming_start')
      if (!start) continue

      const w = h.num(map, 'world_width')
      const hgt = h.num(map, 'world_height')
      const margin = h.num(map, 'wildlife_spawn_edge_margin')
      const minDist = h.num(map, 'wildlife_spawn_min_player_distance')
      const sx = h.num(start, 'x')
      const sy = h.num(start, 'y')

      const valid = spawns.filter((p) => {
        const x = h.num(p, 'x')
        const y = h.num(p, 'y')
        const onEdge = x <= margin || x >= w - margin || y <= margin || y >= hgt - margin
        const far = Math.hypot(x - sx, y - sy) >= minDist
        return onEdge && far
      })

      if (valid.length === 0) {
        report.block({
          file: 'maps.csv',
          line: map.lineNumber,
          problem: `맵 \`${id}\` 에 외곽 조건과 안전거리를 모두 만족하는 야생동물 출현 지점이 없다`,
          basis: 'DEC-CONTENT-016',
          fix: 'wildlife_spawn 지점을 맵 가장자리로 옮기거나 wildlife_spawn_min_player_distance 를 줄인다',
        })
      }
    }
  },

  'map_points.required_role_counts'({ report, h }) {
    const once = ['player_farming_start', 'player_raid_start', 'resident_spawn', 'ally_support']
    for (const map of h.approved('maps.csv')) {
      const id = h.val(map, 'id')
      const points = h.rows('map_points.csv').filter((r) => h.val(r, 'map_id') === id)

      for (const role of once) {
        const n = points.filter((r) => h.val(r, 'point_role') === role).length
        if (n !== 1) {
          report.block({
            file: 'map_points.csv',
            problem: `맵 \`${id}\` 의 \`${role}\` 지점이 ${n}개다. 정확히 하나여야 한다`,
            basis: 'DEC-CONTENT-016',
            fix: n === 0 ? `${role} 지점을 추가한다` : '하나만 남긴다',
          })
        }
      }

      const spawns = points.filter((r) => h.val(r, 'point_role') === 'wildlife_spawn').length
      if (spawns === 0) {
        report.block({
          file: 'map_points.csv',
          problem: `맵 \`${id}\` 에 wildlife_spawn 지점이 없다. 1개 이상이어야 한다`,
          basis: 'DEC-CONTENT-016',
          fix: 'wildlife_spawn 지점을 추가한다',
        })
      }
    }
  },

  'map_points.coordinate_in_bounds': coordinateInBounds('map_points.csv'),
  'farm_plots.coordinate_in_bounds': coordinateInBounds('farm_plots.csv'),

  'map_points.wildlife_spawn_on_edge'({ report, h }) {
    for (const map of h.approved('maps.csv')) {
      const id = h.val(map, 'id')
      const w = h.num(map, 'world_width')
      const hgt = h.num(map, 'world_height')
      const margin = h.num(map, 'wildlife_spawn_edge_margin')

      for (const p of h.rows('map_points.csv')) {
        if (h.val(p, 'map_id') !== id) continue
        if (h.val(p, 'point_role') !== 'wildlife_spawn') continue
        const x = h.num(p, 'x')
        const y = h.num(p, 'y')
        const onEdge = x <= margin || x >= w - margin || y <= margin || y >= hgt - margin
        if (!onEdge) {
          report.block({
            file: 'map_points.csv',
            line: p.lineNumber,
            problem: `wildlife_spawn 지점이 맵 외곽이 아니다 (${x}, ${y})`,
            basis: 'DEC-CONTENT-016',
            fix: `x ≤ ${margin} 또는 x ≥ ${w - margin} 또는 y ≤ ${margin} 또는 y ≥ ${hgt - margin}`,
          })
        }
      }
    }
  },

  'map_points.wildlife_spawn_player_distance'({ report, h }) {
    for (const map of h.approved('maps.csv')) {
      const id = h.val(map, 'id')
      const points = h.rows('map_points.csv').filter((r) => h.val(r, 'map_id') === id)
      const start = points.find((r) => h.val(r, 'point_role') === 'player_farming_start')
      if (!start) continue
      const minDist = h.num(map, 'wildlife_spawn_min_player_distance')
      const sx = h.num(start, 'x')
      const sy = h.num(start, 'y')

      for (const p of points) {
        if (h.val(p, 'point_role') !== 'wildlife_spawn') continue
        const d = Math.hypot(h.num(p, 'x') - sx, h.num(p, 'y') - sy)
        if (d < minDist) {
          report.block({
            file: 'map_points.csv',
            line: p.lineNumber,
            problem: `재배 시작점과의 거리가 ${d.toFixed(2)} 로 최소 거리 ${minDist} 보다 가깝다`,
            basis: 'DEC-CONTENT-016',
            fix: '출현 지점을 더 멀리 옮긴다',
          })
        }
      }
    }
  },

  'map_points.start_position_overlap'({ report, h }) {
    const roles = ['player_farming_start', 'player_raid_start', 'resident_spawn', 'ally_support']
    const byPos = new Map()
    for (const p of h.rows('map_points.csv')) {
      if (!roles.includes(h.val(p, 'point_role'))) continue
      const key = `${h.val(p, 'map_id')}@${h.val(p, 'x')},${h.val(p, 'y')}`
      if (!byPos.has(key)) byPos.set(key, [])
      byPos.get(key).push(p)
    }
    for (const [, list] of byPos) {
      if (list.length > 1) {
        report.warn({
          file: 'map_points.csv',
          line: list[0].lineNumber,
          problem: `시작 위치가 겹친다: ${list.map((p) => h.val(p, 'point_role')).join(', ')}`,
          basis: 'DEC-CONTENT-016',
          fix: '좌표를 다르게 둔다',
        })
      }
    }
  },

  'farm_plots.at_least_one'({ report, h }) {
    if (h.rows('farm_plots.csv').length === 0 && h.approved('maps.csv').length > 0) {
      report.block({
        file: 'farm_plots.csv',
        problem: '경작지가 하나도 없다',
        basis: 'DEC-CONTENT-016 · 맵에는 경작지가 1개 이상 있어야 한다',
        fix: '경작지를 추가한다',
      })
    }
  },

  'farm_plots.duplicate_coordinate'({ report, h }) {
    const seen = new Map()
    for (const p of h.rows('farm_plots.csv')) {
      const key = `${h.val(p, 'map_id')}@${h.val(p, 'x')},${h.val(p, 'y')}`
      if (seen.has(key)) {
        report.warn({
          file: 'farm_plots.csv',
          line: p.lineNumber,
          problem: `경작지 좌표가 ${seen.get(key)}행과 겹친다`,
          basis: 'DEC-CONTENT-016',
          fix: '좌표를 다르게 둔다',
        })
      } else {
        seen.set(key, p.lineNumber)
      }
    }
  },

  // ── 작물 ──────────────────────────────────────────────────────────────
  'crop.pool_has_positive_weight'({ report, h }) {
    const crops = h.approved('crops.csv')
    if (crops.length === 0) return
    if (!crops.some((c) => h.num(c, 'spawn_weight') >= 1)) {
      report.block({
        file: 'crops.csv',
        problem: 'spawn_weight 가 1 이상인 승인 작물이 하나도 없다. 파종이 불가능하다',
        basis: 'DEC-CONTENT-003',
        fix: '작물 하나 이상의 spawn_weight 를 1 이상으로 올린다',
      })
    }
  },

  'crop.attribute_one_to_one': attributeOneToOne,
  'crop_attribute.one_to_one_with_crop': attributeOneToOne,

  'crop_attribute.no_orphan'({ report, h }) {
    const used = new Set(h.approved('crops.csv').map((c) => h.val(c, 'crop_attribute_id')))
    for (const attr of h.approved('crop_attributes.csv')) {
      const id = h.val(attr, 'id')
      if (!used.has(id)) {
        report.block({
          file: 'crop_attributes.csv',
          line: attr.lineNumber,
          field: 'id',
          problem: `어떤 승인 작물도 참조하지 않는 작물 속성이다: \`${id}\``,
          basis: 'DEC-CONTENT-012 · 참조되지 않는 고아 데이터가 없어야 한다',
          fix: '작물이 참조하게 하거나 이 속성을 retired 로 바꾼다',
        })
      }
    }
  },

  'crop.has_base_recipe': everyCropHasBaseRecipe,
  'recipe.every_crop_has_base_recipe': everyCropHasBaseRecipe,

  // ── 재료 ──────────────────────────────────────────────────────────────
  'material.used_by_recipe'({ report, h }) {
    const used = new Set(
      h.rows('recipe_inputs.csv')
        .filter((r) => h.val(r, 'input_kind') === 'material')
        .map((r) => h.val(r, 'input_id'))
    )
    for (const m of h.approved('crafting_materials.csv')) {
      const id = h.val(m, 'id')
      if (!used.has(id)) {
        report.block({
          file: 'crafting_materials.csv',
          line: m.lineNumber,
          field: 'id',
          problem: `어떤 승인 레시피도 사용하지 않는 재료다: \`${id}\``,
          basis: 'DEC-CONTENT-004 · 승인 조합 재료는 승인 레시피 하나 이상에서 사용되어야 한다',
          fix: '레시피에서 사용하거나 draft / in_review 상태로 되돌린다',
        })
      }
    }
  },

  // ── 레시피 ────────────────────────────────────────────────────────────
  'recipe.unique_result'({ report, h }) {
    const seen = new Map()
    for (const r of h.approved('recipes.csv')) {
      const result = h.val(r, 'result_id')
      if (!result) continue
      if (seen.has(result)) {
        report.block({
          file: 'recipes.csv',
          line: r.lineNumber,
          field: 'result_id',
          problem: `같은 결과물을 만드는 승인 레시피가 둘 이상이다: \`${result}\` (${seen.get(result)}행과 중복)`,
          basis: 'DEC-CONTENT-015 · 승인 결과물 하나는 정확히 하나의 승인 레시피가 생성한다',
          fix: '상위 레시피는 별도의 결과물 ID를 사용한다',
        })
      } else {
        seen.set(result, r.lineNumber)
      }
    }
  },

  'throwable_weapon.exactly_one_recipe': exactlyOneRecipe('throwable_weapons.csv', 'throwable_weapon'),
  'recovery_item.exactly_one_recipe': exactlyOneRecipe('recovery_items.csv', 'recovery_item'),

  'recipe.requires_crop_and_material': recipeInputKinds,
  'recipe_inputs.parent_has_both_kinds': recipeInputKinds,

  'recipe.unlock_type_matches_unlock_row'({ report, h }) {
    const unlockByRecipe = new Map()
    for (const u of h.rows('crop_mastery_unlocks.csv')) {
      const rid = h.val(u, 'recipe_id')
      unlockByRecipe.set(rid, (unlockByRecipe.get(rid) ?? 0) + 1)
    }
    for (const r of h.approved('recipes.csv')) {
      const id = h.val(r, 'id')
      const type = h.val(r, 'unlock_type')
      const n = unlockByRecipe.get(id) ?? 0
      if (type === 'base' && n > 0) {
        report.block({
          file: 'recipes.csv',
          line: r.lineNumber,
          field: 'unlock_type',
          problem: `base 레시피인데 crop_mastery_unlocks.csv 에 해금 행이 ${n}개 있다`,
          basis: 'DEC-CONTENT-015',
          fix: '해금 행을 지우거나 unlock_type 을 crop_mastery 로 바꾼다',
        })
      }
      if (type === 'crop_mastery' && n !== 1) {
        report.block({
          file: 'recipes.csv',
          line: r.lineNumber,
          field: 'unlock_type',
          problem: `crop_mastery 레시피인데 해금 행이 ${n}개다. 정확히 하나여야 한다`,
          basis: 'DEC-CONTENT-015',
          fix: 'crop_mastery_unlocks.csv 에 해금 행을 정확히 하나 둔다',
        })
      }
    }
  },

  'crop_mastery_unlocks.recipe_used_once'({ report, h }) {
    const seen = new Map()
    for (const u of h.rows('crop_mastery_unlocks.csv')) {
      const rid = h.val(u, 'recipe_id')
      if (seen.has(rid)) {
        report.block({
          file: 'crop_mastery_unlocks.csv',
          line: u.lineNumber,
          field: 'recipe_id',
          problem: `같은 레시피가 두 번 쓰였다 (${seen.get(rid)}행과 중복)`,
          basis: 'DEC-CONTENT-003 · 하나의 recipe_id 는 한 번만 사용할 수 있다',
          fix: '중복 행을 제거한다',
        })
      } else {
        seen.set(rid, u.lineNumber)
      }
    }
  },

  'crop_mastery_unlocks.crop_is_recipe_input'({ report, h }) {
    for (const u of h.rows('crop_mastery_unlocks.csv')) {
      const rid = h.val(u, 'recipe_id')
      const cid = h.val(u, 'crop_id')
      const inputs = h.rows('recipe_inputs.csv').filter((r) => h.val(r, 'recipe_id') === rid)
      const hasCrop = inputs.some((r) => h.val(r, 'input_id') === cid)
      if (inputs.length > 0 && !hasCrop) {
        report.block({
          file: 'crop_mastery_unlocks.csv',
          line: u.lineNumber,
          field: 'crop_id',
          problem: `\`${cid}\` 가 레시피 \`${rid}\` 의 작물 입력에 없다`,
          basis: 'DEC-CONTENT-015 · 숙련도 해금의 crop_id 는 해당 레시피의 작물 입력에 포함되어야 한다',
          fix: '레시피 입력에 이 작물을 넣거나 다른 작물로 바꾼다',
        })
      }
    }
  },

  'crop_mastery_unlocks.parent_unlock_type'({ report, h }) {
    const byId = new Map(h.rows('recipes.csv').map((r) => [h.val(r, 'id'), r]))
    for (const u of h.rows('crop_mastery_unlocks.csv')) {
      const rid = h.val(u, 'recipe_id')
      const recipe = byId.get(rid)
      if (recipe && h.val(recipe, 'unlock_type') !== 'crop_mastery') {
        report.block({
          file: 'crop_mastery_unlocks.csv',
          line: u.lineNumber,
          field: 'recipe_id',
          problem: `레시피 \`${rid}\` 의 unlock_type 이 crop_mastery 가 아니다`,
          basis: 'DEC-CONTENT-015 · base 레시피는 이 CSV에 넣을 수 없다',
          fix: '해금 행을 지우거나 레시피의 unlock_type 을 바꾼다',
        })
      }
    }
  },

  'recipe_inputs.no_currency'({ report, h }) {
    for (const r of h.rows('recipe_inputs.csv')) {
      if (h.val(r, 'input_id').startsWith('currency.')) {
        report.block({
          file: 'recipe_inputs.csv',
          line: r.lineNumber,
          field: 'input_id',
          problem: '돈을 레시피 입력으로 사용했다',
          basis: 'DEC-CONTENT-015 · 돈은 레시피 입력으로 사용할 수 없다',
          fix: '작물 또는 조합 재료로 바꾼다',
        })
      }
    }
  },

  'throwable_weapon.area_radius_gt_collision'({ report, h }) {
    for (const w of h.rows('throwable_weapons.csv')) {
      if (h.val(w, 'impact_mode') !== 'area') continue
      const area = h.num(w, 'area_radius')
      const col = h.num(w, 'collision_radius')
      if (Number.isFinite(area) && Number.isFinite(col) && !(area > col)) {
        report.block({
          file: 'throwable_weapons.csv',
          line: w.lineNumber,
          field: 'area_radius',
          problem: `area_radius(${area}) 가 collision_radius(${col}) 보다 커야 한다`,
          basis: 'DEC-CONTENT-005 · 범위 반경은 투사체 충돌 반경보다 커야 한다',
          fix: 'area_radius 를 키운다',
        })
      }
    }
  },

  'throwable_weapon.tick_interval_le_duration'({ report, h }) {
    for (const w of h.rows('throwable_weapons.csv')) {
      const tick = h.val(w, 'effect_tick_interval_seconds')
      if (tick === '') continue
      const t = Number(tick)
      const d = h.num(w, 'effect_duration_seconds')
      if (Number.isFinite(t) && Number.isFinite(d) && t > d) {
        report.block({
          file: 'throwable_weapons.csv',
          line: w.lineNumber,
          field: 'effect_tick_interval_seconds',
          problem: `틱 간격(${t})이 지속시간(${d})보다 크다. 지속 피해가 한 번도 발생하지 않는다`,
          basis: 'DEC-CONTENT-013 · 지속 피해의 틱 간격은 지속시간보다 클 수 없다',
          fix: '틱 간격을 줄이거나 지속시간을 늘린다',
        })
      }
    }
  },

  // ── 야생동물 ──────────────────────────────────────────────────────────
  'wildlife_spawn_profile.has_entry'({ report, h }) {
    for (const p of h.approved('wildlife_spawn_profiles.csv')) {
      const id = h.val(p, 'id')
      const entries = h
        .rows('wildlife_spawn_entries.csv')
        .filter((e) => h.val(e, 'wildlife_spawn_profile_id') === id)
      if (!entries.some((e) => h.num(e, 'spawn_weight') >= 1)) {
        report.block({
          file: 'wildlife_spawn_profiles.csv',
          line: p.lineNumber,
          problem: `프로필 \`${id}\` 에 spawn_weight 가 1 이상인 승인 야생동물이 없다`,
          basis: 'DEC-CONTENT-007',
          fix: 'wildlife_spawn_entries.csv 에 후보를 추가하거나 가중치를 올린다',
        })
      }
    }
  },
  'wildlife_spawn_entries.profile_has_positive_weight'({ report, schema, dataset, h }) {
    RULES['wildlife_spawn_profile.has_entry']({ report, schema, dataset, h })
  },

  // ── 보상 ──────────────────────────────────────────────────────────────
  'reward_bundle.has_entry'({ report, h }) {
    for (const b of h.approved('reward_bundles.csv')) {
      const id = h.val(b, 'id')
      const entries = h.rows('reward_bundle_entries.csv').filter((e) => h.val(e, 'reward_bundle_id') === id)
      if (entries.length === 0) {
        report.block({
          file: 'reward_bundles.csv',
          line: b.lineNumber,
          problem: `보상 묶음 \`${id}\` 에 항목이 없다`,
          basis: 'DEC-CONTENT-010 · 승인된 보상 묶음은 보상 항목을 하나 이상 가져야 한다',
          fix: '항목을 추가하거나, 보상이 없는 결과라면 이 묶음을 참조하지 않는다',
        })
      }
    }
  },

  'reward_bundle_entries.kind_matches_id_prefix'({ report, h }) {
    const prefix = {
      money: 'currency.',
      crop: 'crop.',
      material: 'material.',
      throwable_weapon: 'throwable_weapon.',
      recovery_item: 'recovery_item.',
    }
    for (const e of h.rows('reward_bundle_entries.csv')) {
      const kind = h.val(e, 'resource_kind')
      const id = h.val(e, 'resource_id')
      const want = prefix[kind]
      if (!want || !id) continue
      if (!id.startsWith(want)) {
        report.block({
          file: 'reward_bundle_entries.csv',
          line: e.lineNumber,
          field: 'resource_id',
          problem: `resource_kind \`${kind}\` 인데 ID가 \`${want}\` 로 시작하지 않는다: \`${id}\``,
          basis: 'DEC-CONTENT-010',
          fix: `\`${want}\` 로 시작하는 ID를 쓴다`,
        })
      }
      if (kind === 'money' && id !== 'currency.money') {
        report.block({
          file: 'reward_bundle_entries.csv',
          line: e.lineNumber,
          field: 'resource_id',
          problem: `money 는 고정 ID \`currency.money\` 만 사용한다`,
          basis: 'DEC-CONTENT-010',
          fix: '`currency.money` 로 바꾼다',
        })
      }
    }
  },

  // ── 주민 판정 ─────────────────────────────────────────────────────────
  'personality_choice_outcomes.three_functions_exactly_once'({ report, h }) {
    const want = ['empathy', 'resource_negotiation', 'threat']
    for (const p of h.approved('resident_personality_profiles.csv')) {
      const id = h.val(p, 'id')
      const rows = h.rows('personality_choice_outcomes.csv').filter((r) => h.val(r, 'personality_profile_id') === id)
      for (const fn of want) {
        const n = rows.filter((r) => h.val(r, 'choice_function') === fn).length
        if (n !== 1) {
          report.block({
            file: 'personality_choice_outcomes.csv',
            problem: `성격 프로필 \`${id}\` 의 \`${fn}\` 결과 행이 ${n}개다. 정확히 하나여야 한다`,
            basis: 'DEC-CONTENT-009 · 승인된 성격 프로필은 세 선택 기능의 결과 행을 각각 정확히 하나 가져야 한다',
            fix: n === 0 ? '결과 행을 추가한다' : '중복 행을 제거한다',
          })
        }
      }
    }
  },
  'personality_profile.has_three_outcomes'({ report, schema, dataset, h }) {
    RULES['personality_choice_outcomes.three_functions_exactly_once']({ report, schema, dataset, h })
  },

  'personality_choice_outcomes.threat_no_resolve'({ report, h }) {
    for (const r of h.rows('personality_choice_outcomes.csv')) {
      if (h.val(r, 'choice_function') !== 'threat') continue
      if (h.val(r, 'result_when_available_id') === 'system_result.precombat.resolve') {
        report.block({
          file: 'personality_choice_outcomes.csv',
          line: r.lineNumber,
          field: 'result_when_available_id',
          problem: '위협·대립은 조우 해결 결과를 사용할 수 없다',
          basis: 'DEC-RESIDENT-049',
          fix: '위축·일반·격앙 전투 결과 중 하나를 쓴다',
        })
      }
    }
  },

  'personality_choice_outcomes.unavailable_no_resolve'({ report, h }) {
    for (const r of h.rows('personality_choice_outcomes.csv')) {
      if (h.val(r, 'result_when_unavailable_id') === 'system_result.precombat.resolve') {
        report.block({
          file: 'personality_choice_outcomes.csv',
          line: r.lineNumber,
          field: 'result_when_unavailable_id',
          problem: '수확물 부족 결과에는 조우 해결을 사용할 수 없다',
          basis: 'DEC-CONTENT-009',
          fix: '위축·일반·격앙 전투 결과 중 하나를 쓴다',
        })
      }
    }
  },

  'combat_modifier.exactly_three'({ report, h }) {
    const want = ['weakened', 'normal', 'enraged']
    const rows = h.approved('resident_combat_modifiers.csv')
    for (const state of want) {
      const n = rows.filter((r) => h.val(r, 'combat_state') === state).length
      if (n !== 1) {
        report.block({
          file: 'resident_combat_modifiers.csv',
          problem: `\`${state}\` 상태의 승인 보정이 ${n}개다. 정확히 하나여야 한다`,
          basis: 'DEC-CONTENT-009',
          fix: n === 0 ? `${state} 보정을 추가한다` : '하나만 남긴다',
        })
      }
    }
  },

  'combat_modifier.normal_all_one'({ report, h }) {
    const mult = ['max_health_multiplier', 'move_speed_multiplier', 'attack_damage_multiplier', 'attack_cooldown_multiplier']
    for (const r of h.rows('resident_combat_modifiers.csv')) {
      if (h.val(r, 'combat_state') !== 'normal') continue
      for (const m of mult) {
        const v = h.num(r, m)
        if (Number.isFinite(v) && v !== 1) {
          report.block({
            file: 'resident_combat_modifiers.csv',
            line: r.lineNumber,
            field: m,
            problem: `일반 상태의 배율은 정확히 1이어야 한다. 실제 값 ${v}`,
            basis: 'DEC-CONTENT-009',
            fix: '1로 바꾼다',
          })
        }
      }
    }
  },

  'combat_modifier.weakened_direction': modifierDirection('weakened'),
  'combat_modifier.enraged_direction': modifierDirection('enraged'),

  // ── 주민 ──────────────────────────────────────────────────────────────
  'resident.profiles_one_to_one'({ report, h }) {
    for (const field of ['combat_profile_id', 'support_attack_profile_id']) {
      const seen = new Map()
      for (const r of h.approved('residents.csv')) {
        const v = h.val(r, field)
        if (!v) continue
        if (seen.has(v)) {
          report.block({
            file: 'residents.csv',
            line: r.lineNumber,
            field,
            problem: `\`${v}\` 를 다른 주민(${seen.get(v)}행)도 참조한다. 1:1이어야 한다`,
            basis: 'DEC-CONTENT-008 · 승인된 주민과 프로필은 1:1로 연결한다',
            fix: '주민마다 별도의 프로필을 만든다',
          })
        } else {
          seen.set(v, r.lineNumber)
        }
      }
    }
  },

  'resident.has_story_scenario'({ report, h }) {
    for (const r of h.approved('residents.csv')) {
      const id = h.val(r, 'id')
      const n = h.approved('story_scenarios.csv').filter((s) => h.val(s, 'resident_id') === id).length
      if (n !== 1) {
        report.block({
          file: 'residents.csv',
          line: r.lineNumber,
          field: 'id',
          problem: `주민 \`${id}\` 의 승인 사연 시나리오가 ${n}개다. 프로토타입에서는 정확히 하나다`,
          basis: 'DEC-RESIDENT-051',
          fix: n === 0 ? 'story_scenarios.csv 에 사연을 추가한다' : '하나만 승인한다',
        })
      }
    }
  },
  'story_scenario.one_per_resident'({ report, schema, dataset, h }) {
    RULES['resident.has_story_scenario']({ report, schema, dataset, h })
  },

  'resident_combat_profile.projectile_range_ge_attack_range'({ report, h }) {
    for (const p of h.rows('resident_combat_profiles.csv')) {
      if (h.val(p, 'attack_pattern_key') !== 'ranged_chase') continue
      const pmr = h.num(p, 'projectile_max_range')
      const ar = h.num(p, 'attack_range')
      if (Number.isFinite(pmr) && Number.isFinite(ar) && pmr < ar) {
        report.block({
          file: 'resident_combat_profiles.csv',
          line: p.lineNumber,
          field: 'projectile_max_range',
          problem: `projectile_max_range(${pmr}) 가 attack_range(${ar}) 보다 작다. 투사체가 절대 닿지 않는다`,
          basis: 'DEC-CONTENT-008 · 이 조건을 만족하지 않으면 승인할 수 없다',
          fix: 'projectile_max_range 를 attack_range 이상으로 올린다',
        })
      }
    }
  },

  'resident_combat_profile.one_to_one_with_resident'({ report, schema, dataset, h }) {
    RULES['resident.profiles_one_to_one']({ report, schema, dataset, h })
  },
  'support_profile.one_to_one_with_resident'({ report, schema, dataset, h }) {
    RULES['resident.profiles_one_to_one']({ report, schema, dataset, h })
  },

  // ── 사연·대화 ─────────────────────────────────────────────────────────
  'story_info.scenario_has_both_types'({ report, h }) {
    for (const s of h.approved('story_scenarios.csv')) {
      const id = h.val(s, 'id')
      const infos = h.approved('story_infos.csv').filter((i) => h.val(i, 'scenario_id') === id)
      for (const type of ['basic', 'core']) {
        if (!infos.some((i) => h.val(i, 'info_type') === type)) {
          report.block({
            file: 'story_infos.csv',
            problem: `시나리오 \`${id}\` 에 ${type} 사연 정보가 없다`,
            basis: 'DEC-CONTENT-017 · 모든 승인 시나리오는 basic 정보와 core 정보를 각각 하나 이상 가져야 한다',
            fix: `${type} 정보를 추가한다`,
          })
        }
      }
    }
  },
  'story_scenario.has_basic_and_core'({ report, schema, dataset, h }) {
    RULES['story_info.scenario_has_both_types']({ report, schema, dataset, h })
  },

  'story_scenario.opening_info_type_matches'({ report, h }) {
    const infoById = new Map(h.rows('story_infos.csv').map((i) => [h.val(i, 'id'), i]))
    const pairs = [
      ['precombat_opening_story_info_id', 'basic'],
      ['surrender_opening_story_info_id', 'core'],
    ]
    for (const s of h.rows('story_scenarios.csv')) {
      for (const [field, want] of pairs) {
        const ref = h.val(s, field)
        if (!ref) continue
        const info = infoById.get(ref)
        if (!info) continue
        const actual = h.val(info, 'info_type')
        if (actual !== want) {
          report.block({
            file: 'story_scenarios.csv',
            line: s.lineNumber,
            field,
            problem: `${want} 정보를 참조해야 하는데 \`${ref}\` 는 ${actual} 정보다`,
            basis: 'DEC-CONTENT-017',
            fix: `${want} 정보를 참조한다`,
          })
        }
      }
    }
  },

  'story_scenario.info_same_scenario'({ report, h }) {
    const infoById = new Map(h.rows('story_infos.csv').map((i) => [h.val(i, 'id'), i]))
    for (const s of h.rows('story_scenarios.csv')) {
      const sid = h.val(s, 'id')
      for (const field of ['precombat_opening_story_info_id', 'surrender_opening_story_info_id']) {
        const ref = h.val(s, field)
        const info = infoById.get(ref)
        if (info && h.val(info, 'scenario_id') !== sid) {
          report.block({
            file: 'story_scenarios.csv',
            line: s.lineNumber,
            field,
            problem: `다른 시나리오의 정보를 참조한다: \`${ref}\``,
            basis: 'DEC-CONTENT-017 · 다른 시나리오 정보의 교차 참조를 검사한다',
            fix: '같은 시나리오에 속한 정보를 참조한다',
          })
        }
      }
    }
  },

  'dialogue_choice.three_per_block'({ report, h }) {
    const blocks = {
      precombat: ['empathy', 'resource_negotiation', 'threat'],
      surrender: ['recruit', 'retreat_reward', 'resume_combat'],
    }
    for (const s of h.approved('story_scenarios.csv')) {
      const sid = h.val(s, 'id')
      const choices = h.approved('dialogue_choices.csv').filter((c) => h.val(c, 'scenario_id') === sid)
      for (const [phase, functions] of Object.entries(blocks)) {
        for (const fn of functions) {
          const n = choices.filter(
            (c) => h.val(c, 'dialogue_phase') === phase && h.val(c, 'choice_function') === fn
          ).length
          if (n !== 1) {
            report.block({
              file: 'dialogue_choices.csv',
              problem: `시나리오 \`${sid}\` 의 ${phase} 블록에 \`${fn}\` 선택지가 ${n}개다. 정확히 하나여야 한다`,
              basis: 'DEC-RESIDENT-026 · 각 대화 블록에 세 선택 기능이 중복 없이 하나씩 존재해야 한다',
              fix: n === 0 ? '선택지를 추가한다' : '중복을 제거한다',
            })
          }
        }
      }
    }
  },

  'dialogue_choice.function_matches_phase'({ report, h }) {
    const allowed = {
      precombat: ['empathy', 'resource_negotiation', 'threat'],
      surrender: ['recruit', 'retreat_reward', 'resume_combat'],
    }
    for (const c of h.rows('dialogue_choices.csv')) {
      const phase = h.val(c, 'dialogue_phase')
      const fn = h.val(c, 'choice_function')
      if (!allowed[phase] || !fn) continue
      if (!allowed[phase].includes(fn)) {
        report.block({
          file: 'dialogue_choices.csv',
          line: c.lineNumber,
          field: 'choice_function',
          problem: `${phase} 단계에서 쓸 수 없는 기능이다: \`${fn}\``,
          basis: 'DEC-CONTENT-009',
          fix: `허용값: ${allowed[phase].join(', ')}`,
        })
      }
    }
  },

  'dialogue_choice.judgement_rule_matches_function'({ report, h }) {
    const want = {
      empathy: 'dialogue_judgement_rule.personality_choice',
      threat: 'dialogue_judgement_rule.personality_choice',
      resource_negotiation: 'dialogue_judgement_rule.personality_resource_offer',
    }
    for (const c of h.rows('dialogue_choices.csv')) {
      if (h.val(c, 'dialogue_phase') !== 'precombat') continue
      const fn = h.val(c, 'choice_function')
      const rule = h.val(c, 'judgement_rule_id')
      if (!want[fn] || !rule) continue
      if (rule !== want[fn]) {
        report.block({
          file: 'dialogue_choices.csv',
          line: c.lineNumber,
          field: 'judgement_rule_id',
          problem: `\`${fn}\` 은 \`${want[fn]}\` 를 참조해야 한다`,
          basis: 'DEC-CONTENT-009',
          fix: `\`${want[fn]}\` 로 바꾼다`,
        })
      }
    }
  },

  'dialogue_choice_responses.result_matches_phase'({ report, h }) {
    const byId = new Map(h.rows('dialogue_choices.csv').map((c) => [h.val(c, 'id'), c]))
    for (const r of h.rows('dialogue_choice_responses.csv')) {
      const choice = byId.get(h.val(r, 'choice_id'))
      if (!choice) continue
      const phase = h.val(choice, 'dialogue_phase')
      const result = h.val(r, 'system_result_id')
      if (!phase || !result) continue
      if (!result.startsWith(`system_result.${phase}.`)) {
        report.block({
          file: 'dialogue_choice_responses.csv',
          line: r.lineNumber,
          field: 'system_result_id',
          problem: `${phase} 선택지에 ${result} 결과를 연결했다`,
          basis: 'DEC-CONTENT-009',
          fix: `system_result.${phase}.* 결과를 쓴다`,
        })
      }
    }
  },

  'dialogue_choice_responses.empathy_resolve_reveals_core'({ report, h }) {
    const byId = new Map(h.rows('dialogue_choices.csv').map((c) => [h.val(c, 'id'), c]))
    const infoById = new Map(h.rows('story_infos.csv').map((i) => [h.val(i, 'id'), i]))
    for (const r of h.rows('dialogue_choice_responses.csv')) {
      const choice = byId.get(h.val(r, 'choice_id'))
      if (!choice) continue
      if (h.val(choice, 'choice_function') !== 'empathy') continue
      if (h.val(r, 'system_result_id') !== 'system_result.precombat.resolve') continue

      const ref = h.val(r, 'revealed_story_info_id')
      const info = ref ? infoById.get(ref) : null
      if (!ref || !info || h.val(info, 'info_type') !== 'core') {
        report.block({
          file: 'dialogue_choice_responses.csv',
          line: r.lineNumber,
          field: 'revealed_story_info_id',
          problem: '공감·설득이 조우 해결로 확정되면 core 사연 정보를 반드시 하나 공개해야 한다',
          basis: 'DEC-CONTENT-017',
          fix: '같은 시나리오의 core 정보를 연결한다',
        })
      }
    }
  },

  'dialogue_choice_responses.revealed_info_is_core_and_same_scenario'({ report, h }) {
    const byId = new Map(h.rows('dialogue_choices.csv').map((c) => [h.val(c, 'id'), c]))
    const infoById = new Map(h.rows('story_infos.csv').map((i) => [h.val(i, 'id'), i]))
    for (const r of h.rows('dialogue_choice_responses.csv')) {
      const ref = h.val(r, 'revealed_story_info_id')
      if (!ref) continue
      const info = infoById.get(ref)
      const choice = byId.get(h.val(r, 'choice_id'))
      if (!info || !choice) continue

      if (h.val(info, 'info_type') !== 'core') {
        report.block({
          file: 'dialogue_choice_responses.csv',
          line: r.lineNumber,
          field: 'revealed_story_info_id',
          problem: `core 정보만 공개할 수 있다. \`${ref}\` 는 ${h.val(info, 'info_type')} 정보다`,
          basis: 'DEC-CONTENT-017',
          fix: 'core 정보를 연결한다',
        })
      }
      if (h.val(info, 'scenario_id') !== h.val(choice, 'scenario_id')) {
        report.block({
          file: 'dialogue_choice_responses.csv',
          line: r.lineNumber,
          field: 'revealed_story_info_id',
          problem: '선택지와 다른 시나리오의 정보를 공개한다',
          basis: 'DEC-CONTENT-017',
          fix: '같은 시나리오의 정보를 연결한다',
        })
      }
    }
  },

  // ── 화면 고정 문구 ────────────────────────────────────────────────────
  //
  // 습격 예고는 습격이 없는 날에도 HUD에서 사라지지 않는다 (DEC-UI-017).
  // 그래서 `none` 행이 빠지면 화면에 구멍이 나는데, 그 구멍은 습격 없는 날에만
  // 보인다 — 습격일만 눌러 보고 넘어가면 못 찾는다. 그래서 차단으로 잡는다.
  'raid_notice.exactly_one_per_raid_type'({ report, h }) {
    const rows = h.approved('raid_notices.csv')

    for (const type of ['none', 'raid', 'final_raid']) {
      const n = rows.filter((r) => h.val(r, 'raid_type') === type).length
      if (n !== 1) {
        report.block({
          file: 'raid_notices.csv',
          problem: `raid_type \`${type}\` 의 승인 예고 문구가 ${n}개다. 정확히 하나여야 한다`,
          basis: 'DEC-CONTENT-021 · 승인 행을 세 raid_type 값마다 정확히 하나씩 둔다',
          fix: n === 0 ? `raid_type 이 \`${type}\` 인 행을 승인한다` : '하나만 남기고 나머지를 retired 로 바꾼다',
        })
      }
    }
  },

  'night_result_text.at_least_one_approved'({ report, h }) {
    const n = h.approved('night_result_texts.csv').length
    if (n === 0) {
      report.block({
        file: 'night_result_texts.csv',
        problem: '승인된 밤 결과 문구가 없다',
        basis: 'DEC-CONTENT-021 · 승인된 밤 결과 문구는 하나 이상이어야 한다',
        fix: '문구 행 하나 이상을 approved 로 승인한다',
      })
    }
  },

  // ── 공포도 증가량 ─────────────────────────────────────────────────────
  'fear_increment.exactly_one_per_cause'({ report, schema, h }) {
    const rows = h.approved('fear_increments.csv')
    // 허용값은 테이블 정의가 갖고 있다. enums.json 에 따로 두면
    // important_action_count_subject 와 같은 행동을 가리키는 목록이 두 벌이 된다.
    const causes =
      schema.tables.get('fear_increments.csv')?.fields.find((f) => f.name === 'cause')?.values ?? []

    for (const cause of causes) {
      const n = rows.filter((r) => h.val(r, 'cause') === cause).length
      if (n !== 1) {
        report.block({
          file: 'fear_increments.csv',
          problem: `\`${cause}\` 의 승인 증가량이 ${n}개다. 정확히 하나여야 한다`,
          basis: 'DEC-RESIDENT-048 · 승인 행은 위협·퇴각·처치 세 개다',
          fix: n === 0 ? `cause 가 \`${cause}\` 인 행을 승인한다` : '하나만 남기고 나머지를 retired 로 바꾼다',
        })
      }
    }
  },

  // ── 튜토리얼 ──────────────────────────────────────────────────────────
  'tutorial_step.step_order_sequential'({ report, h }) {
    const rows = h.approved('tutorial_steps.csv')
    if (rows.length === 0) return

    const seen = new Map()
    for (const r of rows) {
      const order = h.num(r, 'step_order')
      if (seen.has(order)) {
        report.block({
          file: 'tutorial_steps.csv',
          line: r.lineNumber,
          field: 'step_order',
          problem: `step_order ${order} 가 중복된다`,
          basis: 'DEC-CONTENT-025 · 승인 행에서 1부터 연속되고 중복되지 않는다',
          fix: '중복된 행의 step_order 를 다시 매긴다',
        })
      }
      seen.set(order, r)
    }

    for (let want = 1; want <= rows.length; want++) {
      if (!seen.has(want)) {
        report.block({
          file: 'tutorial_steps.csv',
          field: 'step_order',
          problem: `step_order ${want} 이 없다. 승인 행이 ${rows.length}개면 1부터 ${rows.length}까지 빠짐없이 있어야 한다`,
          basis: 'DEC-CONTENT-025 · 승인 행에서 1부터 연속되고 중복되지 않는다',
          fix: `step_order 가 ${want} 인 행을 승인하거나 뒤 번호를 당긴다`,
        })
      }
    }
  },

  'tutorial_step.covers_all_stages'({ report, schema, h }) {
    const rows = h.approved('tutorial_steps.csv')
    if (rows.length === 0) return

    for (const stage of schema.enums.stage?.values ?? []) {
      if (!rows.some((r) => h.val(r, 'stage') === stage)) {
        report.block({
          file: 'tutorial_steps.csv',
          problem: `stage \`${stage}\` 의 승인 안내가 없다`,
          basis: 'DEC-CONTENT-025 · 세 stage 마다 승인 행이 하나 이상 있어야 한다',
          fix: `stage 가 \`${stage}\` 인 행을 하나 이상 승인한다`,
        })
      }
    }
  },

  /**
   * 같은 stage 의 안내는 step_order 상 연속한다 (DEC-CONTENT-025).
   *
   * `covers_all_stages` 는 세 단계가 **있는지**만 본다. 순서가 흩어지는 것은 못 잡는데,
   * 그러면 튜토리얼이 재배 → 정비 → 재배처럼 화면 사이를 오간다.
   *
   * 순서 자체(어느 stage 가 먼저인가)는 검사하지 않는다. `DEC-CONTENT-025` 가
   * **stage 자체의 순서는 고정하지 않는다**로 정했다 — 순서를 정하는 것은 의존
   * 관계이고 그건 레시피·가격이 바뀌면 같이 바뀐다. 그 조건(앞선 안내로만 얻어지는
   * 것을 요구하지 않는다)은 자동 검사가 어려워 사람이 확인한다.
   */
  'tutorial_step.stages_contiguous'({ report, h }) {
    const rows = h.approved('tutorial_steps.csv')
    if (rows.length === 0) return

    const ordered = [...rows].sort((a, b) => h.num(a, 'step_order') - h.num(b, 'step_order'))

    /** 이미 끝난 stage. 다시 나오면 끊긴 것이다 */
    const closed = new Set()
    let previous = null

    for (const r of ordered) {
      const stage = h.val(r, 'stage')
      if (!stage) continue

      if (stage !== previous) {
        if (closed.has(stage)) {
          report.block({
            file: 'tutorial_steps.csv',
            line: r.lineNumber,
            field: 'stage',
            problem: `stage \`${stage}\` 가 끊겼다가 step_order ${h.num(r, 'step_order')} 에서 다시 나온다`,
            basis: 'DEC-CONTENT-025 · 같은 stage 의 안내는 step_order 상 연속한다',
            fix: `같은 stage 의 안내를 한 덩어리로 모으도록 step_order 를 다시 매긴다`,
          })
        }
        if (previous !== null) closed.add(previous)
        previous = stage
      }
    }
  },

  // ── 에셋 연결 ─────────────────────────────────────────────────────────
  'content_asset.id_section_matches_role'({ report, h }) {
    // asset.<구간>.<이름> 의 구간과 asset_role 은 같은 값이다.
    // DEC-ART-001 이 "asset_role 로 사용할 수 있는 구간은" 이라고 써서 둘을 같은 것으로 둔다.
    for (const r of h.rows('content_assets.csv')) {
      const role = h.val(r, 'asset_role')
      const id = h.val(r, 'asset_id')
      if (!role || !id) continue

      const section = id.split('.')[1]
      if (section !== role) {
        report.block({
          file: 'content_assets.csv',
          line: r.lineNumber,
          field: 'asset_id',
          problem: `구간이 asset_role 과 다르다. asset_role 은 \`${role}\` 인데 ID 는 \`${section}\` 구간이다`,
          basis: 'DEC-ART-001 · 논리 에셋 ID 의 구간과 asset_role 은 같은 값을 쓴다',
          fix: `\`asset.${role}.<이름>\` 으로 고치거나 asset_role 을 \`${section}\` 으로 고친다`,
        })
      }
    }
  },

  // ── 런 일정 ───────────────────────────────────────────────────────────
  'run_schedule.exactly_one_approved'({ report, h }) {
    const n = h.approved('run_schedules.csv').length
    if (n !== 1) {
      report.block({
        file: 'run_schedules.csv',
        problem: `승인 런 일정이 ${n}개다. 정확히 하나여야 한다`,
        basis: 'DEC-CONTENT-002',
        fix: n === 0 ? '런 일정을 승인한다' : '하나만 남긴다',
      })
    }
  },

  'run_schedule.days_continuous': dayContinuity,
  'run_schedule_days.day_continuity': dayContinuity,

  'run_schedule_days.exactly_one_final_raid'({ report, h }) {
    for (const s of h.approved('run_schedules.csv')) {
      const sid = h.val(s, 'id')
      const total = h.num(s, 'total_days')
      const days = h.rows('run_schedule_days.csv').filter((d) => h.val(d, 'run_schedule_id') === sid)
      const finals = days.filter((d) => h.val(d, 'raid_type') === 'final_raid')

      if (finals.length !== 1) {
        report.block({
          file: 'run_schedule_days.csv',
          problem: `final_raid 가 ${finals.length}개다. 정확히 하나여야 한다`,
          basis: 'DEC-CONTENT-002 · 일정에는 final_raid 가 정확히 하나 있어야 한다',
          fix: finals.length === 0 ? '마지막 일차를 final_raid 로 바꾼다' : '하나만 남긴다',
        })
        continue
      }

      const day = h.num(finals[0], 'day_number')
      if (Number.isFinite(total) && day !== total) {
        report.block({
          file: 'run_schedule_days.csv',
          line: finals[0].lineNumber,
          field: 'raid_type',
          problem: `final_raid 가 ${day}일차에 있다. 마지막 일차(${total})에 있어야 한다`,
          basis: 'DEC-CONTENT-002 · 마지막 습격 뒤에 도달할 수 없는 일차를 작성하지 않는다',
          fix: `${total}일차로 옮긴다`,
        })
      }
    }
  },

  'run_schedule_days.no_duplicate_hostile_resident'({ report, h }) {
    const seen = new Map()
    for (const d of h.rows('run_schedule_days.csv')) {
      const rid = h.val(d, 'hostile_resident_id')
      if (!rid) continue
      const key = `${h.val(d, 'run_schedule_id')}@${rid}`
      if (seen.has(key)) {
        report.block({
          file: 'run_schedule_days.csv',
          line: d.lineNumber,
          field: 'hostile_resident_id',
          problem: `같은 주민이 ${seen.get(key)}행에서도 적대 주민으로 배치됐다`,
          basis: 'DEC-RESIDENT-043 · 같은 주민을 한 런 일정에서 두 번 이상 배치하지 않는다',
          fix: '다른 주민으로 바꾼다',
        })
      } else {
        seen.set(key, d.lineNumber)
      }
    }
  },

  // ── 공포도·엔딩 ───────────────────────────────────────────────────────
  'fear_band.min_le_max'({ report, h }) {
    for (const b of h.rows('fear_bands.csv')) {
      const max = h.val(b, 'max_fear')
      if (max === '') continue
      const min = h.num(b, 'min_fear')
      if (Number.isFinite(min) && Number(max) < min) {
        report.block({
          file: 'fear_bands.csv',
          line: b.lineNumber,
          field: 'max_fear',
          problem: `max_fear(${max}) 가 min_fear(${min}) 보다 작다`,
          basis: 'DEC-CONTENT-011',
          fix: 'max_fear 를 min_fear 이상으로 올린다',
        })
      }
    }
  },

  'fear_band.only_last_unbounded'({ report, h }) {
    const bands = h.approved('fear_bands.csv')
    const open = bands.filter((b) => h.val(b, 'max_fear') === '')
    if (bands.length > 0 && open.length !== 1) {
      report.block({
        file: 'fear_bands.csv',
        problem: `max_fear 가 비어 있는 구간이 ${open.length}개다. 가장 높은 구간 하나만 비운다`,
        basis: 'DEC-CONTENT-011 · 가장 높은 공포도 구간만 max_fear 를 비운다',
        fix: open.length === 0 ? '가장 높은 구간의 max_fear 를 비운다' : '하나만 비운다',
      })
    }
  },

  'fear_band.continuous_from_zero'({ report, h }) {
    const bands = h
      .approved('fear_bands.csv')
      .slice()
      .sort((a, b) => h.num(a, 'min_fear') - h.num(b, 'min_fear'))
    if (bands.length === 0) return

    if (h.num(bands[0], 'min_fear') !== 0) {
      report.block({
        file: 'fear_bands.csv',
        line: bands[0].lineNumber,
        field: 'min_fear',
        problem: `가장 낮은 구간이 ${h.num(bands[0], 'min_fear')} 부터 시작한다. 0부터여야 한다`,
        basis: 'DEC-CONTENT-011 · 0부터 상한 없는 마지막 구간까지 연속되어야 한다',
        fix: 'min_fear 를 0으로 바꾼다',
      })
    }

    for (let i = 0; i < bands.length - 1; i++) {
      const max = h.val(bands[i], 'max_fear')
      if (max === '') continue
      const nextMin = h.num(bands[i + 1], 'min_fear')
      if (nextMin !== Number(max) + 1) {
        report.block({
          file: 'fear_bands.csv',
          line: bands[i + 1].lineNumber,
          field: 'min_fear',
          problem: `앞 구간이 ${max} 에서 끝나는데 이 구간은 ${nextMin} 부터다. 겹치거나 빈다`,
          basis: 'DEC-CONTENT-011',
          fix: `min_fear 를 ${Number(max) + 1} 로 바꾼다`,
        })
      }
    }
  },

  'ending.exactly_one_global_fallback'({ report, h }) {
    const endings = h.approved('endings.csv')
    if (endings.length === 0) return
    const n = endings.filter((e) => h.val(e, 'is_global_fallback') === 'true').length
    if (n !== 1) {
      report.block({
        file: 'endings.csv',
        problem: `전역 폴백 엔딩이 ${n}개다. 정확히 하나여야 한다`,
        basis: 'DEC-CONTENT-011',
        fix: n === 0 ? '전역 폴백 엔딩을 하나 만든다' : '하나만 남긴다',
      })
    }
  },

  'ending.global_fallback_shape'({ report, h }) {
    for (const e of h.rows('endings.csv')) {
      if (h.val(e, 'is_global_fallback') !== 'true') continue
      if (h.val(e, 'fear_band_id') !== '') {
        report.block({
          file: 'endings.csv',
          line: e.lineNumber,
          field: 'fear_band_id',
          problem: '전역 폴백 엔딩은 fear_band_id 를 비워야 한다',
          basis: 'DEC-CONTENT-011',
          fix: '셀을 비운다',
        })
      }
      if (h.num(e, 'selection_priority') !== 0) {
        report.block({
          file: 'endings.csv',
          line: e.lineNumber,
          field: 'selection_priority',
          problem: '전역 폴백 엔딩은 selection_priority 0을 사용한다',
          basis: 'DEC-CONTENT-011',
          fix: '0으로 바꾼다',
        })
      }
      const conds = h.rows('ending_conditions.csv').filter((c) => h.val(c, 'ending_id') === h.val(e, 'id'))
      if (conds.length > 0) {
        report.block({
          file: 'ending_conditions.csv',
          problem: `전역 폴백 엔딩 \`${h.val(e, 'id')}\` 에 조건 행이 ${conds.length}개 있다`,
          basis: 'DEC-CONTENT-011 · 전역 폴백 엔딩은 추가 조건을 가지지 않는다',
          fix: '조건 행을 제거한다',
        })
      }
    }
  },

  'ending.band_has_exactly_one_default': bandDefaultEnding,
  'fear_band.has_default_ending': bandDefaultEnding,

  'ending.conditional_priority_ge_one'({ report, h }) {
    const withCond = new Set(h.rows('ending_conditions.csv').map((c) => h.val(c, 'ending_id')))
    for (const e of h.approved('endings.csv')) {
      if (!withCond.has(h.val(e, 'id'))) continue
      if (h.num(e, 'selection_priority') < 1) {
        report.block({
          file: 'endings.csv',
          line: e.lineNumber,
          field: 'selection_priority',
          problem: '추가 조건이 있는 엔딩은 selection_priority 가 1 이상이어야 한다',
          basis: 'DEC-CONTENT-011',
          fix: '1 이상으로 올린다',
        })
      }
    }
  },
  'ending_conditions.parent_priority_ge_one'({ report, schema, dataset, h }) {
    RULES['ending.conditional_priority_ge_one']({ report, schema, dataset, h })
  },

  'ending.no_priority_tie'({ report, h }) {
    const byBand = new Map()
    for (const e of h.approved('endings.csv')) {
      const band = h.val(e, 'fear_band_id')
      if (!band) continue
      const key = `${band}@${h.val(e, 'selection_priority')}`
      if (!byBand.has(key)) byBand.set(key, [])
      byBand.get(key).push(e)
    }
    for (const [key, list] of byBand) {
      if (list.length > 1) {
        report.block({
          file: 'endings.csv',
          line: list[0].lineNumber,
          field: 'selection_priority',
          problem: `같은 공포도 구간에 같은 우선순위 엔딩이 ${list.length}개다 (${key})`,
          basis: 'DEC-CONTENT-011 · 같은 우선순위의 엔딩이 동시에 성립하면 데이터 오류로 처리한다',
          fix: '우선순위를 다르게 준다',
        })
      }
    }
  },

  'journal_fallbacks.covers_all_bands_and_directions'({ report, h }) {
    const bands = h.approved('fear_bands.csv')
    if (bands.length === 0) return

    const rows = h.rows('journal_fallbacks.csv')
    const directions = ['up', 'same', 'down']

    for (const band of bands) {
      const bid = h.val(band, 'id')
      const bandRows = rows.filter((r) => h.val(r, 'fear_band_id') === bid)

      for (const dir of directions) {
        const hasDir = bandRows.some((r) => h.val(r, 'change_direction') === dir)
        if (!hasDir) {
          report.block({
            file: 'journal_fallbacks.csv',
            problem: `공포도 구간 \`${bid}\` 에 대한 \`${dir}\` 방향의 폴백 일지가 정의되지 않았다`,
            basis: 'DEC-JOURNAL-003 · 공포도 구간 × 변화 방향 조합의 고정 폴백 일지를 제공해야 한다',
            fix: `journal_fallbacks.csv 에 fear_band_id=${bid}, change_direction=${dir} 행을 추가한다`,
          })
        }
      }
    }
  },

  'ending_conditions.comparison_matches_type'({ report, h }) {
    const countTypes = ['relationship_count', 'important_action_count']
    for (const c of h.rows('ending_conditions.csv')) {
      const type = h.val(c, 'condition_type')
      const cmp = h.val(c, 'comparison')
      if (!type || !cmp) continue
      if (!countTypes.includes(type) && cmp !== 'eq') {
        report.block({
          file: 'ending_conditions.csv',
          line: c.lineNumber,
          field: 'comparison',
          problem: `\`${type}\` 은 eq 만 사용할 수 있다`,
          basis: 'DEC-CONTENT-011',
          fix: 'eq 로 바꾼다',
        })
      }
    }
  },

  'ending_conditions.subject_matches_type'({ report, schema, h }) {
    const map = {
      relationship_count: schema.enums.relationship_count_subject?.values ?? [],
      important_action_count: schema.enums.important_action_count_subject?.values ?? [],
    }
    for (const c of h.rows('ending_conditions.csv')) {
      const type = h.val(c, 'condition_type')
      const subject = h.val(c, 'subject_key')
      const allowed = map[type]
      if (!allowed || !subject) continue
      if (!allowed.includes(subject)) {
        report.block({
          file: 'ending_conditions.csv',
          line: c.lineNumber,
          field: 'subject_key',
          problem: `\`${type}\` 에서 쓸 수 없는 값이다: \`${subject}\``,
          basis: 'DEC-CONTENT-011',
          fix: `허용값: ${allowed.join(', ')}`,
        })
      }
      if (type.startsWith('specific_resident_') && !subject.startsWith('resident.')) {
        report.block({
          file: 'ending_conditions.csv',
          line: c.lineNumber,
          field: 'subject_key',
          problem: `\`${type}\` 의 subject_key 는 resident.* 여야 한다`,
          basis: 'DEC-CONTENT-011',
          fix: 'resident.* ID를 쓴다',
        })
      }
    }
  },

  'ending_conditions.target_value_valid'({ report, schema, h }) {
    const outcomes = schema.enums.specific_resident_outcome_target?.values ?? []
    for (const c of h.rows('ending_conditions.csv')) {
      const type = h.val(c, 'condition_type')
      const target = h.val(c, 'target_value')
      if (!type || !target) continue
      const at = { file: 'ending_conditions.csv', line: c.lineNumber, field: 'target_value' }

      if (type === 'relationship_count' || type === 'important_action_count') {
        if (!/^\d+$/.test(target)) {
          report.block({ ...at, problem: `0 이상의 정수여야 한다: \`${target}\``, basis: 'DEC-CONTENT-011', fix: '정수를 쓴다' })
        }
      } else if (type === 'specific_resident_outcome') {
        if (!outcomes.includes(target)) {
          report.block({ ...at, problem: `허용되지 않는 최종 결과다: \`${target}\``, basis: 'DEC-CONTENT-011', fix: `허용값: ${outcomes.join(', ')}` })
        }
      } else if (type === 'dominant_crop') {
        if (!target.startsWith('crop.')) {
          report.block({ ...at, problem: `crop.* ID여야 한다: \`${target}\``, basis: 'DEC-CONTENT-011', fix: 'crop.* ID를 쓴다' })
        }
      } else if (type === 'dominant_crop_attribute') {
        if (!target.startsWith('crop_attribute.')) {
          report.block({ ...at, problem: `crop_attribute.* ID여야 한다: \`${target}\``, basis: 'DEC-CONTENT-011', fix: 'crop_attribute.* ID를 쓴다' })
        }
      }
      // specific_resident_relationship 은 관계 키 목록이 결정로그에 없어 검사하지 않는다.
      // schema/enums.json 의 open_questions 참조.
    }
  },

  'recipe_inputs.kind_matches_id'({ report, h }) {
    const prefix = { crop: 'crop.', material: 'material.' }
    for (const r of h.rows('recipe_inputs.csv')) {
      const kind = h.val(r, 'input_kind')
      const id = h.val(r, 'input_id')
      const want = prefix[kind]
      if (!want || !id) continue
      if (!id.startsWith(want)) {
        report.block({
          file: 'recipe_inputs.csv',
          line: r.lineNumber,
          field: 'input_id',
          problem: `input_kind \`${kind}\` 인데 ID가 \`${want}\` 로 시작하지 않는다: \`${id}\``,
          basis: 'DEC-CONTENT-015 · input_kind 는 input_id 의 실제 종류와 일치해야 한다',
          fix: `\`${want}\` 로 시작하는 ID를 쓴다`,
        })
      }
    }
  },

  'recipe.result_kind_matches'({ report, h }) {
    const prefix = { throwable_weapon: 'throwable_weapon.', recovery_item: 'recovery_item.' }
    for (const r of h.rows('recipes.csv')) {
      const kind = h.val(r, 'result_kind')
      const id = h.val(r, 'result_id')
      const want = prefix[kind]
      if (!want || !id) continue
      if (!id.startsWith(want)) {
        report.block({
          file: 'recipes.csv',
          line: r.lineNumber,
          field: 'result_id',
          problem: `result_kind \`${kind}\` 인데 결과물 ID가 \`${want}\` 로 시작하지 않는다: \`${id}\``,
          basis: 'DEC-CONTENT-015 · 실제 결과물의 kind 와 result_kind 가 일치해야 한다',
          fix: `\`${want}\` 로 시작하는 ID를 쓴다`,
        })
      }
    }
  },

  'recipe.weapon_attribute_crop_included': weaponAttributeCropIncluded,
  'throwable_weapon.recipe_includes_attribute_crop': weaponAttributeCropIncluded,

  'reward_bundle.no_empty_bundle'({ report, schema, dataset, h }) {
    RULES['reward_bundle.has_entry']({ report, schema, dataset, h })
  },

  'reward_bundle.shared_reference_warning'({ report, h }) {
    const refs = new Map()
    for (const p of h.approved('resident_combat_profiles.csv')) {
      for (const field of ['retreat_reward_bundle_id', 'kill_reward_bundle_id']) {
        const v = h.val(p, field)
        if (!v) continue
        if (!refs.has(v)) refs.set(v, [])
        refs.get(v).push(`${h.val(p, 'id')}.${field}`)
      }
    }
    for (const [bundle, users] of refs) {
      if (users.length > 1) {
        report.warn({
          file: 'reward_bundles.csv',
          problem: `보상 묶음 \`${bundle}\` 을 ${users.length}곳이 참조한다. 수정하면 모두 영향을 받는다`,
          basis: 'DEC-CONTENT-010 · 묶음이 변경되면 모든 참조처가 영향을 받는다는 검증 안내를 제공한다',
          fix: `참조처: ${users.join(', ')}`,
        })
      }
    }
  },

  'dialogue_choice_responses.covers_reachable_results': reachableResponses,
  'dialogue_choice.responses_cover_reachable_results': reachableResponses,
  'personality_choice_outcomes.reachable_responses_exist': reachableResponses,

  'ending_conditions.dominant_crop_and_attribute_overlap'({ report, h }) {
    const byEnding = new Map()
    for (const c of h.rows('ending_conditions.csv')) {
      const eid = h.val(c, 'ending_id')
      if (!byEnding.has(eid)) byEnding.set(eid, new Set())
      byEnding.get(eid).add(h.val(c, 'condition_type'))
    }
    for (const [eid, types] of byEnding) {
      if (types.has('dominant_crop') && types.has('dominant_crop_attribute')) {
        report.warn({
          file: 'ending_conditions.csv',
          problem: `엔딩 \`${eid}\` 이 대표 작물과 대표 작물 속성 조건을 동시에 쓴다. 1:1 관계라 중복 조건이다`,
          basis: 'DEC-CONTENT-011',
          fix: '둘 중 하나만 남긴다',
        })
      }
    }
  },
}

// ── 공용 구현 ────────────────────────────────────────────────────────────

function coordinateInBounds(file) {
  return ({ report, h }) => {
    const maps = new Map(h.rows('maps.csv').map((m) => [h.val(m, 'id'), m]))
    for (const r of h.rows(file)) {
      const map = maps.get(h.val(r, 'map_id'))
      if (!map) continue
      const w = h.num(map, 'world_width')
      const hgt = h.num(map, 'world_height')
      const x = h.num(r, 'x')
      const y = h.num(r, 'y')
      if (Number.isFinite(x) && (x < 0 || x > w)) {
        report.block({
          file,
          line: r.lineNumber,
          field: 'x',
          problem: `x(${x}) 가 0 이상 ${w} 이하 범위를 벗어났다`,
          basis: 'DEC-CONTENT-016',
          fix: `0 ≤ x ≤ ${w}`,
        })
      }
      if (Number.isFinite(y) && (y < 0 || y > hgt)) {
        report.block({
          file,
          line: r.lineNumber,
          field: 'y',
          problem: `y(${y}) 가 0 이상 ${hgt} 이하 범위를 벗어났다`,
          basis: 'DEC-CONTENT-016',
          fix: `0 ≤ y ≤ ${hgt}`,
        })
      }
    }
  }
}

function attributeOneToOne({ report, h }) {
  const seen = new Map()
  for (const c of h.approved('crops.csv')) {
    const attr = h.val(c, 'crop_attribute_id')
    if (!attr) continue
    if (seen.has(attr)) {
      report.block({
        file: 'crops.csv',
        line: c.lineNumber,
        field: 'crop_attribute_id',
        problem: `\`${attr}\` 를 다른 작물(${seen.get(attr)}행)도 참조한다. 1:1이어야 한다`,
        basis: 'DEC-CONTENT-012 · 작물 하나는 정확히 하나의 속성을, 속성 하나도 정확히 하나의 작물에만 연결한다',
        fix: '작물마다 별도의 속성을 만든다',
      })
    } else {
      seen.set(attr, c.lineNumber)
    }
  }
}

function everyCropHasBaseRecipe({ report, h }) {
  const baseRecipes = new Set(
    h.approved('recipes.csv')
      .filter((r) => h.val(r, 'unlock_type') === 'base')
      .map((r) => h.val(r, 'id'))
  )
  const cropsWithBase = new Set(
    h.rows('recipe_inputs.csv')
      .filter((i) => h.val(i, 'input_kind') === 'crop' && baseRecipes.has(h.val(i, 'recipe_id')))
      .map((i) => h.val(i, 'input_id'))
  )
  for (const c of h.approved('crops.csv')) {
    const id = h.val(c, 'id')
    if (!cropsWithBase.has(id)) {
      report.block({
        file: 'crops.csv',
        line: c.lineNumber,
        field: 'id',
        problem: `작물 \`${id}\` 를 입력으로 쓰는 base 레시피가 없다`,
        basis: 'DEC-CONTENT-003 · 모든 승인 작물에는 처음부터 공개되는 기본 레시피가 최소 하나 있어야 한다',
        fix: 'unlock_type 이 base 인 레시피에 이 작물을 입력으로 넣는다',
      })
    }
  }
}

function exactlyOneRecipe(file, resultKind) {
  return ({ report, h }) => {
    for (const item of h.approved(file)) {
      const id = h.val(item, 'id')
      const n = h
        .approved('recipes.csv')
        .filter((r) => h.val(r, 'result_kind') === resultKind && h.val(r, 'result_id') === id).length
      if (n !== 1) {
        report.block({
          file,
          line: item.lineNumber,
          field: 'id',
          problem: `\`${id}\` 를 만드는 승인 레시피가 ${n}개다. 정확히 하나여야 한다`,
          basis: 'DEC-CONTENT-015',
          fix: n === 0 ? '레시피를 추가한다' : '하나만 남긴다',
        })
      }
    }
  }
}

function recipeInputKinds({ report, h }) {
  for (const r of h.approved('recipes.csv')) {
    const id = h.val(r, 'id')
    const inputs = h.rows('recipe_inputs.csv').filter((i) => h.val(i, 'recipe_id') === id)
    for (const kind of ['crop', 'material']) {
      if (!inputs.some((i) => h.val(i, 'input_kind') === kind)) {
        report.block({
          file: 'recipes.csv',
          line: r.lineNumber,
          field: 'id',
          problem: `레시피 \`${id}\` 에 ${kind} 입력이 없다`,
          basis: 'DEC-CONTENT-015 · 승인 레시피는 승인 작물 1종 이상과 승인 조합 재료 1종 이상을 요구한다',
          fix: `recipe_inputs.csv 에 ${kind} 입력을 추가한다`,
        })
      }
    }
  }
}

function modifierDirection(state) {
  const rules =
    state === 'weakened'
      ? [
          ['max_health_multiplier', (v) => v <= 1, '1 이하'],
          ['move_speed_multiplier', (v) => v <= 1, '1 이하'],
          ['attack_damage_multiplier', (v) => v <= 1, '1 이하'],
          ['attack_cooldown_multiplier', (v) => v >= 1, '1 이상'],
        ]
      : [
          ['max_health_multiplier', (v) => v >= 1, '1 이상'],
          ['move_speed_multiplier', (v) => v >= 1, '1 이상'],
          ['attack_damage_multiplier', (v) => v >= 1, '1 이상'],
          ['attack_cooldown_multiplier', (v) => v <= 1, '1 이하'],
        ]

  return ({ report, h }) => {
    for (const r of h.rows('resident_combat_modifiers.csv')) {
      if (h.val(r, 'combat_state') !== state) continue
      for (const [field, ok, label] of rules) {
        const v = h.num(r, field)
        if (Number.isFinite(v) && !ok(v)) {
          report.block({
            file: 'resident_combat_modifiers.csv',
            line: r.lineNumber,
            field,
            problem: `${state} 상태의 ${field} 는 ${label}이어야 한다. 실제 값 ${v}`,
            basis: 'DEC-CONTENT-009',
            fix: `${label}으로 바꾼다`,
          })
        }
      }
    }
  }
}

function dayContinuity({ report, h }) {
  for (const s of h.approved('run_schedules.csv')) {
    const sid = h.val(s, 'id')
    const total = h.num(s, 'total_days')
    if (!Number.isFinite(total)) continue

    const days = h
      .rows('run_schedule_days.csv')
      .filter((d) => h.val(d, 'run_schedule_id') === sid)
      .map((d) => h.num(d, 'day_number'))

    for (let n = 1; n <= total; n++) {
      const count = days.filter((d) => d === n).length
      if (count === 0) {
        report.block({
          file: 'run_schedule_days.csv',
          problem: `${n}일차 행이 없다. 1부터 ${total}까지 연속돼야 한다`,
          basis: 'DEC-CONTENT-002',
          fix: `${n}일차 행을 추가한다`,
        })
      } else if (count > 1) {
        report.block({
          file: 'run_schedule_days.csv',
          problem: `${n}일차 행이 ${count}개다`,
          basis: 'DEC-CONTENT-002 · day_number 는 중복될 수 없다',
          fix: '중복 행을 제거한다',
        })
      }
    }

    for (const d of days) {
      if (d > total) {
        report.block({
          file: 'run_schedule_days.csv',
          field: 'day_number',
          problem: `${d}일차가 total_days(${total}) 를 넘는다`,
          basis: 'DEC-CONTENT-002',
          fix: '행을 제거하거나 total_days 를 늘린다',
        })
      }
    }
  }
}

function bandDefaultEnding({ report, h }) {
  const withCond = new Set(h.rows('ending_conditions.csv').map((c) => h.val(c, 'ending_id')))
  for (const band of h.approved('fear_bands.csv')) {
    const bid = h.val(band, 'id')
    const defaults = h
      .approved('endings.csv')
      .filter(
        (e) =>
          h.val(e, 'fear_band_id') === bid &&
          h.num(e, 'selection_priority') === 0 &&
          !withCond.has(h.val(e, 'id'))
      )
    if (defaults.length !== 1) {
      report.block({
        file: 'endings.csv',
        problem: `공포도 구간 \`${bid}\` 의 기본 엔딩이 ${defaults.length}개다. 정확히 하나여야 한다`,
        basis: 'DEC-CONTENT-011 · 각 공포도 구간에는 추가 조건이 없는 기본 엔딩을 정확히 하나 둔다',
        fix: defaults.length === 0 ? '조건 없는 우선순위 0 엔딩을 하나 만든다' : '하나만 남긴다',
      })
    }
  }
}

function weaponAttributeCropIncluded({ report, h }) {
  const weaponById = new Map(h.rows('throwable_weapons.csv').map((w) => [h.val(w, 'id'), w]))
  const cropByAttr = new Map()
  for (const c of h.rows('crops.csv')) {
    const attr = h.val(c, 'crop_attribute_id')
    if (attr) cropByAttr.set(attr, h.val(c, 'id'))
  }

  for (const r of h.approved('recipes.csv')) {
    if (h.val(r, 'result_kind') !== 'throwable_weapon') continue
    const weapon = weaponById.get(h.val(r, 'result_id'))
    if (!weapon) continue

    const attr = h.val(weapon, 'crop_attribute_id')
    const needCrop = cropByAttr.get(attr)
    if (!needCrop) continue

    const inputs = h.rows('recipe_inputs.csv').filter((i) => h.val(i, 'recipe_id') === h.val(r, 'id'))
    if (!inputs.some((i) => h.val(i, 'input_id') === needCrop)) {
      report.block({
        file: 'recipes.csv',
        line: r.lineNumber,
        field: 'result_id',
        problem: `결과 무기의 속성 \`${attr}\` 에 대응하는 작물 \`${needCrop}\` 이 입력에 없다`,
        basis: 'DEC-CONTENT-015 · 투척 무기 레시피는 결과 무기의 crop_attribute_id 에 대응하는 작물을 반드시 포함해야 한다',
        fix: `recipe_inputs.csv 에 \`${needCrop}\` 을 추가한다`,
      })
    }
  }
}

/**
 * 선택지가 실제로 도달할 수 있는 모든 시스템 결과에 반응 대사가 있는지.
 *
 * 전투 전 선택은 (그 시나리오를 쓰는 주민의 성격 프로필 × 선택 기능) 으로 결과를 구하고,
 * 투항 선택은 direct_system_result_id 하나가 곧 결과다.
 */
function reachableResponses({ report, h }) {
  const scenarioToResident = new Map(
    h.approved('story_scenarios.csv').map((s) => [h.val(s, 'id'), h.val(s, 'resident_id')])
  )
  const residentProfile = new Map(
    h.approved('residents.csv').map((r) => [h.val(r, 'id'), h.val(r, 'personality_profile_id')])
  )
  const outcomes = new Map()
  for (const o of h.rows('personality_choice_outcomes.csv')) {
    outcomes.set(`${h.val(o, 'personality_profile_id')}@${h.val(o, 'choice_function')}`, o)
  }

  const responses = new Set(
    h.rows('dialogue_choice_responses.csv').map((r) => `${h.val(r, 'choice_id')}@${h.val(r, 'system_result_id')}`)
  )

  for (const c of h.approved('dialogue_choices.csv')) {
    const id = h.val(c, 'id')
    const phase = h.val(c, 'dialogue_phase')
    const fn = h.val(c, 'choice_function')
    const reachable = new Set()

    if (phase === 'surrender') {
      const direct = h.val(c, 'direct_system_result_id')
      if (direct) reachable.add(direct)
    } else if (phase === 'precombat') {
      const resident = scenarioToResident.get(h.val(c, 'scenario_id'))
      const profile = resident ? residentProfile.get(resident) : null
      if (!profile) continue
      const o = outcomes.get(`${profile}@${fn}`)
      if (!o) continue

      const available = h.val(o, 'result_when_available_id')
      if (available) reachable.add(available)
      // 자원 협상은 실행 직전 수량 부족 예외까지 반응이 필요하다
      if (fn === 'resource_negotiation') {
        const unavailable = h.val(o, 'result_when_unavailable_id')
        if (unavailable) reachable.add(unavailable)
      }
    }

    for (const result of reachable) {
      if (!responses.has(`${id}@${result}`)) {
        report.block({
          file: 'dialogue_choice_responses.csv',
          problem: `선택지 \`${id}\` 가 도달할 수 있는 결과 \`${result}\` 의 반응 대사가 없다`,
          basis: 'DEC-CONTENT-009 · 선택지는 실제 도달 가능한 모든 시스템 결과의 반응 행을 가져야 한다',
          fix: `(choice_id=${id}, system_result_id=${result}) 행을 추가한다`,
        })
      }
    }
  }
}

export { helpers }
