// 본문 폰트 적재 (DEC-ART-004)
//
// ── 왜 CSS `@font-face` 가 아닌가 ──────────────────────────
//
// `@font-face` 의 `src:` 는 CSS 변수를 읽지 못한다. 그래서 그쪽으로 가면 파일
// 경로를 스타일시트에 직접 적어야 하고, **경로를 아는 곳이 `render/assets.ts`
// 말고 하나 더 생긴다.** 아트 교체가 한 곳에서 끝나야 한다는 규칙이 깨진다.
//
// `FontFace` 는 URL 을 인자로 받으므로 논리 에셋 ID → URL 해석을 그대로 쓴다.
//
// ── 왜 기다릴 수 있어야 하는가 ────────────────────────────
//
// 캔버스는 CSS 를 거치지 않는다. `ctx.font` 에 아직 안 받은 폰트 이름을 넣으면
// 브라우저가 **조용히 대체 폰트로 그린다.** 실패도 경고도 없다. 그래서 첫
// 그리기 전에 적재가 끝나야 하고, 이 파일이 그 약속을 돌려준다.
//
// ── 실패는 정상 경로다 ────────────────────────────────────
//
// 파일이 없거나 적재가 실패해도 게임을 막지 않는다. `--ui-font` 와 `ctx.font`
// 모두 뒤에 대체 폰트가 있어 글자는 그대로 나온다 — 모양만 시스템 폰트가 된다.
// 아트가 없을 때 플레이스홀더로 계속 도는 것과 같은 원칙이다 (AGENTS.md 6절).

import { FONT_ASSET, FONT_FAMILY, assetUrl } from '../render/assets.ts'

/**
 * 본문 폰트를 등록한다. **예외를 던지지 않는다.**
 *
 * @returns 실제로 적재됐으면 `true`. 파일이 없거나 실패하면 `false` 이고
 *          화면은 대체 폰트로 정상 동작한다.
 */
export async function loadBodyFont(): Promise<boolean> {
  const url = assetUrl(FONT_ASSET.body)
  if (url === null) return false

  // `FontFace` 가 없는 환경(테스트의 DOM 없는 실행 등)에서는 조용히 넘어간다
  if (typeof FontFace === 'undefined' || typeof document === 'undefined') return false

  try {
    const face = new FontFace(FONT_FAMILY, `url(${url})`)
    await face.load()
    document.fonts.add(face)
    return true
  } catch {
    return false
  }
}
