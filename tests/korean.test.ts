// 승인 문구의 플레이어 이름 자리표시자 (22번, 8/9).
//
// **조사가 틀려도 화면에서만 드러난다.** `전성민는` 은 코드가 멀쩡히 돌고
// 테스트도 없으면 엔딩까지 가야 보인다 — 5일차를 다 밟아야 하는 자리다.
// 8/6 에 `영순 이(가) 돕는다` 가 그렇게 화면에 나왔다.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { fillPlayerName } from '../src/ui/korean.ts'

test('받침이 있으면 은, 없으면 는', () => {
  assert.equal(fillPlayerName('{player_name}는 밭을 지켰다', '전성민'), '전성민은 밭을 지켰다')
  assert.equal(fillPlayerName('{player_name}는 밭을 지켰다', '영희'), '영희는 밭을 지켰다')
})

test('데이터가 어느 형태로 적었든 결과가 같다', () => {
  // 콘텐츠 담당자가 읽기 좋은 쪽으로 적을 수 있어야 한다.
  assert.equal(fillPlayerName('{player_name}은 갔다', '영희'), '영희는 갔다')
  assert.equal(fillPlayerName('{player_name}는 갔다', '전성민'), '전성민은 갔다')
})

test('주제 조사와 주격 조사를 섞지 않는다', () => {
  // 은/는과 이/가는 뜻이 다르다. 짝을 보고 그 안에서만 고른다.
  assert.equal(fillPlayerName('{player_name}이 왔다', '영희'), '영희가 왔다')
  assert.equal(fillPlayerName('{player_name}가 왔다', '전성민'), '전성민이 왔다')
})

test('조사가 안 붙은 자리표시자도 바꾼다', () => {
  assert.equal(fillPlayerName('밭의 주인은 {player_name}', '영희'), '밭의 주인은 영희')
})

test('자리표시자가 없으면 문구를 그대로 둔다', () => {
  const text = '런이 끝났고 밭과 마을의 한 계절이 저물었다.'
  assert.equal(fillPlayerName(text, '전성민'), text)
})

test('한 문장에 여러 번 나와도 전부 바꾼다', () => {
  assert.equal(
    fillPlayerName('{player_name}는 남았고 {player_name}의 밭도 남았다', '영희'),
    '영희는 남았고 영희의 밭도 남았다',
  )
})

test('한글이 아닌 이름에는 조사를 붙이지 않는다', () => {
  // `korean.ts` 의 규칙이다 — 한글 음절이 아니면 받침을 알 수 없다.
  assert.equal(fillPlayerName('{player_name}는 갔다', 'Ann'), 'Ann 갔다')
})
