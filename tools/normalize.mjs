#!/usr/bin/env node
//
// 작업용 CSV를 승인 후보로 정규화하고 변경 보고서를 만든다.
//
//   npm run data:normalize            data/drafts/ → data/candidates/
//   npm run data:normalize crops.csv  한 파일만
//
// DEC-PIPELINE-007 의 왕복 흐름에서 "AI 정규화" 자리에 해당한다.
// 담당자가 수정한 내용을 바꾸지 않는다. 값 표현만 DEC-PIPELINE-013 표준으로 맞추고,
// 마지막 승인본과 비교한 결과를 보고서로 남긴다.
//
// 이 도구는 승인하지 않는다. content_status 를 approved 로 바꾸지 않으며
// data/approved/ 에 쓰지 않는다. (DEC-PIPELINE-004)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, sep } from 'node:path'
import { loadSchema, allFields, expectedHeader } from './lib/schema.mjs'
import { readCsv, serializeCsv, normalizeCell, isPlaceholder } from './lib/csv.mjs'

const SRC = 'data/drafts'
const DST = 'data/candidates'
const APPROVED = 'data/approved'
const REPORTS = join(DST, 'reports')

/** 보고서에는 운영체제와 무관하게 슬래시 경로를 쓴다 */
const posix = (p) => p.split(sep).join('/')

/** 필드 종류에 맞는 정규화 분류 */
function kindOf(field) {
  switch (field.type) {
    case 'integer':
      return 'integer'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'enum':
      return 'enum'
    case 'reference':
      return 'id'
    default:
      return field.name === 'id' ? 'id' : 'text'
  }
}

/**
 * 한 파일을 정규화한다.
 * @returns {{ header: string[], records: object[], changes: object[] }}
 */
function normalizeTable(def, common, raw) {
  const fields = allFields(def, common)
  const header = expectedHeader(def, common)
  const byName = new Map(fields.map((f) => [f.name, f]))
  const changes = []

  const records = raw.records.map((record) => {
    const out = {}
    for (const column of header) {
      const field = byName.get(column)
      const before = record.cells[column] ?? ''
      const after = normalizeCell(before, field ? kindOf(field) : 'text')
      out[column] = after
      if (before !== after) {
        changes.push({
          line: record.lineNumber,
          field: column,
          before,
          after,
          reason: '값 표현 정규화',
        })
      }
    }
    return out
  })

  // 헤더에 없는 열이 원본에 있으면 버리지 않고 보고한다
  const dropped = raw.header.filter((h) => !header.includes(h))

  return { header, records, changes, dropped, hadBom: raw.hadBom }
}

/** 마지막 승인본과 비교 */
function diffAgainstApproved(name, header, records) {
  const path = join(APPROVED, name)
  if (!existsSync(path)) {
    return { baseline: null, added: records.length, removed: 0, changed: 0, details: [] }
  }

  const base = readCsv(readFileSync(path, 'utf8'))
  const keyOf = (cells) => (cells.id ?? '').trim() || JSON.stringify(cells)

  const baseByKey = new Map(base.records.map((r) => [keyOf(r.cells), r.cells]))
  const nowByKey = new Map(records.map((r) => [keyOf(r), r]))

  const details = []
  let added = 0
  let removed = 0
  let changed = 0

  for (const [key, cells] of nowByKey) {
    const old = baseByKey.get(key)
    if (!old) {
      added++
      details.push({ type: '추가', key })
      continue
    }
    const diffs = header.filter((h) => (old[h] ?? '') !== (cells[h] ?? ''))
    if (diffs.length > 0) {
      changed++
      details.push({ type: '변경', key, fields: diffs })
    }
  }

  for (const key of baseByKey.keys()) {
    if (!nowByKey.has(key)) {
      removed++
      details.push({ type: '삭제', key })
    }
  }

  return { baseline: path, added, removed, changed, details }
}

function buildReport(name, result, diff) {
  const lines = [
    `# 변경 보고서 — ${name}`,
    '',
    '> `npm run data:normalize` 가 생성한다. 직접 수정하지 않는다.',
    '> 담당자가 이 내용을 검토하고 승인한 파일만 `data/approved/` 로 옮긴다.',
    '',
    '## 요약',
    '',
    `- 원본: \`${posix(join(SRC, name))}\``,
    `- 승인 후보: \`${posix(join(DST, name))}\``,
    `- 비교 기준: ${diff.baseline ? `\`${posix(diff.baseline)}\`` : '없음 (최초 작성)'}`,
    `- 추가 ${diff.added} · 변경 ${diff.changed} · 삭제 ${diff.removed}`,
    `- 값 표현 정규화 ${result.changes.length}건`,
    '',
  ]

  if (result.hadBom) {
    lines.push('원본에 UTF-8 BOM이 있어 승인 후보에서는 제거했다. (DEC-PIPELINE-013)', '')
  }

  if (result.dropped.length > 0) {
    lines.push(
      '## 스키마에 없는 열',
      '',
      '아래 열은 스키마에 없어 승인 후보에서 제외했다. 필요한 열이면 임의로 추가하지 말고',
      '기획 책임자에게 스키마 변경을 요청한다. (DEC-PIPELINE-016)',
      '',
      ...result.dropped.map((c) => `- \`${c}\``),
      ''
    )
  }

  if (diff.details.length > 0) {
    lines.push('## 승인본 대비 변경', '', '| 종류 | 항목 | 필드 |', '|---|---|---|')
    for (const d of diff.details) {
      lines.push(`| ${d.type} | \`${d.key}\` | ${d.fields ? d.fields.join(', ') : '—'} |`)
    }
    lines.push('')
  }

  if (result.changes.length > 0) {
    lines.push('## 값 표현 정규화', '', '| 행 | 필드 | 원본 | 정규화 | 이유 |', '|---|---|---|---|---|')
    for (const c of result.changes) {
      lines.push(`| ${c.line} | ${c.field} | \`${c.before}\` | \`${c.after}\` | ${c.reason} |`)
    }
    lines.push('')
  }

  const placeholders = []
  for (const record of result.records) {
    for (const [field, value] of Object.entries(record)) {
      if (isPlaceholder(value)) placeholders.push({ field, value })
    }
  }
  if (placeholders.length > 0) {
    lines.push(
      '## 남은 AUTO / TBD',
      '',
      `${placeholders.length}건. 승인 CSV에는 남을 수 없다. (DEC-PIPELINE-013)`,
      ''
    )
  }

  lines.push(
    '## 다음',
    '',
    '1. 이 보고서와 승인 후보 CSV를 검토한다.',
    '2. 고칠 것이 있으면 `data/drafts/` 를 고치고 다시 정규화한다.',
    '3. 확정되면 승인 후보를 `data/approved/` 로 옮기고 `content_status` 를 `approved` 로 바꾼다.',
    '4. `npm run data:validate` 로 검증한다.',
    ''
  )

  return lines.join('\n')
}

function main() {
  const only = process.argv[2]
  const schema = loadSchema()

  if (!existsSync(SRC)) {
    console.error(`${SRC} 가 없다.`)
    process.exit(1)
  }

  mkdirSync(DST, { recursive: true })
  mkdirSync(REPORTS, { recursive: true })

  let processed = 0

  for (const name of schema.tables.keys()) {
    if (only && name !== only) continue
    const src = join(SRC, name)
    if (!existsSync(src)) continue

    const def = schema.tables.get(name)
    const raw = readCsv(readFileSync(src, 'utf8'))
    const result = normalizeTable(def, schema.common, raw)
    const diff = diffAgainstApproved(name, result.header, result.records)

    writeFileSync(join(DST, name), serializeCsv(result.header, result.records), 'utf8')
    writeFileSync(join(REPORTS, name.replace('.csv', '.md')), buildReport(name, result, diff), 'utf8')

    console.log(
      `${name}  행 ${result.records.length} · 정규화 ${result.changes.length} · ` +
        `추가 ${diff.added} 변경 ${diff.changed} 삭제 ${diff.removed}` +
        (result.dropped.length ? ` · 제외한 열 ${result.dropped.length}` : '')
    )
    processed++
  }

  if (processed === 0) {
    console.log(only ? `${SRC}/${only} 가 없다.` : `${SRC} 에 정규화할 CSV가 없다.`)
    return
  }

  console.log('')
  console.log(`${processed}개 파일을 ${DST} 로 정규화했다.`)
  console.log(`변경 보고서: ${posix(REPORTS)}`)
  console.log('')
  console.log('승인은 사람이 한다. 이 도구는 data/approved/ 에 쓰지 않는다.')
}

main()
