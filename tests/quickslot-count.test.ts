// 퀵슬롯 칸 수 (DEC-INPUT-013).
//
// **칸 수가 두 곳에 있다.** 상태의 `THROWABLE_QUICKSLOT_COUNT` 와 배치표의
// `QUICKSLOT_KEYS` 다. 합칠 수 없는 이유는 `DEC-INPUT-001` 이 키 배치표를
// `input/bindings.ts` 하나로 못박아서 상태 쪽이 키를 만들 수 없기 때문이다.
//
// 갈린 채 어긋나면 **화면에 없는 칸을 가리키는 키**가 생긴다. 눌러도 아무 일이
// 안 일어나므로 조작이 씹힌 것과 구분되지 않고, 콘솔에도 아무것도 안 남는다.
// 8/8 에 5칸에서 4칸으로 줄이면서 실제로 한쪽만 고칠 뻔했다.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { QUICKSLOT_KEYS } from '../src/input/bindings.ts'
import { THROWABLE_QUICKSLOT_COUNT } from '../src/state/types.ts'

test('직접 선택 키 개수와 퀵슬롯 칸 수가 같다', () => {
  assert.equal(
    QUICKSLOT_KEYS.length,
    THROWABLE_QUICKSLOT_COUNT,
    '한쪽만 바꾸면 없는 칸을 가리키는 키가 생긴다 (DEC-INPUT-013)',
  )
})

test('칸 수가 승인된 투척 무기 종류를 담을 수 있다', () => {
  // 승인 데이터가 4종이라 4칸이다. 무기가 늘면 이 테스트가 아니라 DEC 가 먼저
  // 바뀌어야 한다 — 칸 수는 확정 결정이지 데이터에서 계산하는 값이 아니다.
  assert.equal(THROWABLE_QUICKSLOT_COUNT, 4)
})

test('키가 순서대로 1번부터 매겨져 있다', () => {
  // 칸 번호와 키 번호가 같다는 것이 `1~4` 표기의 전제다 (DEC-INPUT-013).
  QUICKSLOT_KEYS.forEach((code, index) => {
    assert.equal(code, `Digit${index + 1}`)
  })
})
