/// <reference types="vite/client" />

// .env 로 들어오는 값의 타입. 실제 의미는 .env.example 에 적혀 있다.
//
// VITE_ 접두어가 붙은 값은 브라우저 번들에 그대로 들어간다.
// ANTHROPIC_API_KEY 처럼 노출되면 안 되는 값에는 절대 붙이지 않는다.

interface ImportMetaEnv {
  /**
   * dev        — 공포도 수치와 데이터 검증 오류를 화면에 표시 (DEC-RESIDENT-047, DEC-UI-024)
   * submission — 제출 빌드. 위 개발용 표시를 모두 숨김
   */
  readonly VITE_BUILD_MODE: 'dev' | 'submission'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
