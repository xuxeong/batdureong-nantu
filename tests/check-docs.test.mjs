// 기획 문서 구조 검수 도구 테스트
//
// tests/fixtures/docs-broken/ 에 일부러 오류를 넣은 결정로그를 두고
// 각 오류를 실제로 잡는지 확인한다.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

function checkDocs(docsDir) {
  const env = docsDir ? { ...process.env, DOCS_DIR: docsDir } : process.env
  try {
    return { code: 0, out: execFileSync('node', ['tools/check-docs.mjs'], { encoding: 'utf8', env }) }
  } catch (err) {
    return { code: err.status, out: (err.stdout ?? '') + (err.stderr ?? '') }
  }
}

test('실제 기획 문서는 구조 검수를 통과한다', () => {
  const { code, out } = checkDocs(null)
  assert.equal(code, 0, `구조 오류가 있다:\n${out}`)
  assert.match(out, /문제 없음/)
})

test('결정로그의 DEC 수를 상태별로 센다', () => {
  const { out } = checkDocs(null)
  assert.match(out, /DEC \d+개/)
  assert.match(out, /확정 \d+ · 보류 \d+ · 폐기 \d+/)
})

test('구조 오류를 차단으로 잡는다', () => {
  const { code, out } = checkDocs('tests/fixtures/docs-broken')
  assert.equal(code, 1)

  const expected = [
    [/DEC ID가 중복된다: DEC-RUN-001/, 'DEC ID 중복'],
    [/이 상태에서 쓸 수 없는 항목이다/, '상태별 허용 항목 위반'],
    [/필수 항목이 없다/, '상태별 필수 항목 누락'],
    [/폐기 결정에 대체 결정 ID가 없다/, '폐기 DEC의 대체 결정 누락'],
    [/존재하지 않는 DEC를 참조한다: DEC-GHOST-999/, '없는 DEC 참조'],
    [/알 수 없는 상태 "검토중"/, '허용되지 않는 상태'],
    [/제목 2가 DEC ID로 시작하지 않는다/, '제목 구조 위반'],
    [/닫히지 않은 코드 블록이 있다/, '코드 블록 미닫힘'],
  ]

  for (const [pattern, label] of expected) {
    assert.match(out, pattern, `${label} 를 잡지 못했다`)
  }
})

test('기준 커밋에 문서가 없으면 원문 비교를 건너뛴다', () => {
  const { out } = checkDocs('tests/fixtures/docs-broken')
  assert.match(out, /원문 변경은 비교하지 않았다/)
  // git 오류 메시지가 출력에 섞이지 않아야 한다
  assert.doesNotMatch(out, /fatal:/)
})
