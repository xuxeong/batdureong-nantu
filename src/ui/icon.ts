// 항목 아이콘 (DEC-ART-002, 아트 디렉션 14.8·14.9, DEC-UI-002, DEC-UI-006)
//
// 보관함 칸·상점 목록·제작 목록과 입력 표·퀵슬롯 칸이 같이 쓴다.
//
// **경로를 여기서 만들지 않는다.** 논리 에셋 ID 를 `render/assets.ts` 에 넘겨
// 번들 URL 을 받는다. 그 파일이 경로를 아는 유일한 곳이다 (AGENTS.md 6절).
//
// 그림이 없으면 **빈 칸이 아니라 아무것도 만들지 않는다.** 부르는 쪽이 이름을
// 그대로 두면 되고, 빈 사각형을 두면 "그림이 깨졌나" 로 읽힌다.

import { assetCssUrl } from '../render/assets.ts'
import './layout.css'

/**
 * 아이콘 요소를 만든다. 그림이 없으면 null.
 *
 * @param assetId `asset.icon.*` 논리 에셋 ID
 * @param className 크기를 바꾸고 싶을 때 덧붙일 클래스
 */
export function createIcon(
  assetId: string | null | undefined,
  className?: string,
): HTMLElement | null {
  const url = assetCssUrl(assetId)
  if (url === null) return null

  const node = document.createElement('div')
  node.className = className === undefined ? 'icon' : `icon ${className}`
  node.style.setProperty('--icon-image', url)
  return node
}

/** 그림이 있는가. 이름을 같이 둘지 판단할 때 쓴다 (14.8) */
export function hasIcon(assetId: string | null | undefined): boolean {
  return assetCssUrl(assetId) !== null
}
