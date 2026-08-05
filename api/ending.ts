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
// health.ts 와 같은 `edge` 다. Node 런타임은 기본 export 를 (req, res) 로 취급해
// 표준 Response 반환이 죽는다 — health.ts 주석이 적어 둔 그대로이고 8/5에 재현했다
// (FUNCTION_INVOCATION_FAILED).
//
// edge 에는 파일 시스템이 없으므로 프롬프트 원본을 읽지 않고 **빌드 시점에 구운
// 모듈**을 가져온다. 원본은 여전히 schema/ending_prompt_system.md 하나이고 이 코드에
// 문장을 복사하지 않는다 (DEC-PIPELINE-012). tools/build-prompts.mjs 참고.

// **`api/` 안의 import 에는 `.ts` 확장자를 붙이지 않는다.** src/ 는 Vite 가 처리해서
// 확장자를 써도 되지만 Vercel 의 edge 번들러는 못 읽고 배포가 통째로 실패한다
// ("referencing unsupported modules"). 8/5에 겪었다.
import { generateOnce, json } from './_llm'
import { ENDING_SYSTEM_PROMPT } from './_prompts'

export const config = { runtime: 'edge' }

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let input: unknown
  try {
    input = await request.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const system = ENDING_SYSTEM_PROMPT

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
