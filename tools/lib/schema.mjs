// 스키마 로딩과 데이터셋 모델
//
// schema/ 의 정의를 읽어 검증기와 런타임 생성기가 함께 쓰는 형태로 만든다.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { readCsv } from './csv.mjs'

const SCHEMA_DIR = 'schema'
const TABLE_DIR = join(SCHEMA_DIR, 'tables')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

/**
 * schema/ 전체를 읽는다.
 * @returns {{ tables: Map<string,object>, common: object, enums: object, manifest: object }}
 */
export function loadSchema() {
  const tables = new Map()
  for (const file of readdirSync(TABLE_DIR).sort()) {
    if (!file.endsWith('.json')) continue
    const def = readJson(join(TABLE_DIR, file))
    tables.set(def.file, def)
  }

  return {
    tables,
    common: readJson(join(SCHEMA_DIR, 'common_entry.json')),
    enums: readJson(join(SCHEMA_DIR, 'enums.json')),
    manifest: readJson(join(SCHEMA_DIR, 'schema_manifest.json')),
  }
}

/**
 * 테이블이 실제로 가져야 하는 열 순서.
 * 독립 콘텐츠는 공통 열이 앞에 오고 그 뒤에 전용 열이 온다.
 */
export function expectedHeader(def, common) {
  const columns = []
  if (def.common_columns) columns.push(...common.fields.map((f) => f.name))
  columns.push(...def.fields.map((f) => f.name))
  return columns
}

/** 테이블의 전체 필드 정의 (공통 + 전용) */
export function allFields(def, common) {
  const fields = []
  if (def.common_columns) fields.push(...common.fields)
  fields.push(...def.fields)
  return fields
}

/**
 * ref.table 은 단일 파일명이거나 `a.csv | b.csv` 형태의 후보 목록이다.
 * @returns {string[]}
 */
export function refTargets(ref) {
  if (!ref || !ref.table) return []
  return ref.table.split('|').map((s) => s.trim()).filter(Boolean)
}

/**
 * 한 디렉터리의 CSV를 읽어 테이블별로 모은다.
 * 스키마에 정의된 파일만 읽고, 없는 파일은 missing 으로 보고한다.
 *
 * @returns {{ tables: Map<string,{header:string[],records:Array,hadBom:boolean,path:string}>, missing: string[], unknown: string[] }}
 */
export function loadDataset(dir, schema) {
  const tables = new Map()
  const missing = []
  const unknown = []

  const present = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith('.csv'))
    : []

  for (const name of schema.tables.keys()) {
    const path = join(dir, name)
    if (!existsSync(path)) {
      missing.push(name)
      continue
    }
    const text = readFileSync(path, 'utf8')
    const { header, records, hadBom } = readCsv(text)
    tables.set(name, { header, records, hadBom, path })
  }

  for (const f of present) {
    if (!schema.tables.has(f)) unknown.push(f)
  }

  return { tables, missing, unknown }
}

/**
 * 저장소 전체의 독립 콘텐츠 ID 색인.
 * ID는 저장소 전체에서 고유해야 하므로 (DEC-CONTENT-001) 한 번에 모아 검사한다.
 *
 * @returns {Map<string, Array<{file:string,line:number,kind:string,status:string}>>}
 */
export function indexIds(dataset, schema) {
  const index = new Map()

  for (const [name, table] of dataset.tables) {
    const def = schema.tables.get(name)
    if (!def || !def.common_columns) continue

    for (const record of table.records) {
      const id = (record.cells.id ?? '').trim()
      if (!id) continue
      if (!index.has(id)) index.set(id, [])
      index.get(id).push({
        file: name,
        line: record.lineNumber,
        kind: (record.cells.kind ?? '').trim(),
        status: (record.cells.content_status ?? '').trim(),
      })
    }
  }

  return index
}

/** 연결 CSV의 복합 키 문자열 */
export function compositeKey(record, keyFields) {
  return keyFields.map((f) => (record.cells[f] ?? '').trim()).join('')
}
