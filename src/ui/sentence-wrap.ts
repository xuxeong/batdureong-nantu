// 문장 단위 줄바꿈 (8/10 담당자)
//
// 긴 글을 **문장 경계에서만** 줄바꿈한다. 대사창과 퀵슬롯 확인 창이 같이 쓴다.
//
// ── 왜 CSS 로 안 하나 ──────────────────────────────────────
//
// `keep-all` + 폭 제한은 **어절** 경계에서 접는다. 8/10 낮에 대사창을 21em 으로
// 조여 봤는데 "이 밤" 같은 어절 사이에서 접혀 문장이 어색하게 갈렸다 — 읽는
// 단위는 어절이 아니라 문장이다. 그래서 접을 자리를 코드가 문장 기준으로 정해
// `\n` 을 박고, CSS 는 `white-space: pre-line` 으로 그대로 따른다.
//
// 규칙은 담당자가 정했다: **한 줄 예산 35자, 넘치면 문장 경계에서 다음 줄로.**

/**
 * 한 줄에 담기는 글자 예산.
 *
 * 대사창 실측이다 — 판 폭(1920 의 73% ≈ 1402px)에서 본문 38px 로 35자 안팎이
 * 들어간다 (담당자 8/10 관측). 확인 창도 같은 값을 쓴다 — 판은 더 좁지만
 * 문장들이 그보다 짧아 같은 예산으로 자연스럽게 갈린다.
 */
const LINE_BUDGET = 35

/**
 * 문장 경계에 `\n` 을 넣는다. 전체가 예산 안이면 그대로 돌려준다.
 *
 * 문장들을 앞에서부터 한 줄에 담다가, 다음 문장을 더하면 예산을 넘는 순간
 * 줄을 바꾼다. 문장 하나가 혼자 예산을 넘으면 자르지 않는다 — 그건 박스 폭이
 * 어절 단위로 접는다 (없는 것보다 낫고, 문장 중간을 코드가 자르는 것보다 낫다).
 *
 * 문장 끝은 `.` `!` `?` `…` 의 연속이다 — 대사에 흔한 `…!` 도 한 끝으로 본다.
 */
export function wrapSentences(text: string, limit: number = LINE_BUDGET): string {
  if (text.length <= limit) return text

  const sentences = text.match(/[^.!?…]*[.!?…]+|[^.!?…]+$/g)
  if (sentences === null) return text

  const lines: string[] = []
  let line = ''
  for (const raw of sentences) {
    const sentence = raw.trim()
    if (sentence === '') continue
    if (line === '') {
      line = sentence
    } else if (line.length + 1 + sentence.length <= limit) {
      line = `${line} ${sentence}`
    } else {
      lines.push(line)
      line = sentence
    }
  }
  if (line !== '') lines.push(line)

  return lines.join('\n')
}
