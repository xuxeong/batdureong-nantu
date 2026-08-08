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

/**
 * 승인 문구의 `{player_name}` 을 실제 이름으로 바꾼다.
 *
 * ── 왜 데이터에 이름을 안 넣나 ─────────────────────────────
 *
 * 플레이어 이름은 매 런마다 새로 입력받는 값이라 승인 데이터에 있을 수 없다.
 * 데이터가 갖는 것은 **"여기에 이름이 들어간다" 는 표시**뿐이고 값은 화면이
 * 채운다 — 엔딩 LLM 프롬프트가 `player_name` 을 입력으로 넘기는 것과 같은 구조다.
 *
 * ── 조사를 같이 고친다 ─────────────────────────────────────
 *
 * 자리표시자 **바로 뒤에 붙은 조사**까지 함께 본다. 데이터에는 읽기 좋은 한
 * 형태만 적고(`{player_name}는`) 실제 조사는 이름의 받침이 정한다.
 *
 *   전성민 → `전성민은`   ·   영희 → `영희는`
 *
 * **`(은)는` 처럼 둘을 병기하지 않는다.** 8/6 에 `영순 이(가) 돕는다` 가 화면에
 * 그대로 나온 적이 있고, 만들다 만 문장으로 읽힌다 (이 파일 머리 주석).
 *
 * 자리표시자가 없는 문구는 손대지 않는다 — 치환은 있는 자리만 바꾼다.
 */
const PLAYER_NAME_PLACEHOLDER = /\{player_name\}(은|는|이|가)?/g

export function fillPlayerName(text: string, playerName: string): string {
  return text.replace(PLAYER_NAME_PLACEHOLDER, (_match, particle: string | undefined) => {
    if (particle === undefined) return playerName
    // 데이터가 어느 쪽을 적었든 짝을 보고 고른다. 주제(은/는)와 주격(이/가)은
    // 뜻이 달라서 서로 바꾸면 안 된다.
    const chosen =
      particle === '은' || particle === '는' ? topicParticle(playerName) : subjectParticle(playerName)
    return `${playerName}${chosen}`
  })
}
