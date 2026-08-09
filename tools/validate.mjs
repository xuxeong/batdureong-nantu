#!/usr/bin/env node
//
// 콘텐츠 CSV 검증
//
//   npm run data:validate              data/approved/ 검사
//   node tools/validate.mjs candidates data/candidates/ 검사
//   node tools/validate.mjs drafts     data/drafts/ 검사
//
// 차단 오류가 하나라도 있으면 종료 코드 1을 반환한다.
//
// 스키마의 rules[].id 중 tools/lib/rules.mjs 에 구현이 없는 것은
// "미구현"으로 함께 보고한다. 조용히 넘어가지 않는다.

import { existsSync } from 'node:fs'
import { loadSchema, loadDataset, indexIds } from './lib/schema.mjs'
import { Report, BLOCK, WARN, SUGGEST } from './lib/report.mjs'
import { checkCellCount, checkHeader, checkRows, checkCommonEntry, checkReferences, checkUniqueKey } from './lib/checks.mjs'
import { RULES, helpers, COVERED_BY_FIELD_CHECKS, ENFORCED_AT_RUNTIME } from './lib/rules.mjs'

const STAGES = {
  approved: { dir: 'data/approved', label: '승인본' },
  candidates: { dir: 'data/candidates', label: '승인 후보' },
  drafts: { dir: 'data/drafts', label: '작업용 초안' },
}

function main() {
  const args = process.argv.slice(2)

  // --dir 로 임의 경로를 검사할 수 있다. 테스트 픽스처 검증에 쓴다.
  const dirIndex = args.indexOf('--dir')
  const dirOverride = dirIndex >= 0 ? args[dirIndex + 1] : null
  const stageName = (dirIndex >= 0 ? args[0] === '--dir' ? 'approved' : args[0] : args[0]) ?? 'approved'

  const stage = dirOverride
    ? { dir: dirOverride, label: `직접 지정 (${stageName} 규칙)` }
    : STAGES[stageName]

  if (!stage) {
    console.error(`알 수 없는 단계: ${stageName}`)
    console.error(`사용: node tools/validate.mjs [${Object.keys(STAGES).join('|')}] [--dir <경로>]`)
    process.exit(2)
  }

  const schema = loadSchema()
  const dataset = loadDataset(stage.dir, schema)
  const report = new Report()

  const written = dataset.tables.size
  const total = schema.tables.size

  console.log(`검증 대상: ${stage.dir} (${stage.label})`)
  console.log(`CSV ${written} / ${total}종 작성됨`)
  console.log('')

  if (written === 0) {
    console.log('작성된 CSV가 없다. 콘텐츠 데이터 준비도 점검 문서 5절의 1단계부터 시작한다.')
    console.log('  1단계: maps.csv · map_points.csv · farm_plots.csv')
    process.exit(0)
  }

  // 스키마에 없는 CSV
  for (const name of dataset.unknown) {
    report.block({
      file: name,
      problem: '스키마에 정의되지 않은 CSV다',
      basis: `DEC-PIPELINE-019 · 이름이 확정된 CSV는 ${schema.tables.size}개다`,
      fix: '파일명을 확인하거나 기획 책임자에게 스키마 추가를 요청한다',
    })
  }

  // ID 색인은 참조 검사에 필요하므로 먼저 만든다
  const idIndex = indexIds(dataset, schema)
  const findById = (id) => {
    for (const [, table] of dataset.tables) {
      const hit = table.records.find((r) => (r.cells.id ?? '').trim() === id)
      if (hit) return hit
    }
    return null
  }

  // 표별 검사
  for (const [name, table] of dataset.tables) {
    const def = schema.tables.get(name)
    // 칸 수를 먼저 본다. 칸이 밀린 행은 아래 검사에서 엉뚱한 열을 탓하는
    // 오류를 줄줄이 만드는데, 그 원인이 목록 맨 위에 있어야 읽힌다.
    checkCellCount(report, name, table)
    checkHeader(report, name, table, def, schema)
    checkRows(report, name, table, def, schema, { stage: stageName, findById })
    checkReferences(report, name, table, def, schema, dataset, idIndex)
    checkUniqueKey(report, name, table, def)

    if (table.hadBom && stageName !== 'drafts') {
      report.warn({
        file: name,
        problem: 'UTF-8 BOM이 있다',
        basis: 'DEC-PIPELINE-013 · 승인 후보와 승인 CSV는 UTF-8 쉼표 구분 형식으로 정규화한다',
        fix: 'npm run data:normalize 로 정규화한다',
      })
    }
  }

  checkCommonEntry(report, idIndex, schema)

  // 표별 교차 규칙
  const h = helpers(dataset)
  const ctx = { report, schema, dataset, h }
  const unimplemented = []
  const skipped = []
  const seen = new Set()
  let ran = 0

  for (const [name, def] of schema.tables) {
    for (const rule of def.rules ?? []) {
      if (seen.has(rule.id)) continue
      seen.add(rule.id)

      // 필드 정의 검사가 이미 수행하는 규칙
      if (COVERED_BY_FIELD_CHECKS.has(rule.id)) {
        ran++
        continue
      }

      // 런타임 생성 단계에서 보장하는 규칙
      if (ENFORCED_AT_RUNTIME.has(rule.id)) continue

      const fn = RULES[rule.id]
      if (!fn) {
        unimplemented.push({ id: rule.id, file: name, severity: rule.severity })
        continue
      }

      // 규칙을 선언한 CSV가 아직 없으면 검사하지 않는다.
      // 1단계 작업 중에 12단계 데이터가 없다고 오류를 내면 안 된다.
      if (!dataset.tables.has(name)) {
        skipped.push(name)
        continue
      }

      try {
        fn(ctx)
        ran++
      } catch (err) {
        report.warn({
          file: name,
          problem: `규칙 \`${rule.id}\` 실행 중 오류: ${err.message}`,
          basis: '검증 도구',
          fix: 'tools/lib/rules.mjs 를 확인한다',
        })
      }
    }
  }

  process.stdout.write(report.toText())

  if (unimplemented.length > 0) {
    console.log('')
    console.log(`── 미구현 규칙 ${unimplemented.length}건 ` + '─'.repeat(36))
    console.log('  스키마에 정의됐지만 검증 도구에 구현하지 않았다.')
    console.log('  해당 데이터를 작성할 때 사람이 직접 확인한다.')
    console.log('')
    for (const u of unimplemented) {
      console.log(`  ${u.severity} | ${u.id}  (${u.file})`)
    }
  }

  console.log('')
  const covered = seen.size - unimplemented.length - ENFORCED_AT_RUNTIME.size
  console.log(`규칙 ${covered}/${seen.size} 구현 · 이번 실행에서 ${ran}건 검사`)
  if (dataset.missing.length > 0) {
    console.log(`아직 없는 CSV ${dataset.missing.length}종의 규칙은 건너뛰었다`)
  }

  process.exit(report.exitCode())
}

main()
