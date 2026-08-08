// 검증 도구 테스트
//
//   npm test
//
// tests/fixtures/ 의 데이터로 validate.mjs 를 실제로 실행한다.
// 픽스처는 DEC-PIPELINE-016 에 따라 코드가 아니라 별도 데이터 파일로 둔다.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

function validate(dir) {
  try {
    const out = execFileSync('node', ['tools/validate.mjs', 'approved', '--dir', dir], {
      encoding: 'utf8',
    })
    return { code: 0, out }
  } catch (err) {
    return { code: err.status, out: (err.stdout ?? '') + (err.stderr ?? '') }
  }
}

test('정상 데이터는 차단 오류 없이 통과한다', () => {
  const { code, out } = validate('tests/fixtures/step1-valid')
  assert.equal(code, 0, `차단 오류가 있다:\n${out}`)
  assert.match(out, /문제 없음/)
})

test('아직 없는 CSV의 규칙은 검사하지 않는다', () => {
  const { out } = validate('tests/fixtures/step1-valid')
  // 1단계만 작성한 상태에서 12단계 엔딩 오류가 뜨면 안 된다
  assert.doesNotMatch(out, /전역 폴백 엔딩/)
  assert.doesNotMatch(out, /승인 런 일정이 0개/)
  assert.match(out, /아직 없는 CSV \d+종의 규칙은 건너뛰었다/)
})

test('잘못된 데이터는 차단 오류로 잡는다', () => {
  const { code, out } = validate('tests/fixtures/step1-broken')
  assert.equal(code, 1)

  const expected = [
    // 자료형·범위
    [/world_width/, '0보다 커야 하는 값이 0'],
    // 공통 엔트리
    [/ID 접두어 `crop` 가 kind `map` 와 다르다/, 'ID 접두어와 kind 불일치'],
    [/허용되지 않는 값이다: `승인`/, 'content_status 열거형 위반'],
    // 값 표현 규칙
    [/빈 값을 `없음` 로 표기했다/, '금지된 빈 값 표기'],
    [/승인 CSV에 `TBD` 가 남아 있다/, '승인본에 남은 placeholder'],
    // 칸 수 — 값이 조용히 사라지는 종류다. 통과시키면 화면에서만 드러난다
    [/칸이 5개로 헤더\(4개\)보다 많다/, '칸이 남는 행'],
    [/칸이 3개로 헤더\(4개\)보다 적다/, '칸이 모자란 행'],
    // 참조·키
    [/참조 대상이 없다: `map\.nonexistent`/, '존재하지 않는 참조'],
    [/복합 고유 키가 중복된다/, '연결 CSV 복합키 중복'],
    [/필수 값이 비어 있다/, '필수 값 누락'],
    // 표별 교차 규칙
    [/승인 맵이 2개다/, '승인 맵 개수'],
    [/`player_raid_start` 지점이 0개다/, '필수 역할 지점 누락'],
    [/재배 시작점과의 거리가/, '야생동물 출현 안전거리'],
    [/경작지가 없다/, '맵에 경작지 없음'],
  ]

  for (const [pattern, label] of expected) {
    assert.match(out, pattern, `${label} 를 잡지 못했다`)
  }
})

test('좌표 중복은 주의로 보고한다', () => {
  const { out } = validate('tests/fixtures/step1-broken')
  assert.match(out, /주의 \d+건/)
  assert.match(out, /경작지 좌표가 2행과 겹친다/)
})

test('구현하지 않은 규칙을 조용히 넘기지 않는다', () => {
  const { out } = validate('tests/fixtures/step1-valid')
  assert.match(out, /규칙 \d+\/\d+ 구현/)
})
