// CSV 파싱·정규화
//
// 값 표현 규칙은 DEC-PIPELINE-013, 표 구조 규칙은 DEC-PIPELINE-008을 따른다.
// 규칙의 원문은 결정로그를 본다. 이 파일은 그 규칙을 실행하는 코드다.

const BOM = '﻿'

/** 셀 하나를 감싸는 큰따옴표가 필요한지 */
function needsQuote(value) {
  return /[",\r\n]/.test(value)
}

/**
 * RFC 4180 방식으로 CSV 텍스트를 행 배열로 파싱한다.
 * - UTF-8 BOM은 제거한다 (작업용 CSV에서 허용).
 * - 큰따옴표 안의 쉼표·줄바꿈은 값의 일부로 취급한다.
 * - 큰따옴표 안의 `""`는 큰따옴표 한 개로 읽는다.
 *
 * @returns {{ rows: string[][], hadBom: boolean }}
 */
export function parseCsv(text) {
  const hadBom = text.startsWith(BOM)
  if (hadBom) text = text.slice(BOM.length)

  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }

    if (ch === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }

    if (ch === '\r' || ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      // CRLF는 한 줄바꿈으로 센다
      i += ch === '\r' && text[i + 1] === '\n' ? 2 : 1
      continue
    }

    field += ch
    i++
  }

  // 마지막 줄에 줄바꿈이 없는 경우
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return { rows, hadBom }
}

/**
 * 파싱한 행 배열을 헤더와 레코드로 나눈다.
 * 각 레코드는 원본 행 번호(1부터, 헤더 포함)를 함께 가진다.
 *
 * @returns {{ header: string[], records: Array<{ lineNumber: number, cells: Record<string,string> }> }}
 */
export function toRecords(rows) {
  if (rows.length === 0) return { header: [], records: [] }

  const header = rows[0].map((h) => h.trim())
  const records = []

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]
    // 완전히 빈 줄은 건너뛴다
    if (cells.length === 1 && cells[0].trim() === '') continue

    const record = {}
    for (let c = 0; c < header.length; c++) {
      record[header[c]] = cells[c] ?? ''
    }
    records.push({ lineNumber: r + 1, cells: record })
  }

  return { header, records }
}

/** 읽은 파일 텍스트를 헤더·레코드로 바로 변환 */
export function readCsv(text) {
  const { rows, hadBom } = parseCsv(text)
  return { ...toRecords(rows), hadBom }
}

/**
 * DEC-PIPELINE-013의 표준 형식으로 값을 정규화한다.
 * 자료형과 허용 범위를 검사하기 전에 먼저 수행한다.
 *
 * `kind`는 정규화 방식을 고르기 위한 값이다.
 *   'id' | 'enum' | 'number' | 'integer' | 'boolean' → 앞뒤 공백 제거
 *   'text' → 앞뒤 공백만 제거하고 문장 내부 공백은 보존
 */
export function normalizeCell(raw, kind = 'text') {
  if (raw === undefined || raw === null) return ''

  // 어떤 종류든 앞뒤 공백은 제거한다.
  // 문장 내부 공백은 건드리지 않는다.
  let value = raw.trim()

  if (value === '') return ''

  switch (kind) {
    case 'boolean':
      return value.toLowerCase()
    case 'integer':
    case 'number':
    case 'id':
    case 'enum':
    case 'text':
    default:
      return value
  }
}

/** 빈 값 대신 쓰면 안 되는 표기 (DEC-PIPELINE-013) */
const FORBIDDEN_EMPTY = new Set(['null', 'NULL', 'N/A', '없음', '-'])

export function isForbiddenEmptyMarker(value) {
  return FORBIDDEN_EMPTY.has(value)
}

/** 작업용 CSV와 승인 후보에서만 허용되는 표기 */
const PLACEHOLDERS = new Set(['AUTO', 'TBD'])

export function isPlaceholder(value) {
  return PLACEHOLDERS.has(value)
}

/** 셀 안에 실제 줄바꿈이 들어 있는지 (허용하지 않음) */
export function hasLineBreak(value) {
  return /[\r\n]/.test(value)
}

/**
 * 값을 정수로 읽는다. 단위·천 단위 쉼표·소수점이 있으면 실패로 본다.
 * @returns {{ ok: boolean, value?: number, reason?: string }}
 */
export function parseInteger(value) {
  if (!/^-?\d+$/.test(value)) {
    if (/,/.test(value)) return { ok: false, reason: '천 단위 쉼표를 사용했다' }
    if (/\./.test(value)) return { ok: false, reason: '정수 자리에 소수점을 사용했다' }
    if (/[^\d\-]/.test(value)) return { ok: false, reason: '숫자가 아닌 문자가 섞였다' }
    return { ok: false, reason: '10진 정수 형식이 아니다' }
  }
  return { ok: true, value: Number(value) }
}

/**
 * 값을 실수로 읽는다. `%`·배율·초 단위가 붙어 있으면 실패로 본다.
 * @returns {{ ok: boolean, value?: number, reason?: string }}
 */
export function parseNumber(value) {
  if (!/^-?\d+(\.\d+)?$/.test(value)) {
    if (/%/.test(value)) return { ok: false, reason: '`%` 기호를 셀에 붙였다' }
    if (/[초sx배]/i.test(value)) return { ok: false, reason: '단위를 셀에 붙였다' }
    if (/,/.test(value)) return { ok: false, reason: '천 단위 쉼표를 사용했다' }
    return { ok: false, reason: '10진 수 형식이 아니다' }
  }
  return { ok: true, value: Number(value) }
}

/**
 * 값을 불리언으로 읽는다. 소문자 `true`/`false`만 허용한다.
 * @returns {{ ok: boolean, value?: boolean, reason?: string }}
 */
export function parseBoolean(value) {
  if (value === 'true') return { ok: true, value: true }
  if (value === 'false') return { ok: true, value: false }
  if (/^(true|false)$/i.test(value)) {
    return { ok: false, reason: '소문자 `true` 또는 `false`만 사용한다' }
  }
  return { ok: false, reason: '`true` 또는 `false`가 아니다' }
}

/** 셀 하나를 CSV 형식으로 직렬화 */
export function serializeCell(value) {
  const s = value === undefined || value === null ? '' : String(value)
  return needsQuote(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * 헤더와 레코드를 UTF-8 쉼표 구분 CSV 텍스트로 만든다.
 * 승인 후보와 승인 CSV는 BOM 없이 저장한다.
 */
export function serializeCsv(header, records) {
  const lines = [header.map(serializeCell).join(',')]
  for (const record of records) {
    lines.push(header.map((h) => serializeCell(record[h])).join(','))
  }
  return lines.join('\n') + '\n'
}
