// 검수 보고서
//
// 출력 형식은 콘텐츠 데이터 준비도 점검 문서 7.5절을 따른다.
//   | 심각도 | 파일·행·필드 | 문제 | 근거 DEC·규칙 | 최소 수정안 |
//
// DEC-CONTENT-001에 따라 파일 경로·행 번호·필드 경로·오류 이유는 도구가 출력하고
// 콘텐츠 엔트리에 검증 위치 메타데이터를 저장하지 않는다.

/** 심각도. 준비도 점검 7.5절. */
export const BLOCK = '차단'
export const WARN = '주의'
export const SUGGEST = '제안'

const ORDER = { [BLOCK]: 0, [WARN]: 1, [SUGGEST]: 2 }

export class Report {
  constructor() {
    /** @type {Array<{severity:string,file:string,line:number|null,field:string|null,problem:string,basis:string,fix:string}>} */
    this.findings = []
  }

  add({ severity, file, line = null, field = null, problem, basis, fix = '' }) {
    this.findings.push({ severity, file, line, field, problem, basis, fix })
    return this
  }

  block(args) {
    return this.add({ ...args, severity: BLOCK })
  }

  warn(args) {
    return this.add({ ...args, severity: WARN })
  }

  suggest(args) {
    return this.add({ ...args, severity: SUGGEST })
  }

  count(severity) {
    return this.findings.filter((f) => f.severity === severity).length
  }

  get hasBlocking() {
    return this.count(BLOCK) > 0
  }

  sorted() {
    return [...this.findings].sort((a, b) => {
      const s = ORDER[a.severity] - ORDER[b.severity]
      if (s !== 0) return s
      const f = a.file.localeCompare(b.file)
      if (f !== 0) return f
      return (a.line ?? 0) - (b.line ?? 0)
    })
  }

  /** 위치를 `파일 12행 field_name` 형태로 */
  static location(f) {
    let s = f.file
    if (f.line !== null) s += ` ${f.line}행`
    if (f.field !== null) s += ` ${f.field}`
    return s
  }

  /** 터미널 출력 */
  toText() {
    if (this.findings.length === 0) return '검수 결과: 문제 없음\n'

    const lines = []
    let current = null

    for (const f of this.sorted()) {
      if (f.severity !== current) {
        current = f.severity
        lines.push('')
        lines.push(`── ${f.severity} ${this.count(f.severity)}건 ` + '─'.repeat(40))
      }
      lines.push(`  ${Report.location(f)}`)
      lines.push(`    ${f.problem}`)
      lines.push(`    근거: ${f.basis}`)
      if (f.fix) lines.push(`    수정: ${f.fix}`)
    }

    lines.push('')
    lines.push(
      `합계  차단 ${this.count(BLOCK)} · 주의 ${this.count(WARN)} · 제안 ${this.count(SUGGEST)}`
    )
    return lines.join('\n') + '\n'
  }

  /** 검수표 (data/candidates/reports/ 에 저장) */
  toMarkdown() {
    const lines = [
      '| 심각도 | 파일·행·필드 | 문제 | 근거 DEC·규칙 | 최소 수정안 |',
      '|---|---|---|---|---|',
    ]
    for (const f of this.sorted()) {
      lines.push(
        `| ${f.severity} | ${esc(Report.location(f))} | ${esc(f.problem)} | ${esc(f.basis)} | ${esc(f.fix)} |`
      )
    }
    if (this.findings.length === 0) {
      lines.push('| — | — | 문제 없음 | — | — |')
    }
    return lines.join('\n') + '\n'
  }

  /** 차단이 있으면 1, 없으면 0 */
  exitCode() {
    return this.hasBlocking ? 1 : 0
  }
}

function esc(s) {
  return String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}
