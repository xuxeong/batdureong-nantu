// 부팅 로딩 표시 (DEC-UI-024)
//
// 확정문 첫 줄이다 — *"게임 부팅 시 콘텐츠 데이터를 불러오는 동안 로딩 표시를
// 보여준다"*.
//
// **흐름 밖에 있다.** `scenes/flow.ts` 는 타이틀에서 시작하는데 그 타이틀조차
// 승인 데이터가 들어온 뒤라야 의미가 있다. 로딩과 데이터 오류는 흐름이 시작되기
// **전**의 상태라 `FlowStep` 에 넣지 않고 `main.ts` 가 직접 켜고 끈다.
// 넣었다면 어느 단계에서 어느 단계로 가는지를 상태기계가 답해야 하는데,
// 부팅은 입력으로 옮겨 다니는 것이 아니라 한 번 끝나면 돌아오지 않는다.
//
// 진행률을 표시하지 않는다. 확정문이 "로딩 표시" 로만 정했고, 적재가
// `import.meta.glob` 한 번이라 나눌 단계가 없다 — 가짜 막대를 그리면
// 실제와 무관한 숫자가 화면에 남는다.

import './layout.css'

export interface LoadingScreen {
  show(): void
  hide(): void
  destroy(): void
}

/**
 * 로딩 문구.
 *
 * `DEC-UI-029` 의 두 번째 갈래다 — 지금 무엇을 기다리는지만 알리고 플레이어의
 * 선택을 바꾸지 않는다.
 */
const LOADING_TEXT = '승인 데이터를 불러오는 중…'

export function createLoading(container: HTMLElement): LoadingScreen {
  const root = document.createElement('div')
  root.className = 'loading'
  root.hidden = true

  const text = document.createElement('p')
  text.className = 'loading__text'
  text.textContent = LOADING_TEXT
  root.appendChild(text)
  container.appendChild(root)

  return {
    show() {
      root.hidden = false
    },
    hide() {
      root.hidden = true
    },
    destroy() {
      root.remove()
    },
  }
}
