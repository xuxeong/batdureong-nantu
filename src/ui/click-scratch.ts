// 누른 자리에 남는 긁힘 자국 (전성민 8/10)
//
// ── 커서와 다른 물건이다 ───────────────────────────────────
//
// `asset.ui.cursor` 는 늘 떠 있는 그림이고 이쪽은 **누른 순간에만** 잠깐 남는다.
// 그래서 파일도 ID 도 따로다. 커서 그림을 바꿔 끼우는 방식으로는 만들 수 없다 —
// 커서는 한 장뿐이고 시간에 따라 사라지지 않는다.
//
// ── 한 장이 아니라 두세 장이다 ─────────────────────────────
//
// 그림은 한 장(13×40)뿐인데 한 번에 하나만 띄우면 **누를 때마다 같은 도장**이
// 찍힌다. 긁힘은 원래 여러 줄이 나란히 나는 자국이라, 같은 그림을 두세 장
// 조금씩 어긋나게 놓고 시간차를 준다. 각도·간격·개수를 매번 조금씩 흔들어서
// 같은 자리를 연속으로 눌러도 다른 자국이 남는다.
//
// 회전을 쓰는 것은 `DEC-ART-004` 의 "움직임은 위치·크기·투명도로 표현한다"
// 조항과 부딪히지 않는다. 그 조항은 콘텐츠 스프라이트의 애니메이션 정책이고,
// UI 연출에는 타이틀 팻말 흔들림(`layout.css` 의 `title-sign-shake`)이 이미
// 회전을 쓰고 있다.
//
// ── 화면 좌표로 그린다 ─────────────────────────────────────
//
// 무대(1920×1080)가 창 크기에 맞춰 확대·축소되지만 이 자국은 그 안에 들어가지
// 않는다. 커서와 같은 층에 있는 것이라 **화면 좌표에 원래 크기로** 둔다.
// 무대 안에 넣으면 창이 작을 때 자국만 같이 작아져서 커서와 크기가 어긋난다.
//
// ── 스타일을 여기서 만들어 꽂는 이유 ───────────────────────
//
// 그림이 없으면 이 효과 자체가 없다. `layout.css` 에 두면 파일이 없는 빌드에도
// 규칙이 남고, 그림 경로를 아는 곳이 `render/assets.ts` 말고 하나 더 생긴다.
// 커서(`main.ts`)가 같은 이유로 같은 방식을 쓴다.

import { UI_ASSET, assetUrl } from '../render/assets.ts'

/**
 * 자국 하나가 남아 있는 시간. 조작 반응이라 밸런스 수치가 아니다.
 *
 * ── 길게 끈 것이 문제가 아니었다 (8/10) ──
 *
 * 처음엔 520ms 로 늘리고 "다 그어진 채 멈춰 있는" 구간을 뒀는데 버튼이 느린
 * 것으로 느껴졌다. 그래서 240ms 로 줄였더니 이번엔 자국이 눈에 안 남았다.
 *
 * **길이가 아니라 어디에 시간을 쓰느냐가 문제였다.** 문제는 동작이 자국을
 * 기다린 것이지 자국이 오래 남은 것이 아니었다. 그래서 박히는 것은 순간으로
 * 하고, 남는 시간은 전부 **서서히 옅어지는 꼬리**에 쓴다. 그 꼬리는 이미 바뀐
 * 화면 위에서 마저 지워지므로 조작을 붙잡지 않는다.
 */
const LIFE_MS = 820

/**
 * 뒤따르는 자국이 늦게 그어지는 간격.
 *
 * **아주 짧아야 한다.** 45ms 로 뒀더니 셋이 차례로 튀어나와 "좌르륵 뜬다" 로
 * 보였다 (8/10 확인). 손톱 셋이 한 번에 지나가는 것이라 거의 동시여야 하고,
 * 시간차는 완전한 동시를 피할 만큼만 준다.
 */
const STAGGER_MS = 9

/**
 * 한 번 누를 때 나는 자국 수.
 *
 * 처음엔 2~3 이었는데(전성민 8/10 — "한 2개, 많아봤자 3개") 실제로 붙여 보니
 * 셋은 나무판 하나를 덮을 만큼 커서 자국이 아니라 무늬로 보였다. 1~2 로 줄인다.
 */
const MIN_MARKS = 1
const MAX_MARKS = 2

/**
 * 그림 실측 13×40. 원래 크기로 쓴다 — 아트가 정한 크기가 곧 화면 크기다
 * (`DEC-ART-004`).
 */
const WIDTH = 13
const HEIGHT = 40

/**
 * 누른 지점에서 자국 무리까지의 어긋남.
 *
 * 정중앙에 두면 커서 그림에 가려진다. 커서 핫스팟이 왼쪽 위 `2,2` 이고 그림이
 * 55×67 이라, 오른쪽 아래로 살짝 밀어 커서 옆에 나오게 한다.
 */
const OFFSET_X = 8
const OFFSET_Y = 6

/** 긁는 방향의 기울기 범위(도). 0 이면 그림 그대로 세로다 */
const BASE_ANGLE_RANGE = 26
/** 자국끼리 각도가 어긋나는 폭(도). 완전히 나란하면 인쇄물처럼 보인다 */
const ANGLE_JITTER = 7
/** 자국끼리 벌어지는 간격(px). 자기 축에 **수직**으로 벌어진다 */
const SPREAD = 10
/** 사라지는 동안 긁는 방향으로 밀리는 거리(px) */
const DRIFT = 9
/** 자국마다 길이가 달라지는 폭. 셋이 같은 길이면 인쇄물로 보인다 */
const LENGTH_JITTER = 0.18

const CLASS = 'click-scratch'

/** 맞은 판에 잠깐 붙는 표시 */
const HIT_CLASS = 'click-scratch-hit'

/**
 * 맞은 판이 움찔하는 시간.
 *
 * **자국만으로는 꽂힌 것으로 안 읽힌다** (8/10 확인). 판이 가만히 있으면
 * 자국이 그 위에 그려진 것으로 보인다. 맞은 쪽이 반응해야 무언가 박힌 것이 된다.
 */
const HIT_MS = 190

/**
 * 자국이 나는 대상 (전성민 8/10 — "나무 버튼일 때만").
 *
 * 나무 팻말 그림(`--hub-button-image`·`--title-sign-image`·
 * `--day-start-button-image`)이 깔리는 버튼들이다. 아무 데나 누를 때마다 나면
 * 긁힘이 조작의 신호가 아니라 배경 소음이 된다.
 *
 * **아트가 없는 빌드는 신경 쓰지 않아도 된다.** 그때는 긁힘 그림도 없어서
 * 효과 자체가 켜지지 않는다.
 */
const WOOD_BUTTON = [
  '.hub__button', // 정비 기능 버튼 넷
  '.hub__finish', // 정비 종료
  '.hub__action', // 구매·판매·제작·칸 비우기
  '.title__start',
  '.title__settings',
  '.day-start__continue',
  /*
    일시정지를 여는 톱니 나무판. **화면마다 클래스가 다르다** — 필드 HUD 는
    `.hud__settings`, 정비 화면은 `.hub__pause` 다. 같은 그림
    (`asset.ui.settings_button`)이지만 붙는 자리가 달라 둘 다 적어야 한다.

    **창을 여는 나무판이지 창 안의 버튼이 아니다.** 창 안쪽 버튼들
    (`.pause__button`)은 나무가 아니라 CSS 상자라 자국이 나면 안 된다.
  */
  '.hud__settings',
  '.hub__pause',
  /*
    수량 조절 − / + (`step_minus`·`step_plus`).

    **통나무판만 넣는다.** 상점·제작 목록의 항목(`.hub__row`)과 보관함 칸
    (`.hub__slot`)은 나무 *틀* 이지 나무판이 아니라서 뺐다 (전성민 8/10 —
    "그 나무틀 말고, 통으로 나무로 된 애들").
  */
  '.hub__step',
].join(',')

/**
 * 누른 뒤 실제 동작까지 미루는 시간 (전성민 8/10).
 *
 * **박히는 데까지만 기다린다.** 자국이 다 옅어질 때까지 기다리면 연출이 아니라
 * 버튼이 느린 것으로 느껴진다 (8/10 확인). 자국이 제자리에 서는 시점
 * (`LIFE_MS` 의 11% = 90ms, 마지막 자국의 시간차까지 더해 약 108ms) 언저리다.
 *
 * 옅어지는 긴 꼬리는 바뀐 화면 위에서 마저 사라진다 — 자국이 팝업보다 위에
 * 그려지므로(`z-index: 900`) 가려지지 않는다.
 */
const ACTION_DELAY_MS = 95

/**
 * 자국은 나지만 **동작은 미루지 않는** 버튼.
 *
 * `.title__start` 는 이미 자기 지연을 갖고 있다 — 누르면 흔들린 뒤 `SHAKE_MS`
 * 만큼 기다렸다 진입한다 (`ui/title.ts`). 여기서 또 미루면 두 지연이 겹친다.
 *
 * `.hub__action`(구매·판매·제작·칸 비우기)은 **미루면 위험하다.** 지연은
 * 클릭을 붙잡았다 잠시 뒤 같은 버튼에 다시 쏘는 방식인데, 이 버튼은 수량이나
 * 목록이 바뀔 때 함께 다시 그려진다. 그 사이에 노드가 교체되면 다시 쏜 클릭이
 * 갈 곳을 잃어 **한 번 눌렀는데 아무 일도 안 일어난 것처럼 보인다.**
 * 거래는 자원이 걸린 조작이라 그런 위험을 살 자리가 아니다.
 *
 * `.hub__step`(수량 − / +)은 **연타하는 자리다.** 한 번 누를 때마다 95ms 씩
 * 밀리면 수량을 올리는 것이 고통스러워진다. 게다가 누른 결과가 숫자 하나라
 * 기다릴 만한 연출도 아니다.
 *
 * 미루는 쪽은 화면을 여닫기만 하는 버튼들이다. 그것들은 자기 자신이 다시
 * 그려지지 않아 붙잡았다 다시 쏘아도 안전하다.
 */
const NO_DELAY = ['.title__start', '.hub__action', '.hub__step'].join(',')

/** 우리가 다시 쏜 클릭. 이 표시가 없으면 무한히 자기 자신을 가로챈다 */
const REDISPATCHED = new WeakSet<Element>()

/** `-r` ~ `r` 사이의 값 */
function jitter(r: number): number {
  return (Math.random() * 2 - 1) * r
}

/**
 * 클릭 긁힘 효과를 켠다. **그림이 없으면 아무것도 하지 않는다.**
 *
 * @returns 실제로 켰으면 `true`
 */
export function enableClickScratch(): boolean {
  const url = assetUrl(UI_ASSET.cursorClickScratch)
  if (url === null) return false

  const style = document.createElement('style')
  style.textContent = `
.${CLASS} {
  position: fixed;
  width: ${WIDTH}px;
  height: ${HEIGHT}px;
  background: url("${url}") center / contain no-repeat;
  /* 클릭을 먹지 않는다. 자국이 버튼 위에 떠도 그 버튼이 계속 눌려야 한다 */
  pointer-events: none;
  /* 대화창(200)보다 위. 커서 옆에 나오는 것이라 무엇에도 가리지 않는다 */
  z-index: 900;
  opacity: 0;
  /*
    전체 박자는 linear 다. 박히는 구간만 키프레임 안에서 따로 가속을 준다 —
    ease-out 을 통째로 걸면 꼬리가 앞쪽으로 몰려 "서서히 옅어짐" 이 안 된다.
  */
  animation: click-scratch-fade ${LIFE_MS}ms linear forwards;
}

/*
  맞은 판이 움찔한다.

  transform 이 아니라 scale·rotate 를 **따로 쓴다.** 이 둘은 transform 과 별개
  속성이라 겹쳐 적용된다. transform 으로 쓰면 이미 transform 을 가진 판
  (열린 기능 버튼의 translateY 등)의 값을 지워서 애니메이션 동안 판이 튄다.

  깊게 눌렸다가 살짝 튀어 오르고 제자리로 온다. 각도는 아주 조금만 준다 —
  크게 주면 맞은 것이 아니라 흔들리는 것이 된다.
*/
.${HIT_CLASS} {
  animation: click-scratch-hit ${HIT_MS}ms ease-out;
}

@keyframes click-scratch-hit {
  0%   { scale: 1;     rotate: 0deg; }
  16%  { scale: 0.952; rotate: -0.7deg; }
  42%  { scale: 1.014; rotate: 0.35deg; }
  100% { scale: 1;     rotate: 0deg; }
}

/*
  자국이 박힌다.

  clip-path 로 아래에서 위로 순식간에 걷어낸다. clip-path 는 회전 전의 제
  상자에 걸리므로 자국의 제 길이 방향으로 드러난다.

  transform 은 한 속성이라 회전만 적고 끝내면 이동·확대가 지워진다 —
  세 값을 매 프레임 함께 적는다.
  (이 주석은 템플릿 문자열 안이라 백틱을 쓸 수 없다.)
*/
@keyframes click-scratch-fade {
  /*
    들어올 때 제 길이보다 길게 늘어난 채로 온다. 박히는 순간 짧아졌다가
    제 길이로 선다 — 부딪힌 것이 멈추는 모양이다.
  */
  0% {
    opacity: 1;
    clip-path: inset(100% 0 0 0);
    transform: rotate(var(--scratch-angle)) translateY(0)
      scaleY(calc(var(--scratch-length) * 1.35));
    animation-timing-function: cubic-bezier(0.1, 0.85, 0.2, 1);
  }
  /*
    여기서 다 박힌다. 820ms 의 5% — 41ms 다.

    30% 로 뒀을 때는 "그어지는" 것으로, 16% 로 줄였을 때도 여전히 나타나는
    과정이 보였다. 박히는 것은 눈에 과정이 남으면 안 된다 — 결과만 남아야 한다.
  */
  5% {
    opacity: 1;
    clip-path: inset(0 0 0 0);
    transform: rotate(var(--scratch-angle)) translateY(calc(var(--scratch-drift) * 0.55))
      scaleY(calc(var(--scratch-length) * 0.84));
  }
  /*
    박힌 것이 제 길이로 서고 **여기서 자리를 잡는다.**

    이 뒤로는 위치도 크기도 바꾸지 않는다. 옅어지는 동안 계속 밀면 지워지는
    것이 아니라 흘러내리는 것으로 보인다 (8/10 확인). 자국은 박힌 자리에
    가만히 있고 옅어지기만 해야 한다.

    아래 두 마디가 같은 transform 을 되풀이하는 것은 그래서다. 안 적으면
    브라우저가 원래 값으로 되돌리며 자국이 제자리로 미끄러져 올라간다.
  */
  11% {
    opacity: 1;
    transform: rotate(var(--scratch-angle)) translateY(var(--scratch-drift))
      scaleY(var(--scratch-length));
  }
  /*
    여기까지는 또렷하다. 이 구간에서 사람이 자국을 읽는다 —
    그동안 화면은 이미 바뀌어 있고 자국은 그 위에 떠 있다.
  */
  30% {
    opacity: 1;
    transform: rotate(var(--scratch-angle)) translateY(var(--scratch-drift))
      scaleY(var(--scratch-length));
  }
  /* 나머지 70% 를 전부 옅어지는 데만 쓴다 */
  100% {
    opacity: 0;
    clip-path: inset(0 0 0 0);
    transform: rotate(var(--scratch-angle)) translateY(var(--scratch-drift))
      scaleY(var(--scratch-length));
  }
}`
  document.head.appendChild(style)

  /*
    실제 동작을 자국이 그어질 만큼 미룬다.

    누름(capture)에서 클릭을 붙잡아 버튼의 처리기까지 못 가게 막고, 잠시 뒤
    같은 버튼에 클릭을 다시 쏜다. capture 단계라 버튼에 붙은 처리기보다 먼저
    돈다 — 여기서 멈추면 그쪽은 이 클릭을 보지 못한다.

    **다시 쏜 클릭은 표시해 둔다.** 안 그러면 그것도 붙잡혀서 영영 안 나간다.
  */
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const button = target.closest(WOOD_BUTTON)
      if (button === null || button.matches(NO_DELAY)) return

      if (REDISPATCHED.has(button)) {
        REDISPATCHED.delete(button)
        return
      }

      event.preventDefault()
      event.stopPropagation()

      window.setTimeout(() => {
        // 그 사이 화면이 다시 그려져 이 버튼이 문서에서 빠졌으면 그냥 버린다.
        // 떨어져 나간 노드에 클릭을 쏘면 아무 일도 일어나지 않는다.
        if (!button.isConnected || !(button instanceof HTMLElement)) return
        REDISPATCHED.add(button)
        button.click()
      }, ACTION_DELAY_MS)
    },
    true,
  )

  window.addEventListener('pointerdown', (event) => {
    // 주 버튼만이다. 오른쪽·가운데 클릭은 게임 조작이 아니다
    if (event.button !== 0) return

    // 나무 버튼에서만 난다. 아무 데나 나면 조작 신호가 아니라 배경 소음이 된다
    if (!(event.target instanceof Element)) return
    const board = event.target.closest(WOOD_BUTTON)
    if (board === null) return

    /*
      맞은 판을 움찔하게 한다.

      **한 번 뗐다 붙여야 다시 돈다.** 클래스가 이미 붙어 있으면 브라우저는
      같은 애니메이션이 계속되는 것으로 보고 다시 시작하지 않는다. 연타할 때
      두 번째부터 판이 반응하지 않는 것이 그 때문이다.
    */
    board.classList.remove(HIT_CLASS)
    // 지운 것을 브라우저가 실제로 반영하게 한 뒤 다시 붙인다
    void (board as HTMLElement).offsetWidth
    board.classList.add(HIT_CLASS)
    window.setTimeout(() => board.classList.remove(HIT_CLASS), HIT_MS)

    // 한 번의 긁힘은 방향이 하나다. 자국마다 방향이 제각각이면 긁은 자국이
    // 아니라 흩뿌린 자국으로 보인다.
    const baseAngle = jitter(BASE_ANGLE_RANGE)
    const count = MIN_MARKS + Math.floor(Math.random() * (MAX_MARKS - MIN_MARKS + 1))

    // 무리의 가운데가 누른 지점에 오게 첫 자국을 왼쪽으로 물린다
    const firstOffset = -((count - 1) * SPREAD) / 2

    /*
      벌어지는 방향은 **긁는 축에 수직**이다.

      화면 가로로 벌리면 기울어진 자국들이 계단처럼 어긋나 손톱 자국이 아니라
      제각각 찍힌 자국이 된다 (8/10 확인). CSS `rotate(θ)` 는 시계 방향이므로
      제 가로축은 `(cos θ, sin θ)` 를 향한다 — 그 방향으로 벌린다.
    */
    const rad = (baseAngle * Math.PI) / 180
    const acrossX = Math.cos(rad)
    const acrossY = Math.sin(rad)

    for (let i = 0; i < count; i++) {
      const mark = document.createElement('div')
      mark.className = CLASS

      const angle = baseAngle + jitter(ANGLE_JITTER)
      const across = firstOffset + i * SPREAD + jitter(SPREAD * 0.2)
      const along = jitter(HEIGHT * 0.1)

      mark.style.setProperty('--scratch-angle', `${angle.toFixed(1)}deg`)
      mark.style.setProperty('--scratch-drift', `${(DRIFT + jitter(2)).toFixed(1)}px`)
      mark.style.setProperty('--scratch-length', (1 + jitter(LENGTH_JITTER)).toFixed(2))
      // 그림의 좌상단 기준이라 절반씩 빼서 지정한 점이 가운데가 되게 한다
      mark.style.left = `${event.clientX + OFFSET_X + across * acrossX - WIDTH / 2}px`
      mark.style.top = `${event.clientY + OFFSET_Y + across * acrossY + along - HEIGHT / 2}px`
      mark.style.animationDelay = `${i * STAGGER_MS}ms`

      // 애니메이션이 끝나면 스스로 사라진다. 남겨 두면 빠르게 누를수록 쌓인다
      mark.addEventListener('animationend', () => mark.remove())
      document.body.appendChild(mark)
    }
  })

  return true
}
