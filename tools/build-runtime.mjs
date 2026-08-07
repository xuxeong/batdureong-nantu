#!/usr/bin/env node
//
// 승인 CSV에서 게임이 읽는 런타임 JSON을 생성한다.
//
//   npm run data:build
//
// DEC-PIPELINE-010 에 따라 검증을 통과한 승인 데이터만 입력으로 쓴다.
// 차단 오류가 있으면 생성하지 않는다.
//
// 생성물은 직접 수정하지 않는다. 언제든 이 명령으로 다시 만든다.

import { writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { loadSchema, loadDataset, allFields, refTargets } from './lib/schema.mjs'

const SRC = 'data/approved'
const OUT = 'generated/runtime'

/**
 * 런타임 JSON에 넣지 않는 열.
 *
 * content_status  — 작성·승인 관리용 (DEC-CONTENT-001)
 * design_intent   — AI 제작 제약용 (DEC-CONTENT-001)
 * source_fact_text — 숨겨진 설정 원본. 게임 화면과 엔딩 LLM 입력에
 *                    직접 전달하지 않는다 (DEC-CONTENT-017)
 */
const RUNTIME_EXCLUDED = new Set(['content_status', 'design_intent', 'source_fact_text'])

/**
 * 연결 CSV를 부모에 붙일 때 사용할 속성 이름.
 * 부모 파일은 스키마의 parent.table 이 알려준다.
 */
const CHILD_KEY = {
  'map_points.csv': 'points',
  'farm_plots.csv': 'farm_plots',
  'recipe_inputs.csv': 'inputs',
  'crop_mastery_unlocks.csv': 'mastery_unlock',
  'wildlife_spawn_entries.csv': 'entries',
  'reward_bundle_entries.csv': 'entries',
  'personality_choice_outcomes.csv': 'choice_outcomes',
  'dialogue_choice_responses.csv': 'responses',
  'run_schedule_days.csv': 'days',
  'ending_conditions.csv': 'conditions',
  'content_assets.csv': 'assets',
}

/** 값 하나를 필드 자료형에 맞는 JSON 값으로 바꾼다 */
function toValue(raw, field) {
  const v = (raw ?? '').trim()
  if (v === '') return null

  switch (field?.type) {
    case 'integer':
    case 'number':
      return Number(v)
    case 'boolean':
      return v === 'true'
    default:
      return v
  }
}

/** 한 행을 런타임 객체로 */
function toObject(record, fields) {
  const out = {}
  for (const field of fields) {
    if (RUNTIME_EXCLUDED.has(field.name)) continue
    out[field.name] = toValue(record.cells[field.name], field)
  }
  return out
}

function main() {
  // 1. 검증을 먼저 통과해야 한다
  console.log('승인 데이터 검증 중...')
  try {
    execFileSync('node', ['tools/validate.mjs', 'approved'], { stdio: 'pipe', encoding: 'utf8' })
  } catch (err) {
    // 기존 생성물은 지우지 않는다. DEC-PIPELINE-004 에 따라 재검토가 끝날 때까지
    // 게임은 검증을 통과한 마지막 승인본을 계속 사용한다.
    console.error('')
    console.error('검증에 실패해 런타임 데이터를 생성하지 않는다.')
    console.error('이전 생성물은 그대로 둔다. 검증을 통과한 마지막 승인본을 계속 사용한다.')
    console.error('npm run data:validate 로 오류를 확인한다.')
    console.error('근거: DEC-PIPELINE-010, DEC-PIPELINE-004')
    process.exit(1)
  }

  const schema = loadSchema()
  const dataset = loadDataset(SRC, schema)

  if (dataset.tables.size === 0) {
    console.log('승인된 CSV가 없다. 생성할 것이 없다.')
    process.exit(0)
  }

  // 2. 표별로 승인 행만 객체로 변환
  const independent = new Map() // 독립 콘텐츠: file → id → object
  const links = new Map() // 연결 CSV: file → [{ parentId, object }]

  for (const [name, table] of dataset.tables) {
    const def = schema.tables.get(name)
    const fields = allFields(def, schema.common)

    if (def.entry_type === 'independent') {
      const byId = new Map()
      for (const record of table.records) {
        if ((record.cells.content_status ?? '').trim() !== 'approved') continue
        const obj = toObject(record, fields)
        byId.set(obj.id, obj)
      }
      independent.set(name, byId)
    } else {
      const list = []
      for (const record of table.records) {
        list.push({
          parentId: (record.cells[def.parent.field] ?? '').trim(),
          object: toObject(record, fields),
        })
      }
      links.set(name, list)
    }
  }

  // 3. 연결 CSV를 부모에 결합한다 (DEC-PIPELINE-008)
  //    부모가 승인 상태가 아니면 런타임에 포함하지 않는다 (DEC-PIPELINE-011)
  let orphaned = 0
  for (const [name, list] of links) {
    const def = schema.tables.get(name)
    // 부모가 한 테이블이 아닐 수 있다. content_assets.csv 는 에셋을 쓰는 콘텐츠
    // 전체가 부모라 parent.table 이 `a.csv | b.csv` 후보 목록이다 (DEC-ART-002).
    const parentTables = refTargets(def.parent).map((f) => independent.get(f)).filter(Boolean)
    if (parentTables.length === 0) continue

    const key = CHILD_KEY[name] ?? name.replace('.csv', '')
    const single = name === 'crop_mastery_unlocks.csv' // 레시피당 최대 하나
    // 에셋은 배열이 아니라 역할로 찾는다. (content_id, asset_role) 이 고유 키라
    // 역할 하나에 ID 하나가 보장된다. 렌더러가 crop.assets.crop_ready 로 읽는다.
    const byRole = name === 'content_assets.csv'

    for (const { parentId, object } of list) {
      const parent = parentTables.map((t) => t.get(parentId)).find(Boolean)
      if (!parent) {
        orphaned++
        continue
      }
      if (byRole) {
        if (!parent[key]) parent[key] = {}
        parent[key][object.asset_role] = object.asset_id
      } else if (single) {
        parent[key] = object
      } else {
        if (!parent[key]) parent[key] = []
        parent[key].push(object)
      }
    }
  }

  // 4. 역방향 관계를 자동 계산한다.
  //    콘텐츠 CSV에는 역참조를 저장하지 않기 때문이다.
  //    (DEC-RESIDENT-051, DEC-CONTENT-004, DEC-CONTENT-012)
  const residents = independent.get('residents.csv')
  const scenarios = independent.get('story_scenarios.csv')
  if (residents && scenarios) {
    // 주민별 승인 사연 시나리오 목록
    for (const scenario of scenarios.values()) {
      const resident = residents.get(scenario.resident_id)
      if (!resident) continue
      if (!resident.story_scenario_ids) resident.story_scenario_ids = []
      resident.story_scenario_ids.push(scenario.id)
    }
  }

  const materials = independent.get('crafting_materials.csv')
  const recipes = independent.get('recipes.csv')
  if (materials && recipes) {
    // 재료 용도는 저장하지 않고 레시피의 결과 분류에서 역산한다 (DEC-CONTENT-004)
    for (const material of materials.values()) material.used_by = []
    for (const recipe of recipes.values()) {
      for (const input of recipe.inputs ?? []) {
        if (input.input_kind !== 'material') continue
        const material = materials.get(input.input_id)
        if (material && !material.used_by.includes(recipe.result_kind)) {
          material.used_by.push(recipe.result_kind)
        }
      }
    }
  }

  // 5. 파일로 쓴다
  //
  // 폴더를 통째로 지우지 않는다. `.gitkeep` 이 같이 사라져서 폴더가 저장소에서
  // 빠지고, 그 삭제가 다음 커밋에 조용히 딸려 들어간다. 실제로 8/3에 두 번 났다.
  // 지울 대상은 이 도구가 만든 JSON 뿐이다.
  mkdirSync(OUT, { recursive: true })
  if (existsSync(OUT)) {
    for (const stale of readdirSync(OUT)) {
      if (stale.endsWith('.json')) rmSync(join(OUT, stale), { force: true })
    }
  }

  const written = []
  for (const [name, byId] of independent) {
    const rows = [...byId.values()]
    if (rows.length === 0) continue
    const file = name.replace('.csv', '.json')
    writeFileSync(join(OUT, file), JSON.stringify(rows, null, 2) + '\n', 'utf8')
    written.push({ file, rows: rows.length })
  }

  // 버전은 콘텐츠 행마다 반복하지 않고 한 번만 기록한다 (DEC-PIPELINE-010, DEC-PIPELINE-012)
  const manifest = {
    schema_version: schema.manifest.schema_version,
    ending_input_schema_version: schema.manifest.ending_input_schema_version,
    ending_prompt_version: schema.manifest.ending_prompt_version,
    journal_prompt_version: schema.manifest.journal_prompt_version,
    files: written.map((w) => w.file).sort(),
  }
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8')

  console.log('')
  for (const w of written.sort((a, b) => a.file.localeCompare(b.file))) {
    console.log(`  ${w.file}  ${w.rows}행`)
  }
  console.log('')
  console.log(`${OUT} 에 ${written.length}개 파일 + manifest.json 생성`)
  if (orphaned > 0) {
    console.log(`부모가 승인 상태가 아니라 제외한 연결 행 ${orphaned}개`)
  }
  console.log('')
  console.log('생성물은 직접 수정하지 않는다. 커밋하지 않고 이 명령으로 다시 만든다.')
}

main()
