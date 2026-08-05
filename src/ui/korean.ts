// 화면 문구에서 이름 뒤에 붙는 조사.
//
// 이름은 승인 데이터(`residents.display_name`)에서 오므로 코드가 고를 수밖에 없다.
// `이(가)` 처럼 두 개를 다 적으면 만들다 만 문장으로 읽힌다 — 실제로 8/6 플레이
// 확인에서 `영순 이(가) 돕는다` 가 화면에 그대로 나왔다.
//
// **문구 자체를 데이터로 뺄 수 있는 자리가 아니다.** 승인 데이터가 주는 것은 이름
// 하나이고, 문장은 그 이름을 받는 화면이 만든다. `DEC-UI-029` 기준으로도 조사는
// 플레이어의 선택을 바꾸지 않는다.

/** 한글 음절인가. 아니면 조사를 붙이지 않는다 */
function hasFinalConsonant(syllable: string): boolean | null {
  const code = syllable.charCodeAt(0)
  if (code < 0xac00 || code > 0xd7a3) return null
  // 한글 음절 = 0xAC00 + (초성×21 + 중성)×28 + 종성. 나머지가 종성이다.
  return (code - 0xac00) % 28 !== 0
}

/** 주격 조사 — 받침이 있으면 `이`, 없으면 `가` */
export function subjectParticle(word: string): string {
  const last = word.at(-1)
  if (last === undefined) return ''

  const final = hasFinalConsonant(last)
  if (final === null) return ''
  return final ? '이' : '가'
}

/** 주제 조사 — 받침이 있으면 `은`, 없으면 `는` */
export function topicParticle(word: string): string {
  const last = word.at(-1)
  if (last === undefined) return ''

  const final = hasFinalConsonant(last)
  if (final === null) return ''
  return final ? '은' : '는'
}
