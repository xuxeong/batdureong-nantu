#!/usr/bin/env node
//
// 기획 문서 구조 자동 검수
//
//   npm run docs:check              작업 트리 검사 + HEAD와 비교
//   node tools/check-docs.mjs <ref> 지정한 커밋과 비교
//
// DEC-PIPELINE-017 이 요구하는 자동 검사를 수행한다.
//
//   DEC ID 중복·누락, 존재하지 않는 참조, 상태별 필드 구조, 제목 구조,
//   CSV 목록, 코드 블록 닫힘, 예상 밖의 확정 원문 변경
//
// 의미 검토는 하지 않는다. 그건 사람과 기획 책임자의 몫이다.

import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { Report } from './lib/report.mjs'
import { loadSchema } from './lib/schema.mjs'

// DOCS_DIR 로 문서 위치를 바꿀 수 있다. 테스트 픽스처 검증에 쓴다.
const PLANNING = process.env.DOCS_DIR ?? 'docs/planning'
const LOG = `${PLANNING}/밭두렁난투_기획_결정로그_현재본.md`
const SYSTEM_DOC = `${PLANNING}/밭두렁난투_시스템_UIUX_기획서_현재본.md`
const CONTENT_DOC = `${PLANNING}/밭두렁난투_콘텐츠_데이터_준비도_점검.md`
const IMPACT_MAP = process.env.DOCS_DIR
  ? `${PLANNING}/document-impact-map.csv`
  : 'docs/governance/document-impact-map.csv'

/** 상태별로 허용되는 항목. AGENTS.md 5.2절. */
const ALLOWED_FIELDS = {
  확정: ['상태', '결정일', '결정'],
  보류: ['상태', '재검토 조건'],
  폐기: ['상태', '결정일', '결정', '폐기일', '폐기 이유', '대체 결정'],
}

const REQUIRED_FIELDS = {
  확정: ['상태', '결정일', '결정'],
  보류: ['상태', '재검토 조건'],
  폐기: ['상태', '결정일', '결정', '폐기일', '폐기 이유', '대체 결정'],
}

const DEC_ID = /^DEC-[A-Z]+-\d{3}$/

/**
 * 결정로그를 파싱한다.
 * @returns {{ categories: Array, decisions: Map<string, object> }}
 */
export function parseLog(text) {
  const lines = text.split('\n')
  const decisions = new Map()
  const categories = []

  let current = null
  let currentField = null
  let inFence = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNumber = i + 1

    if (/^```/.test(line)) inFence = !inFence
    if (inFence) {
      if (current && currentField) current.fields[currentField].push(line)
      continue
    }

    // 제목 1 — 기획 대분류
    const h1 = line.match(/^# (.+)$/)
    if (h1) {
      categories.push({ title: h1[1].trim(), lineNumber })
      current = null
      currentField = null
      continue
    }

    // 제목 2 — 개별 결정
    const h2 = line.match(/^## (.+)$/)
    if (h2) {
      const heading = h2[1].trim()
      const idMatch = heading.match(/^(DEC-[A-Za-z]+-\d+)/)
      current = {
        heading,
        id: idMatch ? idMatch[1] : null,
        lineNumber,
        category: categories.length ? categories[categories.length - 1].title : null,
        fields: {},
        order: [],
      }
      if (current.id) {
        if (!decisions.has(current.id)) decisions.set(current.id, [])
        decisions.get(current.id).push(current)
      } else {
        // ID 없는 제목 2 — 나중에 보고한다
        if (!decisions.has(`__noid__${lineNumber}`)) decisions.set(`__noid__${lineNumber}`, [])
        decisions.get(`__noid__${lineNumber}`).push(current)
      }
      currentField = null
      continue
    }

    if (!current) continue

    // 최상위 항목 `- 키: 값` 또는 `- 키:`
    const field = line.match(/^- ([^:]+):\s*(.*)$/)
    if (field) {
      currentField = field[1].trim()
      current.fields[currentField] = field[2] ? [field[2]] : []
      current.order.push(currentField)
      continue
    }

    // 항목의 하위 줄
    if (currentField && /^\s+/.test(line) && line.trim() !== '') {
      current.fields[currentField].push(line.trim().replace(/^- /, ''))
    }
  }

  return { categories, decisions }
}

/** DEC ID 참조를 모두 뽑는다 */
function findReferences(text) {
  const refs = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    for (const m of lines[i].matchAll(/DEC-[A-Z]+-\d{3}(?:~\d{3})?/g)) {
      refs.push({ raw: m[0], lineNumber: i + 1 })
    }
  }
  return refs
}

/** `DEC-INPUT-001~009` 같은 범위 표기를 개별 ID로 편다 */
function expandRange(raw) {
  const m = raw.match(/^(DEC-[A-Z]+)-(\d{3})~(\d{3})$/)
  if (!m) return [raw]
  const [, prefix, from, to] = m
  const out = []
  for (let n = Number(from); n <= Number(to); n++) {
    out.push(`${prefix}-${String(n).padStart(3, '0')}`)
  }
  return out
}

function checkLog(report, decisions, categories) {
  const file = LOG

  if (categories.length === 0) {
    report.block({ file, problem: '기획 대분류(제목 1)가 없다', basis: 'AGENTS.md 5.2절' })
  }

  for (const [id, entries] of decisions) {
    // ID 없는 제목 2
    if (id.startsWith('__noid__')) {
      for (const e of entries) {
        report.block({
          file,
          line: e.lineNumber,
          problem: `제목 2가 DEC ID로 시작하지 않는다: "${e.heading}"`,
          basis: 'AGENTS.md 5.2절 · 제목 2는 DEC-...로 시작하는 개별 결정에만 사용한다',
          fix: '대분류라면 제목 1로 바꾼다',
        })
      }
      continue
    }

    // ID 중복
    if (entries.length > 1) {
      for (const e of entries) {
        report.block({
          file,
          line: e.lineNumber,
          problem: `DEC ID가 중복된다: ${id}`,
          basis: 'AGENTS.md 5.2절 · 발급한 ID를 변경하거나 재사용하지 않는다',
          fix: `중복 위치: ${entries.map((x) => `${x.lineNumber}행`).join(', ')}`,
        })
      }
    }

    for (const dec of entries) {
      const at = { file, line: dec.lineNumber }

      if (!DEC_ID.test(id)) {
        report.warn({
          ...at,
          problem: `DEC ID 형식이 다르다: ${id}`,
          basis: 'DEC-<대분류>-<세 자리 숫자> 형식을 사용한다',
        })
      }

      const status = (dec.fields['상태'] ?? [])[0]?.trim()
      if (!status) {
        report.block({ ...at, problem: `${id}: 상태 항목이 없다`, basis: 'AGENTS.md 5.2절' })
        continue
      }

      const allowed = ALLOWED_FIELDS[status]
      if (!allowed) {
        report.block({
          ...at,
          problem: `${id}: 알 수 없는 상태 "${status}"`,
          basis: 'AGENTS.md 5.2절 · 확정, 보류, 폐기만 사용한다',
        })
        continue
      }

      // 상태별 허용 항목
      for (const key of dec.order) {
        if (!allowed.includes(key)) {
          report.block({
            ...at,
            field: key,
            problem: `${id}(${status}): 이 상태에서 쓸 수 없는 항목이다`,
            basis: `AGENTS.md 5.2절 · ${status} 상태는 ${allowed.join(', ')}만 사용한다`,
            fix: '항목을 제거하거나 상태를 확인한다',
          })
        }
      }

      // 필수 항목
      for (const key of REQUIRED_FIELDS[status]) {
        if (!dec.order.includes(key)) {
          report.block({
            ...at,
            field: key,
            problem: `${id}(${status}): 필수 항목이 없다`,
            basis: `AGENTS.md 5.2절 · ${status} 상태는 ${REQUIRED_FIELDS[status].join(', ')}를 사용한다`,
          })
        }
      }

      // 폐기 결정의 대체 결정은 실제로 존재해야 한다
      if (status === '폐기') {
        const replacements = dec.fields['대체 결정'] ?? []
        const ids = replacements
          .join(' ')
          .match(/DEC-[A-Z]+-\d{3}/g)
        if (!ids || ids.length === 0) {
          report.block({
            ...at,
            field: '대체 결정',
            problem: `${id}: 폐기 결정에 대체 결정 ID가 없다`,
            basis: 'AGENTS.md 2절 · 폐기 DEC는 반드시 대체 결정을 확인한다',
          })
        }
      }
    }
  }
}

/** 문서들이 참조하는 DEC ID가 실제로 존재하는지 */
function checkReferences(report, decisions) {
  const known = new Set([...decisions.keys()].filter((k) => !k.startsWith('__noid__')))
  const targets = [LOG, SYSTEM_DOC, CONTENT_DOC, IMPACT_MAP]

  for (const file of targets) {
    if (!existsSync(file)) {
      report.block({ file, problem: '문서가 없다', basis: 'README.md 기준 문서 목록' })
      continue
    }
    const text = readFileSync(file, 'utf8')

    for (const ref of findReferences(text)) {
      for (const id of expandRange(ref.raw)) {
        if (!known.has(id)) {
          report.block({
            file,
            line: ref.lineNumber,
            problem: `존재하지 않는 DEC를 참조한다: ${id}${ref.raw !== id ? ` (${ref.raw})` : ''}`,
            basis: 'DEC-PIPELINE-017 · 존재하지 않는 참조를 자동 검사한다',
            fix: '결정로그에서 올바른 ID를 확인한다',
          })
        }
      }
    }
  }
}

/** 코드 블록이 닫혔는지 */
function checkFences(report) {
  for (const file of [LOG, SYSTEM_DOC, CONTENT_DOC]) {
    if (!existsSync(file)) continue
    const lines = readFileSync(file, 'utf8').split('\n')
    let open = null
    for (let i = 0; i < lines.length; i++) {
      if (!/^```/.test(lines[i])) continue
      open = open === null ? i + 1 : null
    }
    if (open !== null) {
      report.block({
        file,
        line: open,
        problem: '닫히지 않은 코드 블록이 있다',
        basis: 'DEC-PIPELINE-017 · 코드 블록 닫힘을 자동 검사한다',
      })
    }
  }
}

/** 준비도 문서의 CSV 목록과 schema/tables/ 가 일치하는지 */
function checkCsvList(report) {
  if (!existsSync(CONTENT_DOC)) return

  const text = readFileSync(CONTENT_DOC, 'utf8')
  const listed = new Set([...text.matchAll(/`([a-z_]+\.csv)`/g)].map((m) => m[1]))

  let schema
  try {
    schema = loadSchema()
  } catch {
    return
  }
  const defined = new Set(schema.tables.keys())

  for (const name of listed) {
    if (!defined.has(name)) {
      report.block({
        file: CONTENT_DOC,
        problem: `문서에 있는 CSV가 schema/tables/ 에 없다: ${name}`,
        basis: 'DEC-PIPELINE-017 · CSV 목록을 자동 검사한다',
        fix: `schema/tables/${name.replace('.csv', '.json')} 를 만든다`,
      })
    }
  }
  for (const name of defined) {
    if (!listed.has(name)) {
      report.warn({
        file: 'schema/tables/',
        problem: `스키마에 있는 CSV가 준비도 문서에 없다: ${name}`,
        basis: 'DEC-PIPELINE-017',
        fix: '문서와 스키마 중 어느 쪽이 맞는지 확인한다',
      })
    }
  }

  const count = defined.size
  if (text.includes('31개') && count !== 31) {
    report.block({
      file: CONTENT_DOC,
      problem: `문서는 CSV가 31개라고 하는데 스키마에는 ${count}개다`,
      basis: 'DEC-PIPELINE-014',
    })
  }
}

/** 확정 DEC의 결정 원문이 바뀌었는지 (기준 커밋과 비교) */
function checkConfirmedTextChanges(report, decisions, ref) {
  let baseText
  try {
    baseText = execFileSync('git', ['show', `${ref}:${LOG}`], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      // 기준 커밋에 파일이 없는 것은 정상 상황이라 git 오류를 표시하지 않는다
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    // 기준 커밋에 파일이 없으면 (최초 커밋 등) 비교하지 않는다
    return { compared: false }
  }

  const base = parseLog(baseText).decisions
  let changed = 0

  for (const [id, entries] of decisions) {
    if (id.startsWith('__noid__')) continue
    const now = entries[0]
    const before = base.get(id)?.[0]
    if (!before) continue

    const nowStatus = (now.fields['상태'] ?? [])[0]?.trim()
    const beforeStatus = (before.fields['상태'] ?? [])[0]?.trim()

    // 확정 → 확정인데 결정 원문이 바뀐 경우
    if (nowStatus === '확정' && beforeStatus === '확정') {
      const a = (before.fields['결정'] ?? []).join('\n')
      const b = (now.fields['결정'] ?? []).join('\n')
      if (a !== b) {
        report.warn({
          file: LOG,
          line: now.lineNumber,
          problem: `${id}: 확정 DEC의 결정 원문이 ${ref} 이후 변경됐다`,
          basis:
            'AGENTS.md 5.2절 · 확정 DEC의 제목과 결정 텍스트는 기본적으로 불변이다. 의미가 바뀌면 폐기 후 새 ID의 대체 DEC를 작성한다',
          fix: '의도한 변경이면 기획 책임자의 승인 기록을 확인한다',
        })
        changed++
      }
      if (before.heading !== now.heading) {
        report.warn({
          file: LOG,
          line: now.lineNumber,
          problem: `${id}: 확정 DEC의 제목이 변경됐다`,
          basis: 'AGENTS.md 5.2절',
        })
        changed++
      }
    }
  }

  return { compared: true, changed }
}

function main() {
  const ref = process.argv[2] ?? 'HEAD'

  if (!existsSync(LOG)) {
    console.error(`${LOG} 가 없다.`)
    process.exit(1)
  }

  const text = readFileSync(LOG, 'utf8')
  const { categories, decisions } = parseLog(text)
  const report = new Report()

  const ids = [...decisions.keys()].filter((k) => !k.startsWith('__noid__'))
  const byStatus = { 확정: 0, 보류: 0, 폐기: 0, 기타: 0 }
  for (const [id, entries] of decisions) {
    if (id.startsWith('__noid__')) continue
    const s = (entries[0].fields['상태'] ?? [])[0]?.trim()
    if (byStatus[s] !== undefined) byStatus[s]++
    else byStatus.기타++
  }

  console.log(`결정로그: 대분류 ${categories.length}개 · DEC ${ids.length}개`)
  console.log(`  확정 ${byStatus.확정} · 보류 ${byStatus.보류} · 폐기 ${byStatus.폐기}` +
    (byStatus.기타 ? ` · 기타 ${byStatus.기타}` : ''))
  console.log('')

  checkLog(report, decisions, categories)
  checkReferences(report, decisions)
  checkFences(report)
  checkCsvList(report)
  const diff = checkConfirmedTextChanges(report, decisions, ref)

  process.stdout.write(report.toText())

  if (diff.compared) {
    console.log('')
    console.log(`${ref} 와 비교: 확정 DEC 원문 변경 ${diff.changed}건`)
  } else {
    console.log('')
    console.log(`${ref} 에 결정로그가 없어 원문 변경은 비교하지 않았다`)
  }

  console.log('')
  console.log('이 도구는 구조만 검사한다. 의미 검토는 DEC-PIPELINE-017 이 정한 시점에 사람이 수행한다.')

  process.exit(report.exitCode())
}

main()
