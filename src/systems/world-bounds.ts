// 맵 경계 제한 (DEC-CONTENT-016)
//
// 확정문 두 줄이 근거다.
//
//   유효 좌표 범위는 `0 ≤ x ≤ world_width`, `0 ≤ y ≤ world_height` 로 한다.
//   **플레이어, 야생동물, 적대 주민의 이동 위치는 맵 경계 안으로 제한한다.**
//
// 셋이 각자 움직이므로 제한도 셋으로 흩어진다. 그때 한 곳을 빠뜨리면 "그 개체만
// 밖으로 나간다" 가 되고 원인을 찾기 어렵다 — 실제로 8/6까지 **셋 다** 빠져 있었고
// 플레이 테스트에서 플레이어가 화면 밖으로 걸어 나가는 것으로 드러났다.
// 그래서 규칙을 여기 한 줄로 두고 부르는 곳만 셋으로 둔다.
//
// **반지름만큼 안쪽으로 밀지 않는다.** 확정문이 제한하는 것은 좌표이지 스프라이트가
// 화면에 다 들어오는 것이 아니다. 실제로 A1 배치는 HUD 가 밭 위로 올라오는 것을
// 이미 의도로 받아들였다 (아트 디렉션 14.6).

export interface WorldBounds {
  width: number
  height: number
}

/** 한 축을 `0 ≤ v ≤ max` 로 자른다 */
export function clampAxis(value: number, max: number): number {
  if (value < 0) return 0
  return value > max ? max : value
}

/**
 * 움직인 개체를 맵 안으로 되돌린다. **자리에서 고친다**(mutate).
 *
 * 새 객체를 돌려주면 부르는 쪽이 대입을 빠뜨렸을 때 조용히 안 걸린다 —
 * 그 형태가 바로 이 규칙이 처음에 통째로 빠진 이유다.
 */
export function clampToWorld(entity: { x: number; y: number }, bounds: WorldBounds): void {
  entity.x = clampAxis(entity.x, bounds.width)
  entity.y = clampAxis(entity.y, bounds.height)
}
