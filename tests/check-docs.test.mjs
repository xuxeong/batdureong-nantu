// 기획 문서 구조 검수 도구 테스트
//
// tests/fixtures/docs-broken/ 에 일부러 오류를 넣은 결정로그를 두고
// 각 오류를 실제로 잡는지 확인한다.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

function checkDocs(docsDir, ref) {
  const env = docsDir ? { ...process.env, DOCS_DIR: docsDir } : process.env
  const args = ['tools/check-docs.mjs', ...(ref ? [ref] : [])]
  try {
    return { code: 0, out: execFileSync('node', args, { encoding: 'utf8', env }) }
  } catch (err) {
    return { code: err.status, out: (err.stdout ?? '') + (err.stderr ?? '') }
  }
}

// 통과 기준은 `차단 0`이지 `문제 없음`이 아니다.
//
// 준비도 점검 7.5절이 `주의`를 "진행 가능하지만 사람 검토 필요"로 정의했으므로
// 주의로 CI를 막으면 그 정의와 어긋난다. 실제로 테이블을 신설할 때마다 걸렸다 —
// 스키마를 먼저 만들면 "스키마에 있는데 준비도 문서에 없다"(주의), 문서를 먼저
// 고치면 "문서에 있는 CSV가 schema/tables/ 에 없다"(차단)라 어느 쪽으로 가도
// 한동안 검수 결과가 비지 않는다.
//
// DEC-PIPELINE-017·020 은 심각도별 CI 동작을 정하지 않았다. 기획 확인함(8/4).
test('실제 기획 문서에 차단 문제가 없다', () => {
  const { code, out } = checkDocs(null)
  assert.equal(code, 0, `차단 문제가 있다:\n${out}`)
  assert.match(out, /검수 결과: 문제 없음|차단 0/)
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

test('기준 커밋에서 문서를 읽을 수 없으면 원문 비교를 건너뛴다', () => {
  // 해석되지 않는 ref를 주면 비교 대상이 없다.
  // 픽스처의 커밋 여부에 의존하지 않게 하려고 ref 쪽을 흔든다.
  const { out } = checkDocs('tests/fixtures/docs-broken', 'no-such-ref-for-test')
  assert.match(out, /원문 변경은 비교하지 않았다/)
  // git 오류 메시지가 출력에 섞이지 않아야 한다
  assert.doesNotMatch(out, /fatal:/)
})

test('확정 DEC의 원문이 바뀌지 않았으면 0건으로 보고한다', () => {
  const { out } = checkDocs(null, 'HEAD')
  assert.match(out, /확정 DEC 원문 변경 0건/)
})
