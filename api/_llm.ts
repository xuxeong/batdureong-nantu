// 엔딩·일지 LLM 호출의 공통 부분 (DEC-CONTENT-011, DEC-JOURNAL-001~004)
//
// ── 이 파일이 지키는 것 ────────────────────────────────────
//
// **프롬프트 문장을 여기 적지 않는다.** 고정 시스템 지시문의 단일 원본은
// `schema/ending_prompt_system.md` 와 `schema/journal_prompt_system.md` 다
// (DEC-PIPELINE-012, DEC-JOURNAL-004). 빌드 시점에 구운 `_prompts.ts` 를 통해
// 전달받을 뿐이다.
//
// **시스템이 사실을 먼저 확정하고 LLM 은 서술만 한다.** 여기서 게임 상태를 바꾸거나
// 엔딩을 고르지 않는다. 입력은 게임이 이미 확정한 JSON 그대로 전달한다.
//
// **실패는 정상 경로다.** 키가 없거나 응답이 규격을 벗어나면 실패로 돌려주고,
// 부르는 쪽이 승인된 폴백 문구를 쓴다 (DEC-JOURNAL-003). 여기서 문장을 지어내지 않는다.

import Anthropic from '@anthropic-ai/sdk'

/**
 * 생성 모델은 환경변수로 교체할 수 있어야 한다.
 *
 * `DEC-PIPELINE-012` 가 "생성 모델 변경은 프롬프트 버전 증가 사유가 아니며 런타임
 * 기록의 `generator_model_id` 로 구분한다"고 확정했다. 코드에 박으면 그 취지가 깨진다.
 * 여기 있는 값은 환경변수가 없을 때의 기본 모델이며 게임 데이터가 아니다.
 */
const DEFAULT_MODEL = 'claude-opus-5'

export function modelId(): string {
  const configured = process.env.ANTHROPIC_MODEL
  return configured === undefined || configured === '' ? DEFAULT_MODEL : configured
}

export type LlmFailure =
  /** 이 환경에 키가 없다. 폴백이 정상 경로다 (.env.example) */
  | 'no_api_key'
  /** 네트워크·시간 초과·5xx */
  | 'request_failed'
  /** 응답이 JSON 구조나 길이·형식 제약을 벗어났다 */
  | 'invalid_response'

export type LlmResult =
  | { ok: true; text: string; modelId: string }
  | { ok: false; reason: LlmFailure }

export interface GenerateOptions {
  /** 고정 시스템 지시문 원문. 파일에서 읽어 그대로 넘긴다 */
  system: string
  /** 시스템이 확정한 사실 JSON */
  input: unknown
  /** 출력 JSON 객체의 유일한 필드 이름 (`record_text` 또는 `journal_text`) */
  field: string
  /** 최대 글자 수. 초과하면 실패로 처리한다 */
  maxChars: number
  maxTokens: number
}

/**
 * 마크다운과 목록을 쓰지 않았는가 (DEC-CONTENT-011, DEC-JOURNAL-002).
 *
 * 규격을 어긴 응답을 다듬어서 쓰지 않는다. 다듬으면 "무엇이 승인된 문장인지"가
 * 흐려지고, 어긴 사실 자체가 기록에 남지 않는다. 실패로 보고하고 폴백을 쓴다.
 */
function looksPlain(text: string): boolean {
  if (/^\s*[-*+]\s/m.test(text)) return false // 목록
  if (/^\s*\d+\.\s/m.test(text)) return false // 번호 목록
  if (/^\s*#/m.test(text)) return false // 제목
  if (/\*\*|__|`/.test(text)) return false // 강조·코드
  return true
}

/**
 * 한 번 호출한다. 재시도는 부르는 쪽이 한다 (DEC-CONTENT-011, DEC-JOURNAL-003).
 *
 * 재시도를 여기 넣지 않는 이유는 "같은 확정 입력으로 1회 재시도" 가 규칙이라
 * 입력을 만든 쪽이 그 동일성을 보장해야 하기 때문이다.
 */
export async function generateOnce(options: GenerateOptions): Promise<LlmResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (apiKey === undefined || apiKey === '') return { ok: false, reason: 'no_api_key' }

  const model = modelId()
  const client = new Anthropic({ apiKey })

  let response
  try {
    response = await client.messages.create({
      model,
      max_tokens: options.maxTokens,
      system: options.system,
      // 출력을 필드 하나짜리 JSON 객체로 제한한다 (DEC-CONTENT-011).
      // 프롬프트로만 부탁하지 않고 스키마로 강제한다.
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: { [options.field]: { type: 'string' } },
            required: [options.field],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: 'user',
          // 확정된 사실만 넘긴다. 플레이어 이름을 포함해 전부 인용된 데이터이며
          // 지시로 해석하지 않는 것은 시스템 지시문이 맡는다.
          content: JSON.stringify(options.input),
        },
      ],
    })
  } catch {
    return { ok: false, reason: 'request_failed' }
  }

  // 안전 분류기가 거절하면 content 가 비어 있다. 폴백으로 간다.
  if (response.stop_reason === 'refusal') return { ok: false, reason: 'invalid_response' }

  const block = response.content.find((b) => b.type === 'text')
  if (block === undefined || block.type !== 'text') {
    return { ok: false, reason: 'invalid_response' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(block.text)
  } catch {
    return { ok: false, reason: 'invalid_response' }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, reason: 'invalid_response' }
  }

  const keys = Object.keys(parsed as Record<string, unknown>)
  if (keys.length !== 1 || keys[0] !== options.field) {
    return { ok: false, reason: 'invalid_response' }
  }

  const text = (parsed as Record<string, unknown>)[options.field]
  if (typeof text !== 'string') return { ok: false, reason: 'invalid_response' }

  const trimmed = text.trim()
  if (trimmed.length === 0) return { ok: false, reason: 'invalid_response' }
  if (trimmed.length > options.maxChars) return { ok: false, reason: 'invalid_response' }
  if (!looksPlain(trimmed)) return { ok: false, reason: 'invalid_response' }

  return { ok: true, text: trimmed, modelId: model }
}

/** JSON 응답. 캐시하지 않는다 — 같은 런에서도 매번 다른 결과다 */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
