// 한지 판 — CSS 로 뜨는 모든 창의 공통 바탕 (DEC-ART-004, 아트 디렉션 12.2)
//
// ── 왜 공통으로 두나 ───────────────────────────────────────
//
// "CSS 로 뜨는 모든 모달을 한지 스타일로" 는 **성질상 화면을 가로지르는 작업**이다.
// 모달마다 찾아가서 9-slice 를 적으면 대사창·정비 팝업·보관함에 이미 세 벌이
// 복사돼 있는 것이 다섯 벌 여섯 벌이 된다. 그리고 그 순간부터 두 사람이 서로의
// 화면 파일을 열게 된다 (8/8 작업 분담).
//
// 그래서 **판의 모양은 여기 한 곳, 붙이는 것은 각 화면 주인**이 한다.
// 화면 쪽에서 할 일은 이 함수를 한 번 부르는 것뿐이고 CSS 는 안 건드린다.
//
// ── 그림이 없으면 아무것도 안 한다 ─────────────────────────
//
// `panel_border`·`panel_texture` 둘 다 있어야 판이 성립한다. 하나만 붙이면
// 테두리 없는 종이나 속이 빈 액자가 되므로, 하나라도 없으면 그대로 두고
// 각 화면의 플레이스홀더(어두운 판 + 테두리)가 그대로 보이게 한다.
// `AGENTS.md` 6절의 "실제 아트가 없으면 명확한 플레이스홀더" 다.

import { UI_ASSET, assetCssUrl } from '../render/assets.ts'

/** `layout.css` 의 `.panel--hanji` 와 짝이다. 한쪽만 바꾸면 안 붙는다 */
const HANJI_CLASS = 'panel--hanji'

/**
 * 요소를 한지 판으로 만든다.
 *
 * 그림이 붙었으면 `true`. 붙일 그림이 없으면 아무것도 하지 않고 `false` 다 —
 * 부르는 쪽이 플레이스홀더를 따로 되돌릴 필요가 없게 **원래 스타일을 지우지
 * 않는다.**
 */
export function applyHanjiPanel(node: HTMLElement): boolean {
  const border = assetCssUrl(UI_ASSET.panelBorder)
  const texture = assetCssUrl(UI_ASSET.panelTexture)
  if (border === null || texture === null) return false

  node.style.setProperty('--panel-hanji-border', border)
  node.style.setProperty('--panel-hanji-texture', texture)
  node.classList.add(HANJI_CLASS)
  return true
}
