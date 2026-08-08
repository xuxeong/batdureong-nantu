# A1 확정 목업 · 분리 에셋 인덱스

기준 목업: `assets/source/phase-a/A1_daytime_gameplay_mockup_v6.png`

- 상태: **확정** (2026-08-09 QA 갱신)
- 제작 방식: 목업 단순 크롭 금지. 같은 계열을 통합 시트 한 장에 생성한 뒤 분리한다.
- 다음 수정 시 개별 PNG만 보지 말고 반드시 해당 통합 시트와 A1-v6을 함께 참조한다.

## 통합 시트

| 시트 | 용도 |
|---|---|
| `assets/source/phase-b/sheets/a1_hud_components_sheet_chroma.png` | A1 HUD 10종 공통 원본 |
| `assets/source/phase-b/sheets/a1_background_1920x1080_sheet.png` | 낮 필드 바닥 원본 |
| `assets/source/phase-b/sheets/a1_forest_frame_1920x1080_sheet.png` | 숲 뒤·앞 레이어 공통 원본 |
| `assets/source/phase-b/sheets/a1_farm_plots_sheet_chroma.png` | 경작지 상태 8종 v1 원본 |
| `assets/source/phase-b/sheets/a1_farm_plots_sheet_chroma_v2.png` | v1 8종을 유지하고 토란 2종을 추가한 현재 원본 |

`processed` 중간 폴더는 사용하지 않는다. 통합 원본 시트에서 사람이 직접 분리·투명화한
채택본만 `assets/final/`에 둔다.

## 경작지 상태 시트

현재본 `a1_farm_plots_sheet_chroma_v2.png`는 v1의 4×2 배열을 그대로 유지하고 아래쪽에
세 번째 행을 추가했다. 왼쪽에서 오른쪽 순서는 다음과 같다.

| 행 | 1열 | 2열 | 3열 | 4열 |
|---|---|---|---|---|
| 위 | 씨앗만 뿌림 | 빈 경작지 | 토마토 성장 중 | 토마토 수확 가능 |
| 가운데 | 찹쌀 성장 중 | 찹쌀 수확 가능 | 고추 성장 중 | 고추 수확 가능 |
| 아래 | 비움 | 토란 성장 중 | 토란 수확 가능 | 비움 |

모든 칸은 같은 흙판 베이스와 같은 시점을 사용한다. 성장 중인 칸에는 열매·이삭이 없고,
수확 가능한 칸에만 붉은 열매 또는 황금 이삭을 사용한다. 마젠타 배경은 최종 분리 대상이다.

### 경작지 최종 파일명과 위치

통합 시트는 `source/`에만 둔다. `final/`에는 아래처럼 상태별 투명 PNG를 각각 둔다.
논리 에셋 ID에서 파일 경로를 계산하므로 폴더명과 파일명을 임의로 바꾸지 않는다.

| 상태 | 논리 에셋 ID | 최종 파일 |
|---|---|---|
| 빈 경작지 | `asset.farm_plot.empty` | `assets/final/farm_plot/empty.png` |
| 씨앗만 뿌림 | `asset.crop_seed.common` | `assets/final/crop_seed/common.png` |
| 토마토 성장 중 | `asset.crop_growing.tomato` | `assets/final/crop_growing/tomato.png` |
| 토마토 수확 가능 | `asset.crop_ready.tomato` | `assets/final/crop_ready/tomato.png` |
| 찹쌀 성장 중 | `asset.crop_growing.glutinous_rice` | `assets/final/crop_growing/glutinous_rice.png` |
| 찹쌀 수확 가능 | `asset.crop_ready.glutinous_rice` | `assets/final/crop_ready/glutinous_rice.png` |
| 고추 성장 중 | `asset.crop_growing.chili` | `assets/final/crop_growing/chili.png` |
| 고추 수확 가능 | `asset.crop_ready.chili` | `assets/final/crop_ready/chili.png` |
| 토란 성장 중 | `asset.crop_growing.taro` | **미이관** — 시트에만 있다 |
| 토란 수확 가능 | `asset.crop_ready.taro` | **미이관** — 시트에만 있다 |

모든 파일은 같은 크기의 투명 캔버스와 중앙 기준점을 사용한다.

**토란은 `assets/final/`로 옮기지 않았다.** 바나나를 대체하는 작업이 승인 CSV 여덟 개에
걸쳐 있고 ID를 바꿀지 표시 이름만 바꿀지가 아직 정해지지 않았다 (아트 디렉션 14.5절).
데이터가 정리된 뒤 파일 이름을 확정하고 옮긴다.

**씨앗은 작물별로 나뉘지 않는다.** `DEC-UI-018`이 공용 씨앗을 확정해서 `common` 한 장이고,
`content_assets.csv`에서 네 작물 행이 모두 이 한 ID를 가리킨다. 빈 경작지는
`content_assets.csv`의 부모 후보에 `farm_plots.csv`가 없으므로 `maps.csv`의
`map.prototype_field` 행에 `farm_plot` 역할로 붙인다.

## UI 에셋

| 논리 이름 | 파일 | 픽셀 크기 | 비고 |
|---|---|---:|---|
| `asset.ui.signboard` | `assets/final/ui/signboard.png` | 253×174 | 일차·습격 예고 2단 표지판 |
| `asset.ui.farming_timer` | `assets/final/ui/farming_timer.png` | 911×83 | 동적 채움은 코드 처리 |
| `asset.ui.settings_button` | `assets/final/ui/settings_button.png` | 138×122 | 일시정지·설정 버튼 하나 |
| `asset.ui.player_status_card` | `assets/final/ui/player_status_card.png` | 585×161 | 초상화·이름·체력·수치 자리 |
| `asset.ui.quickslot` | `assets/final/ui/quickslot.png` | 154×145 | 기본 상태 |
| `asset.ui.quickslot_selected` | `assets/final/ui/quickslot_selected.png` | 155×145 | 선택 강조 상태 |
| `asset.ui.recovery_slot` | `assets/final/ui/recovery_slot.png` | 162×166 | 선택 회복 아이템 슬롯 |
| `asset.ui.heal_gauge` | `assets/final/ui/heal_gauge.png` | 38×139 | 동적 채움은 코드 처리 |
| ~~`asset.ui.interaction_prompt`~~ | **사용하지 않음** | — | 행동 안내는 스프라이트 없이 글자만 띄우기로 2026-08-05에 정했다. 시트에는 남아 있으나 `final/`로 옮기지 않는다 |
| `asset.ui.plot_highlight` | `assets/final/ui/plot_highlight.png` | 186×166 | 선택 경작지 외곽선 |

UI 파일은 모두 투명 PNG다. 화면 배치 크기는 파일 크기를 그대로 강제하지 않고 A1-v5의
상대 비율을 기준으로 코드에서 조절한다.

### QA 추가 에셋 — 개발 등록 대기

| 개발팀 등록 요청 논리 ID | 파일 | 픽셀 크기 | 비고 |
|---|---|---:|---|
| `asset.ui.quickslot_count_badge` | `assets/final/ui/quickslot_count_badge.png` | 46×40 | 투척 퀵슬롯·회복 칸 공용 수량 배지. `item_slot_badge.png`의 배지 형태를 기준으로 Figma에서 분리 제작했으며 각 슬롯 우하단에 배치한다 |

이 행은 아트 산출물 인계 기록이다. 논리 ID는 아직 스키마와 구현에 등록되지 않았으며,
등록과 수량 텍스트 합성은 개발팀 작업이다.

## 배경 레이어

| 논리 이름 | 파일 | 픽셀 크기 | 그리는 순서 |
|---|---|---:|---:|
| `asset.background.prototype_field` | `assets/final/background/prototype_field.png` | 1920×1080 | 1 — 밭 바닥과 바깥 숲이 한 장 |
| `asset.ui.field_frame_front` | `assets/final/ui/field_frame_front.png` | 1920×1080 | 3 — 캐릭터·동물보다 앞 |

경작지·작물·농부·야생동물은 위 두 배경 레이어에 포함하지 않는다. 그리는 순서는
`prototype_field → 경작지/작물/캐릭터/동물 → field_frame_front → HUD`다.

**숲 뒤 겹을 따로 두지 않는다.** 두 장으로 뽑아 보니 둘 다 1920×1080 전면 불투명이라
겹치면 하나가 다른 하나를 완전히 가렸고, 둘 사이에 그려지는 것도 없었다. 배경 한 장에
합쳤다 (아트 디렉션 12.2절 A1).

배경은 월드 좌표가 아니라 **화면 중앙**에 맞춰 그린다. 월드는 1600×900이지만 배경은
밭 바깥까지 포함하므로 월드 크기와 같지 않다.

## 새 채팅 수정 요청 규칙

수정할 때 아래 세 가지를 함께 지정한다.

1. 이 인덱스의 논리 이름 또는 파일명
2. 유지할 통합 시트 (`a1_hud_components_sheet_chroma.png`, `a1_background_1920x1080_sheet.png`,
   `a1_forest_frame_1920x1080_sheet.png`, `a1_farm_plots_sheet_chroma_v2.png` 중 해당 파일)
3. 변경할 항목 하나와 반드시 유지할 항목

한 부품을 수정하더라도 통합 시트의 팔레트·선 굵기·명암 단계를 불변 조건으로 둔다.
