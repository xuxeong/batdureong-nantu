// 플레이어 일지 생성 (DEC-JOURNAL-001~004).
//
// 매 일차 시작에 전날의 확정 사실로 1인칭 일지를 만든다. 1일차 아침에는 전날 기록이
// 없으므로 부르지 않는다 — 그 판단은 클라이언트가 한다.
//
// 엔딩과 **분리된 시스템**이다 (DEC-JOURNAL-004). 프롬프트 원본도 버전도 따로 쓰고,
// 일지 원문은 엔딩 LLM 입력에 전달하지 않는다.
//
// 실패해도 일차 진행을 막지 않는다. 재시도 1회 후 journal_fallbacks.csv 의 승인 문구를
// 쓴다 — 그 선택은 클라이언트가 공포도 구간 × 변화 방향으로 한다 (DEC-JOURNAL-003).
//
// 런타임을 nodejs 로 두는 이유는 ending.ts 와 같다.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateOnce, json, promptBody } from './_llm.ts'

export const config = { runtime: 'nodejs' }

let cachedPrompt: string | null = null
function systemPrompt(): string {
  if (cachedPrompt === null) {
    const path = join(process.cwd(), 'schema', 'journal_prompt_system.md')
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
    return json({ ok: false, reason: 'prompt_missing' }, 500)
  }

  // 출력은 한국어 1~3문장, 200자 이하다 (DEC-JOURNAL-002)
  const call = { system, input, field: 'journal_text', maxChars: 200, maxTokens: 600 }

  let result = await generateOnce(call)
  let retried = false

  if (!result.ok && result.reason !== 'no_api_key') {
    retried = true
    result = await generateOnce(call)
  }

  if (!result.ok) {
    return json({ ok: false, reason: result.reason, retryCount: retried ? 1 : 0 })
  }

  return json({
    ok: true,
    journalText: result.text,
    generatorModelId: result.modelId,
    retryCount: retried ? 1 : 0,
  })
}
