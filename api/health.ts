// 배포 상태 점검용 엔드포인트.
//
// 게임 로직이 아니라 "서버리스 함수가 실제로 실행되는가"와
// "LLM 키가 이 환경에 등록됐는가"만 확인한다. (개발 로드맵 3-2 ①)
//
// 팀규칙 7절: 특정 호스팅 업체 전용 헬퍼를 쓰지 않고 표준 웹 Request/Response만 쓴다.
// 이 시그니처는 Vercel·Cloudflare·Deno·Netlify에서 그대로 동작하므로
// 배포처를 옮겨도 다시 짜지 않는다.

export default function handler(request: Request): Response {
  if (request.method !== 'GET') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  return json({
    ok: true,
    // 값이 아니라 등록 여부만 노출한다. 키 자체는 어떤 경우에도 응답에 담지 않는다.
    // 비어 있으면 엔딩·일지는 폴백 경로로 동작한다 (.env.example, DEC-JOURNAL-003).
    llmKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    buildMode: process.env.VITE_BUILD_MODE ?? null,
  })
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // 배포 직후 확인용이라 캐시되면 옛 결과를 본다.
      'cache-control': 'no-store',
    },
  })
}
