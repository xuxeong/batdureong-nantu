// 엔딩 기록문 생성 (DEC-CONTENT-011).
//
// 시스템이 엔딩을 확정하고 런 결과에 저장한 **뒤에만** 부른다. 이 함수는 서술만
// 만들며 엔딩 종류·제목·주민 결과를 바꾸지 않는다. 실패해도 엔딩 진행을 막지 않는다 —
// 부르는 쪽이 승인된 fallback_record_text 를 쓴다.
//
// API 키는 브라우저에 둘 수 없어 서버리스 함수에 있다. 키가 없으면 폴백이 정상 경로다.
//
// ── 런타임 선언 ────────────────────────────────────────────
//
// health.ts 와 달리 `nodejs` 다. 고정 시스템 지시문을 `schema/ending_prompt_system.md`
// 에서 읽어야 하는데(DEC-PIPELINE-012 — 코드에 문장을 복사하지 않는다) edge 런타임에는
// 파일 시스템이 없다. 핸들러 자체는 표준 Request/Response 만 쓰므로 팀규칙 7절을
// 지킨다. **배포에서 실제로 동작하는지 확인이 필요하다** (로드맵 11-2).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateOnce, json, promptBody } from './_llm.ts'

export const config = { runtime: 'nodejs' }

/** 프롬프트 원본은 한 곳에서만 읽는다 (DEC-PIPELINE-012) */
let cachedPrompt: string | null = null
function systemPrompt(): string {
  if (cachedPrompt === null) {
    const path = join(process.cwd(), 'schema', 'ending_prompt_system.md')
    cachedPrompt = promptBody(readFileSync(path, 'utf8'))
  }
  return cachedPrompt
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let input: unknown
  try {
    input = await request.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  let system: string
  try {
    system = systemPrompt()
  } catch {
    // 프롬프트 원본이 배포에 포함되지 않았다. 문장을 지어내지 않고 실패로 돌려준다.
    return json({ ok: false, reason: 'prompt_missing' }, 500)
  }

  // 같은 확정 입력으로 1회 재시도한다 (DEC-CONTENT-011).
  // 입력을 다시 만들지 않는 것이 요점이다 — 재시도 사이에 사실이 달라지면 안 된다.
  let result = await generateOnce({
    system,
    input,
    field: 'record_text',
    maxChars: 800,
    maxTokens: 2000,
  })
  let retried = false

  if (!result.ok && result.reason !== 'no_api_key') {
    retried = true
    result = await generateOnce({
      system,
      input,
      field: 'record_text',
      maxChars: 800,
      maxTokens: 2000,
    })
  }

  if (!result.ok) {
    // 폴백 문장을 여기서 만들지 않는다. 승인된 fallback_record_text 는 클라이언트가
    // 이미 갖고 있고, 여기서 문장을 지어내면 승인되지 않은 텍스트가 화면에 나온다.
    return json({ ok: false, reason: result.reason, retryCount: retried ? 1 : 0 })
  }

  return json({
    ok: true,
    recordText: result.text,
    // 런 기록에 남길 값 (DEC-CONTENT-011). API 키와 시스템 프롬프트 원문은 넣지 않는다.
    generatorModelId: result.modelId,
    retryCount: retried ? 1 : 0,
  })
}
