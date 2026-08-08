# 사운드 에셋 인덱스 (SFX · BGM)

기준 대화: 2026-08-07~08 사운드 리스트 정리. 크레딧(제작 방법·도구·프롬프트·라이선스)은
`docs/submission/CREDITS.md`에서 관리한다. 이 문서는 **무엇이 어디 있고, 무엇이 아직
없고, 어떻게 연결하는가**만 다룬다.

- 상태: **진행 중** (2026-08-08)
- SFX 32/32 제작, BGM 6/6 제작

## 해결됨 — 파일 형식

`DEC-ART-003`은 "소리는 MP3"로 일괄 정했었는데, SFX 27종이 전부 `.wav`로 나와서
재출력이 부담스럽다는 담당자 판단에 따라 2026-08-08에 `DEC-ART-004`로 대체했다.
지금은 **배경음(`bgm`)은 MP3, 효과음(`sfx`)은 WAV**가 정식 규칙이다 — 짧은 원샷
효과음은 비압축이 디코딩 지연에 유리하다는 근거를 반영했다. 지금 있는 파일들의
확장자를 그대로 쓰면 된다. 더 손댈 것 없음.

## 해결됨 — sfx·bgm이 UI·시스템 고정 목록에 없던 문제

`DEC-ART-004`는 콘텐츠에 안 붙는 UI·시스템 에셋을 `schema/enums.json`의 고정 목록으로
관리하되 그 목록이 쓸 수 있는 구간을 `ui`, `logo`, `hud`, `font` 넷으로 못박아 `sfx`·
`bgm`이 이 목록 대상이 아니었다. 2026-08-08에 `DEC-ART-005`로 대체해 그 목록이 쓸 수
있는 구간에 `bgm`·`sfx`를 추가했다 — 콘텐츠에 안 붙는 에셋뿐 아니라, `content_assets.csv`의
고유키 `(content_id, asset_role)` 제약으로 한 콘텐츠에 여러 효과음을 못 붙이는 경우
(낫 소리 3종처럼 부모가 `player_base_stats.prototype` 하나로 몰린 경우)도 이 고정 목록으로
등록한다.

**배경음 6종은 8/8 에 등록·연결을 끝냈다** ( 10). 낫 소리 3종은 등록만 됐고 호출부가 남았다.

**8/9 에 전부 붙었다.** 파일 32종 중 31종이 소리를 내고 `record_typing` 하나만 남았다 — 엔딩 기록문 타이핑 연출이 생길 때 붙는다.

(아래는 8/8 시점 기록) `DEC-ART-005`가 규칙만 열었고, 표의 "예정" 항목을
실제로 재생하려면 `schema/enums.json`의 고정 목록에 논리 에셋 ID를 추가하는 스키마
작업이 남아 있다 — 콘텐츠 값 추가가 아니라 스키마 변경이므로 담당자 승인 없이
`content_assets.csv`에 끼워 넣지 않는다.

**재생 코드는 막혀 있지 않다** (2026-08-08). 효과음은 `src/audio/sfx.ts`, 배경음은
`src/audio/bgm.ts`, 음량 세 갈래(`DEC-UI-027`)는 `src/audio/mixer.ts` 와 일시정지
화면에 들어가 있다. 셋 다 논리 에셋 ID 를 받을 뿐이라 고정 목록 등록이 끝나는 대로
그대로 쓴다. **남는 것은 ID 등록과 호출부 한 줄씩이다.**

콘텐츠에 자연스럽게 붙고 (content_id, asset_role) 충돌이 없는 것(야생동물 울음, 작물
속성 상태음)은 이미 `content_assets.csv`로 연결했다. 나머지 SFX·BGM은 특정 작물·무기·
주민·야생동물에 안 붙거나(시스템 레벨 사운드) 낫 소리처럼 부모가 몰려 있어 고정 목록
경로로 간다. 아래 표의 "연결 방식"이 이걸 구분한다.

---

## BGM — `assets/final/bgm/`

전부 제작 완료. 프롬프트는 `CREDITS.md`의 `SND-BGM-001`~`006` 참조.

| 상황 | 파일 | 트리거 | 연결 방식 |
|---|---|---|---|
| 타이틀 화면 | `title.mp3` | `screen.changed` → `title` | **연결됨** (8/8) — `screen.changed` |
| 재배 + 정비 공용 | `farm.mp3` | `field.entered({mode:'farming'})`, `overlay.opened({overlay:'maintenance_hub'})` | **연결됨** (8/8) |
| 습격 전투(일반) | `raid.mp3` | `field.entered({mode:'raid'})`, 2~4일차 | **연결됨** (8/8) |
| 마지막 습격(이장 결투) | `boss.mp3` | `field.entered({mode:'raid'})`, 5일차 | **연결됨** (8/8) |
| 런 실패 화면 | `defeat.mp3` | `run.failed` → `screen.changed({screen:'run_failed'})` | **연결됨** (8/8) |
| 엔딩 화면 공용 | `ending.mp3` | `ending.decided` (화면 진입 시점) | **연결됨** (8/8) |

전투 전 대화·투항 대화는 별도 BGM이 없다 — 진입 시점에 이미 흐르던 트랙(`raid.mp3` 또는
`boss.mp3`)을 그대로 유지한다. 조우 결과·밤 결과 화면의 BGM은 **아직 미정** — 직전 트랙
유지로 갈지 전용 트랙을 둘지 결정 필요.

---

## SFX — `assets/final/sfx/`

### 제작 완료 (32종)

| 파일 | 트리거 | 연결 방식 |
|---|---|---|
| `button_click.wav` | 버튼 클릭 전반 | **연결됨** (8/8) |
| `button_reject.wav` | `request.rejected` | **연결됨** (8/8) |
| `modal_open.wav` | `overlay.opened` | **연결됨** (8/8) |
| `screen_transition.wav` | `screen.changed`, `ending.decided` (화면 전환 자체) | **연결됨** (8/8) |
| `plant_seed.wav` | `farm.planted` | **연결됨** (8/8) |
| `harvest_ready.wav` | `farm.plotReady` (DEC-UI-004 필수 항목) | **연결됨** (8/8) |
| `harvest.wav` | `farm.harvested` | **연결됨** (8/8) |
| `trade_confirm.wav` | `shop.sold`, `shop.bought`, `reward.granted` 공용 | **연결됨** (8/8) |
| `quickslot_switch.wav` | `quickslot.select`(선택 전환), `quickslot.autoSwitched`(자동 전환) 공용 | **연결됨** (8/8) |
| `quickslot_empty.wav` | `quickslot.allEmpty` | **연결됨** (8/8) |
| `sickle_swing.wav` | `combat.sickleSwung` | 가능 — 고정 목록 등록 필요 (`content_assets.csv`는 `(content_id, asset_role)`이 고유키라 `player_base_stats.prototype`에 `sfx` 행을 하나만 붙일 수 있는데 낫 소리가 셋이라 못 씀) |
| `sickle_hit.wav` | 낫 명중 판정 | 가능 — 고정 목록 등록 필요 (위와 동일 사유) |
| `throw.wav` | 투척 무기 발사 (4종 공용) | **연결됨** (8/8) |
| `impact_direct.wav` | 투척 명중 — 고춧가루 주머니·미끈 토란 주머니 | **연결됨** (8/8) |
| `impact_area.wav` | 투척 명중 — 토마토 폭탄·찹쌀풀 병 | **연결됨** (8/8) |
| `burn_tick.wav` | 화상 상태 틱 — `crop_attribute.fiery`·`crop_attribute.mushy` 공용 | **가능** — 두 행이 같은 `asset_id` 참조 |
| `slow_tick.wav` | 감속 상태 걸림 — `crop_attribute.slippery`·`crop_attribute.sticky` 공용 | **가능** — 두 행이 같은 `asset_id` 참조 |
| `player_hit.wav` | `combat.playerDamaged` | 가능 — 고정 목록 등록 필요 (위와 동일 사유) |
| `recovery_start.wav` | `recovery.started` | **연결됨** (8/8) |
| `recovery_complete.wav` | `recovery.completed` | **연결됨** (8/8) |
| `wildlife_crow_cry.wav` | 까마귀 스폰 시점 | **가능** — `wildlife.crow` |
| `wildlife_deer_cry.wav` | 고라니 스폰 시점 | **가능** — `wildlife.water_deer` |
| `wildlife_boar_cry.wav` | 멧돼지 스폰 시점 | **가능** — `wildlife.boar` |
| `wildlife_defeat.wav` | 야생동물 처치 (공통) | **연결됨** (8/8) |
| `dialogue_open.wav` | `dialogue.opened` | **연결됨** (8/8) |
| `resident_defeat.wav` | `encounter.finished({finalOutcome:'killed'})` — 막타 | **연결됨** (8/8) |
| `record_typing.wav` | `ending.recordReady` 표시 중 | **연결됨** (8/8) |
| `day_start_none.wav` | `day_start` 화면, 조용한 밤 | **연결됨** (8/9) — 화면이 승인 일정의 `raid_type` 으로 고르고 소리는 고정 목록에서 온다 |
| `day_start_raid.wav` | `day_start` 화면, 일반 습격 | **연결됨** (8/9). `day_start_none.wav`와 동일 파일 — 의도적으로 같은 소리를 쓴다(2026-08-08, 전성민) |
| `day_start_final.wav` | `day_start` 화면, 마지막 습격 | **연결됨** (8/9) |
| `run_failed.wav` | `run.failed` 발생 순간의 스팅어. `defeat.mp3`(BGM)와 별개로 유지 확정 | **연결됨** (8/8) |
| `ending_decided.wav` | `ending.decided` 순간, 화면 전환음과 별개로 유지하기로 함 | **연결됨** (8/8) |

습격 예고 3종 + 일차 시작을 하나로 합친 결과다. 원래 있던 `raid_notice_none/raid/final`과
`day_start`를 대체한다 — 그 4개 파일명은 이제 쓰지 않는다.

### 뺀 것 (재추가하지 않는다)

| 항목 | 뺀 이유 |
|---|---|
| `modal_close.wav` (모달·오버레이 닫기) | `modal_open`과 짝으로 제안했으나 필요 없다고 판단(2026-08-08, 전성민) |
| 데이터 오류 알림 | `data.error`는 승인 데이터가 검증을 통과하면 정상 플레이에서 발생하지 않는 개발자용 안전망이다. 시각 표시만으로 충분 |
| 퀵슬롯 편성 변경 | 정비 단계 로드아웃 조작. 버튼 클릭음으로 충분하다고 판단 |
| 제작 성공 / 실패 | 버튼 클릭·거절음으로 충분 |
| 레시피 해금 | 화면에 짚어줄 시각적 순간이 없어서, 있으면 언제 왜 울렸는지 못 찾는다. 화면 연출이 먼저 생기면 재검토 |
| 플레이어 체력 위험 경고 | 트리밍 |
| 회복 진행 루프 / 취소 | 트리밍 |
| 대화 선택 확정 / 협상 수락 / 투항 발동 | 버튼 클릭음으로 충분 |
| 메뉴 항목 이동(호버) | 이 게임 조작이 대부분 클릭 즉시 확정이라 호버 신호음을 붙일 이유가 약함 |
| 일시정지 열기·닫기 | 버튼 클릭음으로 충분 |

---

## 수정할 때

1. 이 문서의 파일명 또는 트리거 이벤트명을 지정한다.
2. `DEC-ART-005`(2026-08-08)가 고정 목록 구간에 `sfx`·`bgm`을 이미 열어 뒀다. "가능"으로
   표시된 항목은 `schema/enums.json`의 고정 목록에 논리 에셋 ID를 추가하는 스키마
   작업만 남았다 — 콘텐츠 값 추가가 아니므로 담당자 승인 없이 임의로 등록하지 않는다.
   8/9 기준 "예정" 은 남아 있지 않다.
