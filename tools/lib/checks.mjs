// 검증 로직
//
// 스키마의 필드 정의에서 기계적으로 나오는 검사를 수행한다.
// 표별 교차 규칙은 tools/lib/rules.mjs 에서 rule id 별로 구현한다.

import {
  isForbiddenEmptyMarker,
  isPlaceholder,
  hasLineBreak,
  parseInteger,
  parseNumber,
  parseBoolean,
} from './csv.mjs'
import { expectedHeader, allFields, refTargets, compositeKey } from './schema.mjs'

/**
 * `field == a | b` / `field != a | b` / `ref.field == a` 형태의 조건식을 평가한다.
 * 스키마의 required_when, empty_when 에서 사용한다.
 *
 * @returns {boolean|null} 평가할 수 없으면 null
 */
export function evalCondition(expr, record, ctx) {
  if (!expr) return null

  const m = expr.match(/^\s*([\w.]+)\s*(==|!=)\s*(.+?)\s*$/)
  if (!m) return null

  const [, path, op, rhs] = m
  const wanted = rhs.split('|').map((s) => s.trim()).filter(Boolean)

  let actual
  if (path.includes('.')) {
    // 참조한 행의 값을 본다. 예: crop_attribute.combat_mechanic_key
    const [prefix, field] = path.split('.')
    const refValue = (record.cells[`${prefix}_id`] ?? '').trim()
    if (!refValue) return null
    const target = ctx.findById?.(refValue)
    if (!target) return null
    actual = (target.cells[field] ?? '').trim()
  } else {
    actual = (record.cells[path] ?? '').trim()
  }

  const hit = wanted.includes(actual)
  return op === '==' ? hit : !hit
}

/**
 * 행마다 칸 수가 헤더와 같은지.
 *
 * **헤더 이름만 봐서는 못 잡는 자리다.** `toRecords` 가 헤더 길이만큼만 읽어서
 * 칸이 더 많으면 남는 값이 조용히 버려지고, 칸이 적으면 뒤쪽이 빈 문자열이 된다.
 * 둘 다 헤더는 멀쩡하므로 `checkHeader` 를 통과한다.
 *
 * 실제로 2026-08-09 에 튜토리얼 안내 문구 안의 쉼표가 따옴표 없이 들어가 열이
 * 하나 늘었는데, 검증이 통과하고 **화면에서 문구가 잘려야만** 드러났다.
 * 값이 사라지는 종류라 사람이 눈으로 보기 전에는 아무도 모른다.
 *
 * 고치는 방법은 대개 그 칸을 큰따옴표로 감싸는 것이다 —
 * `dialogue_choice_responses.csv` 와 `story_scenarios.csv` 가 이미 그렇게 쓴다.
 */
export function checkCellCount(report, name, table) {
  const expected = table.header.length
  for (const record of table.records) {
    if (record.cellCount === undefined || record.cellCount === expected) continue

    const more = record.cellCount > expected
    report.block({
      file: name,
      line: record.lineNumber,
      field: '',
      problem: more
        ? `칸이 ${record.cellCount}개로 헤더(${expected}개)보다 많다. 남는 값은 어디에도 들어가지 않고 버려진다`
        : `칸이 ${record.cellCount}개로 헤더(${expected}개)보다 적다. 뒤쪽 열이 빈 값이 된다`,
      basis: 'DEC-PIPELINE-013 · tools/lib/csv.mjs 는 헤더 길이만큼만 읽는다',
      fix: more
        ? '값 안에 쉼표가 있으면 그 칸을 큰따옴표로 감싼다'
        : '빠진 열을 채운다. 빈 값이면 쉼표만 두고 자리를 남긴다',
    })
  }
}

/** 헤더가 스키마와 맞는지 */
export function checkHeader(report, name, table, def, schema) {
  const expected = expectedHeader(def, schema.common)
  const actual = table.header

  const missing = expected.filter((c) => !actual.includes(c))
  const extra = actual.filter((c) => !expected.includes(c))

  for (const col of missing) {
    report.block({
      file: name,
      line: 1,
      field: col,
      problem: '스키마에 정의된 열이 없다',
      basis: `${def.decisions?.join(', ') ?? '스키마'} · schema/tables/${name.replace('.csv', '.json')}`,
      fix: `헤더에 \`${col}\` 열을 추가한다`,
    })
  }

  for (const col of extra) {
    report.block({
      file: name,
      line: 1,
      field: col,
      problem: '스키마에 없는 열이다',
      basis: 'DEC-PIPELINE-016 · 새 필드 추가는 콘텐츠 값 추가가 아니라 시스템·스키마 변경이다',
      fix: `열을 제거하거나, 필요하면 기획 책임자에게 스키마 변경을 요청한다`,
    })
  }

  if (missing.length === 0 && extra.length === 0) {
    const orderMismatch = expected.some((c, i) => actual[i] !== c)
    if (orderMismatch) {
      report.suggest({
        file: name,
        line: 1,
        problem: '열 순서가 스키마와 다르다',
        basis: 'DEC-PIPELINE-013 · 열 순서 정규화는 콘텐츠 버전 증가 사유가 아니다',
        fix: 'npm run data:normalize 로 정규화한다',
      })
    }
  }
}

/** 값 하나를 필드 정의에 맞춰 검사 */
function checkValue(report, name, record, field, value, def, opts) {
  const at = { file: name, line: record.lineNumber, field: field.name }
  const basis = def.decisions?.join(', ') ?? '스키마'

  if (hasLineBreak(value)) {
    report.block({
      ...at,
      problem: '셀 안에 줄바꿈이 들어 있다',
      basis: 'DEC-PIPELINE-013 · 셀 안의 실제 줄바꿈은 허용하지 않는다',
      fix: '줄바꿈을 제거한다',
    })
    return
  }

  if (isForbiddenEmptyRepresentation(value)) {
    report.block({
      ...at,
      problem: `빈 값을 \`${value}\` 로 표기했다`,
      basis: 'DEC-PIPELINE-013 · 빈 값을 null, NULL, N/A, 없음, - 로 대신하지 않는다',
      fix: '셀을 비운다',
    })
    return
  }

  if (isPlaceholder(value)) {
    if (opts.stage === 'approved') {
      report.block({
        ...at,
        problem: `승인 CSV에 \`${value}\` 가 남아 있다`,
        basis: 'DEC-PIPELINE-013 · 승인 CSV에는 빈 필수값, AUTO와 TBD가 남아 있을 수 없다',
        fix: '실제 값으로 채운다',
      })
    }
    return
  }

  switch (field.type) {
    case 'integer': {
      const r = parseInteger(value)
      if (!r.ok) {
        report.block({ ...at, problem: `정수가 아니다 (${r.reason})`, basis: 'DEC-PIPELINE-013', fix: '단위·쉼표·소수점 없이 10진 정수로 쓴다' })
        return
      }
      checkRange(report, at, field, r.value, basis)
      return
    }
    case 'number': {
      const r = parseNumber(value)
      if (!r.ok) {
        report.block({ ...at, problem: `수가 아니다 (${r.reason})`, basis: 'DEC-PIPELINE-013', fix: '단위를 붙이지 않고 마침표 소수점으로 쓴다' })
        return
      }
      checkRange(report, at, field, r.value, basis)
      return
    }
    case 'boolean': {
      const r = parseBoolean(value)
      if (!r.ok) {
        report.block({ ...at, problem: `불리언이 아니다 (${r.reason})`, basis: 'DEC-PIPELINE-013', fix: '`true` 또는 `false`' })
      }
      return
    }
    case 'enum': {
      const values = field.values ?? enumValuesFor(field, def, opts.schema)
      if (values && !values.includes(value)) {
        report.block({
          ...at,
          problem: `허용되지 않는 값이다: \`${value}\``,
          basis,
          fix: `허용값: ${values.join(', ')}`,
        })
      }
      return
    }
    case 'string': {
      if (field.pattern && !new RegExp(field.pattern).test(value)) {
        report.block({ ...at, problem: `형식에 맞지 않는다: \`${value}\``, basis, fix: `형식: ${field.pattern}` })
      }
      return
    }
    case 'reference':
      // 참조 검사는 전체 데이터셋이 필요해 따로 수행한다
      return
    default:
      return
  }
}

function checkRange(report, at, field, value, basis) {
  const checks = [
    ['min', (v, b) => v >= b, '이상이어야 한다'],
    ['max', (v, b) => v <= b, '이하여야 한다'],
    ['min_exclusive', (v, b) => v > b, '보다 커야 한다'],
    ['max_exclusive', (v, b) => v < b, '보다 작아야 한다'],
  ]
  for (const [key, ok, label] of checks) {
    if (field[key] === undefined) continue
    if (!ok(value, field[key])) {
      report.block({
        ...at,
        problem: `${field[key]} ${label}. 실제 값 ${value}`,
        basis,
        fix: `${field[key]} ${label}`,
      })
    }
  }
}

function isForbiddenEmptyRepresentation(value) {
  return isForbiddenEmptyMarker(value)
}

/** enum 필드가 값 목록을 직접 갖지 않으면 enums.json 에서 찾는다 */
function enumValuesFor(field, def, schema) {
  if (field.name === 'kind') return [def.kind]
  if (field.name === 'content_status') return schema.enums.content_status?.values
  const entry = schema.enums[field.name]
  return entry?.values
}

/** 한 테이블의 행 단위 검사 */
export function checkRows(report, name, table, def, schema, opts) {
  const fields = allFields(def, schema.common)
  const ctx = { findById: opts.findById }

  for (const record of table.records) {
    for (const field of fields) {
      const value = (record.cells[field.name] ?? '').trim()
      const at = { file: name, line: record.lineNumber, field: field.name }
      const basis = def.decisions?.join(', ') ?? '스키마'

      const requiredWhen = evalCondition(field.required_when, record, ctx)
      const emptyWhen = evalCondition(field.empty_when, record, ctx)
      const isRequired = field.required === true || requiredWhen === true

      if (value === '') {
        if (isRequired) {
          report.block({
            ...at,
            problem: field.required === true ? '필수 값이 비어 있다' : `조건부 필수 값이 비어 있다 (${field.required_when})`,
            basis,
            fix: '값을 채운다',
          })
        }
        continue
      }

      if (emptyWhen === true) {
        report.block({
          ...at,
          problem: `이 조건에서는 비워 둬야 한다 (${field.empty_when})`,
          basis,
          fix: '셀을 비운다',
        })
        continue
      }

      checkValue(report, name, record, field, value, def, { ...opts, schema })
    }
  }
}

/** 공통 엔트리 규칙 — ID 고유성, 접두어와 kind 일치 */
export function checkCommonEntry(report, idIndex, schema) {
  for (const [id, entries] of idIndex) {
    if (entries.length > 1) {
      for (const e of entries) {
        report.block({
          file: e.file,
          line: e.line,
          field: 'id',
          problem: `ID가 저장소 전체에서 중복된다: \`${id}\``,
          basis: 'DEC-CONTENT-001 · ID는 저장소 전체에서 중복될 수 없다',
          fix: `${entries.map((x) => `${x.file}:${x.line}`).join(', ')} 중 하나를 바꾼다`,
        })
      }
    }

    const first = entries[0]
    const prefix = id.split('.')[0]
    if (first.kind && prefix !== first.kind) {
      report.block({
        file: first.file,
        line: first.line,
        field: 'id',
        problem: `ID 접두어 \`${prefix}\` 가 kind \`${first.kind}\` 와 다르다`,
        basis: 'DEC-CONTENT-001 · ID의 첫 구간은 kind와 일치해야 한다',
        fix: `\`${first.kind}.\` 로 시작하게 바꾼다`,
      })
    }
  }
}

/** 참조 검사 — 대상이 존재하고 승인 상태인지 */
export function checkReferences(report, name, table, def, schema, dataset, idIndex) {
  const fields = allFields(def, schema.common)

  for (const field of fields) {
    if (field.type !== 'reference') continue
    const targets = refTargets(field.ref)

    for (const record of table.records) {
      const value = (record.cells[field.name] ?? '').trim()
      if (value === '' || isPlaceholder(value) || value === 'currency.money') continue

      const at = { file: name, line: record.lineNumber, field: field.name }
      const found = idIndex.get(value)

      if (!found) {
        report.block({
          ...at,
          problem: `참조 대상이 없다: \`${value}\``,
          basis: `${def.decisions?.join(', ') ?? '스키마'} · 참조는 실제로 존재하는 승인 콘텐츠를 가리켜야 한다`,
          fix: targets.length ? `${targets.join(' 또는 ')} 에 있는 ID를 쓴다` : '존재하는 ID를 쓴다',
        })
        continue
      }

      const entry = found[0]
      if (targets.length && !targets.includes(entry.file)) {
        report.block({
          ...at,
          problem: `참조 대상의 종류가 다르다. \`${value}\` 는 ${entry.file} 의 항목이다`,
          basis: def.decisions?.join(', ') ?? '스키마',
          fix: `${targets.join(' 또는 ')} 의 ID를 쓴다`,
        })
        continue
      }

      if (field.ref?.require_status && entry.status !== field.ref.require_status) {
        report.block({
          ...at,
          problem: `참조 대상이 ${field.ref.require_status} 상태가 아니다 (현재 ${entry.status || '없음'})`,
          basis: 'DEC-PIPELINE-011 · 승인 시점에는 연결 행의 모든 참조 대상도 승인 상태여야 한다',
          fix: `${entry.file} 의 \`${value}\` 를 먼저 승인한다`,
        })
      }
    }
  }
}

/** 연결 CSV의 복합 고유 키 중복 */
export function checkUniqueKey(report, name, table, def) {
  if (!def.unique_key || def.unique_key.length === 0) return

  const seen = new Map()
  for (const record of table.records) {
    const key = compositeKey(record, def.unique_key)
    if (seen.has(key)) {
      report.block({
        file: name,
        line: record.lineNumber,
        field: def.unique_key.join(', '),
        problem: `복합 고유 키가 중복된다 (${seen.get(key)}행과 같음)`,
        basis: 'DEC-PIPELINE-011 · 연결 CSV의 복합 키는 중복될 수 없다',
        fix: '중복 행을 제거하거나 키 값을 바꾼다',
      })
    } else {
      seen.set(key, record.lineNumber)
    }
  }
}
